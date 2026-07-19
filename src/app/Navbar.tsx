'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useAuth } from '@/providers/AuthProvider';
import { Permission, type PermissionCheck } from '@/lib/permissions';
import ArtButton from '@/components/ui/ArtButton';
import { HREF } from '@/lib/hrefUrl';

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

// Items shown on the LEFT side of the header (next to the logo)
const NAV_LEFT: NavItem[] = [
  { label: 'Profit & Loss',      href: HREF.reportsPnl },
  { label: 'Financial Position', href: HREF.reportsFinancialPosition },
];

// Items shown in the MIDDLE of the header
const NAV_MIDDLE: NavItem[] = [
  { label: 'Mappings',        href: HREF.mappings },
  { label: 'Export Settings', href: HREF.exportSettings },
  { label: 'Connections',     href: HREF.connections },
  { label: 'Invite',          href: HREF.invite, permission: Permission.CAN_INVITE_USERS },
  { label: 'Admin',           href: HREF.admin,  permission: Permission.CAN_ACCESS_STATS },
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

  const navLink = (item: NavItem) => (
    <Link
      key={item.href}
      href={item.href}
      prefetch={item.prefetch !== false}
      className="text-sm"
      style={{ color: isActive(item.href) ? 'var(--text)' : 'var(--text-muted)' }}
    >
      {item.label}
    </Link>
  );

  return (
    <nav
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flex: '0 0 auto',
      }}
      className="px-6 py-3"
    >
      {!user ? (
        <div className="flex items-center justify-center">
          <span className="text-base font-semibold" style={{ color: 'var(--text)' }}>{BRAND.label}</span>
        </div>
      ) : (
        <div className="mx-auto flex max-w-7xl items-center gap-6">
          {/* Left: brand + primary report pages */}
          <div className="flex items-center gap-6 shrink-0">
            <Link
              href={BRAND.href}
              prefetch={BRAND.prefetch !== false}
              className="text-base font-semibold"
              style={{ color: 'var(--text)' }}
            >
              {BRAND.label}
            </Link>
            {NAV_LEFT.flatMap((item) => (isVisible(item) ? [navLink(item)] : []))}
          </div>

          {/* Middle: secondary nav — grows to push right section to edge */}
          <div className="flex flex-1 items-center justify-center gap-4">
            {NAV_MIDDLE.flatMap((item) => (isVisible(item) ? [navLink(item)] : []))}
          </div>

          {/* Right: email (→ profile) + sign out */}
          <div className="flex items-center gap-4 shrink-0">
            <Link
              href={HREF.profile}
              prefetch
              className="text-sm"
              style={{ color: isActive(HREF.profile) ? 'var(--text)' : 'var(--text-muted)' }}
            >
              {user.email}
            </Link>
            <ArtButton
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: HREF.signIn })}
            >
              Sign out
            </ArtButton>
          </div>
        </div>
      )}
    </nav>
  );
}
