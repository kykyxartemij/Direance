import 'server-only';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cached, invalidateCache } from '@/lib/serverCache';
import { createBatchLoader } from '@/lib/batchLoader';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import { withHandler } from '@/lib/withHandler';
import { getAuth } from '@/lib/requestContext';
import { ApiError } from '@/models/api-error';
import { checkUserRequestLimit } from '@/lib/rateLimiter';
import { checkUserDbLimits } from '@/lib/userLimits';
import { parseIdFromRoute } from '@/models';
import {
  CreateConnectionValidator,
  UpdateConnectionValidator,
  FetchFiltersValidator,
  FetchManyValidator,
  type ConnectionType,
  type ConnectionSecret,
} from '@/models/connection.models';
import { parsePaginationFromUrl, createPaginatedResponse } from '@/models/paginated-response.model';
import { parseFreeTextFromUrl } from '@/lib/normalizeText';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import { runConnectionDriver } from '@/lib/connections';

// ==== Select ====
// `secret` is NEVER returned to FE — only decrypted server-side in fetch endpoint.

const CONNECTION_SELECT_LIGHT = {
  id: true,
  name: true,
  type: true,
  reportType: true,
  isDefault: true,
  mapping: { select: { id: true, name: true } },
} as const;

const CONNECTION_SELECT_PAGED = {
  id: true,
  name: true,
  type: true,
  reportType: true,
  isDefault: true,
  mapping: { select: { id: true, name: true } },
} as const;

const CONNECTION_SELECT = {
  id: true,
  name: true,
  type: true,
  reportType: true,
  isDefault: true,
  config: true,
  mapping: { select: { id: true, name: true } },
} as const;

// ==== HTTP handlers ====

export const getLightConnections = withHandler(async (req) => {
  const { userId, permissions } = getAuth();
  await checkUserRequestLimit(req, userId, permissions);

  const list = await cached(
    () =>
      prisma.connection.findMany({
        where: { userId },
        select: CONNECTION_SELECT_LIGHT,
        orderBy: { name: 'asc' },
      }),
    CACHE_KEYS.connection.light(userId),
  );

  return NextResponse.json(list);
});

export const getPagedConnections = withHandler(async (req) => {
  const { userId, permissions } = getAuth();
  await checkUserRequestLimit(req, userId, permissions);

  const searchParams = new URL(req.url).searchParams;
  const { page, pageSize } = await parsePaginationFromUrl(searchParams);
  const freeText = parseFreeTextFromUrl(searchParams);

  const where = { userId };
  const [data, total] = await Promise.all([
    cached(
      () =>
        prisma.connection.findManyFts({
          freeText,
          userId,
          where,
          select: CONNECTION_SELECT_PAGED,
          orderBy: { name: 'asc' },
          skip: page * pageSize,
          take: pageSize,
        }),
      CACHE_KEYS.connection.paged(userId, page, pageSize, freeText),
    ),
    cached(
      () => prisma.connection.countFts({ freeText, userId, where }),
      CACHE_KEYS.connection.count(userId, freeText),
    ),
  ]);

  return NextResponse.json(createPaginatedResponse(data, page, pageSize, total));
});

export const getConnectionById = withHandler<{ id: string }>(async (req, { params }) => {
  const { userId, permissions } = getAuth();
  await checkUserRequestLimit(req, userId, permissions);

  const id = parseIdFromRoute(await params);

  const connection = await cached(
    () =>
      prisma.connection.findFirstOrThrow({
        where: { id, userId },
        select: CONNECTION_SELECT,
      }),
    CACHE_KEYS.connection.byId(userId, id),
  );

  return NextResponse.json(connection);
});

// ==== CRUD ====

export const createConnection = withHandler(async (req) => {
  const { userId, permissions } = getAuth();
  const { secret, mappingId, ...rest } = await CreateConnectionValidator.validate(await req.json(), { abortEarly: false });

  await checkUserRequestLimit(req, userId, permissions);
  await checkUserDbLimits(userId, permissions);

  const encrypted = await encryptSecret(secret);

  const connection = await prisma.connection.create({
    data: {
      ...rest,
      userId,
      secret: encrypted,
      ...(mappingId ? { mappingId } : {}),
    },
    select: CONNECTION_SELECT,
  });

  invalidateCache(...CACHE_KEYS.connection.invalidate(userId));
  await cached(() => Promise.resolve(connection), CACHE_KEYS.connection.byId(userId, connection.id));

  return NextResponse.json(connection, { status: 201 });
});

