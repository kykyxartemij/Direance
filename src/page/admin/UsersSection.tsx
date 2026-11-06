'use client';

import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useGetPagedUsers } from '@/hooks/user.hooks';
import ArtData from '@/components/ui/ArtData';
import ArtBadge from '@/components/ui/ArtBadge';
import ArtPopover from '@/components/ui/ArtPopover';
import PermissionBadge from '@/components/PermissionBadge';
import type { ArtColumn } from '@/components/ui/ArtDataTable/types';
import type { UserModel } from '@/models/user.models';

// ==== PermissionsCell ====

function PermissionsCell({ permissions }: { permissions: string[] }) {
  if (!permissions?.length) return <span className="art-text-muted">None</span>;
  const [first, ...rest] = permissions;
  return (
    <div className="flex items-center gap-1.5">
      <PermissionBadge permission={first} />
      {rest.length > 0 && (
        <ArtPopover
          trigger={<ArtBadge size="md" variant="outlined" className="art-badge--interactive">+{rest.length}</ArtBadge>}
          placement="bottom"
        >
          <div className="flex flex-col gap-1.5 p-2">
            {rest.map((p) => <PermissionBadge key={p} permission={p} />)}
          </div>
        </ArtPopover>
      )}
    </div>
  );
}

// ==== Columns ====

const USER_COLUMNS: ArtColumn<UserModel>[] = [
  { key: 'name', label: 'Name', sizing: { renderLoading: true }, render: (u) => u.name ?? '' },
  { key: 'email', label: 'Email', sizing: {} },
  { key: 'permissions', label: 'Permissions', sizing: { renderLoading: true }, render: (u) => <PermissionsCell permissions={u.permissions} /> },
];

// ==== Section ====

export default function UsersSection() {
  const { page, pageSize, search, dataProps } = useUrlFilters([]);
  const { data: users, isLoading } = useGetPagedUsers(page, pageSize, search);

  return (
    <ArtData
      columns={USER_COLUMNS}
      data={users?.data ?? []}
      total={users?.total ?? 0}
      searchPlaceholder="Search users..."
      rowKey={(u) => u.id}
      emptyMessage="No users found"
      loading={isLoading}
      {...dataProps}
    />
  );
}
