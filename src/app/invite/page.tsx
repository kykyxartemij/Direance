import type { Metadata } from 'next';
import InvitePage from '@/page/invite/InvitePage';

export const metadata: Metadata = { title: 'Invite User' };

export default function Page() {
  return <InvitePage />;
}
