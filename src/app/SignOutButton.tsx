'use client';

import { signOut } from 'next-auth/react';
import ArtButton from '@/components/ui/ArtButton';

export default function SignOutButton() {
  return (
    <ArtButton variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/auth/sign-in' })}>
      Sign out
    </ArtButton>
  );
}
