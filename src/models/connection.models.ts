import * as yup from 'yup';
import { REPORT_TYPES, type ReportType } from '@/models/mapping.models';
export type { ReportType };

// ==== Type registry ====
// Add new driver types here. yup uses these for oneOf validation;
// drivers in src/lib/connections/ implement per-type fetch.

export const CONNECTION_TYPES = ['merit', 'odoo'] as const;
export type ConnectionType = (typeof CONNECTION_TYPES)[number];

// ==== Per-type config + secret shapes ====
// config = non-secret (URLs, db names, company ids) — stored as Json
// secret = credentials encrypted at rest via pgcrypto — never returned to FE

export const MERIT_COUNTRIES = ['estonia', 'poland'] as const;
export type MeritCountry = (typeof MERIT_COUNTRIES)[number];
export const MERIT_BASE_URLS: Record<MeritCountry, string> = {
  estonia: 'https://aktiva.merit.ee/api/v1',
  poland:  'https://program.360ksiegowosc.pl/api/v1',
};

export type MeritConfig = { country: MeritCountry };
export type MeritSecret = { apiKey: string; apiId: string };

export type OdooConfig = { url: string; db: string; username: string };
export type OdooSecret = { password: string };

export type ConnectionConfig = MeritConfig | OdooConfig;
export type ConnectionSecret = MeritSecret | OdooSecret;

// ==== Models ====

export type ConnectionLightModel = {
  id: string;
  name: string;
  type: ConnectionType;
  reportType: ReportType;
  isDefault: boolean;
  mapping?: { id: string; name: string } | null;
};

export type ConnectionModel = {
  id: string;
  name: string;
  type: ConnectionType;
  reportType: ReportType;
  isDefault: boolean;
  config: ConnectionConfig;
  mapping?: { id: string; name: string } | null;
};

// ==== Validators ====

const MeritConfigValidator = yup.object({
  country: yup.string().oneOf(MERIT_COUNTRIES, 'Invalid country').required('Country is required'),
});

const MeritSecretValidator = yup.object({
  apiKey: yup.string().trim().min(1, 'API key is required').required('API key is required'),
  apiId: yup.string().trim().min(1, 'API ID is required').required('API ID is required'),
});

const OdooConfigValidator = yup.object({
  url: yup.string().trim().url('Must be a valid URL').required('URL is required'),
  db: yup.string().trim().min(1, 'Database is required').required('Database is required'),
  username: yup.string().trim().min(1, 'Username is required').required('Username is required'),
});

const OdooSecretValidator = yup.object({
  password: yup.string().min(1, 'Password is required').required('Password is required'),
});

// Discriminated by `type`. yup.when picks the right shape per type.
const ConfigValidator = yup.lazy((_value, options) => {
  const type = (options.parent as { type?: string })?.type;
  if (type === 'merit') return MeritConfigValidator;
  if (type === 'odoo')  return OdooConfigValidator;
  return yup.object();
});

const SecretValidator = yup.lazy((_value, options) => {
  const type = (options.parent as { type?: string })?.type;
  if (type === 'merit') return MeritSecretValidator;
  if (type === 'odoo')  return OdooSecretValidator;
  return yup.object();
});

export const CreateConnectionValidator = yup.object({
  name:       yup.string().trim().min(1, 'Name is required').required('Name is required'),
  type:       yup.string().oneOf(CONNECTION_TYPES, 'Invalid type').required('Type is required'),
  reportType: yup.string().oneOf(REPORT_TYPES, 'Invalid report type').required('Report type is required'),
  isDefault:  yup.boolean().default(false),
  config:     ConfigValidator,
  secret:     SecretValidator,
  mappingId:  yup.string().uuid('Mapping ID must be UUID').nullable().optional(),
});

// On update, secret is optional — empty means "keep existing".
export const UpdateConnectionValidator = yup.object({
  name:       yup.string().trim().min(1).optional(),
  type:       yup.string().oneOf(CONNECTION_TYPES, 'Invalid type').optional(),
  reportType: yup.string().oneOf(REPORT_TYPES, 'Invalid report type').optional(),
  isDefault:  yup.boolean().optional(),
  config:     ConfigValidator,
  secret:     SecretValidator,
  mappingId:  yup.string().uuid('Mapping ID must be UUID').nullable().optional(),
});

export type CreateConnectionModel = yup.InferType<typeof CreateConnectionValidator>;
export type UpdateConnectionModel = Partial<CreateConnectionModel> & { id: string };

// ==== Fetch filters ====
// Sent on POST /api/connections/:id/fetch. Per-type narrowing happens in the driver.
// Standard fields map to driver concepts server-side — FE sends what the user picks,
// driver translates to external API requirements.

export type FetchFiltersModel = {
  /** Report type filter (Merit: drives which endpoint is called). */
  reportType?: string;
  /** Range start date YYYY-MM-DD. */
  dateFrom?: string;
  /** Range end date YYYY-MM-DD. */
  dateTo?: string;
  /** Number of periods to fetch (Merit: PerCount). */
  perCount?: number;
  /** Period end date YYYY-MM-DD (Merit: EndDate). */
  endDate?: string;
  /** Sum all periods into one column — P&L only (Merit: SumPeriods). */
  sumPeriods?: boolean;
  /** Free-form extras the driver may understand (journalIds, accountPrefix, etc.) */
  extras?: Record<string, unknown>;
};

export const FetchFiltersValidator = yup.object({
  reportType: yup.string().optional(),
  dateFrom:   yup.string().optional(),
  dateTo:     yup.string().optional(),
  perCount:   yup.number().integer().min(1).optional(),
  endDate:    yup.string().optional(),
  sumPeriods: yup.boolean().optional(),
  extras:     yup.object().optional(),
});

// ==== Fetch many filters ====

export const FetchManyValidator = FetchFiltersValidator.shape({
  ids: yup.array(yup.string().required()).min(1, 'ids is required').required('ids is required'),
});
