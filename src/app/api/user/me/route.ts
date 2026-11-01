import { NextRequest } from 'next/server';
import { getMe, deleteMe } from '@/services/user.service';

export async function GET(req: NextRequest) {
  return getMe(req);
}

// NOTE: PATCH disabled. UpdateUserValidator accepts `permissions` and `email`, so patchMe lets a
// user grant themselves IS_ADMIN. Drop both fields before re-exposing it.

export async function DELETE(req: NextRequest) {
  return deleteMe(req);
}
