'use client';

import { useState } from 'react';
import { useReports } from '@/providers/ReportProvider';
import { useGetLightConnections, useRefreshPnlConnectionById, useRefreshFinancialPositionConnectionById } from '@/hooks/connection.hooks';
import ArtButton from '@/components/ui/ArtButton';
import PnlFilterForm from '@/page/connections/PnlFilterForm';
import FinancialPositionFilterForm from '@/page/connections/FinancialPositionFilterForm';
import { defaultPnlFilterValues, buildPnlFetchFilters, type PnlFilterValues } from '@/page/connections/pnlFilterFields';
import {
  defaultFinancialPositionFilterValues,
  buildFinancialPositionFetchFilters,
  type FinancialPositionFilterValues,
} from '@/page/connections/financialPositionFilterFields';
import type { ReportType } from '@/models/mapping.models';

// ==== Per-active-connection refresh bar — scoped to one report page's type ====
// Mounted once per report page (pnl / financial position), only ever shows
// connections of that page's reportType — see PnlFilterForm /
// FinancialPositionFilterForm (kept separate on purpose).

type Props = {
  reportType: ReportType;
};

export default function ConnectionRefreshBar({ reportType }: Props) {
  const { reports } = useReports();
  const { data: allConnections = [] } = useGetLightConnections();
  const connections = allConnections.filter((c) => c.reportType === reportType);
  const { mutate: refreshPnl, isPending: refreshingPnl } = useRefreshPnlConnectionById();
  const { mutate: refreshFinancialPosition, isPending: refreshingFinancialPosition } = useRefreshFinancialPositionConnectionById();
  const isPending = refreshingPnl || refreshingFinancialPosition;

  const [pnlValuesMap, setPnlValuesMap] = useState<Record<string, PnlFilterValues>>({});
  const [finPosValuesMap, setFinPosValuesMap] = useState<Record<string, FinancialPositionFilterValues>>({});

  const activeConnectionReports = reports.filter(
    (r) => r.source === 'connection' && r.active && connections.some((c) => c.id === r.connectionId),
  );
  if (activeConnectionReports.length === 0) return null;

  function handleSubmit(reportId: string, connectionId: string) {
    if (reportType === 'pnl') {
      refreshPnl({ reportId, connectionId, ...buildPnlFetchFilters(pnlValuesMap[connectionId] ?? defaultPnlFilterValues()) });
    } else {
      refreshFinancialPosition({ reportId, connectionId, ...buildFinancialPositionFetchFilters(finPosValuesMap[connectionId] ?? defaultFinancialPositionFilterValues()) });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {activeConnectionReports.map((r) => {
        const conn = connections.find((c) => c.id === r.connectionId);
        if (!conn) return null;
        return (
          <div key={r.id} className="art-data-filters">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {conn.name}
              </span>
              <ArtButton color="primary" size="sm" loading={isPending} onClick={() => handleSubmit(r.id, conn.id)}>
                Get report
              </ArtButton>
            </div>
            {reportType === 'pnl' ? (
              <PnlFilterForm
                values={pnlValuesMap[conn.id] ?? defaultPnlFilterValues()}
                onChange={(key, value) =>
                  setPnlValuesMap((prev) => ({ ...prev, [conn.id]: { ...(prev[conn.id] ?? defaultPnlFilterValues()), [key]: value } }))
                }
              />
            ) : (
              <FinancialPositionFilterForm
                values={finPosValuesMap[conn.id] ?? defaultFinancialPositionFilterValues()}
                onChange={(key, value) =>
                  setFinPosValuesMap((prev) => ({ ...prev, [conn.id]: { ...(prev[conn.id] ?? defaultFinancialPositionFilterValues()), [key]: value } }))
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
