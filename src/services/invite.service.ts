import 'server-only';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { cached, invalidateCache, populateCache } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import { requireAuth } from '@/auth';
import { ApiError } from '@/models/api-error';
import { handleApiError } from '@/lib/errorHandler';
import { API } from '@/lib/apiUrl';
import { sendInviteEmail, fetchInviteLimits } from '@/lib/email';
import { Permission } from '@/lib/permissions';
import { checkUserRequestLimit, checkPublicRequestLimit } from '@/lib/rateLimiter';
import { buildSendInviteValidator, AcceptInviteValidator, InviteModel } from '@/models/invite.models';

// ==== NOTES ====
// Lazy cleanup + limit enforcement via prisma.invite.assertLimit() and findFirstWithCleanup().
// TTL (14 days) and limit (50) configured in prisma.ts withLazyCleanup registration.
// Vercel Cron hits /api/cron/cleanup daily as a proactive sweep.
// ==== ==== ====

const INVITE_CACHE_TTL = 300;

// ==== HTTP handlers ====

export async function getInviteLimits(): Promise<NextResponse> {
  try {
    await requireAuth(Permission.CAN_ACCESS_STATS);
    const limits = await cached(
      fetchInviteLimits, 
      CACHE_KEYS.invite.limits(), 
      60 * 60
    );
    if (!limits) throw new ApiError('Invite limits unavailable — RESEND_API_KEY not configured', 503);
    return NextResponse.json(limits);
  } catch (error) {
    return handleApiError(error, 'GET', API.invite.limits());
  }
}

export async function sendInvite(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId: inviterId, permissions: inviterPerms } = await requireAuth(Permission.CAN_INVITE_USERS);
    await checkUserRequestLimit(req, inviterId, inviterPerms);
    await prisma.invite.assertLimit();

    const body = await req.json();
    const data = await buildSendInviteValidator(inviterPerms).validate(body, { abortEarly: false });

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
  } catch (error) {
    return handleApiError(error, 'POST', API.invite.send());
  }
}

export async function acceptInvite(req: NextRequest): Promise<NextResponse> {
  try {
    await checkPublicRequestLimit(req);
    const body = await req.json();
    const data = await AcceptInviteValidator.validate(body, { abortEarly: false });

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
  } catch (error) {
    return handleApiError(error, 'POST', API.invite.accept());
  }
}

export async function lookupInvite(req: NextRequest): Promise<NextResponse> {
  try {
    await checkPublicRequestLimit(req);
    const token = req.nextUrl.searchParams.get('token') ?? '';
    if (!token) throw new ApiError('Token is required', 400);
    
    const invite = await cached(
      () => prisma.invite.findFirstWithCleanup({
        where:  { token },
        select: { id: true, email: true, invitedBy: true, permissions: true },
      }),
      CACHE_KEYS.invite.byToken(token),
      INVITE_CACHE_TTL,
    );
    if (!invite) throw new ApiError('Invite link is invalid, expired, or already used', 400);

    return NextResponse.json({ email: invite.email });
  } catch (error) {
    return handleApiError(error, 'GET', API.invite.lookup(':token'));
  }
}
