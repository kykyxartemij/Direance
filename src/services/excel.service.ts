import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requireAuth } from '@/auth';
import { handleApiError } from '@/lib/errorHandler';
import { ExcelUploadValidator, type ParsedReport } from '@/models/report.models';

// ==== Private helpers ====

async function parseExcelFile(file: File): Promise<ParsedReport> {
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

export async function uploadReport(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth();

    const formData = await req.formData();
    const { file } = await ExcelUploadValidator.validate(
      { file: formData.get('file') },
      { abortEarly: false }
    );

    const report = await parseExcelFile(file!);
    return NextResponse.json(report);
  } catch (error) {
    return handleApiError(error, 'POST /api/report/upload');
  }
}
