import * as yup from 'yup';

const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
];

export const ExcelUploadValidator = yup.object({
  file: yup
    .mixed<File>()
    .required('No file provided')
    .test('fileType', 'Only Excel files are accepted (.xlsx, .xls)', (value) =>
      value instanceof File && EXCEL_MIME_TYPES.includes(value.type),
    ),
});

export type ParsedReport = {
  sheetName: string;
  sheetNames: string[];
  headers: string[];
  rows: Record<string, unknown>[];
};
