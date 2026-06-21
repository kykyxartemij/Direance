import 'server-only';
import { Prisma } from '../../../generated/prisma/client';

// ==== Types ====

type SimpleValue = string | number | boolean | Date | null | undefined;

type ComparisonOp = {
  lt?:  SimpleValue;
  lte?: SimpleValue;
  gt?:  SimpleValue;
  gte?: SimpleValue;
  not?: SimpleValue;
  in?:  SimpleValue[];
};

export type SimpleWhere<T = Record<string, unknown>> =
  { OR?: SimpleWhere<T>[]; AND?: SimpleWhere<T>[] } &
  { [K in keyof T]?: SimpleValue | ComparisonOp };

// ==== Where builder ====

export function buildWhere(where: SimpleWhere): Prisma.Sql {
  const parts: Prisma.Sql[] = [];

  for (const [key, val] of Object.entries(where)) {
    if (key === 'OR' && Array.isArray(val)) {
      const clauses = (val as SimpleWhere[]).map(buildWhere);
      parts.push(Prisma.sql`(${Prisma.join(clauses, ' OR ')})`);
      continue;
    }
    if (key === 'AND' && Array.isArray(val)) {
      const clauses = (val as SimpleWhere[]).map(buildWhere);
      parts.push(Prisma.sql`(${Prisma.join(clauses, ' AND ')})`);
      continue;
    }
    if (val === undefined) continue;

    const col = Prisma.raw(`"${key}"`);

    if (val !== null && typeof val === 'object' && !(val instanceof Date) && !Array.isArray(val)) {
      const op = val as ComparisonOp;
      if (op.lt  !== undefined) parts.push(Prisma.sql`${col} < ${op.lt}`);
      if (op.lte !== undefined) parts.push(Prisma.sql`${col} <= ${op.lte}`);
      if (op.gt  !== undefined) parts.push(Prisma.sql`${col} > ${op.gt}`);
      if (op.gte !== undefined) parts.push(Prisma.sql`${col} >= ${op.gte}`);
      if (op.not !== undefined) parts.push(
        op.not === null
          ? Prisma.sql`${col} IS NOT NULL`
          : Prisma.sql`${col} != ${op.not}`,
      );
      if (op.in !== undefined) parts.push(Prisma.sql`${col} = ANY(${op.in})`);
      continue;
    }

    parts.push(
      val === null
        ? Prisma.sql`${col} IS NULL`
        : Prisma.sql`${col} = ${val as SimpleValue}`,
    );
  }

  if (parts.length === 0) throw new Error('where cannot be empty');
  return Prisma.join(parts, ' AND ');
}

// ==== Select builder ====

export function buildReturning(select?: Record<string, boolean>): Prisma.Sql {
  if (!select) return Prisma.sql`*`;
  const cols = Object.entries(select).flatMap(([k, v]) => v ? [Prisma.raw(`"${k}"`)] : []);
  return cols.length > 0 ? Prisma.join(cols, ', ') : Prisma.sql`*`;
}
