import 'server-only';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { cached, invalidateCache, populateCache } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import { withHandler, withPublicHandler } from '@/lib/withHandler';
import { getAuth, getClientIp } from '@/lib/requestContext';
import { ApiError } from '@/models/api-error';
import { sendInviteEmail, sendInviteExtendedEmail } from '@/lib/email';
import { Permission } from '@/lib/permissions';
import { checkUserRequestLimit, checkPublicRequestLimit } from '@/lib/rateLimiter';
import { buildSendInviteValidator, AcceptInviteValidator, INVITE_SELECT } from '@/models/invite.models';

// ==== NOTES ====
// Lazy cleanup + limit enforcement via prisma.invite.assertLimit() and findFirstWithCleanup().
// TTL (14 days) and limit (50) configured in prisma.ts withLazyCleanup registration.
// Vercel Cron hits /api/cron/cleanup daily as a proactive sweep.
// ==== ==== ====

const INVITE_CACHE_TTL = 300;
const RESEND_COOLDOWN_MS = 3 * 86_400_000;

// ==== HTTP handlers ====

export const sendInvite = withHandler(
  async (req) => {
    const { userId: inviterId, permissions: inviterPerms } = getAuth();
    const ip = getClientIp();

    await checkUserRequestLimit(ip, inviterId, inviterPerms);
    await prisma.invite.assertLimit();

    const data = await buildSendInviteValidator(inviterPerms).validate(await req.json(), { abortEarly: false });

    const existing = await cached(
      () => prisma.user.findUnique({ where: { email: data.email }, select: { id: true } }),
      CACHE_KEYS.user.byEmail(data.email),
    );
    if (existing) throw new ApiError('A user with this email already exists', 409);

    // Resend only after the cooldown: it restarts the 14-day expiry and keeps the token,
    // so the link already in the inbox stays valid. Expired invites were removed by assertLimit.
    const [extended] = await prisma.invite.updateManyAndReturn({
      where:  { email: data.email, createdAt: { lt: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
      data:   { invitedBy: inviterId, permissions: data.permissions, createdAt: new Date() },
      select: { token: true },
    });

    if (extended) {
      invalidateCache(...CACHE_KEYS.invite.invalidate());
      await sendInviteExtendedEmail(data.email, extended.token);
      return NextResponse.json({ message: 'Invite extended' }, { status: 200 });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const [created] = await prisma.invite.createManyAndReturn({
      data:           { email: data.email, token, invitedBy: inviterId, permissions: data.permissions },
      skipDuplicates: true,
      select:         { id: true },
    });
    if (!created) throw new ApiError('An invite was sent to this email less than 3 days ago. Try again later.', 429);

    invalidateCache(...CACHE_KEYS.invite.invalidate());
    await sendInviteEmail(data.email, token);

    return NextResponse.json({ message: 'Invite sent' }, { status: 201 });
  },
  { permission: Permission.CAN_INVITE_USERS },
);

export const acceptInvite = withPublicHandler(async (req) => {
  const data = await AcceptInviteValidator.validate(await req.json(), { abortEarly: false });

  await checkPublicRequestLimit(getClientIp());

  const invite = await cached(
    () => prisma.invite.findFirstWithCleanup({
      where:  { token: data.token },
      select: INVITE_SELECT,
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

  const ip = getClientIp();

  const invite = await cached(
    async () => {
      await checkPublicRequestLimit(ip);
      return prisma.invite.findFirstWithCleanup({
        where:  { token },
        select: INVITE_SELECT,
      });
    },
    CACHE_KEYS.invite.byToken(token),
    INVITE_CACHE_TTL,
  );
  if (!invite) throw new ApiError('Invite link is invalid, expired, or already used', 400);

  return NextResponse.json({ email: invite.email });
});
