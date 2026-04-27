'use client';

import { useQuery } from '@tanstack/react-query';
import axiosClient from '@/lib/axiosClient';
import { queryKeys } from '@/lib/queryKeys';
import { API } from '@/lib/apiUrl';
import ArtSkeleton from '@/components/ui/ArtSkeleton';
import ArtProgress from '@/components/ui/ArtProgress';
import type { ArtColor } from '@/components/ui/art.types';

// ==== Types ====

type DbStats = {
  storage:  { usedBytes: number; limitBytes: number };
  transfer: { usedBytes: number; limitBytes: number };
  compute:  { usedCuHours: number; limitCuHours: number };
  periodEnd: string;
};

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

// ==== Sub-component ====

function StatBar({
  label,
  used,
  limit,
  usedRaw,
  limitRaw,
  loading,
}: {
  label: string;
  used: string;
  limit: string;
  usedRaw: number;
  limitRaw: number;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: 'var(--text)' }}>{label}</span>
        {loading ? (
          <ArtSkeleton className="h-4 w-24" />
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>{used} / {limit}</span>
        )}
      </div>
      {loading
        ? <ArtSkeleton className="h-2 w-full" />
        : <ArtProgress value={usedRaw} max={limitRaw} color={barColor(usedRaw, limitRaw)} />
      }
    </div>
  );
}

// ==== Component ====

export default function AdminPage({ loading: loadingProp }: { loading?: boolean }) {
  const { data, isLoading: queryLoading, error } = useQuery<DbStats>({
    queryKey: queryKeys.admin.dbStats(),
    queryFn: async () => {
      const { data } = await axiosClient.get<DbStats>(API.admin.dbStats());
      return data;
    },
    staleTime: 15 * 60 * 1000,
    enabled: !loadingProp,
  });

  const isLoading = loadingProp || queryLoading;

  const periodLabel = data
    ? new Date(data.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Admin</h1>

      <div
        className="flex flex-col gap-5 rounded-lg p-6"
        style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Neon DB Usage
          </span>
          {periodLabel && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              resets {periodLabel}
            </span>
          )}
        </div>

        {error ? (
          <p className="text-sm" style={{ color: 'var(--art-danger)' }}>
            Failed to load stats. Check NEON_API_KEY and NEON_ORG_ID.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <StatBar
              label="Storage"
              used={data ? formatBytes(data.storage.usedBytes) : '—'}
              limit={data ? formatBytes(data.storage.limitBytes) : '—'}
              usedRaw={data?.storage.usedBytes ?? 0}
              limitRaw={data?.storage.limitBytes ?? 1}
              loading={isLoading}
            />
            <StatBar
              label="Network transfer"
              used={data ? formatBytes(data.transfer.usedBytes) : '—'}
              limit={data ? formatBytes(data.transfer.limitBytes) : '—'}
              usedRaw={data?.transfer.usedBytes ?? 0}
              limitRaw={data?.transfer.limitBytes ?? 1}
              loading={isLoading}
            />
            <StatBar
              label="Compute"
              used={data ? `${(data.compute.usedCuHours ?? 0).toFixed(1)} CU-hrs` : '—'}
              limit={data ? `${data.compute.limitCuHours} CU-hrs` : '—'}
              usedRaw={data?.compute.usedCuHours ?? 0}
              limitRaw={data?.compute.limitCuHours ?? 1}
              loading={isLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
