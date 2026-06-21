import { type NextRequest } from 'next/server';
import { getInviteLimits } from '@/services/invite.service';

export async function GET(req: NextRequest) {
  return getInviteLimits(req);
}
