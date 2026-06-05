/* eslint-disable local/use-fetch-client */
import 'server-only';
import type { DriverInput, RawReport } from './index';
import type { OdooConfig, OdooSecret } from '@/models/connection.models';
import { ApiError } from '@/models/api-error';

// ==== Odoo driver ====
// JSON-RPC over POST {url}/jsonrpc. Two calls:
//   1. authenticate → uid
//   2. execute_kw(db, uid, password, 'account.move.line', 'search_read', [domain], { fields, limit })
//
// First pass: pulls account.move.line for a date range. Mapping turns the
// flat list into the row shape downstream code expects.

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

export async function runOdooDriver({ config, secret, filters }: DriverInput): Promise<RawReport> {
  const { url, db, username } = config as unknown as OdooConfig;
  const { password } = secret as OdooSecret;

  const uid = await rpc(url, 'common', 'authenticate', [db, username, password, {}]);
  if (!uid || typeof uid !== 'number') throw new ApiError('Odoo authentication failed', 401);

  const extras = (filters.extras ?? {}) as { journalIds?: number[]; accountPrefix?: string };

  const domain: unknown[] = [];
  if (filters.dateFrom)            domain.push(['date', '>=', filters.dateFrom]);
  if (filters.dateTo)              domain.push(['date', '<=', filters.dateTo]);
  if (extras.journalIds?.length)   domain.push(['journal_id', 'in', extras.journalIds]);
  if (extras.accountPrefix)        domain.push(['account_id.code', '=like', `${extras.accountPrefix}%`]);

  const rows = await rpc(url, 'object', 'execute_kw', [
    db, uid, password,
    'account.move.line', 'search_read',
    [domain],
    { fields: FIELDS, limit: 10_000 },
  ]) as Record<string, unknown>[];

  return {
    sheets: [{ name: filters.reportType ?? 'gl', rows: Array.isArray(rows) ? rows : [] }],
    fetchedAt: new Date().toISOString(),
  };
}
