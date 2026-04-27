import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cached, invalidateCache } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import { handleApiError } from '@/lib/errorHandler';
import { requireAuth } from '@/auth';
import { ApiError } from '@/models/api-error';
import { checkUserRequestLimit } from '@/lib/rateLimiter';
import { checkUserDbLimits } from '@/lib/userLimits';
import { parseIdFromRoute } from '@/models';
import {
  CreateExportSettingValidator,
  UpdateExportSettingValidator,
} from '@/models/export-settings.models';
import { parsePaginationFromUrl, createPaginatedResponse } from '@/models/paginated-response.model';

// ==== Select ====

// Light — id + name only, dropdowns and lightweight lists
const EXPORT_SETTING_SELECT_LIGHT = {
  id: true,
  name: true,
} as const;

// Paged — list view, no logo fields (logo changes never invalidate this cache group)
const EXPORT_SETTING_SELECT_PAGED = {
  id: true,
  name: true,
  applyHeaderToAllSheets: true,
  includeOriginalSheets: true,
  mappedValueNames: true,
} as const;

// Full — detail view, adds headerLayout and logo metadata (no bytes — bytes can't survive JSON caching)
const EXPORT_SETTING_SELECT = {
  ...EXPORT_SETTING_SELECT_PAGED,
  headerLayout: true,
  logo: { select: { id: true, mime: true, name: true } },
} as const;

// ==== HTTP handlers ====

export async function getLightExportSettings(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);

    const light = await cached(
      () =>
        prisma.exportSetting.findMany({
          where: { userId },
          select: EXPORT_SETTING_SELECT_LIGHT,
          orderBy: { name: 'asc' },
        }),
      CACHE_KEYS.exportSetting.light(userId),
    );

    return NextResponse.json(light);
  } catch (error) {
    return handleApiError(error, 'GET /api/export-settings/light');
  }
}

export async function getPagedExportSettings(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);

    const { page, pageSize } = await parsePaginationFromUrl(new URL(req.url).searchParams);

    // TODO: FreeText implementation
    const where = { userId };
    const [data, total] = await Promise.all([
      cached(
        () =>
          prisma.exportSetting.findMany({
            where,
            select: EXPORT_SETTING_SELECT_PAGED,
            orderBy: { name: 'asc' },
            skip: page * pageSize,
            take: pageSize,
          }),
        CACHE_KEYS.exportSetting.paged(userId, page, pageSize)
      ),
      cached(() => prisma.exportSetting.count({ where }), CACHE_KEYS.exportSetting.count(userId)),
    ]);

    return NextResponse.json(createPaginatedResponse(data, page, pageSize, total));
  } catch (error) {
    return handleApiError(error, 'GET /api/export-settings/paged');
  }
}

export async function getExportSettingById(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);

    const id = parseIdFromRoute(await params);

    const settings = await cached(
      () =>
        prisma.exportSetting.findFirstOrThrow({
          where: { id, userId },
          select: EXPORT_SETTING_SELECT,
        }),
      CACHE_KEYS.exportSetting.byId(id)
    );

    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error, 'GET /api/export-settings/:id');
  }
}

// ==== CRUD ====

export async function createExportSetting(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);
    await checkUserDbLimits(userId, permissions);

    const body = await req.json();
    const { headerLayout, logoId, ...rest } = await CreateExportSettingValidator.validate(body, { abortEarly: false });

    const settings = await prisma.exportSetting.create({
      data: {
        ...rest,
        userId,
        ...(headerLayout != null ? { headerLayout } : {}),
        ...(logoId ? { logoId } : {}),
      },
      select: EXPORT_SETTING_SELECT,
    });

    invalidateCache(...CACHE_KEYS.exportSetting.invalidate());
    await cached(() => Promise.resolve(settings), CACHE_KEYS.exportSetting.byId(settings.id));

    return NextResponse.json(settings, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/export-settings');
  }
}

export async function updateExportSetting(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);
    await checkUserDbLimits(userId, permissions);

    const id = parseIdFromRoute(await params);

    const body = await req.json();
    const { headerLayout, logoId, ...rest } = await UpdateExportSettingValidator.validate(body, { abortEarly: false });

    const settings = await prisma.exportSetting.updateManyAndReturn({
      where: { id, userId },
      data: {
        ...rest,
        ...(headerLayout != null ? { headerLayout } : {}),
        ...(logoId !== undefined ? { logoId } : {}),
      },
      select: EXPORT_SETTING_SELECT,
    });
    if (settings.length === 0) throw new ApiError('Export setting not found', 404);
    const meta = settings[0];

    invalidateCache(...CACHE_KEYS.exportSetting.invalidate());
    await cached(() => Promise.resolve(meta), CACHE_KEYS.exportSetting.byId(id));

    return NextResponse.json(meta);
  } catch (error) {
    return handleApiError(error, 'PATCH /api/export-settings/:id');
  }
}

export async function deleteExportSetting(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);
    await checkUserDbLimits(userId, permissions);

    const id = parseIdFromRoute(await params);

    // deleteMany with userId in where — single query, 0 count means not found or wrong owner
    const { count } = await prisma.exportSetting.deleteMany({ where: { id, userId } });
    if (count === 0) throw new ApiError('Export setting not found', 404);

    invalidateCache(...CACHE_KEYS.exportSetting.invalidate());
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/export-settings/:id');
  }
}
