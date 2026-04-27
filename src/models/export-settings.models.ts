import * as yup from 'yup';

// ==== Header layout types ====

export type HeaderItem = {
  /** Excel cell address, e.g. "A1", "B2" */
  cell: string;
  /** Display text or <Placeholder> to fill at export time */
  content: string;
};

export type HeaderLayout = {
  /** Cell where the logo image is placed, e.g. "A1" */
  logoCell?: string;
  /** Cell where the DataTable begins, e.g. "B4" */
  dataStartCell?: string;
  /** Additional positioned text/placeholder cells */
  items?: HeaderItem[];
};

// ==== Main type ====

export type ExportSetting = {
  id: string;
  name: string;
  headerLayout?: HeaderLayout | null;
  applyHeaderToAllSheets: boolean;
  includeOriginalSheets: boolean;
  /** Named value categories — shown as Display Name options in Row Mappings */
  mappedValueNames: string[];
  /** Logo metadata — bytes served separately via GET /api/export-settings/:id/logo */
  logo?: { id: string; mime: string; name: string } | null;
};

// ==== Validators ====

const HeaderItemValidator = yup.object({
  cell: yup.string().trim().required(),
  content: yup.string().required(),
});

const HeaderLayoutValidator = yup.object({
  logoCell: yup.string().trim().optional(),
  dataStartCell: yup.string().trim().optional(),
  items: yup.array().of(HeaderItemValidator).optional(),
});

export const ExportSettingCreateValidator = yup.object({
  name: yup.string().trim().min(1, 'Name is required').required('Name is required'),
  headerLayout: HeaderLayoutValidator.nullable().optional(),
  applyHeaderToAllSheets: yup.boolean().default(false),
  includeOriginalSheets: yup.boolean().default(false),
  mappedValueNames: yup.array().of(yup.string().required()).default([]),
  logoId: yup.string().optional(),
});

export const ExportSettingUpdateValidator = yup.object({
  name: yup.string().trim().min(1).optional(),
  headerLayout: HeaderLayoutValidator.nullable().optional(),
  applyHeaderToAllSheets: yup.boolean().optional(),
  includeOriginalSheets: yup.boolean().optional(),
  mappedValueNames: yup.array().of(yup.string().required()).optional(),
  logoId: yup.string().optional(),
});

export type ExportSettingCreateInput = yup.InferType<typeof ExportSettingCreateValidator>;
export type ExportSettingUpdateInput = yup.InferType<typeof ExportSettingUpdateValidator>;

// ==== Resolved (runtime only — logo bytes merged in for export) ====

export type ExportSettingResolved = ExportSetting & {
  logoData?: string | null;
  logoMime?: string | null;
  logoName?: string | null;
};

// ==== Light response (list endpoints) ====

export type ExportSettingLightItem = Pick<ExportSetting, 'id' | 'name'>;
