'use client';

import { useForm, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useRouter } from 'next/navigation';
import { useSendInvite } from '@/hooks/invite.hooks';
import InviteLimitsSection from './InviteLimitsSection';
import { useAuth } from '@/providers/AuthProvider';
import { Permission } from '@/lib/permissions';
import PermissionGuard from '@/components/PermissionGuard';
import { useArtSnackbar } from '@/components/ui/ArtSnackbar';
import { ArtForm, ArtFormInput, ArtFormListbox } from '@/components/form';
import ArtLabel from '@/components/ui/ArtLabel';
import { type ArtListboxOption } from '@/components/ui/ArtListbox';
import { PERMISSION_META } from '@/components/permissionMeta';

// ==== Permission options ====
// IS_ADMIN never appears in the picker — admins can grant other perms but not their own role.

const GRANTABLE_PERMISSIONS: Permission[] = Object.values(Permission).filter(
  (p) => p !== Permission.IS_ADMIN,
);

// ==== Schema ====

const schema = yup.object({
  email: yup.string().trim().email('Invalid email').required('Email is required'),
  permissions: yup
    .array()
    .of(yup.string().oneOf(Object.values(Permission)).required())
    .default([]),
});

type FormValues = {
  email: string;
  permissions: string[];
};

// ==== Component ====

export default function InvitePage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();
  const { enqueueSuccess } = useArtSnackbar();
  const sendInvite = useSendInvite();

  const isAdmin = hasPermission(Permission.IS_ADMIN);
  const canGrant = isAdmin || hasPermission(Permission.CAN_CHANGE_USER_PERMISSIONS);

  // Selectable set = perms the inviter holds (admins see everything except IS_ADMIN).
  const userPerms = user?.permissions ?? [];
  const selectable = isAdmin
    ? GRANTABLE_PERMISSIONS
    : GRANTABLE_PERMISSIONS.filter((p) => userPerms.includes(p));

  const options: ArtListboxOption[] = selectable.map((p) => ({
    value: p,
    label: PERMISSION_META[p].label,
    icon: PERMISSION_META[p].icon,
    color: PERMISSION_META[p].color,
  }));

  const methods = useForm<FormValues>({
    resolver: yupResolver(schema) as Resolver<FormValues>,
    defaultValues: { email: '', permissions: [] },
  });

  function onSubmit(data: FormValues) {
    sendInvite.mutate(
      { email: data.email, permissions: data.permissions as Permission[] },
      {
        onSuccess: () => {
          enqueueSuccess(`Invite sent to ${data.email}`);
          router.push('/admin');
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
    <ArtForm
      methods={methods}
      onSubmit={onSubmit}
      buttons={[
        { label: 'Cancel', variant: 'ghost', type: 'button', onClick: () => router.back() },
        { label: 'Send invite', color: 'primary', type: 'submit', loading: sendInvite.isPending },
      ]}
    >
      <ArtFormInput
        name="email"
        type="email"
        label="Email"
        placeholder="newuser@company.com"
        required
        autoComplete="off"
      />

      {canGrant ? (
        <div className="flex flex-col gap-2">
          <ArtLabel>Permissions to grant</ArtLabel>
          {selectable.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              You don&apos;t hold any grantable permissions. The user will be invited without permissions.
            </p>
          ) : (
            <>
              <ArtFormListbox
                name="permissions"
                options={options}
                className="max-h-60 overflow-y-auto art-scrollable"
                noOptionsMessage={false}
              />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                You can only grant permissions you hold yourself.
              </p>
            </>
          )}
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          You can invite users but cannot assign permissions. The new user will start with no permissions.
        </p>
      )}
    </ArtForm>
    <PermissionGuard permission={Permission.CAN_ACCESS_STATS}>
      <InviteLimitsSection />
    </PermissionGuard>
    </div>
  );
}
