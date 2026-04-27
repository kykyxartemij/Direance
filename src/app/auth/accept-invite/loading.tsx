import ArtSkeleton from '@/components/ui/ArtSkeleton';

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <ArtSkeleton style={{ height: 28, width: 200, borderRadius: 6 }} />
      <ArtSkeleton style={{ height: 16, width: 160, borderRadius: 4 }} />
      <ArtSkeleton style={{ height: 40, borderRadius: 6 }} />
      <ArtSkeleton style={{ height: 40, borderRadius: 6 }} />
      <ArtSkeleton style={{ height: 40, borderRadius: 6 }} />
      <ArtSkeleton style={{ height: 40, borderRadius: 6 }} />
    </div>
  );
}
