// ==== Permission enum ====
// String-backed so values survive JSON/DB round-trips.
// IS_ADMIN overrides every other permission check.

export enum Permission {
  IS_ADMIN               = 'IS_ADMIN', 

  CAN_INVITE_USERS       = 'CAN_INVITE_USERS',
  CAN_MODIFY_GLOBAL      = 'CAN_MODIFY_GLOBAL',

  CAN_ACCESS_USERS            = 'CAN_ACCESS_USERS',
  CAN_CHANGE_USER_PERMISSIONS = 'CAN_CHANGE_USER_PERMISSIONS',
  CAN_DELETE_USERS            = 'CAN_DELETE_USERS',

  NO_DB_SIZE_LIMITS    = 'NO_DB_SIZE_LIMITS',
  NO_DB_REQUEST_LIMITS = 'NO_DB_REQUEST_LIMITS',
  CAN_ACCESS_DB_STATS  = 'CAN_ACCESS_DB_STATS',
}

// ==== Check types ====

export type PermissionCheck =
  | Permission
  | { anyOf: Permission[] }
  | { allOf: Permission[] };

// ==== Check helper ====

export function checkPermission(
  user: { permissions: string[] } | null | undefined,
  check: PermissionCheck,
): boolean {
  if (!user) return false;
  const perms = user.permissions ?? [];
  if (perms.includes(Permission.IS_ADMIN)) return true;
  if (typeof check === 'string') return perms.includes(check);
  if ('anyOf' in check) return check.anyOf.some(p => perms.includes(p));
  return check.allOf.every(p => perms.includes(p));
}

// ==== Legacy alias ====
export const hasPermission = (
  user: { permissions: string[] },
  perm: Permission,
) => checkPermission(user, perm);
