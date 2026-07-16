import 'server-only';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { cached, invalidateCache, populateCache } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import { withHandler, withPublicHandler } from '@/lib/withHandler';
import { getAuth } from '@/lib/requestContext';
import { ApiError } from '@/models/api-error';
import { sendInviteEmail, fetchInviteLimits } from '@/lib/email';
import { Permission } from '@/lib/permissions';
import { checkUserRequestLimit, checkPublicRequestLimit } from '@/lib/rateLimiter';
import { buildSendInviteValidator, AcceptInviteValidator } from '@/models/invite.models';

// ==== NOTES ====
// Lazy cleanup + limit enforcement via prisma.invite.assertLimit() and findFirstWithCleanup().
// TTL (14 days) and limit (50) configured in prisma.ts withLazyCleanup registration.
// Vercel Cron hits /api/cron/cleanup daily as a proactive sweep.
// ==== ==== ====

const INVITE_CACHE_TTL = 300;

// ==== HTTP handlers ====

export const getInviteLimits = withHandler(
  async () => {
    const limits = await cached(
      fetchInviteLimits,
      CACHE_KEYS.invite.limits(),
      60 * 60,
    );
    if (!limits) throw new ApiError('Invite limits unavailable — RESEND_API_KEY not configured', 503);
    return NextResponse.json(limits);
  },
  { permission: Permission.CAN_ACCESS_STATS },
);

export const sendInvite = withHandler(
  async (req) => {
    const { userId: inviterId, permissions: inviterPerms } = getAuth();
    await checkUserRequestLimit(req, inviterId, inviterPerms);
    await prisma.invite.assertLimit();

    const data = await buildSendInviteValidator(inviterPerms).validate(await req.json(), { abortEarly: false });

    const existing = await cached(
      () => prisma.user.findUnique({ where: { email: data.email }, select: { id: true } }),
      CACHE_KEYS.user.byEmail(data.email),
    );
    if (existing) throw new ApiError('A user with this email already exists', 409);

    const token = crypto.randomBytes(32).toString('hex');

    await prisma.invite.upsertAndReturn({
      where:  { email: data.email },
      create: { email: data.email, token, invitedBy: inviterId, permissions: data.permissions },
      update: { token, invitedBy: inviterId, permissions: data.permissions },
      select: { id: true },
    });

    invalidateCache(...CACHE_KEYS.invite.invalidate());
    await sendInviteEmail(data.email, token);

    return NextResponse.json({ message: 'Invite sent' }, { status: 201 });
  },
  { permission: Permission.CAN_INVITE_USERS },
);

export const acceptInvite = withPublicHandler(async (req) => {
  const data = await AcceptInviteValidator.validate(await req.json(), { abortEarly: false });
  await checkPublicRequestLimit(req);

  const invite = await cached(
    () => prisma.invite.findFirstWithCleanup({
      where:  { token: data.token },
      select: { id: true, email: true, invitedBy: true, permissions: true },
    }),
    CACHE_KEYS.invite.byToken(data.token),
    INVITE_CACHE_TTL,
  );
  if (!invite) throw new ApiError('Invite link is invalid, expired, or already used', 400);

  const existing = await populateCache(
    () => prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } }),
    CACHE_KEYS.user.byEmail(invite.email),
  );
  if (existing) throw new ApiError('An account with this email already exists', 409);

  const hashed = await bcrypt.hash(data.password, 12);

  await prisma.$transaction([
    prisma.user.create({
      data: {
        email: invite.email,
        name: data.name || 'NoNamer',
        password: hashed,
        emailVerified: new Date(),
        permissions: invite.permissions,
      },
      select: { id: true },
    }),
    prisma.invite.delete({ where: { token: data.token }, select: { id: true } }),
  ]);

  invalidateCache(...CACHE_KEYS.invite.invalidate(), ...CACHE_KEYS.user.invalidate());
  return NextResponse.json({ email: invite.email }, { status: 201 });
});

export const lookupInvite = withPublicHandler(async (req) => {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  if (!token) throw new ApiError('Token is required', 400);

  const invite = await cached(
    async () => {
      await checkPublicRequestLimit(req);
      return prisma.invite.findFirstWithCleanup({
        where:  { token },
        select: { id: true, email: true, invitedBy: true, permissions: true },
      });
    },
    CACHE_KEYS.invite.byToken(token),
    INVITE_CACHE_TTL,
  );
  if (!invite) throw new ApiError('Invite link is invalid, expired, or already used', 400);

  return NextResponse.json({ email: invite.email });
});
