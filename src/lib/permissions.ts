// ==== Permission enum ====
// String-backed so values survive JSON/DB round-trips.
// IS_ADMIN overrides every other permission check.

export enum Permission {
  IS_ADMIN               = 'IS_ADMIN',

  CAN_INVITE_USERS       = 'CAN_INVITE_USERS',
  CAN_MODIFY_GLOBAL      = 'CAN_MODIFY_GLOBAL',

  // Admin helpers users
  CAN_ACCESS_USERS   = 'CAN_ACCESS_USERS', // Can access user list 
  CAN_CHANGE_USER_PERMISSIONS = 'CAN_CHANGE_USER_PERMISSIONS', // Can change other users' permissions in user list

  // Internal verifiers
  NO_DB_SIZE_LIMITS         = 'NO_DB_SIZE_LIMITS', // Can bypass user limits
  NO_DB_REQUEST_LIMITS = 'NO_DB_REQUEST_LIMITS', // Can bypass request limits
  CAN_ACCESS_DB_STATS = 'CAN_ACCESS_DB_STATS', // See global DB stats (for monitoring from Neon db dashboard)
}

// ==== Check helper ====

export function hasPermission(
  user: { permissions: string[] },
  perm: Permission,
): boolean {
  const perms = user.permissions ?? [];
  return perms.includes(Permission.IS_ADMIN) || perms.includes(perm);
}
