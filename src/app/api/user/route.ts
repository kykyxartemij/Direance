import { NextRequest } from 'next/server';
import { patchMe, deleteMe } from '@/services/user.service';

export async function PATCH(req: NextRequest) {
  return patchMe(req);
}

export async function DELETE() {
  return deleteMe();
}
