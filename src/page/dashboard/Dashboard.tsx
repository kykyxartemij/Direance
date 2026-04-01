'use client';

import { useState } from 'react';
import * as XLSXStyle from 'xlsx-js-style';
import Link from 'next/link';
import { useReports, type UploadedReport } from '@/providers/ReportProvider';
import { parseWorkbook } from '@/page/mapping/applyMapping';
import ArtButton from '@/components/ui/ArtButton';
import ArtBadge from '@/components/ui/ArtBadge';
import ArtDataTable, { type ArtColumn } from '@/components/ui/ArtDataTable';
import ArtTabs from '@/components/ui/ArtTabs';
import type { ArtColor } from '@/components/ui/art.types';
import ExcelViewer from './ExcelViewer';

// ==== Types ====

type Row = Record<string, unknown>;

// ==== Combine logic ====

function combineReports(reports: UploadedReport[]): {
  headers: string[];
  rows: Row[];
  rowIndents: number[];
  rowColors: (ArtColor | undefined)[];
  valueColors: (ArtColor | undefined)[];
} {
  if (reports.length === 0) return { headers: [], rows: [], rowIndents: [], rowColors: [], valueColors: [] };

  const parsed = reports.map((r) => {
    const base = r.processedHeaders && r.processedRows
      ? { headers: r.processedHeaders, rows: r.processedRows }
      : parseWorkbook(r.workbook, r.activeSheet);
    return {
      label: r.fileName.replace(/\.(xlsx|xls)$/i, '').slice(0, 10),
      rowIndents: r.rowIndents,
      rowColors: r.rowColors ?? [],
      valueColors: r.valueColors ?? [],
      ...base,
    };
  });

  if (parsed.length === 1) {
    return {
      headers: parsed[0].headers,
      rows: parsed[0].rows,
      rowIndents: parsed[0].rowIndents,
      rowColors: parsed[0].rowColors,
      valueColors: parsed[0].valueColors,
    };
  }

  const descHeader = parsed[0].headers[0];
  const combinedHeaders = [
    descHeader,
    ...parsed.flatMap(({ label, headers }) => headers.slice(1).map((h: string) => `${label} · ${h}`)),
  ];

  const rowMap = new Map<string, Row>();
  const colorMap = new Map<string, { nameColor?: ArtColor; valueColor?: ArtColor }>();
  for (const { label, rows, headers, rowColors, valueColors } of parsed) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const desc = String(row[headers[0]] ?? '');
      if (!rowMap.has(desc)) {
        rowMap.set(desc, { [descHeader]: desc });
        colorMap.set(desc, { nameColor: rowColors[i], valueColor: valueColors[i] });
      }
      const merged = rowMap.get(desc)!;
      for (const h of headers.slice(1)) merged[`${label} · ${h}`] = row[h];
    }
  }

  const orderedRows = Array.from(rowMap.values());
  const orderedColors = Array.from(colorMap.values());

  return {
    headers: combinedHeaders,
    rows: orderedRows,
    rowIndents: parsed[0].rowIndents,
    rowColors: orderedColors.map((c) => c.nameColor),
    valueColors: orderedColors.map((c) => c.valueColor),
  };
}

// ==== Excel styling constants ====

const FONT_COLOR: Record<string, string> = {
  primary: '646CFF',
  success: '22C55E',
  warning: 'EAB308',
  danger:  'EF4444',
};

const THIN_BORDER = { style: 'thin', color: { rgb: 'D0D0D0' } } as const;
const CELL_BORDER = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '333333' } },
  border: CELL_BORDER,
  alignment: { vertical: 'center' },
};

const SECTION_STYLE = {
  font: { bold: true },
  fill: { fgColor: { rgb: 'E8E8E8' } },
  border: CELL_BORDER,
};

const TOTAL_STYLE = {
  font: { bold: true },
  fill: { fgColor: { rgb: 'F0F0F0' } },
  border: CELL_BORDER,
};

const DEFAULT_STYLE = {
  font: {},
  border: CELL_BORDER,
};

// ==== Excel export ====

