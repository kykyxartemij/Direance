'use client';

import type { ReactNode } from 'react';

// Used by ExportSetting and Mapping forms to group related fields without ArtCollapse.

export default function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}
