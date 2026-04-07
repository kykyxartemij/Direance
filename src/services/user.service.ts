import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { cached, invalidateCache } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import { handleApiError } from '@/lib/errorHandler';
import { requireAuth } from '@/auth';
import { ApiError } from '@/models/api-error';
import { RegisterValidator, UserUpdateValidator } from '@/models/user.models';

// ==== Select ====

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  image: true,
} as const;

// ==== HTTP handlers ====

export async function getMe(): Promise<NextResponse> {
  try {
    const userId = await requireAuth();

    const user = await cached(
      () => prisma.user.findUniqueOrThrow({ where: { id: userId }, select: USER_SELECT }),
      CACHE_KEYS.user.byId(userId)
    );

    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error, 'GET /api/user/me');
  }
}

// TODO: Redifine. No ability to register user the regular way. You may get access only if admin created account for you. On your side is to change your password as needed.
export async function registerUser(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const data = await RegisterValidator.validate(body, { abortEarly: false });

    // eslint-disable-next-line local/no-uncached-prisma
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ApiError('Email already in use', 409);

    const hashed = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: { email: data.email, password: hashed, name: data.name || null },
      select: USER_SELECT,
    });

    invalidateCache(...CACHE_KEYS.user.invalidate());
    await cached(() => Promise.resolve(user), CACHE_KEYS.user.byId(user.id));

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/auth/register');
  }
}

// Currently not used
export async function patchMe(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = await requireAuth();

    const body = await req.json();
    const data = await UserUpdateValidator.validate(body, { abortEarly: false });

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: USER_SELECT,
    });

    invalidateCache(...CACHE_KEYS.user.invalidate());
    await cached(() => Promise.resolve(user), CACHE_KEYS.user.byId(user.id));

    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error, 'PATCH /api/user');
  }
}

export async function deleteMe(): Promise<NextResponse> {
  try {
    const userId = await requireAuth();

    await prisma.user.delete({ where: { id: userId } });
    invalidateCache(...CACHE_KEYS.user.invalidate());

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/user');
  }
}
