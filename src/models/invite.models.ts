import * as yup from 'yup';
import { Permission } from '@/lib/permissions';

// ==== Validators ====

export const SendInviteValidator = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
  permissions: yup
    .array()
    .of(yup.string().oneOf(Object.values(Permission), 'Invalid permission').required())
    .default([]),
});

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
