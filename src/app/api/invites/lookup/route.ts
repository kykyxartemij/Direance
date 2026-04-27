import { NextRequest } from 'next/server';
import { lookupInvite } from '@/services/invite.service';

export async function GET(req: NextRequest) {
  return lookupInvite(req);
}
