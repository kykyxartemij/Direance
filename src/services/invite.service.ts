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
import { sendInviteEmail, sendInviteExtendedEmail, fetchInviteLimits } from '@/lib/email';
import { Permission } from '@/lib/permissions';
import { checkUserRequestLimit, checkPublicRequestLimit } from '@/lib/rateLimiter';
import { buildSendInviteValidator, AcceptInviteValidator, InviteModel } from '@/models/invite.models';
import { Prisma } from '../../generated/prisma/client';

// ==== NOTES ====
// Lazy cleanup runs on sendInvite + fetchValidInvite instead of a scheduled job.
// pg_cron would be cleaner but Neon auto-suspends — cron jobs don't fire on a sleeping DB.
// ==== ==== ====

const INVITE_LIMIT = 50;
const INVITE_CACHE_TTL = 300;

// ==== Select ====

const INVITE_SELECT = {
  id: true,
  email: true,
  invitedBy: true,
  permissions: true,
} as const;

// Lazy cleanup runs on sendInvite + fetchValidInvite instead of a scheduled job.
// pg_cron would be cleaner but Neon auto-suspends — cron jobs don't fire on a sleeping DB.
async function checkInviteLimits(): Promise<void> {
  const [{ count }] = await prisma.$queryRaw<[{ count: bigint }]>`
    WITH deleted AS (
      DELETE FROM "Invite" WHERE "createdAt" < NOW() - INTERVAL '14 days'
    )
    SELECT COUNT(*) AS count FROM "Invite"
  `;
  if (Number(count) >= INVITE_LIMIT) throw new ApiError('Too many invites sent. Please try again later, after some invitations expire', 429);
}

const INVITE_COLS = Prisma.raw(
  Object.keys(INVITE_SELECT).map(k => `"${k}"`).join(', ')
);

async function fetchValidInvite(token: string): Promise<InviteModel> {
  const [invite] = await cached(
    () => prisma.$queryRaw<InviteModel[]>`
      WITH cleanup AS (
        DELETE FROM "Invite" WHERE "token" = ${token} AND "createdAt" < NOW() - INTERVAL '14 days'
      )
      SELECT ${INVITE_COLS} FROM "Invite" WHERE "token" = ${token} AND "createdAt" >= NOW() - INTERVAL '14 days'
    `,
    CACHE_KEYS.invite.byToken(token),
    INVITE_CACHE_TTL,
  );
  if (!invite) throw new ApiError('Invite link is invalid, expired, or already used', 400);
  return invite;
}


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

/** POST /api/invites — send an invite email to a new user */
export async function sendInvite(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId: inviterId, permissions: inviterPerms } = await requireAuth(Permission.CAN_INVITE_USERS);
    await checkUserRequestLimit(req, inviterId, inviterPerms);
    await checkInviteLimits();

    const body = await req.json();
    const data = await buildSendInviteValidator(inviterPerms).validate(body, { abortEarly: false });

    // Block if email already has an active account
    const existing = await cached(
      () => prisma.user.findUnique({ where: { email: data.email }, select: { id: true } }),
      CACHE_KEYS.user.byEmail(data.email),
    );
    if (existing) throw new ApiError('A user with this email already exists', 409);

    const token = crypto.randomBytes(32).toString('hex');

    const [{ createdAt, wasUpdated }] = await prisma.invite.upsertAndReturn({
      where:  { email: data.email },
      create: { id: crypto.randomUUID(), email: data.email, token, invitedBy: inviterId, permissions: data.permissions },
      update: { token, invitedBy: inviterId, permissions: data.permissions, createdAt: new Date() },
      select: { createdAt: true },
    });

    invalidateCache(...CACHE_KEYS.invite.invalidate());

    await sendInviteEmail(data.email, token);
    // const THREE_DAYS_MS = 72 * 60 * 60 * 1000;
    // if (!wasUpdated) {
    //   await sendInviteEmail(data.email, token);
    // } else if (Date.now() - createdAt.getTime() >= THREE_DAYS_MS) {
    //   await sendInviteExtendedEmail(data.email, token);
    // }

    return NextResponse.json({ message: 'Invite sent' }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST', API.invite.send());
  }
}

/** POST /api/invites/accept — create account, then delete the invite */
export async function acceptInvite(req: NextRequest): Promise<NextResponse> {
  try {
    await checkPublicRequestLimit(req);
    const body = await req.json();
    const data = await AcceptInviteValidator.validate(body, { abortEarly: false });

    const invite = await fetchValidInvite(data.token);

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
          name: data.name || "NoNamer",
          password: hashed,
          emailVerified: new Date(), // invite = pre-verified email
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

/** GET /api/invites/lookup?token= — validate token and return email (for the accept-invite page) */
export async function lookupInvite(req: NextRequest): Promise<NextResponse> {
  try {
    await checkPublicRequestLimit(req);

    const token = req.nextUrl.searchParams.get('token') ?? '';
    if (!token) throw new ApiError('Token is required', 400);

    const invite = await fetchValidInvite(token);

    return NextResponse.json({ email: invite.email });
  } catch (error) {
    return handleApiError(error, 'GET', API.invite.lookup(':token'));
  }
}
