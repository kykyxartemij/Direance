import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth } from '@/auth';
import { checkPermission, type PermissionCheck } from '@/lib/permissions';

export default async function PermissionPage({
  permission,
  children,
}: {
  permission: PermissionCheck;
  children: ReactNode;
}) {
  const session = await auth();
  if (!checkPermission(session?.user, permission)) notFound();
  return <>{children}</>;
}
