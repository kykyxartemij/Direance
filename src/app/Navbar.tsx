import Link from 'next/link';
import { auth } from '@/auth';
import SignOutButton from './SignOutButton';

export default async function Navbar() {
  const session = await auth();

  return (
    <nav
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
      className="px-6 py-3"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <Link href="/" style={{ color: 'var(--text)' }} className="text-base font-semibold">
          Direance
        </Link>

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
