import { NextRequest } from 'next/server';
import { uploadReport } from '@/services/excel.service';

export async function POST(req: NextRequest) {
  return uploadReport(req);
}
