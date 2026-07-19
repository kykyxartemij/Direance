/* eslint-disable local/require-art-page */
// NOTE: auth pages use AuthFormLayout (centered ArtCard box, no header/actions chrome) via
// the shared app/auth/layout.tsx — a different shape than ArtPage's header+content pages.
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import AcceptInvitePage from '@/page/auth/accept-invite/AcceptInvitePage';

export const metadata: Metadata = { title: 'Accept invite' };

export default async function Page() {
  const session = await auth();
  if (session) redirect('/');
  return <AcceptInvitePage />;
}
