/* eslint-disable local/require-art-page */
// NOTE: auth pages use AuthFormLayout (centered ArtCard box, no header/actions chrome) via
// the shared app/auth/layout.tsx — a different shape than ArtPage's header+content pages.
import type { Metadata } from 'next';
import SignInPage from '@/page/auth/sign-in/SignInPage';

export const metadata: Metadata = { title: 'Sign in' };

export default function Page() {
  return <SignInPage />;
}
