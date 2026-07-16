import * as yup from 'yup';
import { REPORT_TYPES, type ReportType } from '@/models/mapping.models';
import type { MappingModel } from '@/models/mapping.models';
export type { ReportType };

// #region Connections

// ==== Type registry ====
// merit_estonia/merit_poland are separate types, not one 'merit' + country field — distinct base URLs, see MERIT_BASE_URLS.

export const CONNECTION_TYPES = ['merit_estonia', 'merit_poland', 'odoo'] as const;
export type ConnectionType = (typeof CONNECTION_TYPES)[number];

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  merit_estonia: 'Merit Estonia',
  merit_poland:  'Merit Poland',
  odoo:          'Odoo',
};

// ==== Per-type config + secret shapes ====
// config = non-secret (URLs, db names, company ids) — stored as Json
// secret = credentials encrypted at rest via pgcrypto — never returned to FE

export const MERIT_BASE_URLS: Record<'merit_estonia' | 'merit_poland', string> = {
  merit_estonia: 'https://aktiva.merit.ee/api/v1',
  merit_poland:  'https://program.360ksiegowosc.pl/api/v1',
};

// depFilter/journalIds/accountPrefix are driver-native knobs, set once per
// connection — not fetch-time filters (those stay universal, see PnlFetchFiltersModel).
export type MeritConfig = { depFilter?: string };
export type MeritSecret = { apiKey: string; apiId: string };

export type OdooConfig = { url: string; db: string; username: string; journalIds?: number[]; accountPrefix?: string };
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
  depFilter: yup.string().trim().optional(),
});

const MeritSecretValidator = yup.object({
  apiKey: yup.string().trim().min(1, 'API key is required').required('API key is required'),
  apiId: yup.string().trim().min(1, 'API ID is required').required('API ID is required'),
});

const OdooConfigValidator = yup.object({
  url: yup.string().trim().url('Must be a valid URL').required('URL is required'),
  db: yup.string().trim().min(1, 'Database is required').required('Database is required'),
  username: yup.string().trim().min(1, 'Username is required').required('Username is required'),
  journalIds: yup.array(yup.number().required()).optional(),
  accountPrefix: yup.string().trim().optional(),
});

const OdooSecretValidator = yup.object({
  password: yup.string().min(1, 'Password is required').required('Password is required'),
});

// Discriminated by `type`. yup.when picks the right shape per type.
const ConfigValidator = yup.lazy((_value, options) => {
  const type = (options.parent as { type?: string })?.type;
  if (type === 'merit_estonia' || type === 'merit_poland') return MeritConfigValidator;
  if (type === 'odoo') return OdooConfigValidator;
  return yup.object();
});

const SecretValidator = yup.lazy((_value, options) => {
  const type = (options.parent as { type?: string })?.type;
  if (type === 'merit_estonia' || type === 'merit_poland') return MeritSecretValidator;
  if (type === 'odoo') return OdooSecretValidator;
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

// No name/isDefault/mappingId/reportType — those are storage concerns, not auth.
export const TestConnectionValidator = yup.object({
  type:   yup.string().oneOf(CONNECTION_TYPES, 'Invalid type').required('Type is required'),
  config: ConfigValidator,
  secret: SecretValidator,
});

export type TestConnectionModel = yup.InferType<typeof TestConnectionValidator>;

// ==== Fetch response — external service data ====
// Live driver output (src/lib/connections/*), not persisted connection config.

export type ConnectionSheet = {
  name: string;
  rows: Record<string, unknown>[];
};

// Per-connection result of POST /api/connections/fetch/pnl or fetch/financial-position.
export type ConnectionFetchResult = {
  sheets: ConnectionSheet[];
  fetchedAt: string;
  mapping: MappingModel | null; // joined on the connection row server-side — null when none is linked
};

export type ConnectionFetchManyResponse = Record<string, ConnectionFetchResult>; // keyed by connection id

// #endregion
// #region Pnl

// ==== Fetch filters — Profit & Loss ====
// Universal across drivers: dateTo (period end), periods (count back from dateTo),
// dateFrom (explicit range start, alternative to periods). Every driver interprets
// all three fields — Merit maps periods->PerCount/dateTo->EndDate directly and
// derives periods from dateFrom when given; Odoo maps dateFrom/dateTo to its
// domain directly and derives dateFrom from periods when given. See lib/connections/*.

export type PnlFetchFiltersModel = {
  dateTo?: string;
  dateFrom?: string;
  periods?: number;
};

export const PnlFetchManyValidator = yup.object({
  ids:      yup.array(yup.string().required()).min(1, 'ids is required').required('ids is required'),
  dateTo:   yup.string().optional(),
  dateFrom: yup.string().optional(),
  periods:  yup.number().integer().min(1).optional(),
});

// Single-connection fetch — id comes from the route, not the body. Same
// filter fields as PnlFetchManyValidator minus `ids`.
export const PnlFetchValidator = yup.object({
  dateTo:   yup.string().optional(),
  dateFrom: yup.string().optional(),
  periods:  yup.number().integer().min(1).optional(),
});

// #endregion
// #region Financial Position

// ==== Fetch filters — Financial Position ====
// Balance sheet is as-of, not range — no dateFrom. dateTo (balance date) and
// periods (count back from dateTo) are universal, same translation rule as Pnl.

export type FinancialPositionFetchFiltersModel = {
  dateTo?: string;
  periods?: number;
};

export const FinancialPositionFetchManyValidator = yup.object({
  ids:     yup.array(yup.string().required()).min(1, 'ids is required').required('ids is required'),
  dateTo:  yup.string().optional(),
  periods: yup.number().integer().min(1).optional(),
});

// Single-connection fetch — id comes from the route, not the body. Same
// filter fields as FinancialPositionFetchManyValidator minus `ids`.
export const FinancialPositionFetchValidator = yup.object({
  dateTo:  yup.string().optional(),
  periods: yup.number().integer().min(1).optional(),
});

// #endregion
