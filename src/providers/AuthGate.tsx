'use client';

import type { ReactNode } from 'react';
import { useSession } from 'next-auth/react';

// Blocks render of the whole app until next-auth resolved the session.
// Until then no child fetches fire, no nav flicker, no wrong Header.
export default function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useSession();
  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-2" style={{ minHeight: '100vh' }}>
        <div className="global-loader-ring" aria-hidden="true" />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading<span className="global-loader-dots" /></span>
        <span className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>Please wait a moment</span>
      </div>
    );
  }
  return <>{children}</>;
}
