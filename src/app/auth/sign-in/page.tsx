'use client';

import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ArtInput from '@/components/ui/ArtInput';
import ArtButton from '@/components/ui/ArtButton';

const schema = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup.string().required('Password is required'),
});

type FormValues = yup.InferType<typeof schema>;

export default function SignInPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: yupResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setError('root', { message: 'Invalid email or password' });
      return;
    }

    router.push('/');
    router.refresh();
  };

  return (
    <>
      <h1 className="mb-6 text-xl font-semibold" style={{ color: 'var(--text)' }}>
        Sign in to Direance
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
          autoComplete="current-password"
        />

        {errors.root && (
          <p className="text-sm" style={{ color: 'var(--art-danger)' }}>
            {errors.root.message}
          </p>
        )}

        <ArtButton type="submit" loading={isSubmitting} variant="default" size="md">
          Sign in
        </ArtButton>
      </form>

      <p className="mt-5 text-sm" style={{ color: 'var(--text-muted)' }}>
        No account?{' '}
        <Link href="/auth/sign-up" prefetch style={{ color: 'var(--primary)' }}>
          Create one
        </Link>
      </p>
    </>
  );
}
