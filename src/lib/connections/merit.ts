/* eslint-disable local/use-fetch-client */
import 'server-only';
import crypto from 'crypto';
import type { RawReport } from './index';
import { MERIT_BASE_URLS, type MeritSecret, type PnlFetchFiltersModel, type FinancialPositionFetchFiltersModel } from '@/models/connection.models';
import { ApiError } from '@/models/api-error';

// ==== Merit.ee driver ====
// Two separate functions, not one switch on reportType — getbalancerep
// (Financial Position) and getprofitrep (P&L) are different endpoints with
// different payloads. Per the real API spec (PDF: Merit_Aktiva_API_specification,
// v1), the ONLY accepted fields are:
//   getprofitrep:  EndDate (Str), PerCount (Int), DepFilter (Str, optional)
//   getbalancerep: EndDate (Str), PerCount (Int) — no DepFilter
// There is no SumPeriods, date-range, journal, or account-prefix concept on
// Merit's side at all — those are Odoo-only (see odoo.ts). Do not add them
// back here without a doc reference confirming the real param name.
//
// Auth: POST JSON body, auth params in URL query string.
// Docs: https://api.merit.ee/connecting-robots/reference-manual/authentication/

type MeritDriverInput<F> = {
  type: 'merit_estonia' | 'merit_poland';
  config: Record<string, unknown>;
  secret: unknown;
  filters: F;
};

function toMeritDate(iso: string): string {
  return iso.replace(/-/g, '');
}

function defaultEndDate(): string {
  return toMeritDate(new Date().toISOString().slice(0, 10));
}

function meritTimestamp(): string {
  return new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
}

async function meritPost(
  baseUrl: string,
  path: string,
  apiId: string,
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const body      = JSON.stringify(payload);
  const timestamp = meritTimestamp();
  const signature = encodeURIComponent(
    crypto.createHmac('sha256', apiKey).update(apiId + timestamp + body).digest('base64'),
  );
  const url = `${baseUrl}/${path}?apiId=${encodeURIComponent(apiId)}&timestamp=${timestamp}&signature=${signature}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!res.ok) throw new ApiError(`Merit ${path} ${res.status}: ${await res.text().catch(() => res.statusText)}`, 502);
  return res.json();
}

type MeritRow = {
  No: number;
  Description: string;
  RowType: number;
  Balance: (number | null)[] | null;
};

// Flatten Merit report rows into a simple table:
//   No | Description | Period 1 | Period 2 | ...
// RowType 1 = section header (no balance), 2/3 = account, 4 = subtotal/formula.
function flattenMeritRows(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  if (d.ErrorMsg) throw new ApiError(`Merit error: ${d.ErrorMsg}`, 502);
  const raw = d.Data;
  if (!Array.isArray(raw)) return [];

  const rows = raw as MeritRow[];

  // Determine how many period columns exist (from first row that has Balance).
  const sample = rows.find((r) => Array.isArray(r.Balance));
  const periodCount = sample ? (sample.Balance?.length ?? 1) : 1;

  return rows.map((r) => {
    const out: Record<string, unknown> = {
      No:          r.No,
      Description: r.Description,
    };
    if (Array.isArray(r.Balance)) {
      r.Balance.forEach((val, i) => {
        out[`Period ${i + 1}`] = val ?? '';
      });
    } else {
      // Header row — leave period columns empty
      for (let i = 0; i < periodCount; i++) out[`Period ${i + 1}`] = '';
    }
    return out;
  });
}

export async function runMeritPnlDriver({ type, secret, filters }: MeritDriverInput<PnlFetchFiltersModel>): Promise<RawReport> {
  const { apiKey, apiId } = secret as MeritSecret;
  const baseUrl           = MERIT_BASE_URLS[type];

  const endDate  = filters.endDate ? toMeritDate(filters.endDate) : defaultEndDate();
  const perCount = filters.perCount ?? 1;

  const data = await meritPost(baseUrl, 'getprofitrep', apiId, apiKey, {
    EndDate: endDate,
    PerCount: perCount,
    DepFilter: filters.depFilter ?? '',
  });

  return {
    sheets: [{ name: 'pnl', rows: flattenMeritRows(data) }],
    fetchedAt: new Date().toISOString(),
  };
}

export async function runMeritFinancialPositionDriver({ type, secret, filters }: MeritDriverInput<FinancialPositionFetchFiltersModel>): Promise<RawReport> {
  const { apiKey, apiId } = secret as MeritSecret;
  const baseUrl           = MERIT_BASE_URLS[type];

  const endDate  = filters.endDate ? toMeritDate(filters.endDate) : defaultEndDate();
  const perCount = filters.perCount ?? 1;

  const data = await meritPost(baseUrl, 'getbalancerep', apiId, apiKey, { EndDate: endDate, PerCount: perCount });

  return {
    sheets: [{ name: 'financial_position', rows: flattenMeritRows(data) }],
    fetchedAt: new Date().toISOString(),
  };
}
