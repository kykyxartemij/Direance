'use client';

import { useMemo } from 'react';
import { useGetLightConnections, useFetchFinancialPositionConnectionReports } from '@/hooks/connection.hooks';
import { useReports, isConnectionActive } from '@/providers/ReportProvider';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import {
  defaultFinancialPositionFilterValues,
  buildFinancialPositionFetchFilters,
} from '@/page/reports/financial-position/financialPositionFilterFields';
import FinancialPositionFilterForm from '@/page/reports/financial-position/FinancialPositionFilterForm';
import ArtDataFilters from '@/components/ui/ArtDataFilters';
import ReportView from '../ReportView';

// ==== Financial Position report page ====
// Owns its own data: URL-backed fetch filters (shareable / survive refresh), the active
// Financial Position connection reports (fetched + built by the hook), and any manually-
// uploaded files of this type from ReportProvider. Merges them and hands the flat list to
// ReportView. Profit & Loss is a separate page with the same shape — deliberately not merged.

export default function FinancialPositionPage() {
  const { data: connections = [] } = useGetLightConnections();
  const { reports: fileReports, connectionOverrides } = useReports();
  const { filters, setFilter, clearFilters, activeCount } = useUrlFilters(['dateTo', 'periods'] as const);

  // URL params are string | null — fall back to the field defaults (a balance date + one
  // period are always needed, they just aren't "active filters" until the user changes them).
  const dateTo = filters.dateTo ?? defaultFinancialPositionFilterValues().dateTo;
  const periods = filters.periods ?? defaultFinancialPositionFilterValues().periods;

  const activeConnections = connections.filter((c) => c.reportType === 'financial_position' && isConnectionActive(c, connectionOverrides));
  const { data: connectionReports = [] } = useFetchFinancialPositionConnectionReports(
    activeConnections,
    buildFinancialPositionFetchFilters({ dateTo, periods }),
    { throwOnError: true },
  );

  const reports = [
    ...fileReports.filter((r) => r.source === 'file' && r.mapping?.reportType === 'financial_position'),
    ...connectionReports,
  ];

  // Stable reference required — a fresh element every render trips react-doctor/jsx-no-jsx-as-prop.
  const advancedFilters = useMemo(
    () => <FinancialPositionFilterForm values={{ dateTo, periods }} onChange={(key, value) => setFilter(key, value)} />,
    [dateTo, periods, setFilter],
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
      <ReportView reports={reports} />
    </div>
  );
}
