/* eslint-disable local/require-art-page */
// NOTE: parallel-routes slot, composed with @stats inside admin/layout.tsx's shared
// max-w-7xl wrapper — an <ArtPage> here would nest a second max-width container and
// duplicate chrome. Own title/permission-gate come from @users/layout.tsx instead.
'use client';

import UsersSection from '@/page/admin/UsersSection';

export default function Page() {
  return <UsersSection />;
}
