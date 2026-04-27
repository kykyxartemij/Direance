import 'server-only';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/models/api-error';
import { Permission, hasPermission } from './permissions';

// ==== Config ====

export const RATE_LIMITS = {
  user_ops:       { max: 5,   windowMs: 60_000 },       // 5 min per user
  ip_ops:         { max: 20,  windowMs: 60_000 },       // 20 min per IP
  global_ops:     { max: 200, windowMs: 60_000 },       // 200 min across all users
  login_attempts: { max: 5,   windowMs: 5 * 60_000 },  // 5 login attempts per 5 min per email
} as const;

// ==== Helpers ====

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';
}

function windowSec(windowMs: number): number {
  return Math.floor(windowMs / 1000);
}

// ==== Public API ====

/**
 * Rate-limit a mutating request (POST / PATCH / DELETE).
 * Call after requireAuth(), before doing work.
 * Throws ApiError(429) if any limit is exceeded.
 * NO_DB_REQUEST_LIMITS and IS_ADMIN bypass all limits — full pass-through.
 * Backed by Postgres — works across all Vercel instances.
 */
export async function checkUserRequestLimit(req: NextRequest, userId: string, permissions: string[]): Promise<void> {

  if (hasPermission({ permissions }, Permission.NO_DB_REQUEST_LIMITS)) {
    return;
  }

  // All three checks in 1 roundtrip
  const ip = getIp(req);
  const [row] = await prisma.$queryRaw<[{ ip_ok: boolean; user_ok: boolean; global_ok: boolean }]>`
    SELECT
      check_rate_limit(${`ip:${ip}`}::text,       ${RATE_LIMITS.ip_ops.max}::int,     ${windowSec(RATE_LIMITS.ip_ops.windowMs)}::int)     AS ip_ok,
      check_rate_limit(${`user:${userId}`}::text,  ${RATE_LIMITS.user_ops.max}::int,   ${windowSec(RATE_LIMITS.user_ops.windowMs)}::int)   AS user_ok,
      check_rate_limit('global'::text,             ${RATE_LIMITS.global_ops.max}::int, ${windowSec(RATE_LIMITS.global_ops.windowMs)}::int) AS global_ok
  `;
  if (!row.ip_ok)     throw new ApiError('Too many requests from this IP', 429);
  if (!row.user_ok)   throw new ApiError('Too many requests', 429);
  if (!row.global_ok) throw new ApiError('Server busy, please try again shortly', 429);
}

/**
 * Rate-limit a public (unauthenticated) request by IP + global.
 * No user check — no session required.
 * Call at the top of public endpoints (acceptInvite, lookupInvite, etc.).
 */
export async function checkPublicRequestLimit(req: NextRequest): Promise<void> {
  const ip = getIp(req);
  const [row] = await prisma.$queryRaw<[{ ip_ok: boolean; global_ok: boolean }]>`
    SELECT
      check_rate_limit(${`ip:${ip}`}::text, ${RATE_LIMITS.ip_ops.max}::int, ${windowSec(RATE_LIMITS.ip_ops.windowMs)}::int) AS ip_ok,
      check_rate_limit('global'::text,      ${RATE_LIMITS.global_ops.max}::int, ${windowSec(RATE_LIMITS.global_ops.windowMs)}::int) AS global_ok
  `;
  if (!row.ip_ok)     throw new ApiError('Too many requests from this IP', 429);
  if (!row.global_ok) throw new ApiError('Server busy, please try again shortly', 429);
}

/**
 * Rate-limit a login attempt by email.
 * Returns false if the limit is exceeded.
 * Call inside Credentials authorize() — return null to deny.
 */
export async function checkLoginRate(email: string): Promise<boolean> {
  const [row] = await prisma.$queryRaw<[{ ok: boolean }]>`
    SELECT check_rate_limit(${`login:${email.toLowerCase()}`}::text, ${RATE_LIMITS.login_attempts.max}::int, ${windowSec(RATE_LIMITS.login_attempts.windowMs)}::int) AS ok
  `;
  return row.ok;
}
