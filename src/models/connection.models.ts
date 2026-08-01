import * as yup from 'yup';
import type { Prisma } from '../../generated/prisma/client';
import { ConnectionType } from '../../generated/prisma/enums';
import { REPORT_TYPES, type ReportType } from '@/models/mapping.models';
import type { MappingModel } from '@/models/mapping.models';
import { IdFieldValidator } from '@/models';
export type { ReportType };
export type { ConnectionType };

// ==== Type registry ====
// merit_estonia/merit_poland are separate types, not one 'merit' + country field — distinct base URLs, see MERIT_BASE_URLS.

export const CONNECTION_TYPES = Object.values(ConnectionType);

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  merit_estonia: 'Merit Estonia',
  merit_poland:  'Merit Poland',
  odoo:          'Odoo',
};

export const MERIT_BASE_URLS: Record<'merit_estonia' | 'merit_poland', string> = {
  merit_estonia: 'https://aktiva.merit.ee/api/v1',
  merit_poland:  'https://program.360ksiegowosc.pl/api/v1',
};

// #region Prisma's Select
// secret is NEVER returned to FE — decrypted server-side only, in the fetch endpoints.

// ==== Connection Light ====

export const CONNECTION_SELECT_LIGHT = {
  id: true,
  name: true,
  type: true,
  reportType: true,
  isDefault: true,
  mapping: { select: { id: true, name: true } },
} as const;

export type ConnectionLightModel = Prisma.ConnectionGetPayload<{ select: typeof CONNECTION_SELECT_LIGHT }>;

// ==== Connection Paged ====

export const CONNECTION_SELECT_PAGED = {
  id: true,
  name: true,
  type: true,
  reportType: true,
  isDefault: true,
  config: true,
  mapping: { select: { id: true, name: true } },
} as const;

export type ConnectionPagedModel = Prisma.ConnectionGetPayload<{ select: typeof CONNECTION_SELECT_PAGED }>;

// ==== Connection Full ====

export const CONNECTION_SELECT = {
  id: true,
  name: true,
  type: true,
  reportType: true,
  isDefault: true,
  config: true,
  mapping: { select: { id: true, name: true } },
} as const;

export type ConnectionModel = Prisma.ConnectionGetPayload<{ select: typeof CONNECTION_SELECT }>;

// #endregion
// #region Json Config
// Discriminated by yup.lazy() on the sibling `type` field — InferType can't resolve that to a
// union, so ConnectionConfig/ConnectionSecret below stay hand-typed.

const meritConfigFields = {
  depFilter: yup.string().trim().optional(),
};
const MeritConfigValidator = yup.object(meritConfigFields);
export type MeritConfig = yup.InferType<typeof MeritConfigValidator>;

const meritSecretFields = {
  apiKey: yup.string().trim().min(1, 'API key is required').required('API key is required'),
  apiId: yup.string().trim().min(1, 'API ID is required').required('API ID is required'),
};
const MeritSecretValidator = yup.object(meritSecretFields);
export type MeritSecret = yup.InferType<typeof MeritSecretValidator>;

const odooConfigFields = {
  url: yup.string().trim().url('Must be a valid URL').required('URL is required'),
  db: yup.string().trim().min(1, 'Database is required').required('Database is required'),
  username: yup.string().trim().min(1, 'Username is required').required('Username is required'),
  journalIds: yup.array(yup.number().required()).optional(),
  accountPrefix: yup.string().trim().optional(),
};
const OdooConfigValidator = yup.object(odooConfigFields);
export type OdooConfig = yup.InferType<typeof OdooConfigValidator>;

// Not trimmed — a password can intentionally have leading/trailing spaces.
const OdooSecretValidator = yup.object({
  password: yup.string().min(1, 'Password is required').required('Password is required'),
});
export type OdooSecret = yup.InferType<typeof OdooSecretValidator>;

export type ConnectionConfig = MeritConfig | OdooConfig;
export type ConnectionSecret = MeritSecret | OdooSecret;

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

// #endregion
// #region Yup

// ==== Connection Create / Update ====

const connectionFields = {
  name: yup.string().trim().min(1, 'Name is required').required('Name is required'),
  type: yup.string().oneOf(CONNECTION_TYPES, 'Invalid type').required('Type is required'),
  reportType: yup.string().oneOf(REPORT_TYPES, 'Invalid report type').required('Report type is required'),
  isDefault: yup.boolean().required(),
  mappingId: IdFieldValidator.nullable().optional(),
};

export const CreateConnectionValidator = yup.object(connectionFields).shape({
  isDefault: yup.boolean().default(false),
  config: ConfigValidator,
  secret: SecretValidator,
});

// config/secret .optional() explicitly — .partial() doesn't reach a yup.lazy() field.
export const UpdateConnectionValidator = yup.object(connectionFields).partial().shape({
  config: ConfigValidator.optional(),
  secret: SecretValidator.optional(),
});

export type CreateConnectionModel = yup.InferType<typeof CreateConnectionValidator>;
export type UpdateConnectionModel = yup.InferType<typeof UpdateConnectionValidator>;

export const TestConnectionValidator = yup.object({
  type:   yup.string().oneOf(CONNECTION_TYPES, 'Invalid type').required('Type is required'),
  config: ConfigValidator,
  secret: SecretValidator,
});

export type TestConnectionModel = yup.InferType<typeof TestConnectionValidator>;

// #endregion
// #region Fetch response — external service data
// Live driver output (src/lib/connections/*) — no validator or Prisma select behind these.

export type ConnectionSheet = {
  name: string;
  rows: Record<string, unknown>[];
};

export type ConnectionFetchResult = {
  sheets: ConnectionSheet[];
  fetchedAt: string;
  mapping: MappingModel | null;
};

export type ConnectionFetchManyResponse = Record<string, ConnectionFetchResult>;

// #endregion
// #region Pnl

// ==== Fetch filters — Profit & Loss ====
// dateTo/periods/dateFrom are universal across drivers — each driver derives whatever it
// doesn't natively use from the other two. See lib/connections/*.

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

// Same fields as PnlFetchManyValidator minus `ids` — id comes from the route.
export const PnlFetchValidator = yup.object({
  dateTo:   yup.string().optional(),
  dateFrom: yup.string().optional(),
  periods:  yup.number().integer().min(1).optional(),
});

// #endregion
// #region Financial Position

// ==== Fetch filters — Financial Position ====
// Balance sheet is as-of, not range — no dateFrom.

export type FinancialPositionFetchFiltersModel = {
  dateTo?: string;
  periods?: number;
};

export const FinancialPositionFetchManyValidator = yup.object({
  ids:     yup.array(yup.string().required()).min(1, 'ids is required').required('ids is required'),
  dateTo:  yup.string().optional(),
  periods: yup.number().integer().min(1).optional(),
});

export const FinancialPositionFetchValidator = yup.object({
  dateTo:  yup.string().optional(),
  periods: yup.number().integer().min(1).optional(),
});

// #endregion
