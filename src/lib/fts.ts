import 'server-only';
import { Prisma } from '../../generated/prisma/client';
import type { PrismaClient } from '../../generated/prisma/client';
import { unstable_cache } from 'next/cache';
import { tryParseUuid } from '@/models';

const FTS_CACHE_TTL = 300; // 5 min — keeps results warm for a user's session
const MIN_FTS_LENGTH = 5;

// ==== Helpers ====

/**
 * Combined FTS + trigram query in a single SQL statement.
 *
 * Layer 1 — tsvector + plainto_tsquery: stemming, word order agnostic, phrase-aware.
 * Layer 2 — pg_trgm similarity > 0.2: typo tolerance, partial matches.
 * Results ranked by tsvector rank so exact word matches surface first.
 *
 * Requires per-table: search_vector GIN index + searchColumn gin_trgm_ops index.
 */
async function resolveFtsIds(
  client: PrismaClient,
  table: string,
  searchColumn: string,
  freeText: string,
): Promise<string[]> {
  const rows = await client.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT id,
      ts_rank(search_vector, plainto_tsquery('english', ${freeText})) AS rank
    FROM ${Prisma.raw(table)}
    WHERE
      search_vector @@ plainto_tsquery('english', ${freeText})
      OR similarity(${Prisma.raw(searchColumn)}, ${freeText}) > 0.2
    ORDER BY rank DESC
  `;
  return rows.map((r) => r.id);
}

/**
 * Caches resolveFtsIds for FTS_CACHE_TTL seconds, tagged with collectionCacheKey.
 * Cache key is scoped per user when userId is provided — keeps each user's session
 * results warm without eviction from other users' unrelated searches.
 * CRUD mutations that call invalidateCache(...CACHE_KEYS.x.invalidate())
 * automatically bust this cache — no extra invalidation needed.
 */
async function resolveFtsIdsCached(
  client: PrismaClient,
  table: string,
  searchColumn: string,
  collectionCacheKey: string,
  freeText: string,
  userId?: string,
): Promise<string[]> {
  const cacheKey = userId
    ? ['fts', collectionCacheKey, userId, freeText]
    : ['fts', collectionCacheKey, freeText];

  const tags = userId ? [collectionCacheKey, userId] : [collectionCacheKey];

  return unstable_cache(
    () => resolveFtsIds(client, table, searchColumn, freeText),
    cacheKey,
    { revalidate: FTS_CACHE_TTL, tags },
  )();
}

// ==== Factory ====

/**
 * Returns { findManyFts, countFts } to register on a Prisma $extends model block.
 *
 * @param client             Base PrismaClient (same instance as the one being extended)
 * @param model              Base model delegate, e.g. base.exportSetting
 * @param table              PostgreSQL table name, e.g. '"ExportSetting"'
 * @param collectionCacheKey First element of CACHE_KEYS.x.invalidate(), e.g. 'exportSetting'
 * @param searchColumn       Column used for contains and pg_trgm similarity, e.g. 'name'.
 *                           Must match the column indexed with gin_trgm_ops in the migration.
 *
 * Decision tree (same for both methods):
 *   empty                   → no filter, return all               0 extra DB calls
 *   1–4 chars               → contains (ILIKE), substring match   0 extra DB calls
 *   valid UUID              → exact id filter                      0 extra DB calls
 *   5+ chars                → FTS + trigram (cached 5 min)        1 extra DB call
 */
export function withFts<
  TModel extends {
    findMany: (args?: any) => Promise<any[]>;
    count: (args?: any) => Promise<number>;
  },
>(
  client: PrismaClient,
  model: TModel,
  table: string,
  collectionCacheKey: string,
  searchColumn = 'name',
) {
  return {
    async findManyFts<T extends Parameters<TModel['findMany']>[0]>({
      freeText,
      userId,
      ...args
    }: T & { freeText?: string; userId?: string }): Promise<Awaited<ReturnType<TModel['findMany']>>> {
      const term = freeText?.trim() ?? '';

      if (!term) {
        return model.findMany(args) as Awaited<ReturnType<TModel['findMany']>>;
      }

      if (term.length < MIN_FTS_LENGTH) {
        return model.findMany({
          ...args,
          where: { ...(args as any).where, [searchColumn]: { contains: term, mode: 'insensitive' } },
        }) as Awaited<ReturnType<TModel['findMany']>>;
      }

      const uuid = tryParseUuid(term);
      if (uuid) {
        return model.findMany({ ...args, where: { ...(args as any).where, id: uuid } }) as Awaited<ReturnType<TModel['findMany']>>;
      }

      const idsByFreeText = await resolveFtsIdsCached(client, table, searchColumn, collectionCacheKey, term, userId);
      if (idsByFreeText.length === 0) return [] as Awaited<ReturnType<TModel['findMany']>>;
      return model.findMany({ ...args, where: { ...(args as any).where, id: { in: idsByFreeText } } }) as Awaited<ReturnType<TModel['findMany']>>;
    },

    async countFts({
      freeText,
      userId,
      where,
    }: {
      freeText?: string;
      userId?: string;
      where?: Parameters<TModel['count']>[0]['where'];
    }): Promise<number> {
      const term = freeText?.trim() ?? '';

      if (!term) {
        return model.count({ where });
      }

      if (term.length < MIN_FTS_LENGTH) {
        return model.count({
          where: { ...where, [searchColumn]: { contains: term, mode: 'insensitive' } },
        });
      }

      const uuid = tryParseUuid(term);
      if (uuid) {
        return model.count({ where: { ...where, id: uuid } });
      }

      const idsByFreeText = await resolveFtsIdsCached(client, table, searchColumn, collectionCacheKey, term, userId);
      if (idsByFreeText.length === 0) return 0;
      return model.count({ where: { ...where, id: { in: idsByFreeText } } });
    },
  };
}
