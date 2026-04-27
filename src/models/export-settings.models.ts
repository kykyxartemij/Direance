import * as yup from 'yup';

// ==== Header layout types ====

export type HeaderItemModel = {
  /** Excel cell address, e.g. "A1", "B2" */
  cell: string;
  /** Display text or <Placeholder> to fill at export time */
  content: string;
};

export type HeaderLayoutModel = {
  /** Cell where the logo image is placed, e.g. "A1" */
  logoCell?: string;
  /** Cell where the DataTable begins, e.g. "B4" */
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
  /** Named value categories — shown as Display Name options in Row Mappings */
  mappedValueNames: string[];
  /** Logo metadata — bytes served separately via GET /api/export-settings/:id/logo */
  logo?: { id: string; mime: string; name: string } | null;
};

/** Runtime-only — logo bytes merged in for export */
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
  mappedValueNames: yup.array().of(yup.string().required()).default([]),
  logoId: yup.string().optional(),
});

export const UpdateExportSettingValidator = yup.object({
  name: yup.string().trim().min(1).optional(),
  headerLayout: HeaderLayoutValidator.nullable().optional(),
  applyHeaderToAllSheets: yup.boolean().optional(),
  includeOriginalSheets: yup.boolean().optional(),
  mappedValueNames: yup.array().of(yup.string().required()).optional(),
  logoId: yup.string().optional(),
});

// ==== Input models ====

export type CreateExportSettingModel = yup.InferType<typeof CreateExportSettingValidator>;
export type UpdateExportSettingModel = Partial<CreateExportSettingModel> & { id: string };
