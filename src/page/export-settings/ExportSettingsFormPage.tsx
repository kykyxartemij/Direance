'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  useGetLogoById,
  useGetLightLogos,
} from '@/hooks/logo.hooks';
import ArtComboBox, { type ArtComboBoxOption } from '@/components/ui/ArtComboBox';
import { useArtSnackbar } from '@/components/ui/ArtSnackbar';
import type { HeaderItemModel, HeaderLayoutModel, CreateExportSettingModel, UpdateExportSettingModel, MappedValueModel } from '@/models/export-settings.models';
import { ArtForm, ArtFormInput, ArtFormCheckbox } from '@/components/form';
import ArtInput from '@/components/ui/ArtInput';
import ArtButton from '@/components/ui/ArtButton';
import ArtUpload from '@/components/ui/ArtUpload';
import FormSection from '@/components/FormSection';
import GlobalPageLoader from '@/components/GlobalPageLoader';
import ColorSelect from '@/page/mapping/ColorSelect';
import type { ArtColor } from '@/components/ui/art.types';

// ==== Types ====

interface ExportSettingsFormPageProps {
  id?: string;
}

// ==== Schema ====

const formSchema = yup.object({
  name: yup.string().trim().min(1, 'Name is required').required('Name is required'),
  applyHeaderToAllSheets: yup.boolean().default(false),
  includeOriginalSheets: yup.boolean().default(false),
  hasTotalColumn: yup.boolean().default(false),
  headerLogoCell: yup.string().optional(),
  headerDataStartCell: yup.string().optional(),
});

type FormValues = {
  name: string;
  applyHeaderToAllSheets: boolean;
  includeOriginalSheets: boolean;
  hasTotalColumn: boolean;
  headerLogoCell: string | undefined;
  headerDataStartCell: string | undefined;
};


// ==== Category row (uncontrolled name + ref-exposed color state) ====
// Each row owns its color in local state so typing a name doesn't re-render the parent,
// and switching a color only re-renders this single row.

interface MappedValueRowRef {
  getData(): MappedValueModel;
}

const MappedValueRow = forwardRef<MappedValueRowRef, { item: MappedValueModel; onRemove: () => void }>(
  ({ item, onRemove }, ref) => {
    const nameRef = useRef<HTMLInputElement>(null);
    const [color, setColor] = useState<ArtColor>(item.color);

    useImperativeHandle(ref, () => ({
      getData: () => ({ name: nameRef.current?.value.trim() ?? '', color }),
    }), [color]);

    return (
      <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 160px 32px' }}>
        <ArtInput ref={nameRef} placeholder="e.g. Revenue" defaultValue={item.name} />
        <ColorSelect value={color} onChange={(c) => setColor(c ?? 'neutral')} />
        <ArtButton type="button" variant="ghost" color="danger" size="sm" onClick={onRemove}>×</ArtButton>
      </div>
    );
  }
);
MappedValueRow.displayName = 'MappedValueRow';

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

// ==== Logo section (unified) ====
// Nothing is uploaded or linked until the parent form's Save runs. The section
// owns its UI state (the staged file or picked id) and exposes it via callback;
// the parent passes it to the create/update mutation in onSave.

export type LogoStaged =
  | { kind: 'unchanged' }
  | { kind: 'pickedId'; id: string; name: string | null }
  | { kind: 'file'; file: File }
  | { kind: 'unlink' };

interface LogoSectionProps {
  existingLogoId: string | null;
  existingLogoName: string | null;
  staged: LogoStaged;
  onChange: (next: LogoStaged) => void;
}

