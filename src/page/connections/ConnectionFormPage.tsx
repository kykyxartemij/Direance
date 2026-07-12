'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  useGetConnectionById,
  useCreateConnection,
  useUpdateConnection,
} from '@/hooks/connection.hooks';
import { useGetLightMappings } from '@/hooks/mapping.hooks';
import { useArtSnackbar } from '@/components/ui/ArtSnackbar';
import { ArtForm, ArtFormInput, ArtFormSelect, ArtFormCheckbox } from '@/components/form';
import FormSection from '@/components/FormSection';
import GlobalPageLoader from '@/components/GlobalPageLoader';
import {
  CONNECTION_TYPES,
  CONNECTION_TYPE_LABELS,
  type ConnectionType,
  type CreateConnectionModel,
  type UpdateConnectionModel,
} from '@/models/connection.models';
import { REPORT_TYPES, REPORT_TYPE_LABELS, type ReportType } from '@/models/mapping.models';

// ==== Types ====

interface ConnectionFormPageProps {
  id?: string;
}

// Form values flat: per-type fields appear only when their type is selected.
// type itself now encodes the Merit country — no separate meritCountry field.
type FormValues = {
  name:       string;
  type:       ConnectionType;
  reportType: ReportType;
  isDefault:  boolean;
  mappingId:  string | null;

  meritApiKey?: string;
  meritApiId?:  string;

  odooUrl?:      string;
  odooDb?:       string;
  odooUsername?: string;
  odooPassword?: string;
};

const REPORT_TYPE_OPTIONS = REPORT_TYPES.map((r) => ({ label: REPORT_TYPE_LABELS[r], value: r }));
const CONNECTION_TYPE_OPTIONS = CONNECTION_TYPES.map((t) => ({ label: CONNECTION_TYPE_LABELS[t], value: t }));

function isMeritType(type: ConnectionType | undefined): boolean {
  return type === 'merit_estonia' || type === 'merit_poland';
}

const formSchema = yup.object({
  name:       yup.string().trim().min(1, 'Name is required').required('Name is required'),
  type:       yup.string().oneOf(CONNECTION_TYPES, 'Invalid type').required('Type is required'),
  reportType: yup.string().oneOf(REPORT_TYPES, 'Invalid report type').required('Report type is required'),
  isDefault:  yup.boolean().default(false),
  mappingId:  yup.string().uuid('Mapping ID must be UUID').nullable(),

  meritApiKey: yup.string().when('type', { is: isMeritType, then: (s) => s.required('API key is required') }),
  meritApiId:  yup.string().when('type', { is: isMeritType, then: (s) => s.required('API ID is required') }),

  odooUrl:      yup.string().when('type', { is: 'odoo', then: (s) => s.url('Must be a valid URL').required('URL is required') }),
  odooDb:       yup.string().when('type', { is: 'odoo', then: (s) => s.required('Database is required') }),
  odooUsername: yup.string().when('type', { is: 'odoo', then: (s) => s.required('Username is required') }),
  odooPassword: yup.string().when('type', { is: 'odoo', then: (s) => s.required('Password is required') }),
});

// ==== Page ====

export default function ConnectionFormPage({ id }: ConnectionFormPageProps) {
  const router = useRouter();
  const isEdit = !!id;
  const { enqueueSuccess, enqueueError } = useArtSnackbar();

  const { data: existing, isLoading } = useGetConnectionById(id);

  if (isEdit && (isLoading || !existing)) return <GlobalPageLoader />;

  return (
    <ConnectionForm
      id={id}
      existing={existing}
      isEdit={isEdit}
      onSuccess={() => router.push('/connections')}
      enqueueSuccess={enqueueSuccess}
      enqueueError={enqueueError}
    />
  );
}

export function ConnectionFormEdit() {
  const params = useParams();
  const id = params.id as string;
  return <ConnectionFormPage id={id} />;
}

// ==== Inner form ====

interface ConnectionFormProps {
  id?: string;
  existing?: ReturnType<typeof useGetConnectionById>['data'];
  isEdit: boolean;
  onSuccess: () => void;
  enqueueSuccess: (title: string) => void;
  enqueueError: (err: Error, title: string) => void;
}

