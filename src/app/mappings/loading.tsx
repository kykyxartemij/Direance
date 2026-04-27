import ArtSkeleton from '@/components/ui/ArtSkeleton';

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl py-8">
      <ArtSkeleton style={{ height: 32, width: 128, borderRadius: 6, marginBottom: 24 }} />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <ArtSkeleton key={i} style={{ height: 48, borderRadius: 6 }} />
        ))}
      </div>
    </div>
  );
}