function LogoSection({ existingLogoId, existingLogoName, staged, onChange }: LogoSectionProps) {
  const { data: logos = [] } = useGetLightLogos();

  // Combo reflects the staged choice. Falls back to the existing linked logo
  // when nothing is staged yet.
  const selectedId =
    staged.kind === 'pickedId' ? staged.id
    : staged.kind === 'unlink' || staged.kind === 'file' ? null
    : existingLogoId;

  // Preview source — show the existing logo only when nothing has been staged
  // away (no upload, no unlink). Fetched on-demand via useGetLogoById.
  const previewId =
    staged.kind === 'pickedId' ? staged.id
    : staged.kind === 'unchanged' ? existingLogoId
    : null;
  const previewLogo = useGetLogoById(previewId ?? '');
  const previewSrc = previewLogo.data?.data
    ? `data:${previewLogo.data.mime ?? 'image/webp'};base64,${previewLogo.data.data}`
    : null;

  const stagedFile = staged.kind === 'file' ? staged.file : null;
  const stagedFileUrl = useStagedFileUrl(stagedFile);

  const options: ArtComboBoxOption[] = logos.map((l) => ({ label: l.name ?? '(unnamed)', value: l.id }));
  const selected = options.find((o) => o.value === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <ArtComboBox
        label="Pick a logo"
        options={options}
        selected={selected}
        placeholder={logos.length === 0 ? 'No logos uploaded — upload one below' : 'Select from your logos…'}
        clearable
        onChange={(opt) => {
          if (!opt) {
            onChange(existingLogoId ? { kind: 'unlink' } : { kind: 'unchanged' });
            return;
          }
          onChange({ kind: 'pickedId', id: opt.value, name: opt.label });
        }}
      />

      <ArtUpload
        label="Or upload a new logo"
        hint="PNG, JPEG, WebP, or GIF — compressed to max 80 KB on save"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) {
            // ArtUpload's clear button fires a synthetic change with no files.
            if (staged.kind === 'file') {
              onChange(existingLogoId ? { kind: 'unchanged' } : { kind: 'unlink' });
            }
            return;
          }
          onChange({ kind: 'file', file });
        }}
      />

      {(stagedFileUrl || previewSrc) && (
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stagedFileUrl ?? previewSrc!}
            alt="Logo preview"
            className="rounded"
            style={{ maxHeight: 64, maxWidth: 200, objectFit: 'contain', background: 'var(--border)', padding: 6 }}
          />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {staged.kind === 'file'
              ? `New: ${staged.file.name} (saves on submit)`
              : staged.kind === 'pickedId'
                ? `Picked: ${staged.name ?? '(unnamed)'} (saves on submit)`
                : `Current: ${existingLogoName ?? '(unnamed)'}`}
          </span>
        </div>
      )}

      {existingLogoId && staged.kind !== 'unlink' && (
        <ArtButton
          type="button"
          variant="ghost"
          color="danger"
          size="sm"
          onClick={() => onChange({ kind: 'unlink' })}
          style={{ alignSelf: 'flex-start' }}
        >
          Unlink logo on save
        </ArtButton>
      )}

      {staged.kind === 'unlink' && (
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--art-danger)' }}>Logo will be unlinked on save.</span>
          <ArtButton type="button" variant="ghost" size="sm" onClick={() => onChange({ kind: 'unchanged' })}>
            Undo
          </ArtButton>
        </div>
      )}
    </div>
  );
}

// Stable object URL for staged file previews. Revoked when the file changes
// or the component unmounts to avoid leaking blob URLs.
function useStagedFileUrl(file: File | null): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

// ==== Page ====

