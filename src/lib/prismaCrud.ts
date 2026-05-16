import 'server-only';
import { Prisma } from '../../generated/prisma/client';
import type { PrismaClient } from '../../generated/prisma/client';

// ==== Where builder ====
// Supports equality conditions and OR arrays — enough for any delete where clause.

type SimpleValue = string | number | boolean | null | undefined;
type SimpleWhere = { OR?: SimpleWhere[] } & Record<string, SimpleValue | SimpleWhere[]>;

function buildWhere(where: SimpleWhere): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  for (const [key, val] of Object.entries(where)) {
    if (key === 'OR' && Array.isArray(val)) {
      const clauses = (val as SimpleWhere[]).map(buildWhere);
      parts.push(Prisma.sql`(${Prisma.join(clauses, ' OR ')})`);
    } else if (val !== undefined) {
      parts.push(Prisma.sql`${Prisma.raw(`"${key}"`)} = ${val as SimpleValue}`);
    }
  }
  if (parts.length === 0) throw new Error('deleteManyAndReturn: where cannot be empty');
  return Prisma.join(parts, ' AND ');
}

// ==== Select builder ====

function buildReturning(select?: Record<string, boolean>): Prisma.Sql {
  if (!select) return Prisma.sql`*`;
  const cols = Object.entries(select)
    .filter(([, v]) => v)
    .map(([k]) => Prisma.raw(`"${k}"`));
  return cols.length > 0 ? Prisma.join(cols, ', ') : Prisma.sql`*`;
}

// ==== Factory ====

/**
 * Returns { deleteManyAndReturn } to register on a Prisma $extends model block.
 * Accepts Prisma-style where (equality + OR), select, and limit.
 * Return type is inferred from select — no manual generic at the call site.
 * Returns Prisma.PrismaPromise — usable in prisma.$transaction([...]).
 *
 * @param client  Base PrismaClient (same instance as the one being extended)
 * @param table   PostgreSQL table name, e.g. '"FieldMapping"'
 *
 * @example
 * // prisma.ts — register alongside withFts:
 * import type { FieldMappingModel } from '../../generated/prisma/models/FieldMapping';
 *
 * fieldMapping: {
 *   ...withFts(base, base.fieldMapping, '"FieldMapping"', 'mapping', 'name'),
 *   ...withDeleteReturning<FieldMappingModel>(base, '"FieldMapping"'),
 * }
 *
 * // service — return type inferred from select, no manual generic needed:
 * const deleted = await prisma.fieldMapping.deleteManyAndReturn({
 *   where: { id, userId },
 *   select: { isGlobal: true },  // → { isGlobal: boolean }[]
 * });
 */
export function withCrud<TModel extends object>(client: PrismaClient, table: string) {
  return {
    deleteManyAndReturn<
      TSelect extends Partial<Record<keyof TModel, boolean>> | undefined = undefined,
    >(args: {
      where: SimpleWhere;
      select?: TSelect;
      limit?: number;
    }): Prisma.PrismaPromise<
      (TSelect extends undefined
        ? TModel
        : Pick<TModel, Extract<keyof NonNullable<TSelect>, keyof TModel>>)[]
    > {
      const whereSql = buildWhere(args.where);
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
  };
}
