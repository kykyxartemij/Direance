'use client';

import { useSearchParams } from 'next/navigation';
import MappingStep from './MappingStep';

// Reads ?id= from URL so the page.tsx stays sync/static — instant nav, BE calls happen during loading state.
export default function MappingStepPage() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get('id') ?? undefined;
  return <MappingStep reportId={reportId} />;
}
