import PermissionGuard from '@/components/PermissionGuard';
import ArtTitle from '@/components/ui/ArtTitle';
import { Permission } from '@/lib/permissions';
import type { ReactNode } from 'react';

export default function UsersLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGuard permission={Permission.CAN_ACCESS_USERS}>
      <div>
        <ArtTitle title="Users" />
        {children}
      </div>
    </PermissionGuard>
  );
}
