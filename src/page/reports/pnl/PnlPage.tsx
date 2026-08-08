'use client';

import { useMemo } from 'react';
import { useGetLightConnections, useGetPnlReportsByConnections } from '@/hooks/connection.hooks';
import { useReports } from '@/providers/ReportProvider/ReportProvider';
import { isConnectionActive } from '@/providers/ReportProvider/helpers';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { defaultPnlFilterValues, buildPnlFetchFilters } from '@/page/reports/pnl/pnlFilterFields';
import PnlFilterForm from '@/page/reports/pnl/PnlFilterForm';
import ArtDataFilters from '@/components/ui/ArtDataFilters';
import ReportView from '../ReportView';

// ==== Profit & Loss report page ====
// Owns its own data: URL-backed fetch filters (shareable / survive refresh), the active P&L
// connection reports (fetched + built by useGetPnlReportsByConnections), and any manually-
// uploaded P&L files from ReportProvider. Merges them and hands the flat list to ReportView.
// Financial Position is a separate page with the same shape — deliberately not one dashboard.

export default function PnlPage() {
  const { data: connections = [] } = useGetLightConnections();
  const { reports: fileReports, connectionOverrides } = useReports();
  const { filters, setFilter, clearFilters, activeCount } = useUrlFilters(['dateTo', 'dateFrom', 'periods'] as const);

  // URL params are string | null — fall back to the field defaults (an end date + one period
  // are always needed, they just aren't "active filters" until the user changes them).
  const dateTo = filters.dateTo ?? defaultPnlFilterValues().dateTo;
  const dateFrom = filters.dateFrom ?? '';
  const periods = filters.periods ?? defaultPnlFilterValues().periods;

  const activeConnections = connections.filter((c) => c.reportType === 'pnl' && isConnectionActive(c, connectionOverrides));
  const { data: connectionReports = [], isFetching } = useGetPnlReportsByConnections(
    activeConnections,
    buildPnlFetchFilters({ dateTo, dateFrom, periods }),
    { throwOnError: true },
  );

  const reports = [
    ...fileReports.filter((r) => r.source === 'file' && r.mapping?.reportType === 'pnl'),
    ...connectionReports,
  ];

  // Stable reference required — a fresh element every render trips react-doctor/jsx-no-jsx-as-prop.
  const advancedFilters = useMemo(
    () => <PnlFilterForm values={{ dateTo, dateFrom, periods }} onChange={(key, value) => setFilter(key, value)} />,
    [dateTo, dateFrom, periods, setFilter],
  );

  return (
    <div className="flex flex-col gap-4">
      <ArtDataFilters
        searchable={false}
        defaultFiltersOpen
        advancedFilters={advancedFilters}
        activeFilterCount={activeCount}
        onClearFilters={clearFilters}
      />
      <ReportView reports={reports} loading={isFetching} />
    </div>
  );
}
