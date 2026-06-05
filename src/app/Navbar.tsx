'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useAuth } from '@/providers/AuthProvider';
import { Permission, type PermissionCheck } from '@/lib/permissions';
import ArtButton from '@/components/ui/ArtButton';

// ==== Nav config ====
// Single source of truth. Add a page here → it appears in the nav,
// gets RSC prefetch via <Link>, and is permission-gated automatically.

type NavItem = {
  label: string;
  href: string;
  permission?: PermissionCheck;  // hidden if user lacks permission
  prefetch?: boolean;            // default true — RSC prefetch on hover/viewport
  authOnly?: boolean;            // default true — hide when signed out
};

const BRAND: NavItem = { label: 'Direance', href: '/', authOnly: false };

const NAV_ITEMS: NavItem[] = [
  { label: 'Mappings',        href: '/mappings' },
  { label: 'Export Settings', href: '/export-settings' },
  { label: 'Connections',     href: '/connections' },
  { label: 'Profile',         href: '/profile' },
  { label: 'Invite',          href: '/invite', permission: Permission.CAN_INVITE_USERS },
  { label: 'Admin',           href: '/admin',  permission: Permission.CAN_ACCESS_STATS },
];

// ==== Component ====

export default function Navbar() {
  const { user, hasPermission } = useAuth();
  const pathname = usePathname();

  const isVisible = (item: NavItem) => {
    if (item.authOnly !== false && !user) return false;
    if (item.permission && !hasPermission(item.permission)) return false;
    return true;
  };

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  const visibleItems = NAV_ITEMS.filter(isVisible);

  return (
    <nav
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flex: '0 0 auto',
      }}
      className="px-6 py-3"
    >
      <div className={`mx-auto flex max-w-7xl items-center ${user ? 'justify-between' : 'justify-center'}`}>
        <div className="flex items-center gap-6">
          <Link
            href={BRAND.href}
            prefetch={BRAND.prefetch !== false}
            className="text-base font-semibold"
            style={{ color: 'var(--text)' }}
          >
            {BRAND.label}
          </Link>

          {user && (
            <div className="flex items-center gap-4">
              {visibleItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={item.prefetch !== false}
                  className="text-sm"
                  style={{ color: isActive(item.href) ? 'var(--text)' : 'var(--text-muted)' }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {user.email}
            </span>
            <ArtButton
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/auth/sign-in' })}
            >
              Sign out
            </ArtButton>
          </div>
        )}
      </div>
    </nav>
  );
}
