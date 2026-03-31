import { NextRequest } from 'next/server';
import { registerUser } from '@/services/user.service';

export async function POST(req: NextRequest) {
  return registerUser(req);
}
