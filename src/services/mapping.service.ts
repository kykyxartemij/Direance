import 'server-only';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cached, invalidateCache } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import { withHandler } from '@/lib/withHandler';
import { getAuth } from '@/lib/requestContext';
import { ApiError } from '@/models/api-error';
import { checkUserDbLimits } from '@/lib/userLimits';
import { parseIdFromRoute } from '@/models';
import { CreateMappingValidator, UpdateMappingValidator } from '@/models/mapping.models';
import { parsePaginationFromUrl, createPaginatedResponse } from '@/models/paginated-response.model';
import { parseFreeTextFromUrl } from '@/lib/normalizeText';
import { checkUserRequestLimit } from '@/lib/rateLimiter';
import { hasPermission, Permission } from '@/lib/permissions';

// ==== Select ====

// Light — id + name only, dropdowns and lightweight lists
const MAPPING_SELECT_LIGHT = {
  id: true,
  name: true,
  reportType: true,
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
export const MAPPING_SELECT = {
  id: true,
  name: true,
  isGlobal: true,
  reportType: true,
  config: true,
  exportSetting: { select: { id: true, name: true, mappedValues: true, hasTotalColumn: true } },
} as const;

// ==== HTTP handlers ====

export const getLightMappings = withHandler(async (req) => {
  const { userId, permissions } = getAuth();
  await checkUserRequestLimit(req, userId, permissions);

  const reportType = new URL(req.url).searchParams.get('reportType') ?? undefined;

  const mappings = await cached(
    () =>
      prisma.fieldMapping.findMany({
        where: {
          OR: [{ userId }, { isGlobal: true }],
          ...(reportType ? { reportType } : {}),
        },
        select: MAPPING_SELECT_LIGHT,
        orderBy: { name: 'asc' },
      }),
    CACHE_KEYS.mapping.light(userId, reportType),
  );

  return NextResponse.json(mappings);
});

export const getPagedMappings = withHandler(async (req) => {
  const { userId, permissions } = getAuth();
  await checkUserRequestLimit(req, userId, permissions);

  const searchParams = new URL(req.url).searchParams;
  const { page, pageSize } = await parsePaginationFromUrl(searchParams);
  const freeText = parseFreeTextFromUrl(searchParams);

  const where = { OR: [{ userId }, { isGlobal: true }] };
  const [data, total] = await Promise.all([
    cached(
      () =>
        prisma.fieldMapping.findManyFts({
          freeText,
          userId,
          where,
          select: MAPPING_SELECT_PAGED,
          orderBy: { name: 'asc' },
          skip: page * pageSize,
          take: pageSize,
        }),
      CACHE_KEYS.mapping.paged(userId, page, pageSize, freeText),
    ),
    cached(
      () => prisma.fieldMapping.countFts({ freeText, userId, where }),
      CACHE_KEYS.mapping.count(userId, freeText),
    ),
  ]);

  return NextResponse.json(createPaginatedResponse(data, page, pageSize, total));
});

export const getMappingById = withHandler<{ id: string }>(async (req, { params }) => {
  const { userId, permissions } = getAuth();
  await checkUserRequestLimit(req, userId, permissions);

  const id = parseIdFromRoute(await params);

  const mapping = await cached(
    () =>
      prisma.fieldMapping.findFirstOrThrow({
        where: { id, OR: [{ userId }, { isGlobal: true }] },
        select: MAPPING_SELECT,
      }),
    CACHE_KEYS.mapping.byId(userId, id),
  );

  return NextResponse.json(mapping);
});

// ==== CRUD ====

export const createMapping = withHandler(async (req) => {
  const { userId, permissions } = getAuth();
  const data = await CreateMappingValidator.validate(await req.json(), { abortEarly: false });

  await checkUserRequestLimit(req, userId, permissions);
  await checkUserDbLimits(userId, permissions);

  const canModifyGlobal = hasPermission(permissions, Permission.CAN_MODIFY_GLOBAL);
  if (!canModifyGlobal && data.isGlobal) throw new ApiError('Only users with permission CAN_MODIFY_GLOBAL can create global mappings.', 403);

  const mapping = await prisma.fieldMapping.create({
    data: { ...data, userId },
    select: MAPPING_SELECT,
  });

  invalidateCache(...CACHE_KEYS.mapping.invalidate(userId));
  if (data.isGlobal) invalidateCache(...CACHE_KEYS.mapping.invalidateAll());
  await cached(() => Promise.resolve(mapping), CACHE_KEYS.mapping.byId(userId, mapping.id));

  return NextResponse.json(mapping, { status: 201 });
});

export const updateMapping = withHandler<{ id: string }>(async (req, { params }) => {
  const { userId, permissions } = getAuth();
  const id = parseIdFromRoute(await params);
  const data = await UpdateMappingValidator.validate(await req.json(), { abortEarly: false });

  await checkUserRequestLimit(req, userId, permissions);
  await checkUserDbLimits(userId, permissions);

  const canModifyGlobal = hasPermission(permissions, Permission.CAN_MODIFY_GLOBAL);
  if (!canModifyGlobal && data.isGlobal) throw new ApiError('Only users with permission CAN_MODIFY_GLOBAL can modify global mappings.', 403);
  const where = canModifyGlobal
    ? { id, OR: [{ userId }, { isGlobal: true }] }
    : { id, userId, isGlobal: false };

  const results = await prisma.fieldMapping.updateManyAndReturn({
    where,
    data,
    select: MAPPING_SELECT,
  });
  if (results.length === 0) throw new ApiError('Mapping not found', 404);
  const mapping = results[0];

  invalidateCache(...CACHE_KEYS.mapping.invalidate(userId));
  if (mapping.isGlobal) invalidateCache(...CACHE_KEYS.mapping.invalidateAll());
  await cached(() => Promise.resolve(mapping), CACHE_KEYS.mapping.byId(userId, id));

  return NextResponse.json(mapping);
});

export const deleteMapping = withHandler<{ id: string }>(async (req, { params }) => {
  const { userId, permissions } = getAuth();
  await checkUserRequestLimit(req, userId, permissions);

  const id = parseIdFromRoute(await params);

  const canModifyGlobal = hasPermission(permissions, Permission.CAN_MODIFY_GLOBAL);
  const where = canModifyGlobal
    ? { id, OR: [{ userId }, { isGlobal: true }] }
    : { id, userId, isGlobal: false };

  const deleted = await prisma.fieldMapping.deleteManyAndReturn({
    where,
    select: { isGlobal: true },
  });
  if (deleted.length === 0) throw new ApiError('Mapping not found', 404);

  invalidateCache(...CACHE_KEYS.mapping.invalidate(userId));
  if (deleted[0].isGlobal) invalidateCache(...CACHE_KEYS.mapping.invalidateAll());
  return new NextResponse(null, { status: 204 });
});
