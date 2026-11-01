'use client';

import { useGetDbStats } from '@/hooks/admin.hooks';
import { useGetDbConsumption } from '@/hooks/user.hooks';
import { useAuth } from '@/providers/AuthProvider';
import ArtProgress from '@/components/ui/ArtProgress';
import ArtSkeleton from '@/components/ui/ArtSkeleton';
import { Permission } from '@/lib/permissions';
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

function StatBar({ label, used, limit, usedRaw, limitRaw, description }: {
  label: string;
  used: string;
  limit: string;
  usedRaw: number;
  limitRaw: number;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: 'var(--text)' }}>{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>{used} / {limit}</span>
      </div>
      <ArtProgress value={usedRaw} max={limitRaw} color={barColor(usedRaw, limitRaw)} />
      {description && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{description}</p>
      )}
    </div>
  );
}

// ==== Section ====

export default function StatsSection() {
  const { hasPermission } = useAuth();
  const hasNoSizeLimit = hasPermission(Permission.NO_DB_SIZE_LIMITS);
  const { data, isLoading: statsLoading } = useGetDbStats();
  const { data: consumption, isLoading: consumptionLoading } = useGetDbConsumption();
  const isLoading = statsLoading || consumptionLoading;
  const personalLimitRaw = hasNoSizeLimit
    ? (data?.storage.limitBytes ?? 0) - (data?.storage.usedBytes ?? 0) + (consumption?.used ?? 0)
    : (consumption?.limit ?? 0);

  const content = (
    <div
      className="flex flex-col gap-4 rounded-lg p-6"
      style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
    >
      <StatBar
        label="Storage"
        used={formatBytes(data?.storage.usedBytes ?? 0)}
        limit={formatBytes(data?.storage.limitBytes ?? 0)}
        usedRaw={data?.storage.usedBytes ?? 0}
        limitRaw={data?.storage.limitBytes ?? 1}
        description="Space used by all saved data. If full, nothing new can be saved until something is deleted. Does not reset."
      />
      <StatBar
        label="Network Transfer"
        used={formatBytes(data?.transfer.usedBytes ?? 0)}
        limit={formatBytes(data?.transfer.limitBytes ?? 0)}
        usedRaw={data?.transfer.usedBytes ?? 0}
        limitRaw={data?.transfer.limitBytes ?? 1}
        description="Data read from storage. Grows with site use. If full, the site stops working. Resets monthly."
      />
      <StatBar
        label="Compute"
        used={`${(data?.compute.usedCuHours ?? 0).toFixed(1)} CU-hrs`}
        limit={`${data?.compute.limitCuHours ?? 0} CU-hrs`}
        usedRaw={data?.compute.usedCuHours ?? 0}
        limitRaw={data?.compute.limitCuHours ?? 1}
        description="Time the database spends working. Usually near zero. Resets monthly."
      />
      <StatBar
        label="Your Personal Storage Usage"
        used={formatBytes(consumption?.used ?? 0)}
        limit={formatBytes(personalLimitRaw)}
        usedRaw={consumption?.used ?? 0}
        limitRaw={personalLimitRaw || 1}
        description={
          hasNoSizeLimit
            ? 'Space used by your own data. You have no personal limit. Does not reset.'
            : 'Space used by your own data. Delete old records to free space. Does not reset.'
        }
      />
    </div>
  );

  if (isLoading) return <ArtSkeleton wrap>{content}</ArtSkeleton>;
  return content;
}
