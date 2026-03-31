import * as yup from 'yup';

export type UserModel = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

export const UserUpdateValidator = yup.object({
  name: yup.string().nullable().optional(),
});

export type UserUpdateModel = yup.InferType<typeof UserUpdateValidator>;

export const RegisterValidator = yup.object({
  name: yup.string().default(''),
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
});
