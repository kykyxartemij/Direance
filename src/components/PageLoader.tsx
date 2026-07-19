import LoaderRingDots from './LoaderRingDots';

export default function PageLoader() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <LoaderRingDots />
    </div>
  );
}
