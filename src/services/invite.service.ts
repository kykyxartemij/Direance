import 'server-only';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { cached, invalidateCache } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import { requireAuth } from '@/auth';
import { ApiError } from '@/models/api-error';
import { handleApiError } from '@/lib/errorHandler';
import { API } from '@/lib/apiUrl';
import { sendInviteEmail, sendInviteExtendedEmail } from '@/lib/email';
import { Permission } from '@/lib/permissions';
import { checkUserRequestLimit, checkPublicRequestLimit } from '@/lib/rateLimiter';
import { buildSendInviteValidator, AcceptInviteValidator } from '@/models/invite.models';

// ==== Select ====

const INVITE_SELECT = {
  id: true,
  email: true,
  invitedBy: true,
  permissions: true,
  expiresAt: true,
  createdAt: true,
} as const;

// ==== HTTP handlers ====

/** POST /api/invites — send an invite email to a new user */
export async function sendInvite(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId: inviterId, permissions: inviterPerms } = await requireAuth(Permission.CAN_INVITE_USERS);
    await checkUserRequestLimit(req, inviterId, inviterPerms);

    const body = await req.json();
    const data = await buildSendInviteValidator(inviterPerms).validate(body, { abortEarly: false });

    // Block if email already has an active account
    const existing = await cached(
      () => prisma.user.findUnique({ where: { email: data.email }, select: { id: true } }),
      CACHE_KEYS.user.byEmail(data.email),
    );
    if (existing) throw new ApiError('A user with this email already exists', 409);

    // eslint-disable-next-line local/no-uncached-prisma
    const previous = await prisma.invite.findUnique({
      where: { email: data.email },
      select: { createdAt: true },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + TWO_WEEKS_MS);

    await prisma.invite.upsert({
      where: { email: data.email },
      create: { email: data.email, token, invitedBy: inviterId, permissions: data.permissions as string[], expiresAt },
      update: { token, invitedBy: inviterId, permissions: data.permissions as string[], expiresAt },
    });

    invalidateCache(...CACHE_KEYS.invite.invalidate());

    // Email throttle — one email per 3 days per recipient.
    // First invite OR previous invite older than 72h: send full invite email (or "extended" if reinvite).
    const THREE_DAYS_MS = 72 * 60 * 60 * 1000;
    const isReinvite = !!previous;
    const previousAge = previous ? Date.now() - previous.createdAt.getTime() : Infinity;

    if (!isReinvite) {
      await sendInviteEmail(data.email, token);
    } else if (previousAge >= THREE_DAYS_MS) {
      await sendInviteExtendedEmail(data.email, token);
    }
    // else: silent extension — token/expiry updated, but no email (anti-spam)

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

    // eslint-disable-next-line local/no-uncached-prisma
    const invite = await prisma.invite.findUnique({ where: { token: data.token } });

    if (!invite) throw new ApiError('Invalid or already used invite link', 400);

    if (invite.expiresAt < new Date()) {
      // Lazy cleanup — expired invite, delete and inform the user.
      // Catch swallows the rare race where another request deletes it first;
      // the error response is the same either way.
      await prisma.invite.delete({ where: { token: data.token } }).catch(() => undefined);
      invalidateCache(...CACHE_KEYS.invite.invalidate());
      throw new ApiError('This invite link has expired', 400);
    }

    // Race guard — must be fresh, caching would defeat the purpose
    // eslint-disable-next-line local/no-uncached-prisma
    const existing = await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } });
    if (existing) throw new ApiError('An account with this email already exists', 409);

    const hashed = await bcrypt.hash(data.password, 12);

    await prisma.$transaction([
      prisma.user.create({
        data: {
          email: invite.email,
          name: data.name || null,
          password: hashed,
          emailVerified: new Date(), // invite = pre-verified email
          permissions: invite.permissions,
        },
        select: { id: true },
      }),
      // Delete instead of marking used — no point keeping it
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

    const invite = await cached(
      () => prisma.invite.findUnique({ where: { token }, select: INVITE_SELECT }),
      CACHE_KEYS.invite.byToken(token),
      30, // short TTL — invite deleted on accept
    );

    if (!invite) throw new ApiError('Invalid or already used invite link', 400);
    if (invite.expiresAt < new Date()) throw new ApiError('This invite link has expired', 400);

    return NextResponse.json({ email: invite.email });
  } catch (error) {
    return handleApiError(error, 'GET', API.invite.lookup(':token'));
  }
}
