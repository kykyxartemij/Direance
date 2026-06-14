import 'server-only';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cached, invalidateCache } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import { withHandler } from '@/lib/withHandler';
import { getAuth } from '@/lib/requestContext';
import { UpdateUserValidator } from '@/models/user.models';
import { checkUserRequestLimit } from '@/lib/rateLimiter';
import { checkUserDbLimits, computeUserDbConsumption } from '@/lib/userLimits';
import { Permission } from '@/lib/permissions';
import { parsePaginationFromUrl, createPaginatedResponse } from '@/models/paginated-response.model';
import { parseFreeTextFromUrl } from '@/lib/normalizeText';

// ==== Email masking ====

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 3)}...${local.slice(-2)}@${domain}`;
}

function maskUser<T extends { email: string }>(user: T): T {
  return { ...user, email: maskEmail(user.email) };
}

// ==== Select ====

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  permissions: true,
} as const;

// ==== HTTP handlers ====

export const getMe = withHandler(async (req) => {
  const { userId, permissions } = getAuth();
  await checkUserRequestLimit(req, userId, permissions);

  const user = await cached(
    () => prisma.user.findUniqueOrThrow({ where: { id: userId }, select: USER_SELECT }),
    CACHE_KEYS.user.byId(userId),
  );

  return NextResponse.json(maskUser(user));
});

export const patchMe = withHandler(async (req) => {
  const { userId, permissions } = getAuth();
  const data = await UpdateUserValidator.validate(await req.json(), { abortEarly: false });

  await checkUserRequestLimit(req, userId, permissions);
  await checkUserDbLimits(userId, permissions);

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: USER_SELECT,
  });

  invalidateCache(...CACHE_KEYS.user.invalidate());
  await cached(() => Promise.resolve(user), CACHE_KEYS.user.byId(userId));

  return NextResponse.json(maskUser(user));
});

export const getDbConsumption = withHandler(async (req) => {
  const { userId, permissions } = getAuth();
  await checkUserRequestLimit(req, userId, permissions);

  const data = await cached(
    () => computeUserDbConsumption(userId),
    CACHE_KEYS.user.dbConsumption(userId),
  );

  return NextResponse.json(data);
});

export const deleteMe = withHandler(async (req) => {
  const { userId, permissions } = getAuth();
  await checkUserRequestLimit(req, userId, permissions);

  await prisma.user.delete({ where: { id: userId } });
  invalidateCache(...CACHE_KEYS.user.invalidate());

  return new NextResponse(null, { status: 204 });
});

export const getPagedUsers = withHandler(
  async (req) => {
    const { userId, permissions } = getAuth();
    await checkUserRequestLimit(req, userId, permissions);

    const searchParams = new URL(req.url).searchParams;
    const { page, pageSize } = await parsePaginationFromUrl(searchParams);
    const freeText = parseFreeTextFromUrl(searchParams);

    const [data, total] = await Promise.all([
      cached(
        () => prisma.user.findManyFts({
          freeText,
          userId,
          select: USER_SELECT,
          orderBy: { email: 'asc' },
          skip: page * pageSize,
          take: pageSize,
        }),
        CACHE_KEYS.user.paged(userId, page, pageSize, freeText),
      ),
      cached(
        () => prisma.user.countFts({ freeText, userId }),
        CACHE_KEYS.user.count(userId, freeText),
      ),
    ]);

    return NextResponse.json(createPaginatedResponse(data.map(maskUser), page, pageSize, total));
  },
  { permission: Permission.CAN_ACCESS_USERS },
);
