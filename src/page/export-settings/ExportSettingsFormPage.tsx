'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  useGetExportSettingById,
  useCreateExportSetting,
  useUpdateExportSetting,
} from '@/hooks/export-settings.hooks';
import {
  useGetLogoByExportSettingId,
  useDeleteLogo,
} from '@/hooks/logo.hooks';
import { useArtSnackbar } from '@/components/ui/ArtSnackbar';
import type { HeaderItemModel, HeaderLayoutModel, CreateExportSettingModel, UpdateExportSettingModel } from '@/models/export-settings.models';
import { ArtForm, ArtFormInput, ArtFormCheckbox } from '@/components/form';
import ArtInput from '@/components/ui/ArtInput';
import ArtButton from '@/components/ui/ArtButton';
import ArtLabel from '@/components/ui/ArtLabel';

// ==== Types ====

interface ExportSettingsFormPageProps {
  id?: string;
}

// ==== Schema ====

const formSchema = yup.object({
  name: yup.string().trim().min(1, 'Name is required').required('Name is required'),
  applyHeaderToAllSheets: yup.boolean().default(false),
  includeOriginalSheets: yup.boolean().default(false),
  headerLogoCell: yup.string().optional(),
  headerDataStartCell: yup.string().optional(),
});

type FormValues = {
  name: string;
  applyHeaderToAllSheets: boolean;
  includeOriginalSheets: boolean;
  headerLogoCell: string | undefined;
  headerDataStartCell: string | undefined;
};

// ==== Tag input (controlled — renders chips in real time) ====

