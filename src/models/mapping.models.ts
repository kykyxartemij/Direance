import * as yup from 'yup';
import type { ArtColor } from '@/components/ui/art.types';

// ==== Enums ====

export type ReportType = 'pnl' | 'financial_position';

export const REPORT_TYPES: ReportType[] = ['pnl', 'financial_position'];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  pnl:                'Profit & Loss',
  financial_position: 'Financial Position',
};

export const REPORT_TYPE_OPTIONS: { label: string; value: string }[] = REPORT_TYPES.map((r) => ({
  label: REPORT_TYPE_LABELS[r],
  value: r,
}));

// ==== Config sub-types ====

export type TableRegion = {
  descriptionColumn: number;
  valueColumns: number[];
  startRow?: number; // 0-indexed first data row; row just before is used for column naming. Defaults to sourceLayout.headerRow + 1
};

export type TotalColumnDef = {
  _id?: string; // Stable client-side identity — set on creation, persisted in config JSON, used as React key
  label: string;
  sourceValueIndices: number[]; // 0-based, relative to output value headers. Empty = all
};

export type SourceLayout = {
  regions: TableRegion[];
  totalColumns?: TotalColumnDef[];
  headerRow: number;
};

export type RowMapping = {
  sourceName: string;
  displayName?: string;
  nameColor?: ArtColor;
  valueColor?: ArtColor;
  hidden?: boolean;
};

export type ColumnHeaderMapping = {
  sourceIndex: number;
  displayName?: string;
  groupName?: string;
};

export type SheetMode = 'combine' | 'skip';
export type TotalColumnMode = 'none' | 'append' | 'only';

export type SheetConfig = {
  mode: SheetMode;
  totalColumnMode?: TotalColumnMode;
};

export type ExportSettings = {
  templateDescription?: string;
  includeOriginalSheets?: boolean;
  useLogoOnAllSheets?: boolean;
};

export type MappingConfig = {
  fromCurrency?: string;
  currency: string;
  sourceLayout: SourceLayout;
  sheetLayouts?: Record<string, SourceLayout>;
  sheetsConfig?: Record<string, SheetConfig>;
  rowMappings: RowMapping[];
  columnHeaders: ColumnHeaderMapping[];
};

// ==== Models ====

export type MappingLightModel = {
  id: string;
  name: string;
  reportType: ReportType;
};

export type MappingModel = {
  id: string;
  name: string;
  isGlobal: boolean;
  reportType: ReportType;
  config: MappingConfig;
  exportSetting?: { // populated via Prisma relation — minimal fields for RowMappings + Dashboard color rule
    id: string;
    name: string;
    mappedValues: import('@/models/export-settings.models').MappedValueModel[];
    hasTotalColumn: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
};

// ==== Default config ====

export const DEFAULT_MAPPING_CONFIG: MappingConfig = {
  fromCurrency: 'EUR',
  currency: 'EUR',
  sourceLayout: { regions: [{ descriptionColumn: 0, valueColumns: [] }], headerRow: 0 },
  rowMappings: [],
  columnHeaders: [],
};

// ==== Validators ====

const ART_COLORS: ArtColor[] = ['primary', 'warning', 'success', 'danger', 'neutral'];

const TableRegionValidator = yup.object({
  descriptionColumn: yup.number().integer().min(0).required('This field is required'),
  valueColumns: yup.array().of(yup.number().integer().min(0).required('This field is required')).required('This field is required'),
  startRow: yup.number().integer().min(0).optional(),
});

const TotalColumnDefValidator = yup.object({
  label: yup.string().required('This field is required'),
  sourceValueIndices: yup.array().of(yup.number().integer().min(0).required('This field is required')).required('This field is required'),
});

const SourceLayoutValidator = yup.object({
  regions: yup.array().of(TableRegionValidator).min(1, 'At least one region is required').required('This field is required'),
  totalColumns: yup.array().of(TotalColumnDefValidator).optional(),
  headerRow: yup.number().integer().min(0).required('This field is required'),
});

const RowMappingValidator = yup.object({
  sourceName: yup.string().required('This field is required'),
  displayName: yup.string().optional(),
  nameColor: yup.string().oneOf(ART_COLORS).optional(),
  valueColor: yup.string().oneOf(ART_COLORS).optional(),
  hidden: yup.boolean().optional(),
});

const ColumnHeaderMappingValidator = yup.object({
  sourceIndex: yup.number().integer().min(0).required('This field is required'),
  displayName: yup.string().optional(),
  groupName: yup.string().optional(),
});

const MappingConfigValidator = yup.object({
  fromCurrency: yup.string().optional(),
  currency: yup.string().default('EUR'),
  sourceLayout: SourceLayoutValidator.required('This field is required'),
  sheetLayouts: yup.mixed<Record<string, SourceLayout>>().optional(),
  sheetsConfig: yup.mixed<Record<string, SheetConfig>>().optional(),
  rowMappings: yup.array().of(RowMappingValidator).default([]),
  columnHeaders: yup.array().of(ColumnHeaderMappingValidator).default([]),
});

export const CreateMappingValidator = yup.object({
  name: yup.string().trim().min(1, 'Name is required').required('Name is required'),
  reportType: yup.string().oneOf(REPORT_TYPES, 'Invalid report type').default('pnl'),
  config: MappingConfigValidator.required('This field is required'),
  exportSettingId: yup.string().nullable().optional(),
  isGlobal: yup.boolean().optional(),
});

export const UpdateMappingValidator = yup.object({
  name: yup.string().trim().min(1, 'Name is required').optional(),
  reportType: yup.string().oneOf(REPORT_TYPES, 'Invalid report type').optional(),
  config: MappingConfigValidator.optional(),
  exportSettingId: yup.string().nullable().optional(),
  isGlobal: yup.boolean().optional(),
});

export type CreateMappingModel = yup.InferType<typeof CreateMappingValidator>;
export type UpdateMappingModel = yup.InferType<typeof UpdateMappingValidator>;
