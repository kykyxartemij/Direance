import type { Metadata } from 'next';
import AcceptInvitePage from '@/page/auth/accept-invite/AcceptInvitePage';

export const metadata: Metadata = { title: 'Accept invite' };

export default function Page() {
  return <AcceptInvitePage />;
}