function exportToExcel(
  headers: string[],
  rows: Row[],
  rowIndents: number[],
  rowColors: (ArtColor | undefined)[] = [],
  valueColors: (ArtColor | undefined)[] = [],
) {
  const [descHeader, ...valueHeaders] = headers;
  const wb = XLSXStyle.utils.book_new();
  const ws: XLSXStyle.WorkSheet = {};

  // Header row
  headers.forEach((h, c) => {
    ws[XLSXStyle.utils.encode_cell({ r: 0, c })] = {
      t: 's',
      v: h,
      s: { ...HEADER_STYLE, alignment: { ...HEADER_STYLE.alignment, horizontal: c === 0 ? 'left' : 'right' } },
    };
  });

  const sectionStart: Record<number, number> = {};

  rows.forEach((row, rowIdx) => {
    const excelRow = rowIdx + 2;
    const desc = String(row[descHeader] ?? '');
    const isTotal = /^total/i.test(desc);
    const isEmpty = valueHeaders.every((h) => row[h] === '' || row[h] == null);
    const indent = rowIndents[rowIdx] ?? 0;
    const isSection = isEmpty && !isTotal;
    const isTopLevel = indent === 0 && (isSection || isTotal);

    // Row-level style base
    const rowBase = isTopLevel && isSection ? SECTION_STYLE
      : isTotal ? TOTAL_STYLE
      : DEFAULT_STYLE;

    // Name font color from mapping
    const nameRgb = rowColors[rowIdx] ? FONT_COLOR[rowColors[rowIdx]!] : undefined;
    const valRgb = valueColors[rowIdx] ? FONT_COLOR[valueColors[rowIdx]!] : undefined;

    const nameFont = {
      ...rowBase.font,
      ...(nameRgb ? { color: { rgb: nameRgb } } : {}),
    };

    ws[XLSXStyle.utils.encode_cell({ r: excelRow - 1, c: 0 })] = {
      t: 's',
      v: desc,
      s: { ...rowBase, font: nameFont },
    };

    valueHeaders.forEach((h, vIdx) => {
      const c = vIdx + 1;
      const colLetter = XLSXStyle.utils.encode_col(c);
      const addr = XLSXStyle.utils.encode_cell({ r: excelRow - 1, c });

      const valFont = {
        ...rowBase.font,
        ...(valRgb ? { color: { rgb: valRgb } } : {}),
      };
      const cellStyle = {
        ...rowBase,
        font: valFont,
        alignment: { horizontal: 'right' as const },
        numFmt: '#,##0',
      };

      if (isEmpty) {
        ws[addr] = { t: 's', v: '', s: { ...rowBase, font: valFont } };
        delete sectionStart[c];
      } else if (isTotal && sectionStart[c] != null) {
        ws[addr] = { t: 'n', f: `SUM(${colLetter}${sectionStart[c]}:${colLetter}${excelRow - 1})`, s: cellStyle };
        delete sectionStart[c];
      } else {
        const num = Number(row[h]);
        const isNum = !isNaN(num) && row[h] !== '';
        ws[addr] = isNum
          ? { t: 'n', v: num, s: cellStyle }
          : { t: 's', v: String(row[h] ?? ''), s: { ...rowBase, font: valFont } };
        if (isNum && sectionStart[c] == null) sectionStart[c] = excelRow;
      }
    });
  });

  // Set ref and column widths
  ws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } });
  ws['!cols'] = [{ wch: 35 }, ...valueHeaders.map(() => ({ wch: 18 }))];

  XLSXStyle.utils.book_append_sheet(wb, ws, 'Report');
  XLSXStyle.writeFile(wb, 'combined-report.xlsx');
}

// ==== Helpers ====

function formatCell(value: unknown): string {
  if (value === '' || value == null) return '';
  const num = Number(value);
  if (!isNaN(num)) return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return String(value);
}

function colorToCssVar(color: ArtColor | undefined): string | undefined {
  if (!color || color === 'neutral') return undefined;
  return `var(--art-${color})`;
}

