import { NextRequest } from 'next/server';
import { getMe, patchMe, deleteMe } from '@/services/user.service';

export async function GET(req: NextRequest) {
  return getMe(req);
}

export async function PATCH(req: NextRequest) {
  return patchMe(req);
}

export async function DELETE(req: NextRequest) {
  return deleteMe(req);
}