export default function ExportSettingsFormPage({ id }: ExportSettingsFormPageProps) {
  const router = useRouter();
  const isEdit = !!id;
  const { enqueueSuccess, enqueueError } = useArtSnackbar();

  const { data: existing, isLoading } = useGetExportSettingById(id);

  // Gate render until data ready — defaultValues only fire on mount. Same loader as loading.tsx so transition is seamless.
  if (isEdit && (isLoading || !existing)) return <GlobalPageLoader />;

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

// ==== Edit wrapper (reads id from route — keeps page.tsx sync/static for instant nav) ====

export function ExportSettingsFormEdit() {
  const params = useParams();
  const id = params.id as string;
  return <ExportSettingsFormPage id={id} />;
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
      hasTotalColumn: existing?.hasTotalColumn ?? false,
      headerLogoCell: existing?.headerLayout?.logoCell ?? '',
      headerDataStartCell: existing?.headerLayout?.dataStartCell ?? '',
    },
  });

  // ==== State — logo: staged choice, applied on form submit. No mid-form network. ====
  const [logoStaged, setLogoStaged] = useState<LogoStaged>({ kind: 'unchanged' });

  // ==== Refs — header item rows + category rows (many rows, read on submit) ====
  const [items, setItems] = useState<HeaderItemModel[]>(existing?.headerLayout?.items ?? []);
  const itemRefs = useRef<(HeaderItemRowRef | null)[]>([]);

  const [categories, setCategories] = useState<MappedValueModel[]>(existing?.mappedValues ?? []);
  const categoryRefs = useRef<(MappedValueRowRef | null)[]>([]);

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

    const categoryValues = categoryRefs.current
      .map((r) => r?.getData())
      .filter((c): c is MappedValueModel => !!c && !!c.name);

    const body = {
      name: data.name,
      applyHeaderToAllSheets: data.applyHeaderToAllSheets ?? false,
      includeOriginalSheets: data.includeOriginalSheets ?? false,
      hasTotalColumn: data.hasTotalColumn ?? false,
      mappedValues: categoryValues,
      headerLayout: Object.keys(headerLayout).length > 0 ? headerLayout : undefined,
    };

    // Logo staging is layered onto the request:
    //   - file        → mutation handles upload-then-link via `logo: File`
    //   - pickedId    → `logo: string` (id) links existing logo
    //   - unlink      → `body.logoId: null` clears the relation
    //   - unchanged   → no logo fields included
    const logoArg: File | string | undefined =
      logoStaged.kind === 'file' ? logoStaged.file
      : logoStaged.kind === 'pickedId' ? logoStaged.id
      : undefined;
    const logoIdPatch =
      logoStaged.kind === 'unlink' ? { logoId: null }
      : {};

    if (isEdit) {
      updateMutation.mutate(
        { id: id!, body: { ...body, ...logoIdPatch } as UpdateExportSettingModel, logo: logoArg },
        {
          onSuccess: () => { enqueueSuccess('Export setting saved'); onSuccess(); },
          onError: (err) => enqueueError(err as Error, 'Failed to save export setting'),
        },
      );
    } else {
      createMutation.mutate(
        { body: body as CreateExportSettingModel, logo: logoArg },
        {
          onSuccess: () => { enqueueSuccess('Export setting created'); onSuccess(); },
          onError: (err) => enqueueError(err as Error, 'Failed to create export setting'),
        },
      );
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <ArtForm
        methods={methods}
        onSubmit={onSave}
        buttons={[
          { label: 'Cancel', variant: 'ghost', type: 'button', onClick: onSuccess },
          { label: isEdit ? 'Save' : 'Create', color: 'primary', type: 'submit', loading: isPending },
        ]}
      >
        <FormSection title="Name">
          <ArtFormInput name="name" label="Name" required />
        </FormSection>

        <FormSection title="Logo">
          <ArtFormInput name="headerLogoCell" label="Logo cell" placeholder="A1" />
          <LogoSection
            existingLogoId={existing?.logo?.id ?? null}
            existingLogoName={existing?.logo?.name ?? null}
            staged={logoStaged}
            onChange={setLogoStaged}
          />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Scaled to max 64×180 px. Consider leaving ~4 empty rows below logo.
          </p>
        </FormSection>

        <FormSection title="Header layout">
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

          <ArtFormInput name="headerDataStartCell" label="Data start cell" placeholder="A4" />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Cell where data table begins. Account for logo and header rows above.
          </p>
        </FormSection>

        <FormSection title="Value categories">
          {categories.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="grid gap-2 items-center text-xs font-medium" style={{ gridTemplateColumns: '1fr 160px 32px', color: 'var(--text-muted)' }}>
                <span>Name</span>
                <span>Color</span>
                <span />
              </div>
              {categories.map((item, i) => (
                <MappedValueRow
                  key={i}
                  ref={(el) => { categoryRefs.current[i] = el; }}
                  item={item}
                  onRemove={() => {
                    setCategories((prev) => prev.filter((_, idx) => idx !== i));
                    categoryRefs.current.splice(i, 1);
                  }}
                />
              ))}
            </div>
          )}

          <ArtButton
            type="button"
            variant="outlined"
            size="sm"
            onClick={() => setCategories((prev) => [...prev, { name: '', color: 'neutral' }])}
            style={{ alignSelf: 'flex-start' }}
          >
            + Add category
          </ArtButton>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Shown as Display Name options in Row Mappings. Color is applied to matching rows in the Dashboard and export.
          </p>
        </FormSection>

        <FormSection title="Options">
          <ArtFormCheckbox name="hasTotalColumn" label="Add Σ Total column" />
          <ArtFormCheckbox name="applyHeaderToAllSheets" label="Apply header to all sheets" />
          <ArtFormCheckbox name="includeOriginalSheets" label="Include original sheets" />
        </FormSection>
      </ArtForm>
  );
}
