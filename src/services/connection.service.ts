import 'server-only';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cached, invalidateCache, setCache } from '@/lib/serverCache';
import { createBatchLoader } from '@/lib/batchLoader';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import { withHandler } from '@/lib/withHandler';
import { getAuth, getClientIp } from '@/lib/requestContext';
import { ApiError } from '@/models/api-error';
import { checkUserRequestLimit } from '@/lib/rateLimiter';
import { checkUserDbLimits } from '@/lib/userLimits';
import { parseIdFromRoute } from '@/models';
import {
  CreateConnectionValidator,
  UpdateConnectionValidator,
  TestConnectionValidator,
  ConnectionFilterValidator,
  PnlFetchManyValidator,
  FinancialPositionFetchManyValidator,
  PnlFetchValidator,
  FinancialPositionFetchValidator,
  CONNECTION_SELECT_LIGHT,
  CONNECTION_SELECT_PAGED,
  CONNECTION_SELECT,
  type ConnectionType,
  type ConnectionSecret,
} from '@/models/connection.models';
import { parsePaginationFromUrl, createPaginatedResponse, parseFiltersFromUrl, whereFromFilters } from '@/models/paginated-response.model';
import { parseFreeTextFromUrl } from '@/lib/normalizeText';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import { runPnlConnectionDriver, runFinancialPositionConnectionDriver, testPnlConnectionDriver, testFinancialPositionConnectionDriver } from '@/lib/connections';
import { MAPPING_SELECT } from '@/models/mapping.models';

// ==== HTTP handlers ====
// #region Connections

export const getLightConnections = withHandler(async () => {
  const { userId, permissions } = getAuth();
  const ip = getClientIp();

  const list = await cached(
    async () => {
      await checkUserRequestLimit(ip, userId, permissions);
      return prisma.connection.findMany({
        where: { userId },
        select: CONNECTION_SELECT_LIGHT,
        orderBy: { name: 'asc' },
      });
    },
    CACHE_KEYS.connection.light(userId),
  );

  return NextResponse.json(list);
});

export const getPagedConnections = withHandler(async (req) => {
  const { userId, permissions } = getAuth();
  const ip = getClientIp();

  const searchParams = new URL(req.url).searchParams;
  const { page, pageSize } = await parsePaginationFromUrl(searchParams);
  const freeText = parseFreeTextFromUrl(searchParams);
  const filters = await parseFiltersFromUrl(searchParams, ConnectionFilterValidator);

  const where = { userId, ...whereFromFilters(filters) };
  const [data, total] = await Promise.all([
    cached(
      async () => {
        await checkUserRequestLimit(ip, userId, permissions);
        return prisma.connection.findManyFts({
          freeText,
          where,
          select: CONNECTION_SELECT_PAGED,
          orderBy: { name: 'asc' },
          skip: page * pageSize,
          take: pageSize,
        });
      },
      CACHE_KEYS.connection.paged(userId, page, pageSize, freeText, filters.type, filters.reportType),
    ),
    cached(
      () => prisma.connection.countFts({ freeText, where }),
      CACHE_KEYS.connection.count(userId, freeText, filters.type, filters.reportType),
    ),
  ]);

  return NextResponse.json(createPaginatedResponse(data, page, pageSize, total));
});

export const getConnectionById = withHandler<{ id: string }>(async (req, { params }) => {
  const { userId, permissions } = getAuth();
  const ip = getClientIp();

  const id = parseIdFromRoute(await params);

  const connection = await cached(
    async () => {
      await checkUserRequestLimit(ip, userId, permissions);
      return prisma.connection.findFirstOrThrow({
        where: { id, userId },
        select: CONNECTION_SELECT,
      });
    },
    CACHE_KEYS.connection.byId(userId, id),
  );

  return NextResponse.json(connection);
});

// ==== CRUD ====

export const createConnection = withHandler(async (req) => {
  const { userId, permissions } = getAuth();
  const ip = getClientIp();

  const { secret, mappingId, ...rest } = await CreateConnectionValidator.validate(await req.json(), { abortEarly: false });

  await checkUserRequestLimit(ip, userId, permissions);
  await checkUserDbLimits(userId, permissions);

  const encrypted = await encryptSecret(secret);

  // NOTE: mappingId is not verified against the caller (no ownership/isGlobal check) —
  // same as logoId in export-settings.service.ts. Tracked as a known gap, fix TBD.
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
  await setCache(connection, CACHE_KEYS.connection.byId(userId, connection.id));

  return NextResponse.json(connection, { status: 201 });
});

export const updateConnection = withHandler<{ id: string }>(async (req, { params }) => {
  const { userId, permissions } = getAuth();
  const ip = getClientIp();

  const id = parseIdFromRoute(await params);
  const { secret, mappingId, ...rest } = await UpdateConnectionValidator.validate(await req.json(), { abortEarly: false });

  await checkUserRequestLimit(ip, userId, permissions);
  await checkUserDbLimits(userId, permissions);

  // NOTE: mappingId is not verified against the caller — same known gap as createConnection above.
  const connection = await prisma.connection.update({
    where: { id, userId },
    data: {
      ...rest,
      ...(secret ? { secret: await encryptSecret(secret) } : {}),
      ...(mappingId !== undefined ? { mappingId } : {}),
    },
    select: CONNECTION_SELECT,
  });

  invalidateCache(...CACHE_KEYS.connection.invalidate(userId));
  await setCache(connection, CACHE_KEYS.connection.byId(userId, id));

  return NextResponse.json(connection);
});

