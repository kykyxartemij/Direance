import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, tryAuth } from '@/auth';
import { Permission } from '@/lib/permissions';
import { handleApiError, type HttpMethod } from '@/lib/errorHandler';
import { runWithAuth } from '@/lib/requestContext';
import { assertInstanceCapacity } from '@/lib/rateLimiter';

// ==== Types ====

export type AuthCtx = {
  userId: string;
  permissions: string[];
};

export type RouteCtx<TParams extends Record<string, string> = Record<string, string>> = {
  params: Promise<TParams>;
};

// A standard Next.js route handler (req, { params }). Identity is read via getAuth().
export type Handler<TParams extends Record<string, string> = Record<string, string>> =
  (req: NextRequest, ctx: RouteCtx<TParams>) => Promise<NextResponse>;

// ==== withHandler ====

// assertInstanceCapacity → requireAuth → seed request context → body → try/catch.
// Pass { permission } to gate.
export function withHandler<
  TParams extends Record<string, string> = Record<string, string>,
>(
  body: Handler<TParams>,
  opts: { permission?: Permission } = {},
): (req: NextRequest, routeCtx?: RouteCtx<TParams>) => Promise<NextResponse> {
  return async (req, routeCtx) => {
    const ctx = (routeCtx ?? { params: Promise.resolve({}) }) as RouteCtx<TParams>;
    try {
      assertInstanceCapacity();
      const auth = await requireAuth(opts.permission);
      return await runWithAuth(auth, () => body(req, ctx));
    } catch (error) {
      return handleApiError(error, req.method as HttpMethod, req.nextUrl.pathname);
    }
  };
}

// ==== withPublicHandler ====

// assertInstanceCapacity → optional auth seed → body → try/catch.
// Runs instance capacity guard automatically (in-memory, no DB).
// For IP-level protection on sensitive public endpoints, also call checkPublicRequestLimit in the body.
// Read identity in the body with getAuthOptional() (null when anonymous).
export function withPublicHandler<
  TParams extends Record<string, string> = Record<string, string>,
>(
  body: Handler<TParams>,
): (req: NextRequest, routeCtx?: RouteCtx<TParams>) => Promise<NextResponse> {
  return async (req, routeCtx) => {
    const ctx = (routeCtx ?? { params: Promise.resolve({}) }) as RouteCtx<TParams>;
    try {
      assertInstanceCapacity();
      const auth = await tryAuth(); // null if not signed in
      return auth
        ? await runWithAuth(auth, () => body(req, ctx))
        : await body(req, ctx);
    } catch (error) {
      return handleApiError(error, req.method as HttpMethod, req.nextUrl.pathname);
    }
  };
}