export const updateConnection = withHandler<{ id: string }>(async (req, { params }) => {
  const { userId, permissions } = getAuth();
  const id = parseIdFromRoute(await params);
  const { secret, mappingId, ...rest } = await UpdateConnectionValidator.validate(await req.json(), { abortEarly: false });

  await checkUserRequestLimit(req, userId, permissions);
  await checkUserDbLimits(userId, permissions);

  const data: Record<string, unknown> = { ...rest };
  if (secret) data.secret = await encryptSecret(secret);
  if (mappingId !== undefined) data.mappingId = mappingId;

  const results = await prisma.connection.updateManyAndReturn({
    where: { id, userId },
    data,
    select: CONNECTION_SELECT,
  });
  if (results.length === 0) throw new ApiError('Connection not found', 404);
  const connection = results[0];

  invalidateCache(...CACHE_KEYS.connection.invalidate(userId));
  await cached(() => Promise.resolve(connection), CACHE_KEYS.connection.byId(userId, id));

  return NextResponse.json(connection);
});

export const deleteConnection = withHandler<{ id: string }>(async (req, { params }) => {
  const { userId, permissions } = getAuth();
  await checkUserRequestLimit(req, userId, permissions);

  const id = parseIdFromRoute(await params);

  const { count } = await prisma.connection.deleteMany({ where: { id, userId } });
  if (count === 0) throw new ApiError('Connection not found', 404);

  invalidateCache(...CACHE_KEYS.connection.invalidate(userId));
  return new NextResponse(null, { status: 204 });
});

// ==== Fetch (BE proxies external API call) ====

export const fetchFromConnection = withHandler<{ id: string }>(async (req, { params }) => {
  const { userId, permissions } = getAuth();
  const id = parseIdFromRoute(await params);
  const body = await req.json().catch(() => ({}));
  const filters = await FetchFiltersValidator.validate(body, { abortEarly: false });

  await checkUserRequestLimit(req, userId, permissions);

  const result = await cached(
    async () => {
      const row = await prisma.connection.findFirstOrThrow({
        where: { id, userId },
        select: { id: true, type: true, reportType: true, config: true, secret: true },
      });
      const secret = await decryptSecret<ConnectionSecret>(row.secret);
      return runConnectionDriver({
        type: row.type as ConnectionType,
        reportType: row.reportType,
        config: row.config as Record<string, unknown>,
        secret,
        filters,
      });
    },
    CACHE_KEYS.connection.fetch(userId, id, filters),
  );
  
  return NextResponse.json(result);
});

// ==== Fetch many (batch by ids — 1 DB call for cache misses, N cache entries) ====

export const fetchFromConnectionsByIds = withHandler(async (req) => {
  const { userId, permissions } = getAuth();
  const { ids, ...filters } = await FetchManyValidator.validate(await req.json(), { abortEarly: false });

  await checkUserRequestLimit(req, userId, permissions);

  const loadRow = createBatchLoader(
    (batchIds: string[]) =>
      prisma.connection.findMany({
        where: { id: { in: batchIds }, userId },
        select: { id: true, type: true, reportType: true, config: true, secret: true },
      }),
    (row: { id: string }) => row.id,
  );

  const entries = await Promise.all(
    ids.map(async (id: string) => {
      const result = await cached(
        async () => {
          const row = await loadRow(id);
          if (!row) throw new ApiError('Connection not found', 404);
          const secret = await decryptSecret<ConnectionSecret>(row.secret);
          return runConnectionDriver({
            type: row.type as ConnectionType,
            reportType: row.reportType,
            config: row.config as Record<string, unknown>,
            secret,
            filters,
          });
        },
        CACHE_KEYS.connection.fetch(userId, id, filters),
      );
      return [id, result] as const;
    }),
  );

  return NextResponse.json(Object.fromEntries(entries));
});