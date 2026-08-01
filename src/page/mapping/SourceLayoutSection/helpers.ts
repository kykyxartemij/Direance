import type { ArtSelectOption } from '@/components/ui/ArtSelect';
import type { ArtColor } from '@/components/ui/art.types';
import type { TotalColumnMode } from '@/models/mapping.models';

export function colLetter(n: number): string {
  let result = '';
  let col = n;
  while (col >= 0) {
    result = String.fromCharCode(65 + (col % 26)) + result;
    col = Math.floor(col / 26) - 1;
  }
  return result;
}

export function columnLetterOptions(totalCols: number): ArtSelectOption[] {
  return Array.from({ length: totalCols }, (_, i) => ({
    label: colLetter(i),
    value: String(i),
  }));
}

// Region accent palette (matches ExcelViewer)
export const REGION_ART_COLORS: ArtColor[] = ['primary', 'success', 'warning', 'danger'];

export const TOTAL_COL_MODE_OPTIONS: { value: TotalColumnMode; label: string }[] = [
  { value: 'none', label: 'Regular' },
  { value: 'append', label: 'With Total' },
  { value: 'only', label: 'Only Total' },
];
