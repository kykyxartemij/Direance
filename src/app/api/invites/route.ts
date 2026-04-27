import { NextRequest } from 'next/server';
import { sendInvite } from '@/services/invite.service';

export async function POST(req: NextRequest) {
  return sendInvite(req);
}
