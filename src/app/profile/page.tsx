import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';
import ProfilePage from '@/page/profile/ProfilePage';

export const metadata: Metadata = { title: 'Profile' };

export default function Page() {
  return (
    <ArtPage title="Profile" description="Your account and logos." maxWidth="2xl">
      <ProfilePage />
    </ArtPage>
  );
}
