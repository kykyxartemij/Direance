import * as yup from 'yup';
import type { ArtColor } from '@/components/ui/art.types';

// ==== Enums ====

export type ReportType = 'pnl' | 'financial_position';

const REPORT_TYPES: ReportType[] = ['pnl', 'financial_position'];

// ==== Config sub-types ====

export type TableRegion = {
  descriptionColumn: number;
  valueColumns: number[];
  /** 0-indexed first data row for this region. The row just before it is used for column naming.
   *  Defaults to sourceLayout.headerRow + 1 when not set. */
  startRow?: number;
};

export type SourceLayout = {
  regions: TableRegion[];
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

export type SheetConfig = {
  mode: SheetMode;
  /** When true, a total column is appended summarising value columns for this sheet.
   *  TODO: Support Excel-style per-cell formulas (e.g. B5+B6) and treat the
   *  generated total as part of the "original sheet" for includeOriginalSheets output. */
  createTotalColumn?: boolean;
};

export type ExportSettings = {
  templateDescription?: string;
  includeOriginalSheets?: boolean;
  useLogoOnAllSheets?: boolean;
  mappedValueNames?: string[];
};

export type MappingConfig = {
  /** Source currency — the currency values appear in the Excel file */
  fromCurrency?: string;
  /** Target/display currency */
  currency: string;
  sourceLayout: SourceLayout;
  sheetLayouts?: Record<string, SourceLayout>;
  sheetsConfig?: Record<string, SheetConfig>;
  rowMappings: RowMapping[];
  columnHeaders: ColumnHeaderMapping[];
};

// ==== API response ====

export type MappingModel = {
  id: string;
  name: string;
  isGlobal: boolean;
  reportType: ReportType;
  config: MappingConfig;
  /** Populated via Prisma relation — id, name, and mappedValueNames only */
  exportSetting?: { id: string; name: string; mappedValueNames: string[] } | null;
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
  descriptionColumn: yup.number().integer().min(0).required(),
  valueColumns: yup.array().of(yup.number().integer().min(0).required()).required(),
  startRow: yup.number().integer().min(0).optional(),
});

const SourceLayoutValidator = yup.object({
  regions: yup.array().of(TableRegionValidator).min(1).required(),
  headerRow: yup.number().integer().min(0).required(),
});

const RowMappingValidator = yup.object({
  sourceName: yup.string().required(),
  displayName: yup.string().optional(),
  nameColor: yup.string().oneOf(ART_COLORS).optional(),
  valueColor: yup.string().oneOf(ART_COLORS).optional(),
  hidden: yup.boolean().optional(),
});

const ColumnHeaderMappingValidator = yup.object({
  sourceIndex: yup.number().integer().min(0).required(),
  displayName: yup.string().optional(),
  groupName: yup.string().optional(),
});

const MappingConfigValidator = yup.object({
  fromCurrency: yup.string().optional(),
  currency: yup.string().default('EUR'),
  sourceLayout: SourceLayoutValidator.required(),
  sheetLayouts: yup.mixed<Record<string, SourceLayout>>().optional(),
  sheetsConfig: yup.mixed<Record<string, SheetConfig>>().optional(),
  rowMappings: yup.array().of(RowMappingValidator).default([]),
  columnHeaders: yup.array().of(ColumnHeaderMappingValidator).default([]),
});

export const MappingCreateValidator = yup.object({
  name: yup.string().trim().min(1, 'Name is required').required('Name is required'),
  reportType: yup.string().oneOf(REPORT_TYPES).default('pnl'),
  config: MappingConfigValidator.required(),
  exportSettingId: yup.string().optional(),
});

export const MappingUpdateValidator = yup.object({
  name: yup.string().trim().min(1).optional(),
  reportType: yup.string().oneOf(REPORT_TYPES).optional(),
  config: MappingConfigValidator.optional(),
  exportSettingId: yup.string().nullable().optional(),
});

export type MappingCreateInput = yup.InferType<typeof MappingCreateValidator>;
export type MappingUpdateInput = yup.InferType<typeof MappingUpdateValidator>;
