'use client';

import { Component, Suspense, type ReactNode, type ErrorInfo } from 'react';
import ArtSkeleton from './ArtSkeleton';

// ==== Default skeleton ====

function DefaultSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-2">
      <ArtSkeleton style={{ height: 20, width: '40%', borderRadius: 4 }} />
      <ArtSkeleton style={{ height: 16, width: '70%', borderRadius: 4 }} />
      <ArtSkeleton style={{ height: 16, width: '55%', borderRadius: 4 }} />
    </div>
  );
}

// ==== ErrorBoundary ====

interface BoundaryProps {
  children: ReactNode;
  error?: ReactNode;
}

interface BoundaryState {
  caught: Error | null;
}

class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { caught: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { caught: error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ArtAsync]', error, info.componentStack);
  }

  render() {
    if (this.state.caught) {
      return this.props.error ?? (
        <p className="text-sm py-4" style={{ color: 'var(--danger)' }}>
          Something went wrong. Try refreshing.
        </p>
      );
    }
    return this.props.children;
  }
}

// ==== ArtAsync ====

interface ArtAsyncProps {
  children: ReactNode;
  /** Custom Suspense fallback. Defaults to generic ArtSkeleton bars. Pass null to disable. */
  fallback?: ReactNode;
  /** Custom error UI. Defaults to a generic error message. */
  error?: ReactNode;
}

export default function ArtAsync({ children, fallback, error }: ArtAsyncProps) {
  const skeleton = fallback !== undefined ? fallback : <DefaultSkeleton />;
  return (
    <ErrorBoundary error={error}>
      <Suspense fallback={skeleton}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
