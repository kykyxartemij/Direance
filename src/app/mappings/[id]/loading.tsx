import ArtSkeleton from '@/components/ui/ArtSkeleton';

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <ArtSkeleton style={{ height: 32, width: 160, borderRadius: 6, marginBottom: 32 }} />
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <ArtSkeleton key={i} style={{ height: 40, borderRadius: 6 }} />
        ))}
      </div>
    </div>
  );
}