function buildColumns(
  headers: string[],
  rowIndents: number[],
  rowColors: (ArtColor | undefined)[] = [],
  valueColors: (ArtColor | undefined)[] = [],
): ArtColumn<Row>[] {
  const [descHeader, ...valueHeaders] = headers;

  return [
    {
      key: descHeader,
      label: descHeader,
      sticky: true,
      width: 220,
      render: (row, index) => {
        const indent = rowIndents[index] ?? 0;
        const isEmpty = valueHeaders.every((h) => !row[h]);
        const isTotal = /^total/i.test(String(row[descHeader] ?? ''));
        const nameColor = colorToCssVar(rowColors[index]);

        return (
          <span
            style={{
              fontWeight: indent === 0 && (isEmpty || isTotal) ? 600 : undefined,
              color: nameColor ?? 'var(--text)',
            }}
          >
            {String(row[descHeader] ?? '')}
          </span>
        );
      },
    },
    ...valueHeaders.map((h, vIdx) => ({
      key: `${vIdx}_${h}`,
      label: h,
      render: (row: Row, index: number) => (
        <span
          className="tabular-nums"
          style={{
            display: 'block',
            textAlign: 'right' as const,
            color: colorToCssVar(valueColors[index]),
          }}
        >
          {formatCell(row[h])}
        </span>
      ),
    })),
  ];
}

function getRowClass(row: Row, index: number, valueHeaders: string[], rowIndents: number[]): string | undefined {
  const indent = rowIndents[index] ?? 0;
  const isEmpty = valueHeaders.every((h) => row[h] === '' || row[h] == null);
  const isTotal = /^total/i.test(String(Object.values(row)[0] ?? ''));

  if (!isEmpty && !isTotal) return 'art-data-tr--base'; // line items

  // indent 0 = top-level section or top-level total → elevated
  // indent 1+ = sub-section or sub-total → default surface (no extra class)
  return indent === 0 ? 'art-data-tr--elevated' : undefined;
}

// ==== Component ====

const VIEW_TABS = [
  { value: 'table', label: 'Table' },
  { value: 'excel', label: 'Excel' },
];

export default function Dashboard() {
  const { reports } = useReports();
  const [view, setView] = useState('table');

  if (reports.length === 0) {
    return (
      <div className="mt-16 flex flex-col items-center gap-4 text-center">
        <p className="text-lg font-medium" style={{ color: 'var(--text)' }}>
          No reports uploaded yet
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Upload one or more Excel reports to see them combined here.
        </p>
        <Link href="/upload" prefetch>
          <ArtButton color="primary">Upload report</ArtButton>
        </Link>
      </div>
    );
  }

  const { headers, rows, rowIndents, rowColors, valueColors } = combineReports(reports);
  const [, ...valueHeaders] = headers;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ArtTabs tabs={VIEW_TABS} value={view} onChange={setView} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {reports.length} report{reports.length > 1 ? 's' : ''} &nbsp;·&nbsp; {rows.length} rows
          </p>
          {reports.some((r) => !r.processedHeaders) && (
            <div className="flex items-center gap-2">
              {reports.filter((r) => !r.processedHeaders).map((r) => (
                <Link key={r.id} href="/upload">
                  <ArtBadge color="warning" size="sm">
                    {r.fileName} — unmapped
                  </ArtBadge>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <ArtButton onClick={() => exportToExcel(headers, rows, rowIndents, rowColors, valueColors)}>Export Excel</ArtButton>
          <Link href="/upload" prefetch>
            <ArtButton color="primary">Add report</ArtButton>
          </Link>
        </div>
      </div>

      {view === 'table' ? (
        <ArtDataTable<Row>
          columns={buildColumns(headers, rowIndents, rowColors, valueColors)}
          data={rows}
          rowKey={(row) => String(row[headers[0]] ?? '')}
          rowClassName={(row, index) => getRowClass(row, index, valueHeaders, rowIndents)}
          emptyMessage="No rows found"
        />
      ) : (
        <ExcelViewer workbook={reports[0].workbook} />
      )}
    </div>
  );
}
