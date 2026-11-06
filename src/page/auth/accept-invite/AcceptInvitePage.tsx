'use client';

// NOTE: nextjs-no-use-search-params-without-suspense is a false positive — this page renders under loading.tsx which provides the Suspense boundary
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { signIn } from 'next-auth/react';
import { useLookupInvite, useAcceptInvite } from '@/hooks/invite.hooks';
import PageLoader from '@/components/PageLoader';
import { ArtForm, ArtFormInput } from '@/components/form';
import ArtInput from '@/components/ui/ArtInput';
import ArtTitle from '@/components/ui/ArtTitle';
import { AuthFormLayout } from '../AuthFormLayout';

const schema = yup.object({
  name: yup.string().default(''),
  password: yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .test('passwords-match', 'Passwords do not match', function (value) {
      return value === this.parent.password;
    }),
});

type FormValues = yup.InferType<typeof schema>;

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const lookup = useLookupInvite(token);
  const acceptInvite = useAcceptInvite({ meta: { errorMessage: 'Failed to accept invite' } });

  const methods = useForm<FormValues>({ resolver: yupResolver(schema) });
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
      <AuthFormLayout>
        <h1 className="mb-3 text-xl font-semibold">
          Invalid invite
        </h1>
        <p className="text-sm art-text-danger">Missing invite token.</p>
      </AuthFormLayout>
    );
  }

  if (lookup.isPending) return <PageLoader />;

  if (lookup.isError || !lookup.data) {
    return (
      <AuthFormLayout>
        <h1 className="mb-3 text-xl font-semibold">
          Invalid invite
        </h1>
        <p className="text-sm art-text-danger">
          {lookup.error?.message ?? 'Invalid or expired invite link.'}
        </p>
      </AuthFormLayout>
    );
  }

  return (
    <AuthFormLayout>
      <ArtTitle title="Create your account" />

      <ArtForm
        methods={methods}
        onSubmit={onSubmit}
        buttons={[
          { label: 'Create account', color: 'primary', type: 'submit', loading: acceptInvite.isPending },
        ]}
      >
        <ArtInput name="email" type="email" label="Email" value={lookup.data.email} autoComplete="username" readOnly />
        <ArtFormInput
          name="name"
          label="Display name"
          placeholder="Your name or nickname"
          helperText="How others see you. A nickname is fine."
          autoComplete="nickname"
        />
        <ArtFormInput name="password" type="password" label="Password" placeholder="••••••••" autoComplete="new-password" />
        <ArtFormInput name="confirmPassword" type="password" label="Confirm password" placeholder="••••••••" autoComplete="new-password" />
      </ArtForm>
    </AuthFormLayout>
  );
}
