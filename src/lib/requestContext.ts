import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { AuthCtx } from '@/lib/withHandler';

// ==== Request context ====

// Per-request ambient store — ip always present, auth nullable (withPublicHandler, anonymous
// caller). withHandler/withPublicHandler seed it once via runWithContext; any service in the
// call tree reads it via getAuth()/getClientIp() without threading req or identity through
// every signature. One store, one seed call — auth and ip always resolve together per request.

type RequestCtx = {
  ip: string;
  auth: AuthCtx | null;
};

const ctxStore = new AsyncLocalStorage<RequestCtx>();

/**
 * Write-once: if a context is already active (e.g. a withHandler-wrapped fn called from inside
 * another), the outer context stands and this re-seed is a no-op — identity never swaps mid-request.
 */
export const runWithContext = <T>(ctx: RequestCtx, fn: () => Promise<T>): Promise<T> =>
  ctxStore.getStore() ? fn() : ctxStore.run(ctx, fn);

export function getAuth(): AuthCtx {
  const auth = ctxStore.getStore()?.auth;
  if (!auth) throw new Error('getAuth() called outside a request context');
  return auth;
}

/** For withPublicHandler bodies, where identity is optional. */
export function getAuthOptional(): AuthCtx | null {
  return ctxStore.getStore()?.auth ?? null;
}

/**
 * Ambient client IP — always present once seeded (auth or not). `req.headers` can't be read
 * inside an `unstable_cache` callback, so this is how checkUserRequestLimit/checkPublicRequestLimit
 * get `ip` from inside `cached()` without ever touching `req` again.
 */
export function getClientIp(): string {
  const ip = ctxStore.getStore()?.ip;
  if (!ip) throw new Error('getClientIp() called outside a request context');
  return ip;
}
