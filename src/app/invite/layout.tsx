import ArtTitle from '@/components/ui/ArtTitle';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <ArtTitle title="Invite User" description="Send an email invitation to a new user." />
      {children}
    </div>
  );
}
