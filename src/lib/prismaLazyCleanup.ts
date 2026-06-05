import 'server-only';
import { Prisma } from '../../generated/prisma/client';
import type { PrismaClient } from '../../generated/prisma/client';
import { buildWhere, buildReturning, type SimpleWhere } from './prismaCrud';
import { ApiError } from '@/models/api-error';

// ==== Cron registry ====
// withLazyCleanup pushes to this array on registration.
// The Vercel Cron route imports runAllCleanups() and prisma (which triggers registration).

type CronEntry = { table: string; fn: () => Promise<number> };
const cronRegistry: CronEntry[] = [];

export function runAllCleanups(): Promise<{ table: string; deleted: number }[]> {
  return Promise.all(
    cronRegistry.map(async entry => ({ table: entry.table, deleted: await entry.fn() })),
  );
}

// ==== Config ====

type LazyCleanupConfig = {
  /** TTL: which field to check + how long in milliseconds before a record is considered expired. */
  ttl: { field: string; ms: number };
  /** Optional max total active records. assertLimit() throws 429 if exceeded after cleanup. */
  limit?: number;
  /** Message for the 429 error thrown by assertLimit(). */
  limitExceededMessage?: string;
};

// ==== Factory ====

/**
 * Returns { findFirstWithCleanup, findManyWithCleanup, cleanupExpired, assertLimit }
 * to register on a Prisma $extends model block.
 *
 * TTL and limit are configured once at registration — not repeated at call sites.
 * Also registers a cleanup function in the cron registry (see runAllCleanups).
 *
 * findFirstWithCleanup / findManyWithCleanup:
 *   Single CTE statement — delete expired rows AND select valid ones in one DB call.
 *   Expired rows are excluded from results automatically via NOT (expiredWhere).
 *
 * assertLimit:
 *   Cleans up expired records, then counts remaining, throws 429 if >= limit.
 *   Call before insert/upsert to enforce a soft cap.
 *
 * cleanupExpired:
 *   Standalone delete of expired records. Returns count deleted.
 *   Available for manual use; also called by assertLimit and the cron registry.
 *
 * where and cleanup conditions use SimpleWhere (equality, null, lt/lte/gt/gte/not/in, OR, AND) —
 * same operator names as Prisma's native WHERE.
 * Caching is intentionally omitted — handle it at the service layer.
 *
 * @param client  Base PrismaClient (same instance as the one being extended)
 * @param table   Quoted PostgreSQL table name, e.g. '"Invite"'
 * @param config  TTL config + optional limit
 *
 * @example
 * // prisma.ts — register alongside withCrud:
 * invite: {
 *   ...withCrud<InviteModel>(base, '"Invite"'),
 *   ...withLazyCleanup<InviteModel>(base, '"Invite"', {
 *     ttl:                  { field: 'createdAt', ms: 14 * 24 * 60 * 60 * 1000 },
 *     limit:                50,
 *     limitExceededMessage: 'Too many invites sent. Please try again later.',
 *   }),
 * }
 *
 * // service — no manual cleanup or count needed:
 * await prisma.invite.assertLimit();
 * const invite = await prisma.invite.findFirstWithCleanup({
 *   where:  { token },
 *   select: { id: true, email: true, permissions: true },
 * });
 */
export function withLazyCleanup<TModel extends object>(
  client: PrismaClient,
  table: string,
  config: LazyCleanupConfig,
) {
  const t = Prisma.raw(table);

  const expiredWhere = (): SimpleWhere => ({
    [config.ttl.field]: { lt: new Date(Date.now() - config.ttl.ms) },
  });

  // CTE that counts deleted rows — one statement, correct count (reads from RETURNING, not table snapshot)
  async function cleanupExpired(): Promise<number> {
    const [row] = await client.$queryRaw<[{ count: bigint }]>`
      WITH deleted AS (DELETE FROM ${t} WHERE ${buildWhere(expiredWhere())} RETURNING 1)
      SELECT COUNT(*)::int AS count FROM deleted
    `;
    return Number(row?.count ?? 0);
  }

  cronRegistry.push({ table, fn: cleanupExpired });

  return {
    cleanupExpired,

    async assertLimit(): Promise<void> {
      if (config.limit === undefined) return;
      await cleanupExpired();
      const [row] = await client.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::int AS count FROM ${t}
      `;
      if (Number(row?.count ?? 0) >= config.limit) {
        throw new ApiError(
          config.limitExceededMessage ?? 'Record limit exceeded. Please try again later.',
          429,
          'LIMIT_EXCEEDED',
        );
      }
    },

    findFirstWithCleanup<
      TSelect extends Partial<Record<keyof TModel, boolean>> | undefined = undefined,
    >(args: {
      where:   SimpleWhere;
      select?: TSelect;
    }): Prisma.PrismaPromise<
      (TSelect extends undefined
        ? TModel
        : Pick<TModel, Extract<keyof NonNullable<TSelect>, keyof TModel>>) | null
    > {
      const expired   = buildWhere(expiredWhere());
      const findSql   = buildWhere(args.where);
      const selectSql = buildReturning(args.select as Record<string, boolean> | undefined);

      return client.$queryRaw<any[]>`
        WITH _cleanup AS (DELETE FROM ${t} WHERE ${expired})
        SELECT ${selectSql} FROM ${t}
        WHERE ${findSql} AND NOT (${expired})
        LIMIT 1
      `.then((rows: any[]) => rows[0] ?? null) as any;
    },

    findManyWithCleanup<
      TSelect extends Partial<Record<keyof TModel, boolean>> | undefined = undefined,
    >(args: {
      where:    SimpleWhere;
      select?:  TSelect;
      orderBy?: { field: string; direction?: 'asc' | 'desc' };
      take?:    number;
      skip?:    number;
    }): Prisma.PrismaPromise<
      (TSelect extends undefined
        ? TModel
        : Pick<TModel, Extract<keyof NonNullable<TSelect>, keyof TModel>>)[]
    > {
      const expired   = buildWhere(expiredWhere());
      const findSql   = buildWhere(args.where);
      const selectSql = buildReturning(args.select as Record<string, boolean> | undefined);
      const orderSql  = args.orderBy
        ? Prisma.sql`ORDER BY ${Prisma.raw(`"${args.orderBy.field}"`)} ${Prisma.raw(args.orderBy.direction === 'desc' ? 'DESC' : 'ASC')}`
        : Prisma.sql``;
      const limitSql  = args.take !== undefined ? Prisma.sql`LIMIT ${args.take}`  : Prisma.sql``;
      const offsetSql = args.skip !== undefined ? Prisma.sql`OFFSET ${args.skip}` : Prisma.sql``;

      return client.$queryRaw`
        WITH _cleanup AS (DELETE FROM ${t} WHERE ${expired})
        SELECT ${selectSql} FROM ${t}
        WHERE ${findSql} AND NOT (${expired})
        ${orderSql} ${limitSql} ${offsetSql}
      ` as any;
    },
  };
}
