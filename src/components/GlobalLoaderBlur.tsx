'use client';

import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useDebouncedActive } from './useDebouncedActive';
import LoaderRingDots from './LoaderRingDots';

/** App-wide blur — mounted once in layout.tsx. Blurs the whole viewport while any query/mutation tagged `meta: { withGlobalLoaderBlur: true }` is in flight. */
export default function GlobalLoaderBlur() {
  const fetching = useIsFetching({ predicate: (q) => q.meta?.withGlobalLoaderBlur === true });
  const mutating = useIsMutating({ predicate: (m) => m.options.meta?.withGlobalLoaderBlur === true });
  const visible = useDebouncedActive(fetching + mutating > 0);

  return (
    <div className={`global-loading-overlay${visible ? ' is-active' : ''}`} aria-hidden={!visible}>
      <LoaderRingDots subtitle />
    </div>
  );
}
