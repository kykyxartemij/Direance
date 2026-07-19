'use client';

import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useDebouncedActive } from './useDebouncedActive';
import LoaderRingDots from './LoaderRingDots';

/** Scoped equivalent of GlobalLoaderBlur — used inside ArtPage, blurs just its content area
 * instead of the whole viewport. Blurs while any query/mutation tagged
 * `meta: { withPageLoaderBlur: true }` is in flight. */
export default function PageLoaderBlur() {
  const fetching = useIsFetching({ predicate: (q) => q.meta?.withPageLoaderBlur === true });
  const mutating = useIsMutating({ predicate: (m) => m.options.meta?.withPageLoaderBlur === true });
  const visible = useDebouncedActive(fetching + mutating > 0);

  return (
    <div className={`art-page-blur-inline${visible ? ' is-active' : ''}`} aria-hidden={!visible}>
      <LoaderRingDots />
    </div>
  );
}
