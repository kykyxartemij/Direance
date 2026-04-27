import ArtSkeleton from '@/components/ui/ArtSkeleton';

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl py-8">
      <ArtSkeleton style={{ height: 28, width: 160, borderRadius: 6 }} />
      <ArtSkeleton style={{ height: 16, width: 288, borderRadius: 4, marginTop: 8 }} />
    </div>
  );
}
