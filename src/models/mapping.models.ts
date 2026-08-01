import * as yup from 'yup';
import type { Prisma } from '../../generated/prisma/client';
import type { ReportType } from '../../generated/prisma/enums';
import type { ArtColor } from '@/components/ui/art.types';

// ==== Enums ====

export type { ReportType };

export const REPORT_TYPES: ReportType[] = ['pnl', 'financial_position'];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  pnl:                'Profit & Loss',
  financial_position: 'Financial Position',
};

export const REPORT_TYPE_OPTIONS: { label: string; value: string }[] = REPORT_TYPES.map((r) => ({
  label: REPORT_TYPE_LABELS[r],
  value: r,
}));

// #region Prisma's Select

// ==== Mapping Light ====

export const MAPPING_SELECT_LIGHT = {
  id: true,
  name: true,
  reportType: true,
} as const;

export type MappingLightModel = Prisma.FieldMappingGetPayload<{ select: typeof MAPPING_SELECT_LIGHT }>;

// ==== Mapping Paged ====

export const MAPPING_SELECT_PAGED = {
  id: true,
  name: true,
  isGlobal: true,
  reportType: true,
  exportSetting: { select: { id: true, name: true } },
} as const;

export type MappingPagedModel = Prisma.FieldMappingGetPayload<{ select: typeof MAPPING_SELECT_PAGED }>;

// ==== Mapping Full ====

export const MAPPING_SELECT = {
  id: true,
  name: true,
  isGlobal: true,
  reportType: true,
  config: true,
  exportSetting: { select: { id: true, name: true, mappedValues: true, hasTotalColumn: true } },
} as const;

export type MappingModel = Prisma.FieldMappingGetPayload<{ select: typeof MAPPING_SELECT }>;

// #endregion
// #region Json Config
// MappingConfig is the PrismaJson bridge target for FieldMapping.config (see prisma-json.d.ts).

const ART_COLORS: ArtColor[] = ['primary', 'warning', 'success', 'danger', 'neutral'];

// ==== Table Region ====

const tableRegionFields = {
  descriptionColumn: yup.number().integer().min(0).required('This field is required'),
  valueColumns: yup.array().of(yup.number().integer().min(0).required('This field is required')).required('This field is required'),
  startRow: yup.number().integer().min(0).optional(), // defaults to sourceLayout.headerRow + 1
};
const TableRegionValidator = yup.object(tableRegionFields);
export type TableRegion = yup.InferType<typeof TableRegionValidator>;

// ==== Total Column Def ====

const totalColumnDefFields = {
  _id: yup.string().optional(), // client-side React key
  label: yup.string().required('This field is required'),
  sourceValueIndices: yup.array().of(yup.number().integer().min(0).required('This field is required')).required('This field is required'),
};
const TotalColumnDefValidator = yup.object(totalColumnDefFields);
export type TotalColumnDef = yup.InferType<typeof TotalColumnDefValidator>;

// ==== Source Layout ====

const sourceLayoutFields = {
  regions: yup.array().of(TableRegionValidator).min(1, 'At least one region is required').required('This field is required'),
  totalColumns: yup.array().of(TotalColumnDefValidator).optional(),
  headerRow: yup.number().integer().min(0).required('This field is required'),
};
const SourceLayoutValidator = yup.object(sourceLayoutFields);
export type SourceLayout = yup.InferType<typeof SourceLayoutValidator>;

// ==== Row Mapping ====

const rowMappingFields = {
  sourceName: yup.string().required('This field is required'),
  displayName: yup.string().optional(),
  nameColor: yup.string().oneOf(ART_COLORS).optional(),
  valueColor: yup.string().oneOf(ART_COLORS).optional(),
  hidden: yup.boolean().optional(),
};
const RowMappingValidator = yup.object(rowMappingFields);
export type RowMapping = yup.InferType<typeof RowMappingValidator>;

// ==== Column Header Mapping ====

const columnHeaderMappingFields = {
  sourceIndex: yup.number().integer().min(0).required('This field is required'),
  displayName: yup.string().optional(),
  groupName: yup.string().optional(),
};
const ColumnHeaderMappingValidator = yup.object(columnHeaderMappingFields);
export type ColumnHeaderMapping = yup.InferType<typeof ColumnHeaderMappingValidator>;

// ==== Sheet Config ====
// Keyed by sheet name (unknown ahead of time) — yup.mixed() passthrough, no validator to derive from.

export type SheetMode = 'combine' | 'skip';
export type TotalColumnMode = 'none' | 'append' | 'only';
export type SheetConfig = { mode: SheetMode; totalColumnMode?: TotalColumnMode };

// ==== Mapping Config ====

const mappingConfigFields = {
  fromCurrency: yup.string().optional(),
  currency: yup.string().default('EUR'),
  sourceLayout: SourceLayoutValidator.required('This field is required'),
  sheetLayouts: yup.mixed<Record<string, SourceLayout>>().optional(),
  sheetsConfig: yup.mixed<Record<string, SheetConfig>>().optional(),
  rowMappings: yup.array().of(RowMappingValidator).default([]),
  columnHeaders: yup.array().of(ColumnHeaderMappingValidator).default([]),
};
const MappingConfigValidator = yup.object(mappingConfigFields);
export type MappingConfig = yup.InferType<typeof MappingConfigValidator>;

export const DEFAULT_MAPPING_CONFIG: MappingConfig = {
  fromCurrency: 'EUR',
  currency: 'EUR',
  sourceLayout: { regions: [{ descriptionColumn: 0, valueColumns: [] }], headerRow: 0 },
  rowMappings: [],
  columnHeaders: [],
};

// #endregion
// #region Yup

// ==== Mapping Filter ====

export const MappingFilterValidator = yup.object({
  reportType: yup.string().oneOf(REPORT_TYPES, 'Invalid report type').optional(),
});
export type MappingFilterYupModel = yup.InferType<typeof MappingFilterValidator>;

// ==== Mapping Create / Update ====

// reportType's default lives only on Create — .partial() doesn't strip .default() (see guide).
const mappingFields = {
  name: yup.string().trim().min(1, 'Name is required').required('Name is required'),
  reportType: yup.string().oneOf(REPORT_TYPES, 'Invalid report type').required('Report type is required'),
  config: MappingConfigValidator.required('This field is required'),
  exportSettingId: yup.string().nullable().optional(),
  isGlobal: yup.boolean().optional(),
};

export const CreateMappingValidator = yup.object(mappingFields).shape({
  reportType: yup.string().oneOf(REPORT_TYPES, 'Invalid report type').default('pnl'),
});
export const UpdateMappingValidator = yup.object(mappingFields).partial();

export type CreateMappingModel = yup.InferType<typeof CreateMappingValidator>;
export type UpdateMappingModel = yup.InferType<typeof UpdateMappingValidator>;

// #endregion
