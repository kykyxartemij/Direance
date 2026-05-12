'use client';

import dynamic from 'next/dynamic';

const StatsSection = dynamic(() => import('@/page/admin/StatsSection'), { ssr: false });

export default function Page() {
  return <StatsSection />;
}
