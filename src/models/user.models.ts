import * as yup from 'yup';

export type UserModel = {
  id: string;
  email: string;
  name: string | null;
  permissions: string[];
};

export const UserUpdateValidator = yup.object({
  name: yup.string().nullable().optional(),
});

export type UserUpdateModel = yup.InferType<typeof UserUpdateValidator>;
