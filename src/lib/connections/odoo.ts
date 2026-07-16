/* eslint-disable local/use-fetch-client */
import 'server-only';
import type { RawReport } from './index';
import type { OdooConfig, OdooSecret, PnlFetchFiltersModel, FinancialPositionFetchFiltersModel } from '@/models/connection.models';
import { ApiError } from '@/models/api-error';

// ==== Odoo driver ====
// JSON-RPC over POST {url}/jsonrpc. Two calls:
//   1. authenticate → uid
//   2. execute_kw(db, uid, password, 'account.move.line', 'search_read', [domain], { fields, limit })
//
// Two separate functions (P&L / Financial Position), mirroring the Merit
// driver split, even though the query logic is currently identical — keeps
// the two report types independently changeable as Odoo support grows
// (e.g. Financial Position will eventually need a real balance-sheet query,
// not the same account.move.line pull as P&L).
//
// dateTo/dateFrom/periods are the universal fetch filters (see
// PnlFetchFiltersModel) — Odoo maps dateFrom/dateTo straight to the domain
// (exact, no approximation) and derives dateFrom from periods when given.
// journalIds/accountPrefix are connection-level knobs (OdooConfig), not
// fetch filters — set once per connection.

function monthsAgo(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

type OdooDriverInput<F> = {
  config: Record<string, unknown>;
  secret: unknown;
  filters: F;
};

const FIELDS = ['date', 'account_id', 'name', 'debit', 'credit', 'balance', 'journal_id', 'partner_id'];

async function rpc(url: string, service: string, method: string, args: unknown[]): Promise<unknown> {
  const res = await fetch(`${url.replace(/\/$/, '')}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method:  'call',
      params:  { service, method, args },
      id:      Math.floor(Math.random() * 1_000_000),
    }),
  });
  if (!res.ok) throw new ApiError(`Odoo RPC ${res.status}: ${await res.text().catch(() => res.statusText)}`, 502);
  const data = await res.json();
  if (data?.error) throw new ApiError(`Odoo error: ${data.error.message ?? 'unknown'}`, 502);
  return data.result;
}

async function authenticate(config: Record<string, unknown>, secret: unknown): Promise<{ url: string; db: string; uid: number; password: string }> {
  const { url, db, username } = config as unknown as OdooConfig;
  const { password } = secret as OdooSecret;

  const uid = await rpc(url, 'common', 'authenticate', [db, username, password, {}]);
  if (!uid || typeof uid !== 'number') throw new ApiError('Odoo authentication failed', 401);

  return { url, db, uid, password };
}

// Auth-only, no data pulled — used by testConnectionDriver (src/lib/connections/index.ts)
// to validate credentials before a connection is ever saved.
export async function testOdooConnection(config: Record<string, unknown>, secret: unknown): Promise<void> {
  await authenticate(config, secret);
}

async function fetchAccountMoveLines(
  config: Record<string, unknown>,
  secret: unknown,
  filters: { dateTo?: string; dateFrom?: string; periods?: number },
): Promise<Record<string, unknown>[]> {
  const { url, db, uid, password } = await authenticate(config, secret);
  const { journalIds, accountPrefix } = config as OdooConfig;

  const dateFrom = filters.dateFrom ?? (filters.periods && filters.dateTo ? monthsAgo(filters.dateTo, filters.periods) : undefined);

  const domain: unknown[] = [];
  if (dateFrom)                    domain.push(['date', '>=', dateFrom]);
  if (filters.dateTo)              domain.push(['date', '<=', filters.dateTo]);
  if (journalIds?.length)          domain.push(['journal_id', 'in', journalIds]);
  if (accountPrefix)               domain.push(['account_id.code', '=like', `${accountPrefix}%`]);

  const rows = await rpc(url, 'object', 'execute_kw', [
    db, uid, password,
    'account.move.line', 'search_read',
    [domain],
    { fields: FIELDS, limit: 10_000 },
  ]) as Record<string, unknown>[];

  return Array.isArray(rows) ? rows : [];
}

export async function runOdooPnlDriver({ config, secret, filters }: OdooDriverInput<PnlFetchFiltersModel>): Promise<RawReport> {
  const rows = await fetchAccountMoveLines(config, secret, filters);
  return {
    sheets: [{ name: 'pnl', rows }],
    fetchedAt: new Date().toISOString(),
  };
}

export async function runOdooFinancialPositionDriver({ config, secret, filters }: OdooDriverInput<FinancialPositionFetchFiltersModel>): Promise<RawReport> {
  const rows = await fetchAccountMoveLines(config, secret, filters);
  return {
    sheets: [{ name: 'financial_position', rows }],
    fetchedAt: new Date().toISOString(),
  };
}
