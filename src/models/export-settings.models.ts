import * as yup from 'yup';
import type { Prisma } from '../../generated/prisma/client';
import type { ArtColor } from '@/components/ui/art.types';

// #region Prisma's Select

// ==== Export Setting Light ====

export const EXPORT_SETTING_SELECT_LIGHT = {
  id: true,
  name: true,
} as const;

export type ExportSettingLightModel = Prisma.ExportSettingGetPayload<{ select: typeof EXPORT_SETTING_SELECT_LIGHT }>;

// ==== Export Setting Paged ====

export const EXPORT_SETTING_SELECT_PAGED = {
  id: true,
  name: true,
  headerLayout: true,
  applyHeaderToAllSheets: true,
  includeOriginalSheets: true,
  mappedValues: true,
  hasTotalColumn: true,
} as const;

export type ExportSettingPagedModel = Prisma.ExportSettingGetPayload<{ select: typeof EXPORT_SETTING_SELECT_PAGED }>;

// ==== Export Setting Full ====

export const EXPORT_SETTING_SELECT = {
  ...EXPORT_SETTING_SELECT_PAGED,
  headerLayout: true,
  logo: { select: { id: true, mime: true, name: true } },
} as const;

export type ExportSettingModel = Prisma.ExportSettingGetPayload<{ select: typeof EXPORT_SETTING_SELECT }>;

// Runtime-only — logo bytes merged in for export. See ImagesGuide.md.
export type ExportSettingResolvedModel = ExportSettingModel & {
  logoData?: string | null;
  logoMime?: string | null;
  logoName?: string | null;
};

// #endregion
// #region Json Config

const ART_COLORS: ArtColor[] = ['primary', 'warning', 'success', 'danger', 'neutral'];

// ==== Mapped Value ====
// A Mapping row whose display name matches a category name (case-insensitive) inherits that
// category's color and locks the picker.

const mappedValueFields = {
  name: yup.string().trim().min(1, 'Name is required').required('Name is required'),
  color: yup.string().oneOf(ART_COLORS, 'Invalid color').required('Color is required'),
};
const MappedValueValidator = yup.object(mappedValueFields);
export type MappedValueModel = yup.InferType<typeof MappedValueValidator>;

// ==== Header Item ====

const headerItemFields = {
  cell: yup.string().trim().required('Cell is required'),
  content: yup.string().required('Content is required'), // display text, or <Placeholder> filled at export time
};
const HeaderItemValidator = yup.object(headerItemFields);
export type HeaderItemModel = yup.InferType<typeof HeaderItemValidator>;

// ==== Header Layout ====

const headerLayoutFields = {
  logoCell: yup.string().trim().optional(),
  dataStartCell: yup.string().trim().optional(),
  items: yup.array().of(HeaderItemValidator).optional(),
};
const HeaderLayoutValidator = yup.object(headerLayoutFields);
export type HeaderLayoutModel = yup.InferType<typeof HeaderLayoutValidator>;

// #endregion
// #region Yup

// ==== Export Setting Create / Update ====

const exportSettingFields = {
  name: yup.string().trim().min(1, 'Name is required').required('Name is required'),
  headerLayout: HeaderLayoutValidator.nullable().optional(),
  applyHeaderToAllSheets: yup.boolean().required(),
  includeOriginalSheets: yup.boolean().required(),
  hasTotalColumn: yup.boolean().required(),
  mappedValues: yup.array().of(MappedValueValidator).required(),
  logoId: yup.string().nullable().optional(),
};

export const CreateExportSettingValidator = yup.object(exportSettingFields).shape({
  applyHeaderToAllSheets: yup.boolean().default(false),
  includeOriginalSheets: yup.boolean().default(false),
  hasTotalColumn: yup.boolean().default(false),
  mappedValues: yup.array().of(MappedValueValidator).default([]),
});
export const UpdateExportSettingValidator = yup.object(exportSettingFields).partial();

export type CreateExportSettingModel = yup.InferType<typeof CreateExportSettingValidator>;
export type UpdateExportSettingModel = yup.InferType<typeof UpdateExportSettingValidator>;

// ==== Export Setting Filter ====

export const ExportSettingFilterValidator = yup.object({
  hasTotalColumn: yup.boolean().optional(),
});
export type ExportSettingFilterYupModel = yup.InferType<typeof ExportSettingFilterValidator>;

// #endregion
