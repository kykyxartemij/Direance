'use client';

import type { ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import GlobalLoader from '@/components/GlobalLoader';

// Blocks render of the whole app until next-auth resolved the session.
// Until then no child fetches fire, no nav flicker, no wrong Header.
export default function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useSession();
  if (status === 'loading') {
    return <GlobalLoader />;
  }
  return <>{children}</>;
}
