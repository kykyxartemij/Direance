import type { ReactNode } from 'react';

export default function Layout({
  children,
  stats,
  users,
}: {
  children: ReactNode;
  stats: ReactNode;
  users: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl py-8">
      <div className="flex flex-col gap-8">
        {stats}
        {users}
      </div>
    </div>
  );
}
