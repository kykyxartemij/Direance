import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { cached, invalidateCache } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import { handleApiError } from '@/lib/errorHandler';
import { requireAuth } from '@/auth';
import { ApiError } from '@/models/api-error';
import { parseIdFromRoute } from '@/models';
import {
  ExportSettingCreateValidator,
  ExportSettingUpdateValidator,
} from '@/models/export-settings.models';
import { parsePaginationFromUrl, createPaginatedResponse } from '@/models/paginated-response.model';

// ==== Select ====

// Light — paged list view, no logo fields (logo changes never invalidate this cache group)
const EXPORT_SETTING_SELECT_LIGHT = {
  id: true,
  name: true,
  applyHeaderToAllSheets: true,
  includeOriginalSheets: true,
  mappedValueNames: true,
} as const;

// Full — detail view, adds logo metadata (no bytes — bytes can't survive JSON caching)
const EXPORT_SETTING_SELECT = {
  ...EXPORT_SETTING_SELECT_LIGHT,
  headerLayout: true,
  logoMime: true,
  logoName: true,
} as const;

// ==== Logo helpers ====

const LOGO_MAX_BYTES = 200 * 1024; // 200 KB
const LOGO_MAX_WIDTH = 800;

async function processLogo(buffer: Buffer): Promise<Buffer> {
  let result = await sharp(buffer)
    .resize(LOGO_MAX_WIDTH, undefined, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  if (result.length > LOGO_MAX_BYTES) {
    result = await sharp(buffer)
      .resize(LOGO_MAX_WIDTH, undefined, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 65 })
      .toBuffer();
  }

  if (result.length > LOGO_MAX_BYTES) {
    result = await sharp(buffer)
      .resize(600, undefined, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 60 })
      .toBuffer();
  }

  return result;
}

// ==== HTTP handlers ====

export async function getLightExportSettings(): Promise<NextResponse> {
  try {
    const userId = await requireAuth();

    const light = await cached(
      () =>
        prisma.exportSetting.findMany({
          where: { userId },
          select: { id: true, name: true },
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
    const userId = await requireAuth();
    const { page, pageSize } = await parsePaginationFromUrl(new URL(req.url).searchParams);

    // TODO: FreeText implementation
    const where = { userId };
    const [data, total] = await Promise.all([
      cached(
        () =>
          prisma.exportSetting.findMany({
            where,
            select: EXPORT_SETTING_SELECT_LIGHT,
            orderBy: { name: 'asc' },
            skip: page * pageSize,
            take: pageSize,
          }),
        CACHE_KEYS.exportSetting.paged(userId, page, pageSize)
      ),
      cached(() => prisma.exportSetting.count({ where }), CACHE_KEYS.exportSetting.count(userId)),
    ]);

    return NextResponse.json(createPaginatedResponse(data, page + 1, pageSize, total));
  } catch (error) {
    return handleApiError(error, 'GET /api/export-settings/paged');
  }
}

export async function getExportSettingById(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const userId = await requireAuth();
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
    const userId = await requireAuth();

    const body = await req.json();
    const { headerLayout, ...rest } = await ExportSettingCreateValidator.validate(body, {
      abortEarly: false,
    });

    const settings = await prisma.exportSetting.create({
      data: { ...rest, userId, ...(headerLayout != null ? { headerLayout } : {}) },
      select: EXPORT_SETTING_SELECT,
    });

    invalidateCache(...CACHE_KEYS.exportSetting.invalidate());
    await cached(() => Promise.resolve(settings), CACHE_KEYS.exportSetting.byId(settings.id))

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
    const userId = await requireAuth();
    const id = parseIdFromRoute(await params);

    const body = await req.json();
    const { headerLayout, ...rest } = await ExportSettingUpdateValidator.validate(body, {
      abortEarly: false,
    });

    const settings = await prisma.exportSetting.updateManyAndReturn({
      where: { id, userId },
      data: { ...rest, ...(headerLayout != null ? { headerLayout } : {}) },
      select: EXPORT_SETTING_SELECT,
    });
    if (settings.length === 0) throw new ApiError('Export setting not found', 404);
    const meta = settings[0];

    invalidateCache(...CACHE_KEYS.exportSetting.invalidate());
    await cached(() => Promise.resolve(meta), CACHE_KEYS.exportSetting.byId(id));

    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error, 'PATCH /api/export-settings/:id');
  }
}

export async function deleteExportSetting(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const userId = await requireAuth();
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

// ==== Logo handlers ====

export async function getExportSettingLogoById(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const userId = await requireAuth();
    const id = parseIdFromRoute(await params);

    // eslint-disable-next-line local/no-uncached-prisma
    const row = await prisma.exportSetting.findFirstOrThrow({
      where: { id, userId },
      select: { logoData: true, logoMime: true, logoName: true },
    });

    if (!row.logoData) {
      return NextResponse.json({ logoData: null, logoMime: null, logoName: null });
    }

    return NextResponse.json({
      logoData: Buffer.from(row.logoData).toString('base64'),
      logoMime: row.logoMime,
      logoName: row.logoName,
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/export-settings/:id/logo');
  }
}

export async function updateExportSettingLogo(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const userId = await requireAuth();
    const id = parseIdFromRoute(await params);

    const formData = await req.formData();
    const file = formData.get('logo') as File | null;
    if (!file) throw new ApiError('No logo file provided', 400);

    const accepted = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!accepted.includes(file.type)) {
      throw new ApiError('Logo must be PNG, JPEG, WebP, or GIF', 400);
    }

    const raw = Buffer.from(await file.arrayBuffer());
    const logoData = await processLogo(raw);

    const results = await prisma.exportSetting.updateManyAndReturn({
      where: { id, userId },
      data: {
        logoData: logoData as unknown as Uint8Array<ArrayBuffer>,
        logoMime: 'image/jpeg',
        logoName: file.name,
      },
      select: EXPORT_SETTING_SELECT,
    });
    if (results.length === 0) throw new ApiError('Export setting not found', 404);
    const meta = results[0];

    invalidateCache(...CACHE_KEYS.exportSetting.byId(id));
    await cached(() => Promise.resolve(meta), CACHE_KEYS.exportSetting.byId(id));

    return NextResponse.json({
      logoData: `data:image/jpeg;base64,${logoData.toString('base64')}`,
      logoMime: meta.logoMime,
      logoName: meta.logoName,
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/export-settings/:id/logo');
  }
}

export async function deleteExportSettingLogo(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const userId = await requireAuth();
    const id = parseIdFromRoute(await params);

    const { count } = await prisma.exportSetting.updateMany({
      where: { id, userId },
      data: { logoData: null, logoMime: null, logoName: null },
    });
    if (count === 0) throw new ApiError('Export setting not found', 404);

    invalidateCache(...CACHE_KEYS.exportSetting.byId(id));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/export-settings/:id/logo');
  }
}
