'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { signIn } from 'next-auth/react';
import { useLookupInvite, useAcceptInvite } from '@/hooks/invite.hooks';
import { AcceptInviteValidator } from '@/models/invite.models';
import { ArtFormInput } from '@/components/form';
import ArtButton from '@/components/ui/ArtButton';

const FormValidator = AcceptInviteValidator.shape({
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords do not match')
    .required('Please confirm your password'),
});

type FormValues = yup.InferType<typeof FormValidator>;

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const lookup = useLookupInvite(token);
  const acceptInvite = useAcceptInvite();

  const methods = useForm<FormValues>({ resolver: yupResolver(FormValidator) });
  const { handleSubmit, formState: { errors, isSubmitting } } = methods;

  const onSubmit = (data: FormValues) => {
    if (!lookup.data) return;
    acceptInvite.mutate(
      { token, name: data.name ?? '', password: data.password },
      {
        onSuccess: async () => {
          const result = await signIn('credentials', {
            email: lookup.data!.email,
            password: data.password,
            redirect: false,
          });

          if (result?.error) {
            router.push('/auth/sign-in');
            return;
          }

          router.push('/');
          router.refresh();
        },
      },
    );
  };

  if (!token) {
    return (
      <>
        <h1 className="mb-3 text-xl font-semibold" style={{ color: 'var(--text)' }}>
          Invalid invite
        </h1>
        <p className="text-sm" style={{ color: 'var(--art-danger)' }}>Missing invite token.</p>
      </>
    );
  }

  if (lookup.isPending) {
    return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Validating invite…</p>;
  }

  if (lookup.isError || !lookup.data) {
    return (
      <>
        <h1 className="mb-3 text-xl font-semibold" style={{ color: 'var(--text)' }}>
          Invalid invite
        </h1>
        <p className="text-sm" style={{ color: 'var(--art-danger)' }}>
          {lookup.error?.message ?? 'Invalid or expired invite link.'}
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-2 text-xl font-semibold" style={{ color: 'var(--text)' }}>
        Create your account
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        Invited as <strong>{lookup.data.email}</strong>
      </p>

      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <ArtFormInput
            name="name"
            label="Display name (optional)"
            placeholder="A nickname, your real name — anything"
            helperText="Used to identify you in the system. A nickname is fine — your real name isn't required."
            autoComplete="nickname"
          />
          <ArtFormInput name="password" type="password" label="Password" placeholder="••••••••" autoComplete="new-password" />
          <ArtFormInput name="confirmPassword" type="password" label="Confirm password" placeholder="••••••••" autoComplete="new-password" />

          {errors.root && (
            <p className="text-sm" style={{ color: 'var(--art-danger)' }}>{errors.root.message}</p>
          )}

          <ArtButton type="submit" loading={isSubmitting || acceptInvite.isPending} variant="default" size="md">
            Create account
          </ArtButton>
        </form>
      </FormProvider>
    </>
  );
}
