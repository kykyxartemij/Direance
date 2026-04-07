'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useReports } from '@/providers/ReportProvider';
import ArtUpload from '@/components/ui/ArtUpload';
import ArtButton from '@/components/ui/ArtButton';

export default function UploadPage() {
  const { addReport } = useReports();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

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
    <div className="mx-auto max-w-xl py-8">
      <h1 className="mb-1 text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        Upload report
      </h1>
      <p className="mb-8 text-sm" style={{ color: 'var(--text-muted)' }}>
        Upload an Excel file exported from Merit.ee or any other source. The file is parsed
        locally — it never leaves your browser.
      </p>

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
    </div>
  );
}
