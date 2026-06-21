import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { AuthCtx } from '@/lib/withHandler';

// ==== Request context ====

// Per-request ambient store for the authed identity. withHandler seeds it once
// (see runWithCtx below); any service in the call tree reads it via getAuth()
// without threading userId/permissions through every signature.

const authStore = new AsyncLocalStorage<AuthCtx>();

/**
 * Seed the context for one request. withHandler wraps the body in this.
 * Write-once: if a context is already active (e.g. a withHandler-wrapped fn called
 * from inside another), the outer identity stands and this re-seed is a no-op — the
 * auth can never be silently swapped out mid-request.
 */
export const runWithAuth = <T>(auth: AuthCtx, fn: () => Promise<T>): Promise<T> =>
  authStore.getStore() ? fn() : authStore.run(auth, fn);

/** Read the authed identity. Throws if called outside a withHandler request. */
export function getAuth(): AuthCtx {
  const auth = authStore.getStore();
  if (!auth) throw new Error('getAuth() called outside a request context');
  return auth;
}

/** Read the authed identity if present, else null. For public routes (withPublicHandler). */
export function getAuthOptional(): AuthCtx | null {
  return authStore.getStore() ?? null;
}
