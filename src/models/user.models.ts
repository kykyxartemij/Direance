import * as yup from 'yup';
import type { Prisma } from '../../generated/prisma/client';
import { Permission } from '@/lib/permissions';

// ==== Select ====

export const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  permissions: true,
} as const;

// permissions is Prisma String[] (no native Prisma enum for app-level Permission).
export type UserModel = Omit<
  Prisma.UserGetPayload<{ select: typeof USER_SELECT }>,
  'permissions'
> & { permissions: Permission[] };

export type DbConsumption = { used: number; limit: number };

// ==== Update ====

const updateUserFields = {
  name: yup.string().nullable().optional(),
  email: yup.string().email('Invalid email').required('Email is required'),
  permissions: yup.array(yup.string().oneOf(Object.values(Permission), 'Invalid permission').defined()).optional(),
};

export const UpdateUserValidator = yup.object(updateUserFields);
export type UpdateUserModel = yup.InferType<typeof UpdateUserValidator>;
