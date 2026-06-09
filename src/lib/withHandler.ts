import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, tryAuth } from '@/auth';
import { Permission } from '@/lib/permissions';
import { checkPublicRequestLimit } from '@/lib/rateLimiter';
import { handleApiError, type HttpMethod } from '@/lib/errorHandler';
import { runWithAuth } from '@/lib/requestContext';

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

// requireAuth → seed request context → body → try/catch. Pass { permission } to gate.
export function withHandler<
  TParams extends Record<string, string> = Record<string, string>,
>(
  body: Handler<TParams>,
  opts: { permission?: Permission } = {},
): (req: NextRequest, routeCtx?: RouteCtx<TParams>) => Promise<NextResponse> {
  return async (req, routeCtx) => {
    const ctx = (routeCtx ?? { params: Promise.resolve({}) }) as RouteCtx<TParams>;
    try {
      const auth = await requireAuth(opts.permission);
      return await runWithAuth(auth, () => body(req, ctx));
    } catch (error) {
      return handleApiError(error, req.method as HttpMethod, req.nextUrl.pathname);
    }
  };
}

// ==== withPublicHandler ====

// Like withHandler but auth is optional: seeds context if signed in, else runs anyway.
// Read identity in the body with getAuthOptional() (null when anonymous).
export function withPublicHandler<
  TParams extends Record<string, string> = Record<string, string>,
>(
  body: Handler<TParams>,
): (req: NextRequest, routeCtx?: RouteCtx<TParams>) => Promise<NextResponse> {
  return async (req, routeCtx) => {
    const ctx = (routeCtx ?? { params: Promise.resolve({}) }) as RouteCtx<TParams>;
    try {
      await checkPublicRequestLimit(req);
      const auth = await tryAuth(); // null if not signed in
      return auth
        ? await runWithAuth(auth, () => body(req, ctx))
        : await body(req, ctx);
    } catch (error) {
      return handleApiError(error, req.method as HttpMethod, req.nextUrl.pathname);
    }
  };
}
