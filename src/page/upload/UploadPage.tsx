'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useReports } from '@/providers/ReportProvider';
import ArtUpload from '@/components/ui/ArtUpload';
import ArtButton from '@/components/ui/ArtButton';
import ArtTabs from '@/components/ui/ArtTabs';
import FormSection from '@/components/FormSection';
import ConnectionImport from './ConnectionImport';

export default function UploadPage() {
  const { addReport } = useReports();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [tab, setTab] = useState<'file' | 'connection'>('file');

  async function handleUpload(skipMapping: boolean) {
    if (!file) return;
    setLoading(true);
    try {
      await addReport(file);
      router.push(skipMapping ? '/' : '/upload/mapping');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ArtTabs
        value={tab}
        onChange={(v) => setTab(v as 'file' | 'connection')}
        tabs={[
          { value: 'file',       label: 'From file' },
          { value: 'connection', label: 'From connection' },
        ]}
      />

      {tab === 'file' && (
        <FormSection title="Upload">
          <ArtUpload
            ref={fileInputRef}
            label="Report file"
            hint="Excel (.xlsx, .xls)"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          <div className="mt-4 flex justify-end gap-3">
            <ArtButton
              variant="outlined"
              loading={loading}
              disabled={!file}
              onClick={() => handleUpload(true)}
            >
              Skip mapping
            </ArtButton>
            <ArtButton
              color="primary"
              loading={loading}
              disabled={!file}
              onClick={() => handleUpload(false)}
            >
              Add to reports
            </ArtButton>
          </div>
        </FormSection>
      )}

      {tab === 'connection' && (
        <FormSection title="Import from connection">
          <ConnectionImport />
        </FormSection>
      )}
    </>
  );
}
