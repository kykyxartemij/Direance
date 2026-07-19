import type { NextAuthConfig } from 'next-auth';

// Edge-safe config — no Prisma, no bcrypt, no Node.js-only modules.
// Used by middleware for route protection.
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/auth/sign-in',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = nextUrl.pathname.startsWith('/auth');
      const isPublicApi = nextUrl.pathname.startsWith('/api/invites/lookup') || nextUrl.pathname.startsWith('/api/invites/accept');
      if (!isLoggedIn && !isAuthPage && !isPublicApi) return false;
      return true;
    },
  },
  providers: [], // populated in auth.ts
};
