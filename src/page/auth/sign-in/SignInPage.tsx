'use client';

import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { ArtForm, ArtFormInput } from '@/components/form';
import ArtTitle from '@/components/ui/ArtTitle';
import { AuthFormLayout } from '../AuthFormLayout';

// ==== Schema ====

const schema = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup.string().required('Password is required'),
});

type FormValues = yup.InferType<typeof schema>;

// ==== Component ====

export default function SignInPage() {
  const searchParams = useSearchParams();
  const verified = searchParams.get('verified') === 'true';

  const methods = useForm<FormValues>({ resolver: yupResolver(schema) });
  const { setError, formState: { isSubmitting } } = methods;

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

    // Hard reload (not router.push) so the new session cookie is read fresh
    // and Next streams loading.tsx during SSR instead of a stale soft nav.
    window.location.assign('/');
  };

  return (
    <AuthFormLayout>
      <ArtTitle title="Sign in to Direance" />

      {verified && (
        <p className="mb-4 text-sm art-text-success">
          Account created, you can sign in now.
        </p>
      )}

      <ArtForm
        methods={methods}
        onSubmit={onSubmit}
        buttons={[{ label: 'Sign in', color: 'primary', type: 'submit', loading: isSubmitting }]}
      >
        <ArtFormInput name="email" type="email" label="Email" placeholder="you@company.com" autoComplete="email" />
        <ArtFormInput name="password" type="password" label="Password" placeholder="••••••••" autoComplete="current-password" />
      </ArtForm>
    </AuthFormLayout>
  );
}
