import * as yup from 'yup';
import { Permission } from '@/lib/permissions';

// ==== Validators ====

// Body-shape only — used for FE form validation and as the base for the BE factory.
const SendInviteValidator = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
  permissions: yup
    .array()
    .of(yup.string().oneOf(Object.values(Permission), 'Invalid permission').required())
    .default([]),
});

// Bakes inviter's permission context into the validator: body-shape checks PLUS grant rules
// (IS_ADMIN never grantable, needs CAN_CHANGE_USER_PERMISSIONS, can't grant perms not held).
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
};

// Invite send limits. Stats backed by Resend emails.list (page 1 of 100).
// capped = true when fetched 100 items had_more — real volume ≥ shown.
export type InviteLimitsModel = {
  daily:   { sent: number; limit: number };
  monthly: { sent: number; limit: number };
  capped: boolean;
};
