import { auth } from '@/auth';
import { hasPermission, type Permission } from '@/lib/permissions';
import type { ReactNode } from 'react';

export default async function PermissionGuard({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user, permission)) return null;
  return <>{children}</>;
}
