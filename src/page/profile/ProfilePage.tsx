'use client';

import { useRef } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useGetLightLogos, useCreateLogo, useDeleteLogo, useGetLogoById } from '@/hooks/logo.hooks';
import ArtButton from '@/components/ui/ArtButton';
import ArtImage from '@/components/ui/ArtImage';
import { ArtConfirmDialog } from '@/components/ui/ArtDialog';

// ==== User info section ====

function UserInfoSection() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="flex flex-col gap-3 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        Account
      </h3>
      <Field label="Name" value={user.name ?? '—'} />
      <Field label="Email" value={user.email ?? '—'} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: '120px 1fr' }}>
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm" style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  );
}

// ==== Single logo row — bytes load on demand ====

function LogoRow({
  id,
  name,
  onDelete,
  deleting,
}: {
  id: string;
  name: string | null;
  onDelete: () => void;
  deleting: boolean;
}) {
  const query = useGetLogoById(id, { enabled: false });
  const src = query.data?.data ? `data:${query.data.mime ?? 'image/webp'};base64,${query.data.data}` : null;

  return (
    <div className="flex items-center gap-4 py-2" style={{ borderTop: '1px solid var(--border)' }}>
      <ArtImage
        src={src}
        alt={name ?? 'Logo'}
        width={80}
        height={48}
        isLoading={query.isFetching}
        onRequestLoad={() => query.refetch()}
      />
      <span className="flex-1 text-sm" style={{ color: 'var(--text)' }}>{name ?? '(unnamed)'}</span>
      <ArtConfirmDialog
        title="Delete logo"
        description={`Delete "${name ?? 'this logo'}"? Any ExportSetting using it will lose the logo reference.`}
        onConfirm={onDelete}
        confirmLabel="Delete"
      >
        <ArtButton type="button" variant="ghost" color="danger" size="sm" loading={deleting}>
          Delete
        </ArtButton>
      </ArtConfirmDialog>
    </div>
  );
}

// ==== Logos section ====

function LogosSection() {
  const { data: logos = [] } = useGetLightLogos();
  const createLogo = useCreateLogo({ meta: { successMessage: 'Logo uploaded', errorMessage: 'Failed to upload logo' } });
  const deleteLogo = useDeleteLogo({ meta: { successMessage: 'Logo deleted', errorMessage: 'Failed to delete logo' } });
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    createLogo.mutate(file);
  }

  return (
    <div className="flex flex-col gap-3 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Logos
        </h3>
        <ArtButton type="button" variant="outlined" size="sm" loading={createLogo.isPending} onClick={() => fileInputRef.current?.click()}>
          Upload
        </ArtButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          aria-label="Upload logo image"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {logos.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No logos uploaded yet.</p>
      ) : (
        <div className="flex flex-col">
          {logos.map((logo) => (
            <LogoRow
              key={logo.id}
              id={logo.id}
              name={logo.name}
              deleting={deleteLogo.isPending}
              onDelete={() => deleteLogo.mutate({ logoId: logo.id })}
            />
          ))}
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Uploaded logos can be linked from any Export Setting.
      </p>
    </div>
  );
}

// ==== Page ====

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <UserInfoSection />
      <LogosSection />
    </div>
  );
}
