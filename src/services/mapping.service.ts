import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cached, invalidateCache } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import { handleApiError } from '@/lib/errorHandler';
import { requireAuth } from '@/auth';
import { ApiError } from '@/models/api-error';
import { parseIdFromRoute } from '@/models';
import { MappingCreateValidator, MappingUpdateValidator } from '@/models/mapping.models';

// ==== Select ====

const MAPPING_SELECT = {
  id: true,
  name: true,
  isGlobal: true,
  reportType: true,
  config: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ==== HTTP handlers ====

export async function listMappings(): Promise<NextResponse> {
  try {
    const userId = await requireAuth();

    const mappings = await cached(
      () =>
        prisma.fieldMapping.findMany({
          where: { OR: [{ userId }, { isGlobal: true }] },
          select: MAPPING_SELECT,
          orderBy: { createdAt: 'desc' },
        }),
      CACHE_KEYS.mapping.all(),
    );

    return NextResponse.json(mappings);
  } catch (error) {
    return handleApiError(error, 'GET /api/mapping');
  }
}

// TODO: 1: Define usefulity of findFirst vs findUniqueAndThrow
// TODO: 2: use "-andThrow" and catch errors instead of caching empty and checking for it. No cache saved, cause of catch, no need to verify !mapping.
export async function getMappingById(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const userId = await requireAuth();
    const id = parseIdFromRoute(await params);

    const mapping = await cached(
      () =>
        prisma.fieldMapping.findFirst({
          where: { id, OR: [{ userId }, { isGlobal: true }] },
          select: MAPPING_SELECT,
        }),
      CACHE_KEYS.mapping.byId(id),
    );
    if (!mapping) throw new ApiError('Mapping not found', 404);

    return NextResponse.json(mapping);
  } catch (error) {
    return handleApiError(error, 'GET /api/mapping/:id');
  }
}

export async function createMapping(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = await requireAuth();

    const body = await req.json();
    const data = await MappingCreateValidator.validate(body, { abortEarly: false });

    const mapping = await prisma.fieldMapping.create({
      data: { ...data, userId, isGlobal: false },
      select: MAPPING_SELECT,
    });

    // TODO: Cache results
    invalidateCache(...CACHE_KEYS.mapping.invalidate());

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
    const userId = await requireAuth();
    const id = parseIdFromRoute(await params);

    // TODO: Errors handled in handleApiError
    // eslint-disable-next-line local/no-uncached-prisma
    const existing = await prisma.fieldMapping.findUnique({ where: { id } });
    if (!existing || (existing.userId !== userId && !existing.isGlobal)) {
      throw new ApiError('Mapping not found', 404);
    }
    if (existing.isGlobal) {
      throw new ApiError('Global mappings cannot be edited', 403);
    }

    const body = await req.json();
    const data = await MappingUpdateValidator.validate(body, { abortEarly: false });

    const mapping = await prisma.fieldMapping.update({
      where: { id },
      data,
      select: MAPPING_SELECT,
    });

    invalidateCache(...CACHE_KEYS.mapping.invalidate());

    return NextResponse.json(mapping);
  } catch (error) {
    return handleApiError(error, 'PATCH /api/mapping/:id');
  }
}

export async function deleteMapping(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const userId = await requireAuth();
    const id = parseIdFromRoute(await params);

    // TODO: Errors handled in handleApiError
    // eslint-disable-next-line local/no-uncached-prisma
    const existing = await prisma.fieldMapping.findUnique({ where: { id } });
    if (!existing || (existing.userId !== userId && !existing.isGlobal)) {
      throw new ApiError('Mapping not found', 404);
    }
    if (existing.isGlobal) {
      throw new ApiError('Global mappings cannot be deleted', 403);
    }

    await prisma.fieldMapping.delete({ where: { id } });
    invalidateCache(...CACHE_KEYS.mapping.invalidate());

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/mapping/:id');
  }
}
