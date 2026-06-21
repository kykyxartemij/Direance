import 'server-only';
import { Prisma } from '../../generated/prisma/client';
import type { PrismaClient } from '../../generated/prisma/client';
import { buildWhere, buildReturning, type SimpleWhere } from './prisma/simpleWhere';
export type { SimpleWhere } from './prisma/simpleWhere';
export { buildWhere, buildReturning } from './prisma/simpleWhere';

// ==== Value → Prisma.Sql ====
// Maps a JS value to a parameterized SQL fragment with the correct Postgres type cast.
const toSql = (v: unknown): Prisma.Sql => {
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return Prisma.sql`${v}::bytea`;
  if (!Array.isArray(v)) return Prisma.sql`${v as Prisma.Sql}`;
  if (typeof v[0] === 'number')  return Prisma.sql`${v}::float8[]`;
  if (typeof v[0] === 'boolean') return Prisma.sql`${v}::bool[]`;
  if (typeof v[0] === 'bigint')  return Prisma.sql`${v}::int8[]`;
  if (v[0] instanceof Date)      return Prisma.sql`${v}::timestamp[]`;
  if (Buffer.isBuffer(v[0]) || v[0] instanceof Uint8Array) return Prisma.sql`${v}::bytea[]`;
  return Prisma.sql`${v}::text[]`;
};

// ==== Factory ====

/**
 * Returns { upsertAndReturn, deleteManyAndReturn } to register on a Prisma $extends model block.
 *
 * SimpleWhere supports: equality, null (IS NULL), comparison ops (lt/lte/gt/gte/not/in), OR, AND.
 * Return type is inferred from select — no manual generic at the call site.
 * Returns Prisma.PrismaPromise — usable in prisma.$transaction([...]).
 *
 * @param client  Base PrismaClient (same instance as the one being extended)
 * @param table   Quoted PostgreSQL table name, e.g. '"FieldMapping"'
 *
 * @example
 * fieldMapping: {
 *   ...withFts(base, base.fieldMapping, '"FieldMapping"', 'mapping', 'name'),
 *   ...withCrud<FieldMappingModel>(base, '"FieldMapping"'),
 * }
 *
 * const deleted = await prisma.fieldMapping.deleteManyAndReturn({
 *   where: { id, userId },
 *   select: { isGlobal: true },
 * });
 */
export function withCrud<TModel extends object>(client: PrismaClient, table: string) {
  return {
    deleteManyAndReturn<
      TSelect extends Partial<Record<keyof TModel, boolean>> | undefined = undefined,
    >(args: {
      where: SimpleWhere<TModel>;
      select?: TSelect;
      limit?: number;
    }): Prisma.PrismaPromise<
      (TSelect extends undefined
        ? TModel
        : Pick<TModel, Extract<keyof NonNullable<TSelect>, keyof TModel>>)[]
    > {
      const whereSql = buildWhere(args.where as SimpleWhere);
      const returningSql = buildReturning(args.select as Record<string, boolean> | undefined);
      const t = Prisma.raw(table);

      if (args.limit !== undefined) {
        const limit = args.limit;
        return client.$queryRaw`
          DELETE FROM ${t}
          WHERE id IN (SELECT id FROM ${t} WHERE ${whereSql} LIMIT ${limit})
          RETURNING ${returningSql}
        `;
      }

      return client.$queryRaw`
        DELETE FROM ${t} WHERE ${whereSql} RETURNING ${returningSql}
      `;
    },

    /**
     * INSERT ... ON CONFLICT DO UPDATE ... RETURNING — single roundtrip.
     * API mirrors Prisma's native upsert: where (conflict key), create, update, select.
     * Always includes `wasUpdated: boolean` in result (true = row existed, false = fresh insert).
     * Arrays are automatically cast to `text[]`.
     *
     * @example
     * const [row] = await prisma.invite.upsertAndReturn({
     *   where:  { email },
     *   create: { email, token, invitedBy, permissions },
     *   update: { token, invitedBy, permissions },
     *   select: { createdAt: true },
     * });
     * row.wasUpdated // boolean
     */
    upsertAndReturn<
      TSelect extends Partial<Record<keyof TModel, boolean>> | undefined = undefined,
    >(args: {
      where: Partial<TModel>;
      create: Partial<TModel>;
      update: Partial<TModel>;
      select?: TSelect;
    }): Prisma.PrismaPromise<
      ((TSelect extends undefined
        ? TModel
        : Pick<TModel, Extract<keyof NonNullable<TSelect>, keyof TModel>>) & { wasUpdated: boolean })[]
    > {
      const t = Prisma.raw(table);
      const insertCols = Prisma.join(Object.keys(args.create).map(k => Prisma.raw(`"${k}"`)));
      const insertVals = Prisma.join(Object.values(args.create).map(toSql));
      const conflictCols = Prisma.join(Object.keys(args.where).map(k => Prisma.raw(`"${k}"`)));
      const setSql = Prisma.join(
        Object.entries(args.update).map(([k, v]) => Prisma.sql`${Prisma.raw(`"${k}"`)} = ${toSql(v)}`),
      );
      const returningSql = buildReturning(args.select as Record<string, boolean> | undefined);

      return client.$queryRaw`
        INSERT INTO ${t} (${insertCols})
        VALUES (${insertVals})
        ON CONFLICT (${conflictCols}) DO UPDATE SET ${setSql}
        RETURNING ${returningSql}, (xmax::text::int > 0) AS "wasUpdated"
      `;
    },
  };
}
