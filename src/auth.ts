import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { authConfig } from './auth.config';
import { ApiError } from './models/api-error';
import { hasPermission, type Permission } from './lib/permissions';
import { checkLoginRate, checkUserRequestLimit } from './lib/rateLimiter';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        if (!await checkLoginRate(credentials.email as string)) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          select: { id: true, email: true, name: true, password: true },
        });

        if (!user?.password) return null;

        const valid = await bcrypt.compare(credentials.password as string, user.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // OAuth: set emailVerified on existing users (may fail for brand-new OAuth users
      // because PrismaAdapter creates the record after this callback — safe to ignore)
      if (account?.provider !== 'credentials' && user.email && !('emailVerified' in user && user.emailVerified)) {
        // user.emailVerified comes from PrismaAdapter — if already set, skip network entirely
        // If null (first OAuth sign-in), write once; catch handles brand-new users
        // where adapter hasn't created the record yet
        await prisma.user.updateMany({
          where: { email: user.email, emailVerified: null },
          data: { emailVerified: new Date() },
        }).catch(() => undefined);
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        // Embed permissions in JWT on sign-in — no DB call on subsequent requests
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { permissions: true },
        });
        token.permissions = dbUser?.permissions ?? [];
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.permissions = token.permissions as string[];
      return session;
    },
  },
});

// ==== Auth helpers ====

/** GET endpoints that need permissions — returns userId + permissions */
export async function requireAuth(checkPermission?: Permission): Promise<{ userId: string; permissions: string[] }> {
  const session = await auth();
  if (!session?.user?.id) throw new ApiError('Unauthorized', 401);
  if (checkPermission !== undefined && !hasPermission(session.user, checkPermission))
    throw new ApiError('Forbidden', 403);
  return { userId: session.user.id, permissions: session.user.permissions ?? [] };
}
