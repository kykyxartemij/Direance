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
import { BytesResponse } from '@/lib/images/BytesResponse';
import { processImageFile } from '@/lib/images/imageProcessor';
import type { LogoMetadataModel } from '@/models/logo.model';

const LOGO_MAX_BYTES = 80 * 1024;
const LOGO_MAX_WIDTH = 400;
const processLogo = (file: File) => processImageFile(file, LOGO_MAX_BYTES, LOGO_MAX_WIDTH);

// ==== Selects ====

const LOGO_SELECT_LIGHT = {
  id: true,
  mime: true,
  name: true,
} as const;

const LOGO_SELECT = {
  ...LOGO_SELECT_LIGHT,
  data: true
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
    return handleApiError(error, 'GET', API.logo.list());
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
      select: { id: true, data: true, mime: true, name: true },
    });
    if (!logo) throw new ApiError('Logo not found', 404);

    return new BytesResponse<LogoMetadataModel>(logo.data, logo.mime, { id: logo.id, name: logo.name });
  } catch (error) {
    return handleApiError(error, 'GET', API.logo.byId(':id'));
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
      select: { logo: { select: LOGO_SELECT } },
    });

    if (!row) throw new ApiError('Export setting not found', 404);
    if (!row.logo?.data) return new NextResponse(null, { status: 204 });

    return new BytesResponse<LogoMetadataModel>(row.logo.data, row.logo.mime, { id: row.logo.id, name: row.logo.name });
  } catch (error) {
    return handleApiError(error, 'GET', API.logo.byExportSettingId(':id'));
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

    const processed = await processLogo(file);

    const logo = await prisma.logo.create({
      data: {
        userId,
        data: processed.data as unknown as Uint8Array<ArrayBuffer>,
        mime: processed.mime,
        name: processed.name,
      },
      select: LOGO_SELECT_LIGHT,
    });

    invalidateCache(...CACHE_KEYS.logo.invalidate(userId));

    return new BytesResponse<LogoMetadataModel>(processed.data, processed.mime, { id: logo.id, name: logo.name }, 201);
  } catch (error) {
    return handleApiError(error, 'POST', API.logo.list());
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

    invalidateCache(...CACHE_KEYS.logo.invalidate(userId));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, 'DELETE', API.logo.byId(':id'));
  }
}
