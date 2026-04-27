import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cached, invalidateCache } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import { handleApiError } from '@/lib/errorHandler';
import { requireAuth } from '@/auth';
import { UpdateUserValidator } from '@/models/user.models';
import { checkUserRequestLimit } from '@/lib/rateLimiter';
import { checkUserDbLimits, computeUserDbConsumption } from '@/lib/userLimits';

// ==== Select ====

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  permissions: true,
} as const;

// ==== HTTP handlers ====

export async function getMe(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);

    const user = await cached(
      () => prisma.user.findUniqueOrThrow({ where: { id: userId }, select: USER_SELECT }),
      CACHE_KEYS.user.byId(userId),
    );

    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error, 'GET /api/user/me');
  }
}

export async function patchMe(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);
    await checkUserDbLimits(userId, permissions);

    const body = await req.json();
    const data = await UpdateUserValidator.validate(body, { abortEarly: false });

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: USER_SELECT,
    });

    invalidateCache(...CACHE_KEYS.user.invalidate());
    await cached(() => Promise.resolve(user), CACHE_KEYS.user.byId(user.id));

    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error, 'PATCH /api/user/me');
  }
}

export async function getDbConsumption(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);

    const data = await cached(
      () => computeUserDbConsumption(userId),
      CACHE_KEYS.user.dbConsumption(userId),
    );

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'GET /api/user/me/consumption');
  }
}

export async function deleteMe(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);

    await prisma.user.delete({ where: { id: userId } });
    invalidateCache(...CACHE_KEYS.user.invalidate());

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/user/me');
  }
}
