'use client';

import { useRouter, useParams } from 'next/navigation';
import { useForm, useWatch, Controller, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  useGetConnectionById,
  useCreateConnection,
  useUpdateConnection,
} from '@/hooks/connection.hooks';
import { useGetLightMappings } from '@/hooks/mapping.hooks';
import { ArtForm, ArtFormInput, ArtFormSelect, ArtFormCheckbox, ArtFormSwitch } from '@/components/form';
import ArtDivider from '@/components/ui/ArtDivider';
import ArtSelect from '@/components/ui/ArtSelect';
import PageLoader from '@/components/PageLoader';
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
  usePreviousSecret: boolean;

  meritApiKey?:  string;
  meritApiId?:   string;
  meritDepFilter?: string;

  odooUrl?:           string;
  odooDb?:            string;
  odooUsername?:      string;
  odooPassword?:      string;
  odooJournalIds?:    string;
  odooAccountPrefix?: string;
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
  usePreviousSecret: yup.boolean().default(false),

  meritApiKey: yup.string().when(['type', 'usePreviousSecret'], { is: (t: string, kept: boolean) => isMeritType(t as ConnectionType) && !kept, then: (s) => s.required('API key is required') }),
  meritApiId:  yup.string().when(['type', 'usePreviousSecret'], { is: (t: string, kept: boolean) => isMeritType(t as ConnectionType) && !kept, then: (s) => s.required('API ID is required') }),

  odooUrl:      yup.string().when('type', { is: 'odoo', then: (s) => s.url('Must be a valid URL').required('URL is required') }),
  odooDb:       yup.string().when('type', { is: 'odoo', then: (s) => s.required('Database is required') }),
  odooUsername: yup.string().when('type', { is: 'odoo', then: (s) => s.required('Username is required') }),
  odooPassword: yup.string().when(['type', 'usePreviousSecret'], { is: (t: string, kept: boolean) => t === 'odoo' && !kept, then: (s) => s.required('Password is required') }),
});

// ==== Page ====

