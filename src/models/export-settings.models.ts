import * as yup from 'yup';
import type { ArtColor } from '@/components/ui/art.types';

// ==== Value category ====

// Stored as JSON array on ExportSetting. When a Mapping row's display name matches a
// category name (case-insensitive), the category color overrides row-level color and locks the picker.
export type MappedValueModel = {
  name: string;
  color: ArtColor;
};

const ART_COLORS: ArtColor[] = ['primary', 'warning', 'success', 'danger', 'neutral'];

const MappedValueValidator = yup.object({
  name: yup.string().trim().min(1, 'Name is required').required('Name is required'),
  color: yup.string().oneOf(ART_COLORS, 'Invalid color').required('Color is required'),
});

// ==== Header layout types ====

export type HeaderItemModel = {
  cell: string;
  content: string; // display text, or <Placeholder> filled at export time
};

export type HeaderLayoutModel = {
  logoCell?: string;
  dataStartCell?: string;
  items?: HeaderItemModel[];
};

// ==== Models ====

export type ExportSettingLightModel = {
  id: string;
  name: string;
};

export type ExportSettingModel = {
  id: string;
  name: string;
  headerLayout?: HeaderLayoutModel | null;
  applyHeaderToAllSheets: boolean;
  includeOriginalSheets: boolean;
  mappedValues: MappedValueModel[]; // shown as Display Name options in Row Mappings
  hasTotalColumn: boolean; // exported workbook gets a Σ Total column summing all value columns
  logo?: { id: string; mime: string; name: string } | null; // bytes served separately via GET /api/export-settings/:id/logo
};

// Runtime-only — logo bytes merged in for export
export type ExportSettingResolvedModel = ExportSettingModel & {
  logoData?: string | null;
  logoMime?: string | null;
  logoName?: string | null;
};

// ==== Validators ====

const HeaderItemValidator = yup.object({
  cell: yup.string().trim().required('Cell is required'),
  content: yup.string().required('Content is required'),
});

const HeaderLayoutValidator = yup.object({
  logoCell: yup.string().trim().optional(),
  dataStartCell: yup.string().trim().optional(),
  items: yup.array().of(HeaderItemValidator).optional(),
});

export const CreateExportSettingValidator = yup.object({
  name: yup.string().trim().min(1, 'Name is required').required('Name is required'),
  headerLayout: HeaderLayoutValidator.nullable().optional(),
  applyHeaderToAllSheets: yup.boolean().default(false),
  includeOriginalSheets: yup.boolean().default(false),
  hasTotalColumn: yup.boolean().default(false),
  mappedValues: yup.array().of(MappedValueValidator).default([]),
  logoId: yup.string().nullable().optional(),
});

export const UpdateExportSettingValidator = yup.object({
  name: yup.string().trim().min(1).optional(),
  headerLayout: HeaderLayoutValidator.nullable().optional(),
  applyHeaderToAllSheets: yup.boolean().optional(),
  includeOriginalSheets: yup.boolean().optional(),
  hasTotalColumn: yup.boolean().optional(),
  mappedValues: yup.array().of(MappedValueValidator).optional(),
  logoId: yup.string().nullable().optional(),
});

// ==== Input models ====

export type CreateExportSettingModel = yup.InferType<typeof CreateExportSettingValidator>;
export type UpdateExportSettingModel = Partial<CreateExportSettingModel> & { id: string };
