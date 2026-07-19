import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, tryAuth } from '@/auth';
import { Permission } from '@/lib/permissions';
import { handleApiError, type HttpMethod } from '@/lib/errorHandler';
import { runWithContext } from '@/lib/requestContext';
import { assertInstanceCapacity, assertIpCapacity, assertUserCapacity, getIp } from '@/lib/rateLimiter';

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

// Cheapest checks first: instance/IP trip-wires → auth → user trip-wire → body.
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
      const ip = getIp(req);
      assertIpCapacity(ip);
      const auth = await requireAuth(opts.permission);
      assertUserCapacity(auth.userId); // catches IP-rotation abuse — userId stays fixed across VPN/proxy hops
      return await runWithContext({ ip, auth }, () => body(req, ctx));
    } catch (error) {
      return handleApiError(error, req.method as HttpMethod, req.nextUrl.pathname);
    }
  };
}

// ==== withPublicHandler ====

// Same trip-wires as withHandler, auth optional. Sensitive public routes still need
// checkPublicRequestLimit in the body — this is not the authoritative limit.
export function withPublicHandler<
  TParams extends Record<string, string> = Record<string, string>,
>(
  body: Handler<TParams>,
): (req: NextRequest, routeCtx?: RouteCtx<TParams>) => Promise<NextResponse> {
  return async (req, routeCtx) => {
    const ctx = (routeCtx ?? { params: Promise.resolve({}) }) as RouteCtx<TParams>;
    try {
      assertInstanceCapacity();
      const ip = getIp(req);
      assertIpCapacity(ip);
      const auth = await tryAuth(); // null if not signed in
      if (auth) assertUserCapacity(auth.userId); // signed-in caller — same IP-rotation gap as withHandler
      return await runWithContext({ ip, auth }, () => body(req, ctx));
    } catch (error) {
      return handleApiError(error, req.method as HttpMethod, req.nextUrl.pathname);
    }
  };
}
