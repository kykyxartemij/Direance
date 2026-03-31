'use client';

import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axiosClient from '@/lib/axiosClient';
import ArtInput from '@/components/ui/ArtInput';
import ArtButton from '@/components/ui/ArtButton';

const schema = yup.object({
  name: yup.string().default(''),
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup.string().min(8, 'At least 8 characters').required('Password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords do not match')
    .required('Please confirm your password'),
});

type FormValues = yup.InferType<typeof schema>;

export default function SignUpPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: yupResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    try {
      await axiosClient.post('/api/auth/register', {
        name: data.name || undefined,
        email: data.email,
        password: data.password,
      });

      // Auto sign-in after registration
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        router.push('/auth/sign-in');
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      const message = err?.message ?? 'Registration failed';
      setError('root', { message });
    }
  };

  return (
    <>
      <h1 className="mb-6 text-xl font-semibold" style={{ color: 'var(--text)' }}>
        Create your account
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <ArtInput
          {...register('name')}
          label="Name"
          placeholder="Jane Smith"
          helperText={errors.name?.message}
          color={errors.name ? 'danger' : undefined}
          autoComplete="name"
        />

        <ArtInput
          {...register('email')}
          type="email"
          label="Email"
          placeholder="you@company.com"
          helperText={errors.email?.message}
          color={errors.email ? 'danger' : undefined}
          autoComplete="email"
        />

        <ArtInput
          {...register('password')}
          type="password"
          label="Password"
          placeholder="••••••••"
          helperText={errors.password?.message}
          color={errors.password ? 'danger' : undefined}
          autoComplete="new-password"
        />

        <ArtInput
          {...register('confirmPassword')}
          type="password"
          label="Confirm password"
          placeholder="••••••••"
          helperText={errors.confirmPassword?.message}
          color={errors.confirmPassword ? 'danger' : undefined}
          autoComplete="new-password"
        />

        {errors.root && (
          <p className="text-sm" style={{ color: 'var(--art-danger)' }}>
            {errors.root.message}
          </p>
        )}

        <ArtButton type="submit" loading={isSubmitting} variant="default" size="md">
          Create account
        </ArtButton>
      </form>

      <p className="mt-5 text-sm" style={{ color: 'var(--text-muted)' }}>
        Already have an account?{' '}
        <Link href="/auth/sign-in" style={{ color: 'var(--primary)' }}>
          Sign in
        </Link>
      </p>
    </>
  );
}
