import 'server-only';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cached, invalidateCache } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import { withHandler } from '@/lib/withHandler';
import { getAuth, getClientIp } from '@/lib/requestContext';
import { ApiError } from '@/models/api-error';
import { checkUserRequestLimit } from '@/lib/rateLimiter';
import { checkUserDbLimits } from '@/lib/userLimits';
import { parseIdFromRoute } from '@/models';
import {
  CreateExportSettingValidator,
  UpdateExportSettingValidator,
  EXPORT_SETTING_SELECT_LIGHT,
  EXPORT_SETTING_SELECT_PAGED,
  EXPORT_SETTING_SELECT,
} from '@/models/export-settings.models';
import { parsePaginationFromUrl, createPaginatedResponse } from '@/models/paginated-response.model';
import { parseFreeTextFromUrl } from '@/lib/normalizeText';

// ==== HTTP handlers ====

export const getLightExportSettings = withHandler(async () => {
  const { userId, permissions } = getAuth();
  const ip = getClientIp();

  const light = await cached(
    async () => {
      await checkUserRequestLimit(ip, userId, permissions);
      return prisma.exportSetting.findMany({
        where: { userId },
        select: EXPORT_SETTING_SELECT_LIGHT,
        orderBy: { name: 'asc' },
      });
    },
    CACHE_KEYS.exportSetting.light(userId),
  );

  return NextResponse.json(light);
});

export const getPagedExportSettings = withHandler(async (req) => {
  const { userId, permissions } = getAuth();
  const ip = getClientIp();

  const searchParams = new URL(req.url).searchParams;
  const { page, pageSize } = await parsePaginationFromUrl(searchParams);
  const freeText = parseFreeTextFromUrl(searchParams);

  const where = { userId };
  const [data, total] = await Promise.all([
    cached(
      async () => {
        await checkUserRequestLimit(ip, userId, permissions);
        return prisma.exportSetting.findManyFts({
          freeText,
          userId,
          where,
          select: EXPORT_SETTING_SELECT_PAGED,
          orderBy: { name: 'asc' },
          skip: page * pageSize,
          take: pageSize,
        });
      },
      CACHE_KEYS.exportSetting.paged(userId, page, pageSize, freeText),
    ),
    cached(
      () => prisma.exportSetting.countFts({ freeText, userId, where }),
      CACHE_KEYS.exportSetting.count(userId, freeText),
    ),
  ]);

  return NextResponse.json(createPaginatedResponse(data, page, pageSize, total));
});

export const getExportSettingById = withHandler<{ id: string }>(async (req, { params }) => {
  const { userId, permissions } = getAuth();
  const ip = getClientIp();

  const id = parseIdFromRoute(await params);

  const settings = await cached(
    async () => {
      await checkUserRequestLimit(ip, userId, permissions);
      return prisma.exportSetting.findFirstOrThrow({
        where: { id, userId },
        select: EXPORT_SETTING_SELECT,
      });
    },
    CACHE_KEYS.exportSetting.byId(userId, id),
  );

  return NextResponse.json(settings);
});

// ==== CRUD ====

export const createExportSetting = withHandler(async (req) => {
  const { userId, permissions } = getAuth();
  const ip = getClientIp();

  const { headerLayout, logoId, ...rest } = await CreateExportSettingValidator.validate(await req.json(), { abortEarly: false });

  await checkUserRequestLimit(ip, userId, permissions);
  await checkUserDbLimits(userId, permissions);

  const settings = await prisma.exportSetting.create({
    data: {
      ...rest,
      userId,
      ...(headerLayout != null ? { headerLayout } : {}),
      ...(logoId ? { logoId } : {}),
    },
    select: EXPORT_SETTING_SELECT,
  });

  invalidateCache(...CACHE_KEYS.exportSetting.invalidate(userId));
  await cached(() => Promise.resolve(settings), CACHE_KEYS.exportSetting.byId(userId, settings.id));

  return NextResponse.json(settings, { status: 201 });
});

export const updateExportSetting = withHandler<{ id: string }>(async (req, { params }) => {
  const { userId, permissions } = getAuth();
  const ip = getClientIp();

  const id = parseIdFromRoute(await params);
  const { headerLayout, logoId, ...rest } = await UpdateExportSettingValidator.validate(await req.json(), { abortEarly: false });

  await checkUserRequestLimit(ip, userId, permissions);
  await checkUserDbLimits(userId, permissions);

  const results = await prisma.exportSetting.updateManyAndReturn({
    where: { id, userId },
    data: {
      ...rest,
      ...(headerLayout != null ? { headerLayout } : {}),
      ...(logoId !== undefined ? { logoId } : {}),
    },
    select: EXPORT_SETTING_SELECT,
  });
  if (results.length === 0) throw new ApiError('Export setting not found', 404);
  const meta = results[0];

  invalidateCache(...CACHE_KEYS.exportSetting.invalidate(userId));
  await cached(() => Promise.resolve(meta), CACHE_KEYS.exportSetting.byId(userId, id));

  return NextResponse.json(meta);
});

export const deleteExportSetting = withHandler<{ id: string }>(async (req, { params }) => {
  const { userId, permissions } = getAuth();
  const ip = getClientIp();

  const id = parseIdFromRoute(await params);

  await checkUserRequestLimit(ip, userId, permissions);

  const { count } = await prisma.exportSetting.deleteMany({ where: { id, userId } });
  if (count === 0) throw new ApiError('Export setting not found', 404);

  invalidateCache(...CACHE_KEYS.exportSetting.invalidate(userId));
  return new NextResponse(null, { status: 204 });
});
