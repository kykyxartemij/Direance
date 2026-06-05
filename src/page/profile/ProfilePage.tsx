'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useGetLightLogos, useCreateLogo, useDeleteLogo, useGetLogoById } from '@/hooks/logo.hooks';
import { useArtSnackbar } from '@/components/ui/ArtSnackbar';
import ArtButton from '@/components/ui/ArtButton';
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
  const [load, setLoad] = useState(false);
  const query = useGetLogoById(load ? id : '');
  const src = query.data?.data ? `data:${query.data.mime ?? 'image/webp'};base64,${query.data.data}` : null;

  return (
    <div className="flex items-center gap-4 py-2" style={{ borderTop: '1px solid var(--border)' }}>
      <div style={{ width: 80, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--border)', borderRadius: 4 }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name ?? 'Logo'} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {query.isFetching ? '…' : 'preview'}
          </span>
        )}
      </div>
      <span className="flex-1 text-sm" style={{ color: 'var(--text)' }}>{name ?? '(unnamed)'}</span>
      {!src && (
        <ArtButton type="button" variant="outlined" size="sm" loading={query.isFetching} onClick={() => setLoad(true)}>
          Load
        </ArtButton>
      )}
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
  const createLogo = useCreateLogo();
  const deleteLogo = useDeleteLogo();
  const { enqueueSuccess, enqueueError } = useArtSnackbar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    createLogo.mutate(file, {
      onSuccess: () => enqueueSuccess('Logo uploaded'),
      onError: (err) => enqueueError(err as Error, 'Failed to upload logo'),
    });
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
              onDelete={() =>
                deleteLogo.mutate({ logoId: logo.id }, {
                  onSuccess: () => enqueueSuccess('Logo deleted'),
                  onError: (err) => enqueueError(err as Error, 'Failed to delete logo'),
                })
              }
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
