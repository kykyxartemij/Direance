import { type NextRequest } from 'next/server';
import { testFinancialPositionConnection } from '@/services/connection.service';

export async function POST(req: NextRequest) {
  return testFinancialPositionConnection(req);
}
