import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';
import InvitePage from '@/page/invite/InvitePage';

export const metadata: Metadata = { title: 'Invite User' };

export default function Page() {
  return (
    <ArtPage title="Invite User" description="Send an email invitation to a new user." maxWidth="2xl">
      <InvitePage />
    </ArtPage>
  );
}
