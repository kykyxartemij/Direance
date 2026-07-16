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
  privileged_multiplier: 5,
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

// #region per Instance
 
// ==== Instance capacity guard ====
// Protects this Vercel instance from being overloaded. Shared across all traffic
// (auth + public) — called once per request by withHandler / withPublicHandler before
// any DB work. DB limit functions do not call this — no double-counting.

let _mem = { count: 0, windowStart: Date.now() };

function checkMemGlobal(): boolean {
  const now = Date.now();
  if (now - _mem.windowStart > 60_000) _mem = { count: 0, windowStart: now };
  return ++_mem.count <= RATE_LIMITS.global_ops.max * RATE_LIMITS.privileged_multiplier;
}

export function assertInstanceCapacity(): void {
  if (!checkMemGlobal()) throw new ApiError('Server busy, please try again shortly', 429);
}
// Backstop for the per-key maps below — getIp()/userId are attacker-influenced (spoofable
// x-forwarded-for, or just many accounts). The sweep in each guard is the real cleanup;
// this only guards the burst that happens inside a single sweep window.
const MEM_MAP_CAP = 5_000;

function sweepExpired(map: Map<string, { count: number; windowStart: number }>, windowMs: number, now: number): void {
  for (const [key, entry] of map) {
    if (now - entry.windowStart > windowMs) map.delete(key);
  }
}

// ==== IP capacity guard ====
// Pre-auth trip-wire, per IP — rejects a flood before it costs a Postgres call.
// Not authoritative; checkUserRequestLimit / checkPublicRequestLimit are.

const _ipMem = new Map<string, { count: number; windowStart: number }>();
let _ipLastSweep = 0;

function checkMemIp(ip: string): boolean {
  const now = Date.now();
  if (now - _ipLastSweep > RATE_LIMITS.ip_ops.windowMs) {
    sweepExpired(_ipMem, RATE_LIMITS.ip_ops.windowMs, now);
    _ipLastSweep = now;
  }
  if (_ipMem.size > MEM_MAP_CAP) _ipMem.clear();

  const entry = _ipMem.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMITS.ip_ops.windowMs) {
    _ipMem.set(ip, { count: 0, windowStart: now });
  }
  return ++_ipMem.get(ip)!.count <= RATE_LIMITS.ip_ops.max * RATE_LIMITS.privileged_multiplier;
}

export function assertIpCapacity(req: NextRequest): void {
  if (!checkMemIp(getIp(req))) throw new ApiError('Too many requests from this IP', 429);
}

// ==== User capacity guard ====
// Same idea, keyed by userId — catches IP-rotation abuse assertIpCapacity can't (VPN/proxy
// hop resets the IP counter, not userId).

const _userMem = new Map<string, { count: number; windowStart: number }>();
let _userLastSweep = 0;

function checkMemUser(userId: string): boolean {
  const now = Date.now();
  if (now - _userLastSweep > RATE_LIMITS.user_ops.windowMs) {
    sweepExpired(_userMem, RATE_LIMITS.user_ops.windowMs, now);
    _userLastSweep = now;
  }
  if (_userMem.size > MEM_MAP_CAP) _userMem.clear();

  const entry = _userMem.get(userId);
  if (!entry || now - entry.windowStart > RATE_LIMITS.user_ops.windowMs) {
    _userMem.set(userId, { count: 0, windowStart: now });
  }
  return ++_userMem.get(userId)!.count <= RATE_LIMITS.user_ops.max * RATE_LIMITS.privileged_multiplier;
}

export function assertUserCapacity(userId: string): void {
  if (!checkMemUser(userId)) throw new ApiError('Too many requests', 429);
}

// #endregion
// #region DB limits

// ==== Public API ====

/**
 * Call after requireAuth(), before doing work. Backed by Postgres, so limits hold across
 * Vercel instances. NO_DB_REQUEST_LIMITS/IS_ADMIN get privileged_multiplier'd limits, not a full bypass.
 */
export async function checkUserRequestLimit(req: NextRequest, userId: string, permissions: string[]): Promise<void> {
  const ip = getIp(req);

  if (hasPermission({ permissions }, Permission.NO_DB_REQUEST_LIMITS)) {
    const x5 = RATE_LIMITS.privileged_multiplier;
    const [row] = await prisma.$queryRaw<[{ ip_ok: boolean; global_ok: boolean }]>`
      SELECT
        check_rate_limit(${`ip:${ip}`}::text, ${RATE_LIMITS.ip_ops.max * x5}::int,     ${windowSec(RATE_LIMITS.ip_ops.windowMs)}::int)     AS ip_ok,
        check_rate_limit('global'::text,      ${RATE_LIMITS.global_ops.max * x5}::int, ${windowSec(RATE_LIMITS.global_ops.windowMs)}::int) AS global_ok
    `;
    if (!row.ip_ok)     throw new ApiError('Too many requests from this IP', 429);
    if (!row.global_ok) throw new ApiError('Server busy, please try again shortly', 429);
    return;
  }

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

/** Call at the top of public endpoints (acceptInvite, lookupInvite, etc.) — no session required. */
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

/** Call inside Credentials authorize() — return null to deny when this returns false. */
export async function checkLoginLimit(email: string): Promise<boolean> {
  const [row] = await prisma.$queryRaw<[{ ok: boolean }]>`
    SELECT check_rate_limit(${`login:${email.toLowerCase()}`}::text, ${RATE_LIMITS.login_attempts.max}::int, ${windowSec(RATE_LIMITS.login_attempts.windowMs)}::int) AS ok
  `;
  return row.ok;
}
