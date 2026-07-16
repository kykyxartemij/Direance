'use client';

import { useEffect, useRef, useState } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';

const SHOW_DELAY_MS = 80;
const MIN_VISIBLE_MS = 150;

export default function GlobalLoadingOverlay() {
  const fetching = useIsFetching({ predicate: (q) => q.meta?.waitForLoading === true });
  const mutating = useIsMutating({ predicate: (m) => m.options.meta?.waitForLoading === true });
  const active = fetching + mutating > 0;

  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (active && !visible) {
      const timer = setTimeout(() => {
        setVisible(true);
        shownAtRef.current = Date.now();
      }, SHOW_DELAY_MS);
      return () => clearTimeout(timer);
    }
    if (!active && visible) {
      const elapsed = Date.now() - (shownAtRef.current ?? 0);
      const timer = setTimeout(() => setVisible(false), Math.max(0, MIN_VISIBLE_MS - elapsed));
      return () => clearTimeout(timer);
    }
  }, [active, visible]);

  return (
    <div className={`global-loading-overlay${visible ? ' is-active' : ''}`} aria-hidden={!visible}>
      <div className="flex flex-col items-center gap-4">
        <div className="global-loader-ring" aria-hidden="true" />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Loading<span className="global-loader-dots" />
        </span>
      </div>
    </div>
  );
}
