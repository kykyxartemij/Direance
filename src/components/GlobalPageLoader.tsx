import LoadingIcon from '@/components/icons/Loading';

// ==== Component ====

export default function GlobalPageLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-6" style={{ minHeight: '60vh' }}>
      <LoadingIcon width={64} height={64} style={{ color: 'var(--art-accent)' }} />
      <div className="art-progress w-2/5">
        <div className="art-progress-fill animate-[global-loader-slide_1.2s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
