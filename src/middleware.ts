import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

// Edge-safe middleware — uses authConfig (no Prisma/Node.js imports).
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
