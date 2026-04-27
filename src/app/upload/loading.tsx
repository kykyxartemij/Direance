import ArtSkeleton from '@/components/ui/ArtSkeleton';

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <ArtSkeleton style={{ height: 32, width: 128, borderRadius: 6, marginBottom: 24 }} />
      <ArtSkeleton style={{ height: 192, borderRadius: 6 }} />
    </div>
  );
}