function ConnectionForm({ id, existing, isEdit, onSuccess, enqueueSuccess, enqueueError }: ConnectionFormProps) {
  const odooCfg = existing?.type === 'odoo' ? (existing.config as Record<string, string>) : undefined;

  const methods = useForm<FormValues>({
    resolver: yupResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      name:       existing?.name ?? '',
      type:       (existing?.type as ConnectionType) ?? 'merit_estonia',
      reportType: (existing?.reportType as ReportType) ?? 'pnl',
      isDefault:  existing?.isDefault ?? false,
      mappingId:  existing?.mapping?.id ?? null,

      meritApiKey: '',
      meritApiId:  '',

      odooUrl:      odooCfg?.url ?? '',
      odooDb:       odooCfg?.db ?? '',
      odooUsername: odooCfg?.username ?? '',
      odooPassword: '',
    },
  });

  const type       = useWatch({ control: methods.control, name: 'type' }) as ConnectionType;
  const reportType = useWatch({ control: methods.control, name: 'reportType' }) as ReportType;

  const { data: mappings = [] } = useGetLightMappings();
  const mappingOptions = mappings.flatMap((m) =>
    !m.reportType || m.reportType === reportType ? [{ label: m.name, value: m.id }] : []
  );

  const createMutation = useCreateConnection();
  const updateMutation = useUpdateConnection();
  const [secretCleared, setSecretCleared] = useState(false);

  async function onSave(data: FormValues) {
    const config = data.type === 'odoo'
      ? { url: data.odooUrl!, db: data.odooDb!, username: data.odooUsername! }
      : {};

    const secretFilled = isMeritType(data.type)
      ? !!(data.meritApiKey || data.meritApiId)
      : !!data.odooPassword;

    const secret = isMeritType(data.type)
      ? { apiKey: data.meritApiKey ?? '', apiId: data.meritApiId ?? '' }
      : { password: data.odooPassword ?? '' };

    const baseBody = {
      name:       data.name,
      type:       data.type,
      reportType: data.reportType,
      isDefault:  data.isDefault,
      config,
      mappingId:  data.mappingId || null,
    };

    if (isEdit) {
      const body: Omit<UpdateConnectionModel, 'id'> = secretFilled
        ? { ...baseBody, secret }
        : baseBody;
      updateMutation.mutate(
        { id: id!, body },
        {
          onSuccess: () => { enqueueSuccess('Connection saved'); onSuccess(); },
          onError:   (err) => enqueueError(err as Error, 'Failed to save connection'),
        },
      );
    } else {
      createMutation.mutate(
        { ...baseBody, secret } as CreateConnectionModel,
        {
          onSuccess: () => { enqueueSuccess('Connection created'); onSuccess(); },
          onError:   (err) => enqueueError(err as Error, 'Failed to create connection'),
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
      <ArtFormInput name="name" label="Name" required />
      <ArtFormSelect name="type" label="Type" options={CONNECTION_TYPE_OPTIONS} />
      <ArtFormSelect name="reportType" label="Report Type" options={REPORT_TYPE_OPTIONS} />
      <ArtFormSelect name="mappingId" label="Mapping (optional)" options={mappingOptions} clearable />
      <ArtFormCheckbox name="isDefault" label="Active by default (auto-load on Dashboard)" />

      {isMeritType(type) && (
        <FormSection title={CONNECTION_TYPE_LABELS[type]}>
          <ArtFormInput name="meritApiId" label="API ID" required={!isEdit} />
          <ArtFormInput
            name="meritApiKey"
            label="API Key"
            type="password"
            required={!isEdit}
            placeholder={isEdit && !secretCleared ? '••••• (kept unless you type a new value)' : ''}
            onFocus={() => setSecretCleared(true)}
          />
        </FormSection>
      )}

      {type === 'odoo' && (
        <FormSection title="Odoo">
          <ArtFormInput name="odooUrl"      label="URL" placeholder="https://my-company.odoo.com" required />
          <ArtFormInput name="odooDb"       label="Database" required />
          <ArtFormInput name="odooUsername" label="Username" required />
          <ArtFormInput
            name="odooPassword"
            label="Password"
            type="password"
            required={!isEdit}
            placeholder={isEdit && !secretCleared ? '••••• (kept unless you type a new value)' : ''}
            onFocus={() => setSecretCleared(true)}
          />
        </FormSection>
      )}
    </ArtForm>
  );
}
