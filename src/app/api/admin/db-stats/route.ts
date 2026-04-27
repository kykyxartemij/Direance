import { getDbStats } from '@/services/admin.service';

export async function GET() {
  return getDbStats();
}
