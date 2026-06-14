'use client';

import ArtBadge from '@/components/ui/ArtBadge';
import { Permission } from '@/lib/permissions';
import { PERMISSION_META } from '@/components/permissionMeta';

// ==== Component ====

export default function PermissionBadge({ permission }: { permission: string }) {
  const meta = PERMISSION_META[permission as Permission];
  if (!meta) return <ArtBadge size="md">{permission}</ArtBadge>;
  return (
    <ArtBadge size="md" color={meta.color} icon={meta.icon}>
      {meta.label}
    </ArtBadge>
  );
}
