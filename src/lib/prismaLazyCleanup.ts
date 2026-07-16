import 'server-only';
import { Prisma } from '../../generated/prisma/client';
import type { PrismaClient } from '../../generated/prisma/client';
import { buildWhere, buildReturning, type SimpleWhere } from './prisma/simpleWhere';
import { ApiError } from '@/models/api-error';

// ==== Cron registry ====

type CronEntry = { table: string; fn: () => Promise<number> };
const cronRegistry: CronEntry[] = [];

export function runAllCleanups(): Promise<{ table: string; deleted: number }[]> {
  return Promise.all(
    cronRegistry.map(async entry => ({ table: entry.table, deleted: await entry.fn() })),
  );
}

// ==== Config + factory ====

type LazyCleanupConfig = {
  ttl: { field: string; days: number };
  limit?: number; // 0 or omit = no limit. assertLimit() throws 429 when count >= limit
  limitExceededMessage?: string;
};

/** Registers { cleanupExpired, assertLimit, findFirstWithCleanup, findManyWithCleanup } on a Prisma $extends model block. */
export function withLazyCleanup<TModel extends object>(
  client: PrismaClient,
  table: string,
  config: LazyCleanupConfig,
) {
  const t = Prisma.raw(table);

  const expiredWhere = (): SimpleWhere => ({
    [config.ttl.field]: { lt: new Date(Date.now() - config.ttl.days * 86_400_000) },
  });

  // RETURNING-based count: COUNT(*) on the table snapshot gives wrong result after DELETE.
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

    async assertLimit(where?: SimpleWhere<TModel>): Promise<void> {
      if (!config.limit) return;
      const expired  = buildWhere(expiredWhere());
      const scopeSql = where ? Prisma.sql` AND ${buildWhere(where as SimpleWhere)}` : Prisma.sql``;
      const [row] = await client.$queryRaw<[{ count: bigint }]>`
        WITH
          _cleanup   AS (DELETE FROM ${t} WHERE ${expired}),
          _remaining AS (SELECT COUNT(*)::int AS count FROM ${t} WHERE NOT (${expired}) ${scopeSql})
        SELECT count FROM _remaining
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
      where:   SimpleWhere<TModel>;
      select?: TSelect;
    }): Promise<
      (TSelect extends undefined
        ? TModel
        : Pick<TModel, Extract<keyof NonNullable<TSelect>, keyof TModel>>) | null
    > {
      const expired   = buildWhere(expiredWhere());
      const findSql   = buildWhere(args.where as SimpleWhere);
      const selectSql = buildReturning(args.select as Record<string, boolean> | undefined);

      // NOT (expired): CTE executes on a pre-DELETE snapshot — deleted rows remain visible without this guard.
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
      where:    SimpleWhere<TModel>;
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
      const findSql   = buildWhere(args.where as SimpleWhere);
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
