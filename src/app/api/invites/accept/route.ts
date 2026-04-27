import { NextRequest } from 'next/server';
import { acceptInvite } from '@/services/invite.service';

export async function POST(req: NextRequest) {
  return acceptInvite(req);
}