function TagInput({
  values,
  placeholder,
  onChange,
}: {
  values: string[];
  placeholder?: string;
  onChange: (next: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function commit() {
    const v = inputRef.current?.value.trim() ?? '';
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <ArtInput
          ref={inputRef}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        />
        <ArtButton type="button" variant="outlined" size="sm" onClick={commit}>Add</ArtButton>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <span
              key={v}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-sm"
              style={{ background: 'var(--border)', color: 'var(--text)' }}
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((n) => n !== v))}
                className="opacity-50 hover:opacity-100 leading-none"
                aria-label={`Remove ${v}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ==== Header item row (uncontrolled — many rows, read on submit via ref) ====

interface HeaderItemRowRef {
  getData(): HeaderItemModel;
}

const HeaderItemRow = forwardRef<HeaderItemRowRef, { item: HeaderItemModel; onRemove: () => void }>(
  ({ item, onRemove }, ref) => {
    const cellRef = useRef<HTMLInputElement>(null);
    const contentRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      getData: () => ({
        cell: cellRef.current?.value ?? '',
        content: contentRef.current?.value ?? '',
      }),
    }));

    return (
      <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '80px 1fr 32px' }}>
        <ArtInput ref={cellRef} placeholder="B1" defaultValue={item.cell} />
        <ArtInput ref={contentRef} placeholder="Company Name or <Placeholder>" defaultValue={item.content} />
        <ArtButton type="button" variant="ghost" color="danger" size="sm" onClick={onRemove}>×</ArtButton>
      </div>
    );
  }
);
HeaderItemRow.displayName = 'HeaderItemRow';

// ==== Shared logo UI ====

interface LogoUIProps {
  previewSrc: string | null;
  fileName: string | null;
  hasStoredLogo: boolean;
  uploading: boolean;
  deleting: boolean;
  loadingPreview: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: () => void;
  onLoadPreview?: () => void;
}

function LogoUI({
  previewSrc,
  fileName,
  hasStoredLogo,
  uploading,
  deleting,
  loadingPreview,
  fileInputRef,
  onFileChange,
  onDelete,
  onLoadPreview,
}: LogoUIProps) {
  return (
    <div className="flex flex-col gap-3">
      {previewSrc ? (
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc}
            alt="Logo preview"
            className="rounded"
            style={{ maxHeight: 64, maxWidth: 200, objectFit: 'contain', background: 'var(--border)', padding: 6 }}
          />
          <div className="flex flex-col gap-1">
            <span className="text-sm" style={{ color: 'var(--text)' }}>{fileName}</span>
            <div className="flex gap-2">
              <ArtButton type="button" variant="outlined" size="sm" loading={uploading} onClick={() => fileInputRef.current?.click()}>
                Replace
              </ArtButton>
              <ArtButton type="button" variant="ghost" color="danger" size="sm" loading={deleting} onClick={onDelete}>
                Remove
              </ArtButton>
            </div>
          </div>
        </div>
      ) : hasStoredLogo ? (
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{fileName}</span>
          <ArtButton type="button" variant="outlined" size="sm" loading={loadingPreview} onClick={onLoadPreview}>
            Load preview
          </ArtButton>
          <ArtButton type="button" variant="ghost" color="danger" size="sm" loading={deleting} onClick={onDelete}>
            Remove
          </ArtButton>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <ArtButton
            type="button"
            variant="outlined"
            size="sm"
            loading={uploading}
            onClick={() => fileInputRef.current?.click()}
            style={{ alignSelf: 'flex-start' }}
          >
            Upload logo
          </ArtButton>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            PNG, JPEG, WebP, or GIF — automatically compressed to max 200 KB.
            Stored securely in your account.
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />
    </div>
  );
}

// ==== Logo section (edit mode — lazy preview on demand) ====

function LogoSectionEdit({ id }: { id: string }) {
  const { data: settings, refetch: refetchMeta } = useGetExportSettingById(id);
  const logoQuery = useGetLogoByExportSettingId(id);
  const { enqueueSuccess, enqueueError } = useArtSnackbar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUpdateExportSetting();
  const deleteMutation = useDeleteLogo();

  const previewSrc = logoQuery.data?.logoData
    ? `data:${logoQuery.data.logoMime ?? 'image/jpeg'};base64,${logoQuery.data.logoData}`
    : null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    uploadMutation.mutate({ id, body: {}, logo: file }, {
      onSuccess: () => { refetchMeta(); enqueueSuccess('Logo uploaded'); },
      onError: (err) => enqueueError(err as Error, 'Failed to upload logo'),
    });
  }

  return (
    <LogoUI
      previewSrc={previewSrc}
      fileName={logoQuery.data?.logoName ?? settings?.logo?.name ?? null}
      hasStoredLogo={!!settings?.logo?.name && !previewSrc}
      uploading={uploadMutation.isPending}
      deleting={deleteMutation.isPending}
      loadingPreview={logoQuery.isFetching}
      fileInputRef={fileInputRef}
      onFileChange={handleFileChange}
      onDelete={() => deleteMutation.mutate({ logoId: settings?.logo?.id ?? '', exportSettingId: id }, {
        onSuccess: () => { refetchMeta(); enqueueSuccess('Logo removed'); },
        onError: (err) => enqueueError(err as Error, 'Failed to remove logo'),
      })}
      onLoadPreview={() => logoQuery.refetch()}
    />
  );
}

// ==== Logo section (create mode — staged locally, uploaded after create) ====

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface LogoSectionCreateProps {
  stagedFile: File | null;
  stagedPreview: string | null;
  onFileStaged: (file: File, preview: string) => void;
  onFileCleared: () => void;
}

function LogoSectionCreate({ stagedFile, stagedPreview, onFileStaged, onFileCleared }: LogoSectionCreateProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = await fileToBase64(file);
    onFileStaged(file, preview);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <LogoUI
      previewSrc={stagedPreview && stagedFile ? `data:${stagedFile.type};base64,${stagedPreview}` : null}
      fileName={stagedFile?.name ?? null}
      hasStoredLogo={false}
      uploading={false}
      deleting={false}
      loadingPreview={false}
      fileInputRef={fileInputRef}
      onFileChange={handleFileChange}
      onDelete={onFileCleared}
    />
  );
}

// ==== Page ====

export default function ExportSettingsFormPage({ id }: ExportSettingsFormPageProps) {
  const router = useRouter();
  const isEdit = !!id;
  const { enqueueSuccess, enqueueError } = useArtSnackbar();

  const { data: existing, isLoading } = useGetExportSettingById(id);

  // Block render until data is ready — defaultValue only sets initial value on mount
  if (isEdit && (isLoading || !existing)) return null;

  return (
    <ExportSettingForm
      id={id}
      existing={existing}
      isEdit={isEdit}
      onSuccess={() => router.push('/export-settings')}
      enqueueSuccess={enqueueSuccess}
      enqueueError={enqueueError}
    />
  );
}

// ==== Inner form (renders only once data is ready, defaultValues are stable) ====

interface ExportSettingFormProps {
  id?: string;
  existing?: ReturnType<typeof useGetExportSettingById>['data'];
  isEdit: boolean;
  onSuccess: () => void;
  enqueueSuccess: (title: string) => void;
  enqueueError: (err: Error, title: string) => void;
}

function ExportSettingForm({ id, existing, isEdit, onSuccess, enqueueSuccess, enqueueError }: ExportSettingFormProps) {
  // ==== RHF — simple scalar fields ====
  const methods = useForm<FormValues>({
    resolver: yupResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      name: existing?.name ?? '',
      applyHeaderToAllSheets: existing?.applyHeaderToAllSheets ?? false,
      includeOriginalSheets: existing?.includeOriginalSheets ?? false,
      headerLogoCell: existing?.headerLayout?.logoCell ?? '',
      headerDataStartCell: existing?.headerLayout?.dataStartCell ?? '',
    },
  });

  // ==== State — things that render chips or need live UI feedback ====
  const [mappedValueNames, setMappedValueNames] = useState<string[]>(existing?.mappedValueNames ?? []);
  const [stagedLogoFile, setStagedLogoFile] = useState<File | null>(null);
  const [stagedLogoPreview, setStagedLogoPreview] = useState<string | null>(null);

  // ==== Refs — header item rows (many rows, read on submit) ====
  const [items, setItems] = useState<HeaderItemModel[]>(existing?.headerLayout?.items ?? []);
  const itemRefs = useRef<(HeaderItemRowRef | null)[]>([]);

  const createMutation = useCreateExportSetting();
  const updateMutation = useUpdateExportSetting();

  // ==== Submit ====

  async function onSave(data: FormValues) {
    const itemValues = itemRefs.current
      .map((r) => r?.getData())
      .filter((it): it is HeaderItemModel => !!it && !!(it.cell || it.content));

    const headerLayout: HeaderLayoutModel = {};
    if (data.headerLogoCell) headerLayout.logoCell = data.headerLogoCell;
    if (data.headerDataStartCell) headerLayout.dataStartCell = data.headerDataStartCell;
    if (itemValues.length > 0) headerLayout.items = itemValues;

    const body = {
      name: data.name,
      applyHeaderToAllSheets: data.applyHeaderToAllSheets ?? false,
      includeOriginalSheets: data.includeOriginalSheets ?? false,
      mappedValueNames,
      headerLayout: Object.keys(headerLayout).length > 0 ? headerLayout : undefined,
    };

    if (isEdit) {
      updateMutation.mutate({ id: id!, body: body as UpdateExportSettingModel }, {
        onSuccess: () => { enqueueSuccess('Export setting saved'); onSuccess(); },
        onError: (err) => enqueueError(err as Error, 'Failed to save export setting'),
      });
    } else {
      createMutation.mutate({ body: body as CreateExportSettingModel, logo: stagedLogoFile ?? undefined }, {
        onSuccess: () => { enqueueSuccess('Export setting created'); onSuccess(); },
        onError: (err) => enqueueError(err as Error, 'Failed to create export setting'),
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="text-2xl font-semibold mb-8" style={{ color: 'var(--text)' }}>
        {isEdit ? 'Edit Export Setting' : 'New Export Setting'}
      </h1>

      <ArtForm
        methods={methods}
        onSubmit={onSave}
        buttons={[
          { label: 'Cancel', variant: 'ghost', type: 'button', onClick: onSuccess },
          { label: isEdit ? 'Save' : 'Create', color: 'primary', type: 'submit', loading: isPending },
        ]}
      >
        {/* ==== Name ==== */}
        <ArtFormInput name="name" label="Name" required />

        {/* ==== Logo ==== */}
        <div className="flex flex-col gap-3">
          <ArtLabel>Logo</ArtLabel>
          <ArtFormInput name="headerLogoCell" label="Logo cell" placeholder="A1" />
          {isEdit ? (
            <LogoSectionEdit id={id!} />
          ) : (
            <LogoSectionCreate
              stagedFile={stagedLogoFile}
              stagedPreview={stagedLogoPreview}
              onFileStaged={(file, preview) => { setStagedLogoFile(file); setStagedLogoPreview(preview); }}
              onFileCleared={() => { setStagedLogoFile(null); setStagedLogoPreview(null); }}
            />
          )}
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Scaled to max 64×180 px. Consider leaving ~4 empty rows below logo.
          </p>
        </div>

        {/* ==== Header layout ==== */}
        <div className="flex flex-col gap-3">
          <ArtLabel>Header layout</ArtLabel>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Use <span style={{ fontFamily: 'monospace' }}>&lt;Tag&gt;</span> in content for values filled at export time.
          </p>

          {items.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="grid gap-2 items-center text-xs font-medium" style={{ gridTemplateColumns: '80px 1fr 32px', color: 'var(--text-muted)' }}>
                <span>Cell</span>
                <span>Content</span>
                <span />
              </div>
              {items.map((item, i) => (
                <HeaderItemRow
                  key={i}
                  ref={(el) => { itemRefs.current[i] = el; }}
                  item={item}
                  onRemove={() => {
                    setItems((prev) => prev.filter((_, idx) => idx !== i));
                    itemRefs.current.splice(i, 1);
                  }}
                />
              ))}
            </div>
          )}

          <ArtButton
            type="button"
            variant="outlined"
            size="sm"
            onClick={() => setItems((prev) => [...prev, { cell: '', content: '' }])}
            style={{ alignSelf: 'flex-start' }}
          >
            + Add header cell
          </ArtButton>
        </div>

        {/* ==== Data start ==== */}
        <div className="flex flex-col gap-2">
          <ArtFormInput name="headerDataStartCell" label="Data start cell" placeholder="A4" />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Cell where data table begins. Account for logo and header rows above.
          </p>
        </div>

        {/* ==== Value categories ==== */}
        <div className="flex flex-col gap-2">
          <ArtLabel>Value categories</ArtLabel>
          <TagInput
            values={mappedValueNames}
            placeholder="e.g. Revenue, Expenses, Assets…"
            onChange={setMappedValueNames}
          />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Shown as Display Name options in Row Mappings.
          </p>
        </div>

        {/* ==== Toggles ==== */}
        <div className="flex flex-col gap-3">
          <ArtFormCheckbox name="applyHeaderToAllSheets" label="Apply header to all sheets" />
          <ArtFormCheckbox name="includeOriginalSheets" label="Include original sheets" />
        </div>
      </ArtForm>
    </div>
  );
}
