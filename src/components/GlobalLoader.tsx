import LoaderRingDots from './LoaderRingDots';

export default function GlobalLoader() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
      <LoaderRingDots subtitle />
    </div>
  );
}
