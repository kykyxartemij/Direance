/* eslint-disable local/require-art-page */
// NOTE: parallel-routes slot, composed with @users inside admin/layout.tsx's shared
// max-w-7xl wrapper — an <ArtPage> here would nest a second max-width container and
// duplicate chrome. Own title/permission-gate come from @stats/layout.tsx instead.
'use client';

import StatsSection from '@/page/admin/StatsSection';

export default function Page() {
  return <StatsSection />;
}
