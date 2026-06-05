'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useGetLightConnections, useGetConnectionById } from '@/hooks/connection.hooks';
import { fetchMappingById } from '@/hooks/mapping.hooks';
import { useReports } from '@/providers/ReportProvider';
import fetchClient from '@/lib/fetchClient';
import { API } from '@/lib/apiUrl';
import ArtComboBox, { type ArtComboBoxOption } from '@/components/ui/ArtComboBox';
import ArtSelect, { type ArtSelectOption } from '@/components/ui/ArtSelect';
import ArtInput from '@/components/ui/ArtInput';
import ArtButton from '@/components/ui/ArtButton';
import { useArtSnackbar } from '@/components/ui/ArtSnackbar';
import type { FetchFiltersModel } from '@/models/connection.models';
import { REPORT_TYPES, REPORT_TYPE_LABELS } from '@/models/mapping.models';

const MERIT_REPORT_OPTIONS: ArtSelectOption[] = REPORT_TYPES.map((r) => ({ label: REPORT_TYPE_LABELS[r], value: r }));
import type { ConnectionSheet } from '@/providers/ReportProvider';

// ==== Component ====
// Pick a saved Connection → fill per-driver filters → fetch → push to ReportProvider.
// If the Connection has a default mapping linked, auto-apply it on import.

export default function ConnectionImport() {
  const router = useRouter();
  const { enqueueError } = useArtSnackbar();
  const { addReportFromSheets, setMapping } = useReports();

  const [connectionId, setConnectionId] = useState<string | null>(null);

  // Per-driver filter state — only the fields for the picked driver are read at submit.
  const [reportType, setReportType]         = useState('pnl');
  const [dateFrom, setDateFrom]             = useState('');
  const [dateTo, setDateTo]                 = useState('');
  const [journalIds, setJournalIds]         = useState('');
  const [accountPrefix, setAccountPrefix]   = useState('');

  const [loading, setLoading] = useState(false);

  const queryClient = useQueryClient();
  const { data: connections = [] } = useGetLightConnections();
  const { data: selected }         = useGetConnectionById(connectionId ?? undefined);

  const options: ArtComboBoxOption[] = connections.map((c) => ({
    label: `${c.name} (${c.type.toUpperCase()})`,
    value: c.id,
  }));

  function buildFilters(): FetchFiltersModel {
    if (selected?.type === 'odoo') {
      const parsedJournals = journalIds
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
      const extras: Record<string, unknown> = {};
      if (parsedJournals.length > 0) extras.journalIds = parsedJournals;
      if (accountPrefix)             extras.accountPrefix = accountPrefix;
      return {
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo   ? { dateTo }   : {}),
        ...(Object.keys(extras).length > 0 ? { extras } : {}),
      };
    }
    // merit
    return {
      reportType,
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo   ? { dateTo }   : {}),
    };
  }

  async function handleImport(skipMapping: boolean) {
    if (!connectionId) return;
    setLoading(true);
    try {
      const { data } = await fetchClient.post<{ sheets: ConnectionSheet[]; fetchedAt: string }>(
        API.connection.fetch(connectionId),
        buildFilters(),
      );
      const fileName = `${selected?.name ?? 'Connection'}-${new Date(data.fetchedAt).toISOString().slice(0, 10)}`;
      const id = addReportFromSheets(fileName, data.sheets, {
        connectionId,
        connectionType: selected?.type,
        fetchedAt: data.fetchedAt,
      });

      const mappingId = selected?.mapping?.id;
      if (!skipMapping && mappingId) {
        const mapping = await fetchMappingById(queryClient, mappingId);
        setMapping(id, mapping);
      }

      // No mapping linked → navigate to mapping wizard so user can build one
      // (source-layout auto-detect kicks in there). With mapping → straight to Dashboard.
      router.push(skipMapping || !selected?.mapping ? '/' : '/upload/mapping');
    } catch (err) {
      enqueueError(err as Error, 'Failed to import from connection');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ArtComboBox
        label="Connection"
        options={options}
        selected={options.find((o) => o.value === connectionId) ?? null}
        placeholder={connections.length === 0 ? 'No connections — create one first' : 'Pick a connection…'}
        clearable
        onChange={(opt) => setConnectionId(opt?.value ?? null)}
      />

      {selected?.type === 'merit' && (
        <>
          <ArtSelect
            label="Report"
            options={MERIT_REPORT_OPTIONS}
            selected={MERIT_REPORT_OPTIONS.find((o) => o.value === reportType) ?? null}
            onChange={(opt) => setReportType(opt?.value ?? 'pnl')}
          />
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <ArtInput label="Date from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <ArtInput label="Date to"   type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </>
      )}

      {selected?.type === 'odoo' && (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <ArtInput label="Date from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <ArtInput label="Date to"   type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <ArtInput
            label="Journal IDs"
            placeholder="1,2,5"
            value={journalIds}
            onChange={(e) => setJournalIds(e.target.value)}
          />
          <ArtInput
            label="Account prefix"
            placeholder="411"
            value={accountPrefix}
            onChange={(e) => setAccountPrefix(e.target.value)}
          />
        </>
      )}

      <div className="mt-4 flex justify-end gap-3">
        <ArtButton
          variant="outlined"
          loading={loading}
          disabled={!connectionId}
          onClick={() => handleImport(true)}
        >
          Skip mapping
        </ArtButton>
        <ArtButton
          color="primary"
          loading={loading}
          disabled={!connectionId}
          onClick={() => handleImport(false)}
        >
          Import
        </ArtButton>
      </div>
    </div>
  );
}
