import ArtTitle from '@/components/ui/ArtTitle';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <ArtTitle title="Profile" description="Your account info and uploaded logos." />
      {children}
    </div>
  );
}