export const deleteConnection = withHandler<{ id: string }>(async (req, { params }) => {
  const { userId, permissions } = getAuth();
  const ip = getClientIp();

  const id = parseIdFromRoute(await params);

  await checkUserRequestLimit(ip, userId, permissions);

  await prisma.connection.delete({ where: { id, userId } });

  invalidateCache(...CACHE_KEYS.connection.invalidate(userId));
  return new NextResponse(null, { status: 204 });
});

// #endregion
// #region Pnl

// ==== Fetch — Profit & Loss (BE proxies external API call) ====

export const testPnlConnection = withHandler(async (req) => {
  const { type, config, secret } = await TestConnectionValidator.validate(await req.json(), { abortEarly: false });
  await testPnlConnectionDriver({ type, config, secret: secret as ConnectionSecret });
  return new NextResponse(null, { status: 204 });
});

export const fetchProfitConnectionsByIds = withHandler(async (req) => {
  const { userId, permissions } = getAuth();
  const ip = getClientIp();

  const { ids, ...filters } = await PnlFetchManyValidator.validate(await req.json(), { abortEarly: false });

  await checkUserRequestLimit(ip, userId, permissions);

  const loadRow = createBatchLoader(
    (batchIds: string[]) =>
      prisma.connection.findMany({
        where: { id: { in: batchIds }, userId, reportType: 'pnl' },
        select: { id: true, type: true, reportType: true, config: true, secret: true, mapping: { select: MAPPING_SELECT } },
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
          const report = await runPnlConnectionDriver({
            type: row.type as ConnectionType,
            config: row.config as Record<string, unknown>,
            secret,
            filters,
          });
          return { ...report, mapping: row.mapping };
        },
        CACHE_KEYS.connection.fetch(userId, 'pnl', id, filters),
      );
      return [id, result] as const;
    }),
  );

  return NextResponse.json(Object.fromEntries(entries));
});

export const fetchProfitConnectionById = withHandler<{ id: string }>(async (req, { params }) => {
  const { userId, permissions } = getAuth();
  const ip = getClientIp();

  const id = parseIdFromRoute(await params);
  const filters = await PnlFetchValidator.validate(await req.json(), { abortEarly: false });

  const result = await cached(
    async () => {
      await checkUserRequestLimit(ip, userId, permissions);
      const row = await prisma.connection.findFirstOrThrow({
        where: { id, userId, reportType: 'pnl' },
        select: { type: true, config: true, secret: true, mapping: { select: MAPPING_SELECT } },
      });
      const secret = await decryptSecret<ConnectionSecret>(row.secret);
      const report = await runPnlConnectionDriver({
        type: row.type as ConnectionType,
        config: row.config as Record<string, unknown>,
        secret,
        filters,
      });
      return { ...report, mapping: row.mapping };
    },
    CACHE_KEYS.connection.fetch(userId, 'pnl', id, filters),
  );

  return NextResponse.json(result);
});

// #endregion
// #region Financial Position


// ==== Fetch — Financial Position (BE proxies external API call) ====

export const testFinancialPositionConnection = withHandler(async (req) => {
  const { type, config, secret } = await TestConnectionValidator.validate(await req.json(), { abortEarly: false });
  await testFinancialPositionConnectionDriver({ type, config, secret: secret as ConnectionSecret });
  return new NextResponse(null, { status: 204 });
});

export const fetchFinancialPositionConnectionsByIds = withHandler(async (req) => {
  const { userId, permissions } = getAuth();
  const ip = getClientIp();

  const { ids, ...filters } = await FinancialPositionFetchManyValidator.validate(await req.json(), { abortEarly: false });

  await checkUserRequestLimit(ip, userId, permissions);

  const loadRow = createBatchLoader(
    (batchIds: string[]) =>
      prisma.connection.findMany({
        where: { id: { in: batchIds }, userId, reportType: 'financial_position' },
        select: { id: true, type: true, reportType: true, config: true, secret: true, mapping: { select: MAPPING_SELECT } },
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
          const report = await runFinancialPositionConnectionDriver({
            type: row.type as ConnectionType,
            config: row.config as Record<string, unknown>,
            secret,
            filters,
          });
          return { ...report, mapping: row.mapping };
        },
        CACHE_KEYS.connection.fetch(userId, 'financial_position', id, filters),
      );
      return [id, result] as const;
    }),
  );

  return NextResponse.json(Object.fromEntries(entries));
});

export const fetchFinancialPositionConnectionById = withHandler<{ id: string }>(async (req, { params }) => {
  const { userId, permissions } = getAuth();
  const ip = getClientIp();

  const id = parseIdFromRoute(await params);
  const filters = await FinancialPositionFetchValidator.validate(await req.json(), { abortEarly: false });

  const result = await cached(
    async () => {
      await checkUserRequestLimit(ip, userId, permissions);
      const row = await prisma.connection.findFirstOrThrow({
        where: { id, userId, reportType: 'financial_position' },
        select: { type: true, config: true, secret: true, mapping: { select: MAPPING_SELECT } },
      });
      const secret = await decryptSecret<ConnectionSecret>(row.secret);
      const report = await runFinancialPositionConnectionDriver({
        type: row.type as ConnectionType,
        config: row.config as Record<string, unknown>,
        secret,
        filters,
      });
      return { ...report, mapping: row.mapping };
    },
    CACHE_KEYS.connection.fetch(userId, 'financial_position', id, filters),
  );

  return NextResponse.json(result);
});

// #endregion