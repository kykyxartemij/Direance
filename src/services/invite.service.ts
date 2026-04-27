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
import { sendInviteEmail } from '@/lib/email';
import { Permission } from '@/lib/permissions';
import { checkUserRequestLimit, checkPublicRequestLimit } from '@/lib/rateLimiter';
import { SendInviteValidator, AcceptInviteValidator } from '@/models/invite.models';

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
    const { userId: inviterId, permissions } = await requireAuth(Permission.CAN_INVITE_USERS);
    await checkUserRequestLimit(req, inviterId, permissions);

    const body = await req.json();
    const data = await SendInviteValidator.validate(body, { abortEarly: false });

    // Block if email already has an active account
    const existing = await cached(
      () => prisma.user.findUnique({ where: { email: data.email }, select: { id: true } }),
      CACHE_KEYS.user.byEmail(data.email),
    );
    if (existing) throw new ApiError('A user with this email already exists', 409);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h

    // TODO: Seems overkill. 
    await prisma.invite.upsert({
      where: { email: data.email },
      create: { email: data.email, token, invitedBy: inviterId, permissions: data.permissions as string[], expiresAt },
      update: { token, invitedBy: inviterId, permissions: data.permissions as string[], expiresAt },
    });

    invalidateCache(...CACHE_KEYS.invite.invalidate());
    await sendInviteEmail(data.email, token);

    return NextResponse.json({ message: 'Invite sent' }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/invites');
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
      // Lazy cleanup — expired invite, delete it and inform the user
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
      }),
      // Delete instead of marking used — no point keeping it
      prisma.invite.delete({ where: { token: data.token } }),
    ]);

    invalidateCache(...CACHE_KEYS.invite.invalidate(), ...CACHE_KEYS.user.invalidate());

    return NextResponse.json({ email: invite.email }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/invites/accept');
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
    return handleApiError(error, 'GET /api/invites/lookup');
  }
}
