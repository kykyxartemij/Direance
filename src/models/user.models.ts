import * as yup from 'yup';
import { Permission } from '@/lib/permissions';

// ==== Models ====

export type UserModel = {
  id: string;
  email: string;
  name: string | null;
  permissions: string[];
};

// ==== Validators ====

export const UpdateUserValidator = yup.object({
  name: yup.string().nullable().optional(),
  email: yup.string().email('Invalid email').required('Email is required'),
  permissions: yup.array(yup.string().oneOf(Object.values(Permission), 'Invalid permission')).optional(),
});

// ==== Input models ====

export type UpdateUserModel = yup.InferType<typeof UpdateUserValidator>;
