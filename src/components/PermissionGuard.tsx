import { auth } from '@/auth';
import { checkPermission, type PermissionCheck } from '@/lib/permissions';
import type { ReactNode } from 'react';

export default async function PermissionGuard({
  permission,
  children,
}: {
  permission: PermissionCheck;
  children: ReactNode;
}) {
  const session = await auth();
  if (!checkPermission(session?.user, permission)) return null;
  return <>{children}</>;
}
