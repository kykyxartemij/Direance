'use client';

import { SessionProvider, useSession } from 'next-auth/react';
import type { ReactNode } from 'react';
import { checkPermission, type PermissionCheck } from '@/lib/permissions';

// ==== Provider ====

export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

// ==== Hook ====

export function useAuth() {
  const { data: session, status } = useSession();
  const user = session?.user ?? null;

  return {
    user,
    isLoading: status === 'loading',
    hasPermission: (check: PermissionCheck) => checkPermission(user, check),
  };
}
