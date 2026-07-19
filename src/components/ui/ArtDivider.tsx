interface ArtDividerProps {
  label?: string;
  className?: string;
}

export default function ArtDivider({ label, className }: ArtDividerProps) {
  if (!label) {
    return <hr className={className} style={{ borderColor: 'var(--border)' }} />;
  }

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <hr style={{ flex: 1, borderColor: 'var(--border)' }} />
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <hr style={{ flex: 1, borderColor: 'var(--border)' }} />
    </div>
  );
}

ArtDivider.displayName = 'ArtDivider';
