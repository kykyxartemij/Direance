/* eslint-disable local/use-fetch-client */
import 'server-only';
import crypto from 'crypto';
import type { RawReport } from './index';
import { MERIT_BASE_URLS, type MeritConfig, type MeritSecret, type PnlFetchFiltersModel, type FinancialPositionFetchFiltersModel } from '@/models/connection.models';
import { ApiError } from '@/models/api-error';

// ==== Merit.ee driver ====
// Two separate functions, not one switch on reportType — getbalancerep
// (Financial Position) and getprofitrep (P&L) are different endpoints with
// different payloads. Per the real API spec (PDF: Merit_Aktiva_API_specification,
// v1), the ONLY accepted fields are:
//   getprofitrep:  EndDate (Str), PerCount (Int), DepFilter (Str, optional)
//   getbalancerep: EndDate (Str), PerCount (Int) — no DepFilter
// DepFilter lives on MeritConfig (connection-level, P&L connections only) —
// see connection.models.ts. dateTo/dateFrom/periods are the universal fetch
// filters (see PnlFetchFiltersModel); this driver translates dateTo->EndDate
// and periods->PerCount directly, deriving periods from dateFrom when given.
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

// Calendar months covered by two ISO dates, both ends included.
function monthsBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to   = new Date(toIso);
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return Math.max(1, months + 1);
}

function resolvePeriod(filters: { dateTo?: string; dateFrom?: string; periods?: number }): { endDate: string; perCount: number } {
  const endDate = filters.dateTo ? toMeritDate(filters.dateTo) : defaultEndDate();
  const perCount = filters.periods ?? (filters.dateFrom && filters.dateTo ? monthsBetween(filters.dateFrom, filters.dateTo) : 1);
  return { endDate, perCount };
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
  Description: string;
  RowType: number;
  Balance: (number | null)[] | null;
};

// ==== Period column labels ====
// Merit quirk: responses carry no period dates, so labels are derived from EndDate and PerCount.

function monthStart(endDate: string, monthsBack: number): Date {
  return new Date(Date.UTC(Number(endDate.slice(0, 4)), Number(endDate.slice(4, 6)) - 1 - monthsBack, 1));
}

// Merit quirk: Balance[0] is EndDate itself, every later value is an earlier month's last day.
function balancePeriodLabels(endDate: string, perCount: number): string[] {
  return Array.from({ length: perCount }, (_, i) => {
    const start = monthStart(endDate, i);
    const day = i === 0 ? endDate.slice(6, 8) : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
    return `${day}.${String(start.getUTCMonth() + 1).padStart(2, '0')}.${start.getUTCFullYear()}`;
  });
}

function pnlPeriodLabels(endDate: string, perCount: number): string[] {
  return Array.from({ length: perCount }, (_, i) =>
    monthStart(endDate, i).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
  );
}

// Flatten Merit report rows into a simple table: Description | one column per label.
// RowType 1 = section header (no balance), 2/3 = account, 4 = subtotal/formula.
// Merit quirk: getprofitrep appends a total to Balance. Only labeled periods are kept.
function flattenMeritRows(data: unknown, periodLabels: string[]): Record<string, unknown>[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  if (d.ErrorMsg) throw new ApiError(`Merit error: ${d.ErrorMsg}`, 502);
  const raw = d.Data;
  if (!Array.isArray(raw)) return [];

  return (raw as MeritRow[]).map((r) => {
    const out: Record<string, unknown> = { Description: r.Description };
    periodLabels.forEach((label, i) => {
      out[label] = r.Balance?.[i] ?? '';
    });
    return out;
  });
}

export async function runMeritPnlDriver({ type, config, secret, filters }: MeritDriverInput<PnlFetchFiltersModel>): Promise<RawReport> {
  const { apiKey, apiId } = secret as MeritSecret;
  const { depFilter }     = config as MeritConfig;
  const baseUrl           = MERIT_BASE_URLS[type];
  const { endDate, perCount } = resolvePeriod(filters);

  const data = await meritPost(baseUrl, 'getprofitrep', apiId, apiKey, {
    EndDate: endDate,
    PerCount: perCount,
    DepFilter: depFilter ?? '',
  });

  return {
    sheets: [{ name: 'pnl', rows: flattenMeritRows(data, pnlPeriodLabels(endDate, perCount)) }],
    fetchedAt: new Date().toISOString(),
  };
}

export async function runMeritFinancialPositionDriver({ type, secret, filters }: MeritDriverInput<FinancialPositionFetchFiltersModel>): Promise<RawReport> {
  const { apiKey, apiId } = secret as MeritSecret;
  const baseUrl           = MERIT_BASE_URLS[type];
  const { endDate, perCount } = resolvePeriod(filters);

  const data = await meritPost(baseUrl, 'getbalancerep', apiId, apiKey, { EndDate: endDate, PerCount: perCount });

  return {
    sheets: [{ name: 'financial_position', rows: flattenMeritRows(data, balancePeriodLabels(endDate, perCount)) }],
    fetchedAt: new Date().toISOString(),
  };
}
