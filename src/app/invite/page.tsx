import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';
import PermissionPage from '@/components/PermissionPage';
import { Permission } from '@/lib/permissions';
import InvitePage from '@/page/invite/InvitePage';

export const metadata: Metadata = { title: 'Invite User' };

export default function Page() {
  return (
    <PermissionPage permission={Permission.CAN_INVITE_USERS}>
      <ArtPage title="Invite User" description="Send a new user an email invitation." maxWidth="2xl">
        <InvitePage />
      </ArtPage>
    </PermissionPage>
  );
}
