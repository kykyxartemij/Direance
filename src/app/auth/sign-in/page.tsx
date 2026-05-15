import type { Metadata } from 'next';
import SignInPage from '@/page/auth/sign-in/SignInPage';

export const metadata: Metadata = { title: 'Sign in' };

export default function Page() {
  return <SignInPage />;
}
