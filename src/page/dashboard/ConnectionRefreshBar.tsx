'use client';

import { useState } from 'react';
import { useReports } from '@/providers/ReportProvider';
import { useGetLightConnections, useRefreshConnectionReports } from '@/hooks/connection.hooks';
import ArtInput from '@/components/ui/ArtInput';
import ArtButton from '@/components/ui/ArtButton';
import ArtCheckbox from '@/components/ui/ArtCheckbox';
import { REPORT_TYPE_LABELS } from '@/models/mapping.models';
import type { ReportType } from '@/models/mapping.models';
import type { FetchFiltersModel } from '@/models/connection.models';

// ==== Filter state per connection ====

type ConnectionFilters = {
  perCount: number;
  endDate: string;
  sumPeriods: boolean;
};

function defaultFilters(): ConnectionFilters {
  const today = new Date().toISOString().slice(0, 10);
  return { perCount: 3, endDate: today, sumPeriods: false };
}

// ==== Per-connection filter card ====

interface ConnectionFilterCardProps {
  connectionId: string;
  reportId: string;
  name: string;
  reportType: string;
  filters: ConnectionFilters;
  onChange: (f: ConnectionFilters) => void;
  onSubmit: () => void;
  loading: boolean;
}

function ConnectionFilterCard({
  name, reportType, filters, onChange, onSubmit, loading,
}: ConnectionFilterCardProps) {
  const isPnl = reportType === 'pnl';
  const label = REPORT_TYPE_LABELS[reportType as ReportType] ?? reportType;

  return (
    <div className="art-data-filters">
      <div className="art-data-filters-bar" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)', alignSelf: 'center', marginRight: 4 }}>
          {name} · {label}
        </span>

        <ArtInput
          label="Periods"
          type="number"
          min={1}
          max={24}
          value={String(filters.perCount)}
          onChange={(e) => onChange({ ...filters, perCount: Math.max(1, Number(e.target.value) || 1) })}
          style={{ width: 90 }}
        />

        <ArtInput
          label={isPnl ? 'Period end date' : 'Balance date'}
          type="date"
          value={filters.endDate}
          onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
          style={{ width: 160 }}
        />

        {isPnl && (
          <ArtCheckbox
            label="Sum periods"
            size="sm"
            checked={filters.sumPeriods}
            onChange={(e) => onChange({ ...filters, sumPeriods: e.target.checked })}
          />
        )}

        <ArtButton color="primary" loading={loading} onClick={onSubmit} style={{ alignSelf: 'flex-end' }}>
          Get report
        </ArtButton>
      </div>
    </div>
  );
}

// ==== Main component ====

export default function ConnectionRefreshBar() {
  const { reports } = useReports();
  const { data: connections = [] } = useGetLightConnections();
  const { mutate: refresh, isPending } = useRefreshConnectionReports();

  const [filterMap, setFilterMap] = useState<Record<string, ConnectionFilters>>({});

  const activeConnectionReports = reports.filter((r) => r.source === 'connection' && r.connectionId && r.active);
  if (activeConnectionReports.length === 0) return null;

  function getFilters(connectionId: string): ConnectionFilters {
    return filterMap[connectionId] ?? defaultFilters();
  }

  function setFilters(connectionId: string, f: ConnectionFilters) {
    setFilterMap((prev) => ({ ...prev, [connectionId]: f }));
  }

  function handleSubmit(reportId: string, connectionId: string) {
    const f = getFilters(connectionId);
    const filters: FetchFiltersModel = {
      perCount:   f.perCount,
      endDate:    f.endDate || undefined,
      sumPeriods: f.sumPeriods || undefined,
    };
    refresh([{ reportId, connectionId, filters }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {activeConnectionReports.map((r) => {
        const conn = connections.find((c) => c.id === r.connectionId);
        return (
          <ConnectionFilterCard
            key={r.id}
            connectionId={r.connectionId!}
            reportId={r.id}
            name={conn?.name ?? r.fileName}
            reportType={conn?.reportType ?? 'pnl'}
            filters={getFilters(r.connectionId!)}
            onChange={(f) => setFilters(r.connectionId!, f)}
            onSubmit={() => handleSubmit(r.id, r.connectionId!)}
            loading={isPending}
          />
        );
      })}
    </div>
  );
}
