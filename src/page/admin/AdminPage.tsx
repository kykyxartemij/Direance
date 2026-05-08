'use client';

import { useGetDbStats } from '@/hooks/admin.hooks';
import ArtProgress from '@/components/ui/ArtProgress';
import type { ArtColor } from '@/components/ui/art.types';

// ==== Helpers ====

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function barColor(usedRaw: number, limitRaw: number): ArtColor {
  const ratio = usedRaw / limitRaw;
  if (ratio >= 0.9) return 'danger';
  if (ratio >= 0.7) return 'warning';
  return 'primary';
}

// ==== StatBar ====

function StatBar({ label, used, limit, usedRaw, limitRaw }: {
  label: string;
  used: string;
  limit: string;
  usedRaw: number;
  limitRaw: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: 'var(--text)' }}>{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>{used} / {limit}</span>
      </div>
      <ArtProgress value={usedRaw} max={limitRaw} color={barColor(usedRaw, limitRaw)} />
    </div>
  );
}

// ==== Page ====

export default function AdminPage() {
  const { data } = useGetDbStats();

  const periodLabel = new Date(data.periodEnd).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="flex flex-col gap-6">
      <div
        className="flex flex-col gap-5 rounded-lg p-6"
        style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Neon DB Usage</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>resets {periodLabel}</span>
        </div>
        <div className="flex flex-col gap-4">
          <StatBar
            label="Storage"
            used={formatBytes(data.storage.usedBytes)}
            limit={formatBytes(data.storage.limitBytes)}
            usedRaw={data.storage.usedBytes}
            limitRaw={data.storage.limitBytes}
          />
          <StatBar
            label="Network transfer"
            used={formatBytes(data.transfer.usedBytes)}
            limit={formatBytes(data.transfer.limitBytes)}
            usedRaw={data.transfer.usedBytes}
            limitRaw={data.transfer.limitBytes}
          />
          <StatBar
            label="Compute"
            used={`${(data.compute.usedCuHours ?? 0).toFixed(1)} CU-hrs`}
            limit={`${data.compute.limitCuHours} CU-hrs`}
            usedRaw={data.compute.usedCuHours}
            limitRaw={data.compute.limitCuHours}
          />
        </div>
      </div>
    </div>
  );
}
