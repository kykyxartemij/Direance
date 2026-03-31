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
      if (!isLoggedIn && !isAuthPage) return false;
      return true;
    },
  },
  providers: [], // populated in auth.ts
};
