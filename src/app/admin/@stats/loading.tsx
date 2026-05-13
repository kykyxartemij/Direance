import ArtSkeleton from '@/components/ui/ArtSkeleton';
import StatsSection from '@/page/admin/StatsSection';

export default function Loading() {
  return (
    <ArtSkeleton wrap>  
      <StatsSection/>
    </ArtSkeleton>
  )
}
