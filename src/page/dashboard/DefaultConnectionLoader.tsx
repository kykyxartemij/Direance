'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetLightConnections } from '@/hooks/connection.hooks';
import { fetchMappingById } from '@/hooks/mapping.hooks';
import { useReports, type ConnectionSheet } from '@/providers/ReportProvider';
import fetchClient from '@/lib/fetchClient';
import { API } from '@/lib/apiUrl';
import type { ConnectionModel, FetchFiltersModel } from '@/models/connection.models';

// ==== Default connection auto-loader ====
// On first mount of the Dashboard (when reports list is empty), fetches every
// Connection marked isDefault=true and adds it to ReportProvider. If the
// connection has a linked Mapping, the mapping is applied automatically.
//
// Runs at most once per session — guarded by a ref so re-renders, route
// changes, and HMR don't re-trigger fetches.

export default function DefaultConnectionLoader() {
  const queryClient = useQueryClient();
  const { reports, addReportFromSheets, setMapping } = useReports();
  const { data: connections } = useGetLightConnections();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    if (!connections) return;
    // Don't auto-load when the user already has reports — they may have
    // imported manually before defaults finished loading.
    if (reports.length > 0) { didRun.current = true; return; }

    const defaults = connections.filter((c) => c.isDefault);
    if (defaults.length === 0) { didRun.current = true; return; }

    didRun.current = true;
    const filters: FetchFiltersModel = {};
    void Promise.all(defaults.map(async (c) => {
      try {
        const [{ data: full }, { data }] = await Promise.all([
          fetchClient.get<ConnectionModel>(API.connection.byId(c.id)),
          fetchClient.post<{ sheets: ConnectionSheet[]; fetchedAt: string }>(API.connection.fetch(c.id), filters),
        ]);
        const fileName = `${c.name}-${new Date(data.fetchedAt).toISOString().slice(0, 10)}`;
        const id = addReportFromSheets(fileName, data.sheets, {
          connectionId: c.id,
          connectionType: c.type,
          fetchedAt: data.fetchedAt,
        });
        if (full.mapping?.id) {
          const mapping = await fetchMappingById(queryClient, full.mapping.id);
          setMapping(id, mapping);
        }
      } catch {
        // Silent — auto-load failures shouldn't block the Dashboard. User can manually import.
      }
    }));
  }, [connections, reports.length, addReportFromSheets, setMapping, queryClient]);

  return null;
}
