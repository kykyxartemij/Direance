import { getMe } from '@/services/user.service';

export async function GET() {
  return getMe();
}
