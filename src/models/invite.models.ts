import * as yup from 'yup';
import { Permission } from '@/lib/permissions';

// ==== Validators ====

// Body-shape only — used for FE form validation and as the base for the BE factory.
export const SendInviteValidator = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
  permissions: yup
    .array()
    .of(yup.string().oneOf(Object.values(Permission), 'Invalid permission').required())
    .default([]),
});

/**
 * Build the BE validator with the inviter's permission context baked in.
 * Runs body-shape checks PLUS the permission grant rules in one pass.
 * Use with `{ abortEarly: false }` so all violations surface together.
 *
 * Rules:
 *  - IS_ADMIN is never grantable via invite.
 *  - Granting any perm requires CAN_CHANGE_USER_PERMISSIONS (admins implicit).
 *  - An inviter may only grant perms they themselves hold (admins implicit).
 */
export function buildSendInviteValidator(inviterPerms: string[]) {
  const isAdmin = inviterPerms.includes(Permission.IS_ADMIN);
  const canGrant = isAdmin || inviterPerms.includes(Permission.CAN_CHANGE_USER_PERMISSIONS);

  return SendInviteValidator.shape({
    permissions: yup
      .array()
      .of(yup.string().oneOf(Object.values(Permission), 'Invalid permission').required())
      .default([])
      .test(
        'no-admin',
        'IS_ADMIN cannot be granted via invite',
        (perms) => !perms?.includes(Permission.IS_ADMIN),
      )
      .test(
        'can-grant-perms',
        'You do not have permission to grant permissions',
        (perms) => !perms?.length || canGrant,
      )
      .test('subset-of-inviter', function (perms) {
        if (!perms?.length || isAdmin) return true;
        const exceeds = perms.filter((p) => !inviterPerms.includes(p as string));
        if (exceeds.length === 0) return true;
        return this.createError({
          message: `You cannot grant permissions you don't hold: ${exceeds.join(', ')}`,
        });
      }),
  });
}

export const AcceptInviteValidator = yup.object({
  token: yup.string().required('Token is required'),
  name: yup.string().default(''),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
});

// ==== Types ====

export type SendInviteModel = yup.InferType<typeof SendInviteValidator>;
export type AcceptInviteModel = yup.InferType<typeof AcceptInviteValidator>;

export type InviteModel = {
  id: string;
  email: string;
  invitedBy: string;
  permissions: Permission[];
  expiresAt: Date;
  createdAt: Date;
};
