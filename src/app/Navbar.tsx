import Link from 'next/link';
import { auth } from '@/auth';
import SignOutButton from './SignOutButton';
import { hasPermission, Permission } from '@/lib/permissions';

export default async function Navbar() {
  const session = await auth();

  return (
    <nav
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
      className="px-6 py-3"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            prefetch
            style={{ color: 'var(--text)' }}
            className="text-base font-semibold"
          >
            Direance
          </Link>

          {session?.user && (
            <div className="flex items-center gap-4">
              <Link
                href="/upload"
                prefetch
                className="text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                Upload
              </Link>
              <Link
                href="/mappings"
                prefetch
                className="text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                Mappings
              </Link>
              <Link
                href="/export-settings"
                prefetch
                className="text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                Export Settings
              </Link>
              {hasPermission(session.user, Permission.CAN_ACCESS_DB_STATS) && (
                <Link
                  href="/admin"
                  prefetch
                  className="text-sm"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Admin
                </Link>
              )}
            </div>
          )}
        </div>

        {session?.user && (
          <div className="flex items-center gap-4">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {session.user.email}
            </span>
            <SignOutButton />
          </div>
        )}
      </div>
    </nav>
  );
}
