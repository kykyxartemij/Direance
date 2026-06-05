'use client';

import { useAuth } from '@/providers/AuthProvider';
import { type PermissionCheck } from '@/lib/permissions';
import type { ReactNode } from 'react';

export default function PermissionGuard({
  permission,
  children,
}: {
  permission: PermissionCheck;
  children: ReactNode;
}) {
  const { isLoading, hasPermission } = useAuth();
  if (isLoading) return null;
  if (!hasPermission(permission)) return null;
  return <>{children}</>;
}
