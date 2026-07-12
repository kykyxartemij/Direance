import * as yup from 'yup';
import { REPORT_TYPES, type ReportType } from '@/models/mapping.models';
export type { ReportType };

// ==== Type registry ====
// Add new driver types here. yup uses these for oneOf validation;
// drivers in src/lib/connections/ implement per-type fetch.
// merit_estonia / merit_poland are separate types, not one 'merit' + a
// country config field — each is a distinct base URL (see MERIT_BASE_URLS)
// and the connection picker should let you pick the country directly instead
// of a generic "Merit" entry with a buried country dropdown.

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

// No Merit-specific config fields remain — country is now encoded in `type`
// itself (merit_estonia vs merit_poland), not a buried config.country value.
export type MeritConfig = Record<string, never>;
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

// No Merit-specific config fields — country lives in `type`, not config.
const MeritConfigValidator = yup.object({});

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

// ==== Fetch filters — Profit & Loss ====
// Sent on POST /api/connections/fetch/pnl. Two fully separate validators/types
// exist (this one and the Financial Position one below) on purpose — they are
// not the same request shape wearing one schema, they're independent contracts.
// Per Merit's actual API spec (getprofitrep/getbalancerep — see
// https://api.merit.ee/connecting-robots/reference-manual/reports/), Merit only
// ever accepts EndDate + PerCount (+ DepFilter, P&L only). There is no
// SumPeriods, date-range, journal, or account-prefix concept on Merit's side —
// dateFrom/dateTo/extras.journalIds/extras.accountPrefix are Odoo-only
// (account.move.line domain filters, see odoo.ts). depFilter is Merit-only.
// The overlap of perCount/endDate vs dateFrom/dateTo in one type is a real
// external-API fact (two different drivers can serve the same report type),
// not a shared/generic filter model.

export type PnlFetchFiltersModel = {
  /** Range start date YYYY-MM-DD (Odoo only). */
  dateFrom?: string;
  /** Range end date YYYY-MM-DD (Odoo only). */
  dateTo?: string;
  /** Number of periods to fetch (Merit: PerCount). */
  perCount?: number;
  /** Period end date YYYY-MM-DD (Merit: EndDate). */
  endDate?: string;
  /** Department filter (Merit: DepFilter). P&L only — getbalancerep has no equivalent. */
  depFilter?: string;
  /** Free-form extras the driver may understand (Odoo: journalIds, accountPrefix). */
  extras?: Record<string, unknown>;
};

export const PnlFetchManyValidator = yup.object({
  ids:       yup.array(yup.string().required()).min(1, 'ids is required').required('ids is required'),
  dateFrom:  yup.string().optional(),
  dateTo:    yup.string().optional(),
  perCount:  yup.number().integer().min(1).optional(),
  endDate:   yup.string().optional(),
  depFilter: yup.string().optional(),
  extras:    yup.object().optional(),
});

// ==== Fetch filters — Financial Position ====
// Sent on POST /api/connections/fetch/financial-position. No sumPeriods —
// that concept doesn't exist for a balance-sheet-style report.

export type FinancialPositionFetchFiltersModel = {
  /** Range start date YYYY-MM-DD (Odoo). */
  dateFrom?: string;
  /** Range end date YYYY-MM-DD (Odoo). */
  dateTo?: string;
  /** Number of periods to fetch (Merit: PerCount). */
  perCount?: number;
  /** Balance date YYYY-MM-DD (Merit: EndDate). */
  endDate?: string;
  /** Free-form extras the driver may understand (journalIds, accountPrefix, etc.) */
  extras?: Record<string, unknown>;
};

export const FinancialPositionFetchManyValidator = yup.object({
  ids:      yup.array(yup.string().required()).min(1, 'ids is required').required('ids is required'),
  dateFrom: yup.string().optional(),
  dateTo:   yup.string().optional(),
  perCount: yup.number().integer().min(1).optional(),
  endDate:  yup.string().optional(),
  extras:   yup.object().optional(),
});
