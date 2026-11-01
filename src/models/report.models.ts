import * as yup from 'yup';

// ==== Constants ====

const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
];

// Below Vercel's 4.5 MB request cap, so users get this error instead of its bare 413.
const MAX_EXCEL_BYTES = 4 * 1024 * 1024;

// ==== Validators ====

export const ExcelUploadValidator = yup.object({
  file: yup
    .mixed<File>()
    .required('No file provided')
    .test(
      'fileType',
      'Only Excel files are accepted (.xlsx, .xls)',
      (value) => value instanceof File && EXCEL_MIME_TYPES.includes(value.type)
    )
    .test(
      'fileSize',
      'File must be 4 MB or smaller',
      (value) => value instanceof File && value.size <= MAX_EXCEL_BYTES
    ),
});

// ==== Models ====

export type ParsedReportModel = {
  sheetName: string;
  sheetNames: string[];
  headers: string[];
  rows: Record<string, unknown>[];
};
