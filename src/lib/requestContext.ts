import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { AuthCtx } from '@/lib/withHandler';

// ==== Request context ====

// Per-request ambient store for the authed identity. withHandler seeds it once
// (see runWithCtx below); any service in the call tree reads it via getAuth()
// without threading userId/permissions through every signature.

const authStore = new AsyncLocalStorage<AuthCtx>();

/**
 * Write-once: if a context is already active (e.g. a withHandler-wrapped fn called from inside
 * another), the outer identity stands and this re-seed is a no-op — auth never swaps mid-request.
 */
export const runWithAuth = <T>(auth: AuthCtx, fn: () => Promise<T>): Promise<T> =>
  authStore.getStore() ? fn() : authStore.run(auth, fn);

export function getAuth(): AuthCtx {
  const auth = authStore.getStore();
  if (!auth) throw new Error('getAuth() called outside a request context');
  return auth;
}

/** For withPublicHandler bodies, where identity is optional. */
export function getAuthOptional(): AuthCtx | null {
  return authStore.getStore() ?? null;
}
