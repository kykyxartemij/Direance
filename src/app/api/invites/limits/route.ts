import { getInviteLimits } from '@/services/invite.service';

export async function GET() {
  return getInviteLimits();
}
