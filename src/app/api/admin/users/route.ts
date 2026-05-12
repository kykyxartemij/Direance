import { type NextRequest } from 'next/server';
import { getPagedUsers } from '@/services/user.service';

export async function GET(req: NextRequest) {
  return getPagedUsers(req);
}
