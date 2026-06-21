import { Permission } from '@/lib/permissions';
import type { ArtColor } from '@/components/ui/art.types';
import type { ArtIconName } from '@/components/ui/ArtIcon';

export const PERMISSION_META: Record<Permission, { label: string; color?: ArtColor; icon: ArtIconName }> = {
  [Permission.IS_ADMIN]:                    { label: 'Admin',              color: 'danger',  icon: 'Lock'     },
  [Permission.CAN_INVITE_USERS]:            { label: 'Invite Users',       color: 'success', icon: 'UserPlus' },
  [Permission.CAN_MODIFY_GLOBAL]:           { label: 'Modify Global',      color: 'primary', icon: 'Globe'    },
  [Permission.CAN_ACCESS_USERS]:            { label: 'Access Users',       color: 'warning', icon: 'Users'    },
  [Permission.CAN_CHANGE_USER_PERMISSIONS]: { label: 'Change Permissions', color: 'warning', icon: 'Shield'   },
  [Permission.CAN_DELETE_USERS]:            { label: 'Delete Users',       color: 'danger',  icon: 'Close'    },
  [Permission.NO_DB_SIZE_LIMITS]:           { label: 'No DB Size Limits',  color: 'neutral', icon: 'Database' },
  [Permission.NO_DB_REQUEST_LIMITS]:        { label: 'No Rate Limits',     color: 'neutral', icon: 'Zap'      },
  [Permission.CAN_ACCESS_STATS]:            { label: 'Stats',              color: 'primary', icon: 'BarChart' },
};
