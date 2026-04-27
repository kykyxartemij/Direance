import ArtSkeleton from '@/components/ui/ArtSkeleton';

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <ArtSkeleton style={{ height: 28, width: 192, borderRadius: 6 }} />
      <ArtSkeleton style={{ height: 40, borderRadius: 6 }} />
      <ArtSkeleton style={{ height: 40, borderRadius: 6 }} />
      <ArtSkeleton style={{ height: 40, borderRadius: 6 }} />
    </div>
  );
}
