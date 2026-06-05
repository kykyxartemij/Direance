import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cached, invalidateCache } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import { handleApiError } from '@/lib/errorHandler';
import { API } from '@/lib/apiUrl';
import { requireAuth } from '@/auth';
import { ApiError } from '@/models/api-error';
import { checkUserRequestLimit } from '@/lib/rateLimiter';
import { checkUserDbLimits } from '@/lib/userLimits';
import { parseIdFromRoute } from '@/models';
import {
  CreateConnectionValidator,
  UpdateConnectionValidator,
  FetchFiltersValidator,
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

export async function getLightConnections(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
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
  } catch (error) {
    return handleApiError(error, 'GET', API.connection.light());
  }
}

export async function getPagedConnections(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
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
  } catch (error) {
    return handleApiError(error, 'GET', API.connection.paged(0, 0));
  }
}

export async function getConnectionById(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
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
  } catch (error) {
    return handleApiError(error, 'GET', API.connection.byId(':id'));
  }
}

// ==== CRUD ====

export async function createConnection(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);
    await checkUserDbLimits(userId, permissions);

    const body = await req.json();
    const { secret, mappingId, ...rest } = await CreateConnectionValidator.validate(body, { abortEarly: false });

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
  } catch (error) {
    return handleApiError(error, 'POST', API.connection.list());
  }
}

export async function updateConnection(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);
    await checkUserDbLimits(userId, permissions);

    const id = parseIdFromRoute(await params);

    const body = await req.json();
    const { secret, mappingId, ...rest } = await UpdateConnectionValidator.validate(body, { abortEarly: false });

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
  } catch (error) {
    return handleApiError(error, 'PATCH', API.connection.byId(':id'));
  }
}

export async function deleteConnection(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);
    await checkUserDbLimits(userId, permissions);

    const id = parseIdFromRoute(await params);

    const { count } = await prisma.connection.deleteMany({ where: { id, userId } });
    if (count === 0) throw new ApiError('Connection not found', 404);

    invalidateCache(...CACHE_KEYS.connection.invalidate(userId));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, 'DELETE', API.connection.byId(':id'));
  }
}

// ==== Fetch (BE proxies external API call) ====

export async function fetchFromConnection(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);

    const id = parseIdFromRoute(await params);
    const body = await req.json().catch(() => ({}));
    const filters = await FetchFiltersValidator.validate(body, { abortEarly: false });

    // Owner-scoped lookup includes encrypted secret; never persists to FE cache.
    const row = await prisma.connection.findFirstOrThrow({
      where: { id, userId },
      select: { id: true, type: true, reportType: true, config: true, secret: true },
    });

    const secret = await decryptSecret<ConnectionSecret>(row.secret);
    const result = await runConnectionDriver({
      type: row.type as ConnectionType,
      reportType: row.reportType,
      config: row.config as Record<string, unknown>,
      secret,
      filters,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'POST', API.connection.fetch(':id'));
  }
}
