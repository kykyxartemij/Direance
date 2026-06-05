import PermissionGuard from '@/components/PermissionGuard';
import ArtTitle from '@/components/ui/ArtTitle';
import { Permission } from '@/lib/permissions';
import type { ReactNode } from 'react';

export default function StatsLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionGuard permission={Permission.CAN_ACCESS_STATS}>
      <div>
        <ArtTitle title="Database Usage" description="Numbers update every few hours" />
        {children}
      </div>
    </PermissionGuard>
  );
}
