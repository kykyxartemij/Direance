import type { ReactNode } from 'react';
import PermissionPage from '@/components/PermissionPage';
import { Permission } from '@/lib/permissions';

export default function UiLayout({ children }: { children: ReactNode }) {
  return <PermissionPage permission={Permission.IS_ADMIN}>{children}</PermissionPage>;
}
