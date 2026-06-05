'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
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
  MERIT_COUNTRIES,
  type ConnectionType,
  type MeritCountry,
  type CreateConnectionModel,
  type UpdateConnectionModel,
} from '@/models/connection.models';
import { REPORT_TYPES, REPORT_TYPE_LABELS, type ReportType } from '@/models/mapping.models';
// REPORT_TYPES + REPORT_TYPE_LABELS used in REPORT_TYPE_OPTIONS below

// ==== Types ====

interface ConnectionFormPageProps {
  id?: string;
}

// Form values flat: per-type fields appear only when their type is selected.
// Submit-time we narrow into the discriminated CreateConnectionModel shape.
type FormValues = {
  name:       string;
  type:       ConnectionType;
  reportType: ReportType;
  isDefault:  boolean;
  mappingId:  string | null;

  meritCountry?: MeritCountry;
  meritApiKey?:    string;
  meritApiId?:     string;

  odooUrl?:      string;
  odooDb?:       string;
  odooUsername?: string;
  odooPassword?: string;
};

const REPORT_TYPE_OPTIONS = REPORT_TYPES.map((r) => ({ label: REPORT_TYPE_LABELS[r], value: r }));

const formSchema = yup.object({
  name:       yup.string().trim().min(1, 'Name is required').required('Name is required'),
  type:       yup.string().oneOf(CONNECTION_TYPES, 'Invalid type').required('Type is required'),
  reportType: yup.string().oneOf(REPORT_TYPES, 'Invalid report type').required('Report type is required'),
  isDefault:  yup.boolean().default(false),
  mappingId:  yup.string().uuid('Mapping ID must be UUID').nullable(),

  meritCountry:   yup.string().when('type', { is: 'merit', then: (s) => s.oneOf(MERIT_COUNTRIES).required('Country is required') }),
  meritApiKey:    yup.string().when('type', { is: 'merit', then: (s) => s.required('API key is required') }),
  meritApiId:     yup.string().when('type', { is: 'merit', then: (s) => s.required('API ID is required') }),

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
  const meritCfg = existing?.type === 'merit' ? (existing.config as Record<string, string>) : undefined;
  const odooCfg  = existing?.type === 'odoo'  ? (existing.config as Record<string, string>) : undefined;

  const methods = useForm<FormValues>({
    resolver: yupResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      name:       existing?.name ?? '',
      type:       (existing?.type as ConnectionType) ?? 'merit',
      reportType: (existing?.reportType as ReportType) ?? 'pnl',
      isDefault:  existing?.isDefault ?? false,
      mappingId:  existing?.mapping?.id ?? null,

      meritCountry:   (meritCfg?.country as MeritCountry) ?? 'estonia',
      meritApiKey:    '',
      meritApiId:     '',

      odooUrl:      odooCfg?.url ?? '',
      odooDb:       odooCfg?.db ?? '',
      odooUsername: odooCfg?.username ?? '',
      odooPassword: '',
    },
  });

  const type       = methods.watch('type');
  const reportType = methods.watch('reportType');

  const { data: mappings = [] } = useGetLightMappings();
  const mappingOptions = mappings
    .filter((m) => !m.reportType || m.reportType === reportType)
    .map((m) => ({ label: m.name, value: m.id }));

  const createMutation = useCreateConnection();
  const updateMutation = useUpdateConnection();
  const [secretCleared, setSecretCleared] = useState(false);

  async function onSave(data: FormValues) {
    const config =
      data.type === 'merit'
        ? { country: data.meritCountry! }
        : { url: data.odooUrl!, db: data.odooDb!, username: data.odooUsername! };

    const secretFilled =
      data.type === 'merit'
        ? !!(data.meritApiKey || data.meritApiId)
        : !!data.odooPassword;

    const secret =
      data.type === 'merit'
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
      // On edit, only send secret when user typed new values — else keep stored secret.
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
      <ArtFormSelect
        name="type"
        label="Type"
        options={CONNECTION_TYPES.map((t) => ({ label: t.toUpperCase(), value: t }))}
      />
      <ArtFormSelect
        name="reportType"
        label="Report Type"
        options={REPORT_TYPE_OPTIONS}
      />
      <ArtFormSelect
        name="mappingId"
        label="Mapping (optional)"
        options={mappingOptions}
        clearable
      />
      <ArtFormCheckbox
        name="isDefault"
        label="Active by default (auto-load on Dashboard)"
      />

      {type === 'merit' && (
        <FormSection title="Merit.ee">
          <ArtFormSelect
            name="meritCountry"
            label="Country"
            options={MERIT_COUNTRIES.map((c) => ({ label: c === 'estonia' ? 'Estonia' : 'Poland', value: c }))}
          />
          <ArtFormInput name="meritApiId"     label="API ID" required={!isEdit} />
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