export default function ConnectionFormPage({ id }: ConnectionFormPageProps) {
  const router = useRouter();
  const isEdit = !!id;

  const { data: existing, isLoading } = useGetConnectionById(id);

  if (isEdit && (isLoading || !existing)) return <PageLoader />;

  return (
    <ConnectionForm
      key={id ?? '__new__'}
      id={id}
      existing={existing}
      isEdit={isEdit}
      onSuccess={() => router.push('/connections')}
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
}

function ConnectionForm({ id, existing, isEdit, onSuccess }: ConnectionFormProps) {
  const odooCfg  = existing?.type === 'odoo' ? (existing.config as Record<string, unknown>) : undefined;
  const meritCfg = isMeritType(existing?.type as ConnectionType) ? (existing?.config as Record<string, unknown>) : undefined;

  const methods = useForm<FormValues>({
    resolver: yupResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      name:       existing?.name ?? '',
      type:       (existing?.type as ConnectionType) ?? 'merit_estonia',
      reportType: (existing?.reportType as ReportType) ?? 'pnl',
      isDefault:  existing?.isDefault ?? false,
      mappingId:  existing?.mapping?.id ?? null,
      usePreviousSecret: isEdit,

      meritApiKey:    '',
      meritApiId:     '',
      meritDepFilter: (meritCfg?.depFilter as string) ?? '',

      odooUrl:           (odooCfg?.url as string) ?? '',
      odooDb:             (odooCfg?.db as string) ?? '',
      odooUsername:       (odooCfg?.username as string) ?? '',
      odooPassword:       '',
      odooJournalIds:     Array.isArray(odooCfg?.journalIds) ? (odooCfg.journalIds as number[]).join(',') : '',
      odooAccountPrefix: (odooCfg?.accountPrefix as string) ?? '',
    },
  });

  const type       = useWatch({ control: methods.control, name: 'type' }) as ConnectionType;
  const reportType = useWatch({ control: methods.control, name: 'reportType' }) as ReportType;
  const usePreviousSecret = useWatch({ control: methods.control, name: 'usePreviousSecret' });
  const requireSecret = !isEdit || !usePreviousSecret;

  const { data: mappings = [] } = useGetLightMappings();
  const mappingOptions = mappings.flatMap((m) =>
    !m.reportType || m.reportType === reportType ? [{ label: m.name, value: m.id }] : []
  );

  // A mapping picked under the old reportType is invalid for the new one.
  function handleReportTypeChange(next: ReportType) {
    methods.setValue('reportType', next);
    methods.setValue('mappingId', null);
  }

  const createMutation = useCreateConnection({ meta: { successMessage: 'Connection created', errorMessage: 'Failed to create connection' } });
  const updateMutation = useUpdateConnection({ meta: { successMessage: 'Connection saved', errorMessage: 'Failed to save connection' } });

  async function onSave(data: FormValues) {
    const journalIds = (data.odooJournalIds ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));

    const config = data.type === 'odoo'
      ? {
          url: data.odooUrl!,
          db: data.odooDb!,
          username: data.odooUsername!,
          ...(journalIds.length > 0 ? { journalIds } : {}),
          ...(data.odooAccountPrefix ? { accountPrefix: data.odooAccountPrefix } : {}),
        }
      : { ...(data.meritDepFilter ? { depFilter: data.meritDepFilter } : {}) };

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
      const body: Omit<UpdateConnectionModel, 'id'> = data.usePreviousSecret
        ? baseBody
        : { ...baseBody, secret };
      updateMutation.mutate({ id: id!, body }, { onSuccess });
    } else {
      createMutation.mutate({ ...baseBody, secret } as CreateConnectionModel, { onSuccess });
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
      <Controller<FormValues, 'reportType'>
        name="reportType"
        control={methods.control}
        render={({ field, fieldState }) => (
          <ArtSelect
            label="Report Type"
            options={REPORT_TYPE_OPTIONS}
            selected={REPORT_TYPE_OPTIONS.find((o) => o.value === field.value) ?? null}
            onChange={(opt) => handleReportTypeChange((opt?.value ?? 'pnl') as ReportType)}
            errorText={fieldState.error?.message}
          />
        )}
      />
      <ArtFormSelect name="mappingId" label="Mapping" options={mappingOptions} clearable />
      <ArtFormCheckbox name="isDefault" label="Active by default (auto-load on its report page)" />

      {isEdit && (
        <ArtFormSwitch name="usePreviousSecret" label="Use previous settings" />
      )}
      <ArtFormSelect name="type" label="Type" options={CONNECTION_TYPE_OPTIONS} disabled={isEdit && usePreviousSecret} />

      {isMeritType(type) && (
        <>
          <ArtDivider label={CONNECTION_TYPE_LABELS[type]} />
          <ArtFormInput name="meritApiId" label="API ID" required={requireSecret} disabled={isEdit && usePreviousSecret} autoComplete="off" />
          <ArtFormInput
            name="meritApiKey"
            label="API Key"
            type="password"
            required={requireSecret}
            disabled={isEdit && usePreviousSecret}
            autoComplete="new-password"
          />
          {reportType === 'pnl' && (
            <ArtFormInput
              name="meritDepFilter"
              label="Department filter"
              placeholder="e.g. 10"
              helperText="Applied to every P&L fetch on this connection. Leave blank for all departments."
            />
          )}
        </>
      )}

      {type === 'odoo' && (
        <>
          <ArtDivider label="Odoo" />
          <ArtFormInput name="odooUrl"      label="URL" placeholder="https://my-company.odoo.com" required autoComplete="off" />
          <ArtFormInput name="odooDb"       label="Database" required autoComplete="off" />
          <ArtFormInput name="odooUsername" label="Username" required autoComplete="off" />
          <ArtFormInput
            name="odooPassword"
            label="Password"
            type="password"
            required={requireSecret}
            disabled={isEdit && usePreviousSecret}
            autoComplete="new-password"
          />
          <ArtFormInput
            name="odooJournalIds"
            label="Journal IDs"
            placeholder="1,2,5"
            helperText="Comma-separated. Applied to every fetch on this connection. Leave blank for all journals."
          />
          <ArtFormInput
            name="odooAccountPrefix"
            label="Account prefix"
            placeholder="411"
            helperText="Only include accounts whose code starts with this prefix."
          />
        </>
      )}
    </ArtForm>
  );
}
