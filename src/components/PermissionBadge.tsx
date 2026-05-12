'use client';

import ArtBadge from '@/components/ui/ArtBadge';
import { Permission } from '@/lib/permissions';
import type { ArtColor } from '@/components/ui/art.types';
import type { ArtIconName } from '@/components/ui/ArtIcon';

// ==== Meta ====

const PERMISSION_META: Record<Permission, { label: string; color?: ArtColor; icon: ArtIconName }> = {
  [Permission.IS_ADMIN]:                    { label: 'Admin',              color: 'danger',  icon: 'Lock'     },
  [Permission.CAN_INVITE_USERS]:            { label: 'Invite Users',       color: 'success', icon: 'UserPlus' },
  [Permission.CAN_MODIFY_GLOBAL]:           { label: 'Modify Global',      color: 'primary', icon: 'Globe'    },
  [Permission.CAN_ACCESS_USERS]:            { label: 'Access Users',       color: 'warning', icon: 'Users'    },
  [Permission.CAN_CHANGE_USER_PERMISSIONS]: { label: 'Change Permissions', color: 'warning', icon: 'Shield'   },
  [Permission.NO_DB_SIZE_LIMITS]:           { label: 'No DB Size Limits',  color: 'neutral', icon: 'Database' },
  [Permission.NO_DB_REQUEST_LIMITS]:        { label: 'No Rate Limits',     color: 'neutral', icon: 'Zap'      },
  [Permission.CAN_ACCESS_DB_STATS]:         { label: 'DB Stats',           color: 'primary', icon: 'BarChart' },
};

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
