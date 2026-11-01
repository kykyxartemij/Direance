import type { ReactNode } from 'react';
import PermissionPage from '@/components/PermissionPage';
import { Permission } from '@/lib/permissions';

// Either slot's permission opens the page; each slot still guards its own content.
const ADMIN_ACCESS = { anyOf: [Permission.CAN_ACCESS_STATS, Permission.CAN_ACCESS_USERS] };

export default function Layout({
  children,
  stats,
  users,
}: {
  children: ReactNode;
  stats: ReactNode;
  users: ReactNode;
}) {
  return (
    <PermissionPage permission={ADMIN_ACCESS}>
      <div className="mx-auto max-w-7xl py-8">
        <div className="flex flex-col gap-8">
          {stats}
          {users}
        </div>
      </div>
    </PermissionPage>
  );
}
