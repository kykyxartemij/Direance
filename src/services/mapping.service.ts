import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cached, invalidateCache } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import { handleApiError } from '@/lib/errorHandler';
import { requireAuth } from '@/auth';
import { ApiError } from '@/models/api-error';
import { checkUserDbLimits } from '@/lib/userLimits';
import { parseIdFromRoute } from '@/models';
import { MappingCreateValidator, MappingUpdateValidator } from '@/models/mapping.models';
import { parsePaginationFromUrl, createPaginatedResponse } from '@/models/paginated-response.model';
import { checkUserRequestLimit } from '@/lib/rateLimiter';

// ==== Select ====

// Light — id + name only, dropdowns and lightweight lists
const MAPPING_SELECT_LIGHT = {
  id: true,
  name: true,
} as const;

// Paged — list view, no config (heavy field)
const MAPPING_SELECT_PAGED = {
  id: true,
  name: true,
  isGlobal: true,
  reportType: true,
  exportSetting: { select: { id: true, name: true } },
} as const;

// Full — detail view, adds config and full exportSetting
const MAPPING_SELECT = {
  id: true,
  name: true,
  isGlobal: true,
  reportType: true,
  config: true,
  exportSetting: { select: { id: true, name: true, mappedValueNames: true } },
} as const;

// ==== HTTP handlers ====

export async function getLightMappings(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);

    const mappings = await cached(
      () =>
        prisma.fieldMapping.findMany({
          where: { OR: [{ userId }, { isGlobal: true }] },
          select: MAPPING_SELECT_LIGHT,
          orderBy: { name: 'asc' },
        }),
      CACHE_KEYS.mapping.light(userId),
    );

    return NextResponse.json(mappings);
  } catch (error) {
    return handleApiError(error, 'GET /api/mapping/light');
  }
}

export async function getPagedMappings(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);

    const { page, pageSize } = await parsePaginationFromUrl(new URL(req.url).searchParams);

    // TODO: FreeText implementation
    const where = { OR: [{ userId }, { isGlobal: true }] };
    const [data, total] = await Promise.all([
      cached(
        () =>
          prisma.fieldMapping.findMany({
            where,
            select: MAPPING_SELECT_PAGED,
            orderBy: { name: 'asc' },
            skip: page * pageSize,
            take: pageSize,
          }),
        CACHE_KEYS.mapping.paged(userId, page, pageSize),
      ),
      cached(
        () => prisma.fieldMapping.count({ where }),
        CACHE_KEYS.mapping.count(userId),
      ),
    ]);

    return NextResponse.json(createPaginatedResponse(data, page, pageSize, total));
  } catch (error) {
    return handleApiError(error, 'GET /api/mapping/paged');
  }
}

export async function getMappingById(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);

    const id = parseIdFromRoute(await params);

    const mapping = await cached(
      () =>
        prisma.fieldMapping.findFirstOrThrow({
          where: { id, OR: [{ userId }, { isGlobal: true }] },
          select: MAPPING_SELECT,
        }),
      CACHE_KEYS.mapping.byId(id),
    );

    return NextResponse.json(mapping);
  } catch (error) {
    return handleApiError(error, 'GET /api/mapping/:id');
  }
}

// ==== CRUD ====

export async function createMapping(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);
    await checkUserDbLimits(userId, permissions);
    
    const body = await req.json();
    // TODO: Allow isGlobal when admin functionality is implemented
    const data = await MappingCreateValidator.validate(body, { abortEarly: false });

    const mapping = await prisma.fieldMapping.create({
      data: { ...data, userId, isGlobal: false },
      select: MAPPING_SELECT,
    });

    invalidateCache(...CACHE_KEYS.mapping.invalidate());
    await cached(() => Promise.resolve(mapping), CACHE_KEYS.mapping.byId(mapping.id));

    return NextResponse.json(mapping, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/mapping');
  }
}

export async function updateMapping(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);
    await checkUserDbLimits(userId, permissions);

    const id = parseIdFromRoute(await params);

    const body = await req.json();
    // TODO: Allow isGlobal updates when admin functionality is implemented
    const data = await MappingUpdateValidator.validate(body, { abortEarly: false });

    const results = await prisma.fieldMapping.updateManyAndReturn({
      where: { id, userId },
      data,
      select: MAPPING_SELECT,
    });
    if (results.length === 0) throw new ApiError('Mapping not found', 404);
    const mapping = results[0];

    invalidateCache(...CACHE_KEYS.mapping.invalidate());
    await cached(() => Promise.resolve(mapping), CACHE_KEYS.mapping.byId(id));

    return NextResponse.json(mapping);
  } catch (error) {
    return handleApiError(error, 'PATCH /api/mapping/:id');
  }
}

export async function deleteMapping(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);

    const id = parseIdFromRoute(await params);

    // TODO: Allow isGlobal deletion when admin functionality is implemented
    const { count } = await prisma.fieldMapping.deleteMany({ where: { id, userId } });
    if (count === 0) throw new ApiError('Mapping not found', 404);

    invalidateCache(...CACHE_KEYS.mapping.invalidate());
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/mapping/:id');
  }
}
