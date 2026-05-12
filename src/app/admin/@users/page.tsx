'use client';

import dynamic from 'next/dynamic';

const UsersSection = dynamic(() => import('@/page/admin/UsersSection'), { ssr: false });

export default function Page() {
  return <UsersSection />;
}
