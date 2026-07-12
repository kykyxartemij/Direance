import ArtTitle from '@/components/ui/ArtTitle';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl py-8">
      <ArtTitle title="Profit & Loss" />
      {children}
    </div>
  );
}
