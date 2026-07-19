interface LoaderRingDotsProps {
  /** Extra "Please wait a moment" line — Global* variants only, Page* variants omit it. */
  subtitle?: boolean;
}

export default function LoaderRingDots({ subtitle }: LoaderRingDotsProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="global-loader-ring" aria-hidden="true" />
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Loading<span className="global-loader-dots" />
      </span>
      {subtitle && (
        <span className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
          Please wait a moment
        </span>
      )}
    </div>
  );
}
