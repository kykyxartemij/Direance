import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { cached, invalidateCache } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import { handleApiError } from '@/lib/errorHandler';
import { requireAuth } from '@/auth';
import { ApiError } from '@/models/api-error';
import { checkUserRequestLimit } from '@/lib/rateLimiter';
import { checkUserDbLimits } from '@/lib/userLimits';
import { parseIdFromRoute } from '@/models';
import { LOGO_ACCEPTED_MIME_TYPES } from '@/models/logo.model';

// ==== Logo processing ====

const LOGO_MAX_BYTES = 200 * 1024;
const LOGO_MAX_WIDTH = 800;

async function processLogo(buffer: Buffer): Promise<{ data: Buffer; mime: string }> {
  const meta = await sharp(buffer).metadata();
  const hasAlpha = meta.hasAlpha === true;

  if (hasAlpha) {
    let result = await sharp(buffer)
      .resize(LOGO_MAX_WIDTH, undefined, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();

    if (result.length > LOGO_MAX_BYTES) {
      result = await sharp(buffer)
        .resize(600, undefined, { fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 9, palette: true })
        .toBuffer();
    }

    return { data: result, mime: 'image/png' };
  }

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

  return { data: result, mime: 'image/jpeg' };
}

// Exported helper — validates file type, runs sharp processing.
// Used by export-settings service for inline logo create/update.
// Intentionally throws — callers wrap in their own try/catch handler.
// eslint-disable-next-line local/require-api-try-catch
export async function processLogoFile(file: File): Promise<{ data: Buffer; mime: string; name: string }> {
  if (!(LOGO_ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) {
    throw new ApiError('Logo must be PNG, JPEG, WebP, or GIF', 400);
  }
  const raw = Buffer.from(await file.arrayBuffer());
  const processed = await processLogo(raw);
  return { ...processed, name: file.name };
}

// ==== Selects ====

const LOGO_SELECT_LIGHT = {
  id: true,
  mime: true,
  name: true,
  createdAt: true,
} as const;

// ==== HTTP handlers ====

export async function getLightLogos(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);

    const logos = await cached(
      () => prisma.logo.findMany({
        where: { userId },
        select: LOGO_SELECT_LIGHT,
        orderBy: { createdAt: 'desc' },
      }),
      CACHE_KEYS.logo.light(userId),
    );

    return NextResponse.json(logos);
  } catch (error) {
    return handleApiError(error, 'GET /api/logos');
  }
}

export async function getLogoById(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);

    const id = parseIdFromRoute(await params);

    // eslint-disable-next-line local/no-uncached-prisma
    const logo = await prisma.logo.findFirst({
      where: { id, userId },
      select: { data: true, mime: true, name: true },
    });
    if (!logo) throw new ApiError('Logo not found', 404);

    return NextResponse.json({
      logoData: Buffer.from(logo.data).toString('base64'),
      logoMime: logo.mime,
      logoName: logo.name,
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/logos/:id');
  }
}

export async function getLogoByExportSettingId(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);

    const id = parseIdFromRoute(await params);

    // eslint-disable-next-line local/no-uncached-prisma
    const row = await prisma.exportSetting.findFirst({
      where: { id, userId },
      select: { logo: { select: { data: true, mime: true, name: true } } },
    });

    if (!row) throw new ApiError('Export setting not found', 404);

    if (!row.logo?.data) {
      return NextResponse.json({ logoData: null, logoMime: null, logoName: null });
    }

    return NextResponse.json({
      logoData: Buffer.from(row.logo.data).toString('base64'),
      logoMime: row.logo.mime,
      logoName: row.logo.name,
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/export-settings/:id/logo');
  }
}

export async function createLogo(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);
    await checkUserDbLimits(userId, permissions);

    const formData = await req.formData();
    const file = formData.get('logo') as File | null;
    if (!file) throw new ApiError('No logo file provided', 400);

    const processed = await processLogoFile(file);

    const logo = await prisma.logo.create({
      data: {
        userId,
        data: processed.data as unknown as Uint8Array<ArrayBuffer>,
        mime: processed.mime,
        name: processed.name,
      },
      select: LOGO_SELECT_LIGHT,
    });

    invalidateCache(...CACHE_KEYS.logo.invalidate());

    return NextResponse.json(logo, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/logos');
  }
}

export async function deleteLogo(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);

    const id = parseIdFromRoute(await params);

    const { count } = await prisma.logo.deleteMany({ where: { id, userId } });
    if (count === 0) throw new ApiError('Logo not found', 404);

    invalidateCache(...CACHE_KEYS.logo.invalidate());
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/logos/:id');
  }
}
