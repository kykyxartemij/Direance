'use client';

import ArtSkeleton from '../ArtSkeleton';
import ArtCut from '../ArtCut';
import type { ProcessedColumn } from './types';

export function SkeletonCell({ col }: { col: ProcessedColumn<unknown> }) {
  const content = col.render ? col.render({} as unknown, 0) : <span>&nbsp;</span>;
  return (
    <ArtCut width={col._cutWidth ?? '100%'}>
      <ArtSkeleton wrap>{content}</ArtSkeleton>
    </ArtCut>
  );
}
