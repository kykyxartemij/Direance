'use client';

import { useState } from 'react';
import axiosClient from '@/lib/axiosClient';
import { API } from '@/lib/apiUrl';
import ArtUpload from '@/components/ui/ArtUpload';
import ArtButton from '@/components/ui/ArtButton';
import type { ParsedReport } from '@/models/report.models';

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ParsedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await axiosClient.post<ParsedReport>(API.report.upload(), formData);
      setReport(data);
    } catch (err: any) {
      setError(err?.message ?? 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 flex flex-col gap-6">
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <ArtUpload
            label="Upload report"
            hint="Excel (.xlsx, .xls)"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <ArtButton
          onClick={handleParse}
          loading={loading}
          disabled={!file}
          variant="default"
          size="md"
        >
          Parse
        </ArtButton>
      </div>

      {error && (
        <p className="text-sm" style={{ color: 'var(--art-danger)' }}>
          {error}
        </p>
      )}

      {report && (
        <div>
          <p className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Sheet: <span style={{ color: 'var(--text)' }}>{report.sheetName}</span>
            {report.sheetNames.length > 1 && (
              <> &nbsp;·&nbsp; {report.sheetNames.length} sheets total</>
            )}
            &nbsp;·&nbsp; {report.rows.length} rows
          </p>

          <div
            className="overflow-x-auto rounded border"
            style={{ borderColor: 'var(--border)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  {report.headers.map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left font-medium whitespace-nowrap"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    {report.headers.map((h) => (
                      <td
                        key={h}
                        className="px-3 py-2 whitespace-nowrap"
                        style={{ color: 'var(--text)' }}
                      >
                        {String(row[h] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
