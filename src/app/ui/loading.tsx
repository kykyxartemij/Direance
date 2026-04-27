import ArtSkeleton from '@/components/ui/ArtSkeleton';

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <ArtSkeleton style={{ height: 32, width: 192, borderRadius: 6 }} />
    </div>
  );
}
