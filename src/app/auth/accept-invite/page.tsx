'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { signIn } from 'next-auth/react';
import axiosClient from '@/lib/axiosClient';
import ArtInput from '@/components/ui/ArtInput';
import ArtButton from '@/components/ui/ArtButton';

const schema = yup.object({
  name: yup.string().default(''),
  password: yup.string().min(8, 'At least 8 characters').required('Password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords do not match')
    .required('Please confirm your password'),
});

type FormValues = yup.InferType<typeof schema>;

type InviteState =
  | { status: 'loading' }
  | { status: 'valid'; email: string }
  | { status: 'invalid'; message: string };

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [invite, setInvite] = useState<InviteState>({ status: 'loading' });

  useEffect(() => {
    if (!token) { setInvite({ status: 'invalid', message: 'Missing invite token.' }); return; }

    axiosClient
      .get(`/api/invites/lookup?token=${encodeURIComponent(token)}`)
      .then((res) => setInvite({ status: 'valid', email: res.data.email }))
      .catch((err) => {
        const message = err?.response?.data?.error ?? 'Invalid or expired invite link.';
        setInvite({ status: 'invalid', message });
      });
  }, [token]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: yupResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    if (invite.status !== 'valid') return;
    try {
      await axiosClient.post('/api/invites/accept', {
        token,
        name: data.name || undefined,
        password: data.password,
      });

      const result = await signIn('credentials', {
        email: invite.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        router.push('/auth/sign-in');
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      const message = (err as any)?.response?.data?.error ?? 'Failed to create account.';
      setError('root', { message });
    }
  };

  if (invite.status === 'loading') {
    return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Validating invite…</p>;
  }

  if (invite.status === 'invalid') {
    return (
      <>
        <h1 className="mb-3 text-xl font-semibold" style={{ color: 'var(--text)' }}>
          Invalid invite
        </h1>
        <p className="text-sm" style={{ color: 'var(--art-danger)' }}>{invite.message}</p>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-2 text-xl font-semibold" style={{ color: 'var(--text)' }}>
        Create your account
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        Invited as <strong>{invite.email}</strong>
      </p>

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
    </>
  );
}
