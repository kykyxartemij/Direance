import 'server-only';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { withHandler } from '@/lib/withHandler';
import { ExcelUploadValidator, type ParsedReportModel } from '@/models/report.models';

// ==== Private helpers ====

async function parseExcelFile(file: File): Promise<ParsedReportModel> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

  return {
    sheetName,
    sheetNames: workbook.SheetNames,
    headers: rows.length > 0 ? Object.keys(rows[0]) : [],
    rows,
  };
}

// ==== HTTP handlers ====

export const uploadReport = withHandler(async (req) => {
  const formData = await req.formData();
  const { file } = await ExcelUploadValidator.validate(
    { file: formData.get('file') },
    { abortEarly: false },
  );

  const report = await parseExcelFile(file!);
  return NextResponse.json(report);
});
