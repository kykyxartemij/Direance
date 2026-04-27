import ArtSkeleton from '@/components/ui/ArtSkeleton';

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl py-8">
      <div className="flex items-center justify-between mb-6">
        <ArtSkeleton style={{ height: 32, width: 176, borderRadius: 6 }} />
        <ArtSkeleton style={{ height: 36, width: 112, borderRadius: 6 }} />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <ArtSkeleton key={i} style={{ height: 48, borderRadius: 6 }} />
        ))}
      </div>
    </div>
  );
}
