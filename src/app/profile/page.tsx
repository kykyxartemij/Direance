import type { Metadata } from 'next';
import ProfilePage from '@/page/profile/ProfilePage';

export const metadata: Metadata = { title: 'Profile' };

export default function Page() {
  return <ProfilePage />;
}
