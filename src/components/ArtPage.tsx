'use client';

import { Suspense, type ReactNode } from 'react';
import ArtTitle from '@/components/ui/ArtTitle';
import ArtButton from '@/components/ui/ArtButton';
import { cn } from '@/components/ui/art.utils';
import PageLoader from './PageLoader';
import PageLoaderBlur from './PageLoaderBlur';
import { ArtErrorBoundary } from './ArtErrorBoundary';

// ==== Types ====

const MAX_WIDTH_CLASS = {
  '2xl': 'max-w-2xl',
  '5xl': 'max-w-5xl',
  '7xl': 'max-w-7xl',
} as const;

interface ArtPageProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  maxWidth?: keyof typeof MAX_WIDTH_CLASS;
  className?: string;
  children: ReactNode;
}

// ==== Error fallback ====

function ArtPageError({ error }: { error: Error }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Something went wrong</h2>
        <p className="text-sm" style={{ color: 'var(--art-danger)' }}>{error.message}</p>
      </div>
      <ArtButton variant="outlined" onClick={() => window.location.reload()}>Reload</ArtButton>
    </div>
  );
}

// ==== Component ====
// Owns what page.tsx + layout.tsx + loading.tsx used to split across three files: chrome
// (title/actions), a Suspense boundary, and the error fallback. page.tsx stays a thin shell
// rendering the feature component, which returns this as its root.
//
// The Suspense boundary is a safety net — it covers `useSearchParams` (which suspends during
// prerender) and any lazy child. It is NOT a licence for useSuspenseQuery: first-load state
// is always a plain useQuery gated on isLoading by the component that owns the fetch.
// Already-mounted opportunistic fetches tag `meta: { withPageLoaderBlur: true }` — PageLoaderBlur
// blurs just this page's content; see GlobalLoaderBlur for the app-wide equivalent
// (meta.withGlobalLoaderBlur).

export default function ArtPage({ title, description, actions, maxWidth = '5xl', className, children }: ArtPageProps) {
  return (
    <div className={cn('mx-auto py-8', MAX_WIDTH_CLASS[maxWidth], className)}>
      <div className="flex items-start justify-between mb-6">
        <ArtTitle title={title} description={description} className="mb-0" />
        {actions}
      </div>

      <ArtErrorBoundary fallback={(err) => <ArtPageError error={err} />}>
        <div className="art-page-content">
          <Suspense fallback={<PageLoader />}>{children}</Suspense>
          <PageLoaderBlur />
        </div>
      </ArtErrorBoundary>
    </div>
  );
}

ArtPage.displayName = 'ArtPage';
