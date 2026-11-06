'use client';

import { useGetLightConnections, useGetPnlReportsByConnections } from '@/hooks/connection.hooks';
import { useReports } from '@/providers/ReportProvider/ReportProvider';
import { isConnectionActive } from '@/providers/ReportProvider/helpers';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { defaultPnlFilterValues, buildPnlFetchFilters } from '@/page/reports/pnl/pnlFilterFields';
import PnlFilterForm from '@/page/reports/pnl/PnlFilterForm';
import ReportView from '../ReportView';

// ==== Profit & Loss report page ====
// Owns its own data: URL-backed fetch filters (shareable / survive refresh), the active P&L
// connection reports (fetched + built by useGetPnlReportsByConnections), and any manually-
// uploaded P&L files from ReportProvider. Merges them and hands the flat list to ReportView.
// Financial Position is a separate page with the same shape — deliberately not one dashboard.

export default function PnlPage() {
  const { data: connections = [] } = useGetLightConnections();
  const { reports: fileReports, connectionOverrides } = useReports();
  const { filters, setFilter } = useUrlFilters(['dateTo', 'dateFrom', 'periods'] as const);

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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <PnlFilterForm values={{ dateTo, dateFrom, periods }} onChange={setFilter} />
      </div>
      <ReportView reports={reports} loading={isFetching} />
    </div>
  );
}
