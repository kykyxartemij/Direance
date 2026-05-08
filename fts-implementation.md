# FTS (Full-Text Search) Implementation Spec

## Overview

This document describes the implementation of PostgreSQL full-text search into the existing Prisma ORM setup. The goal is to add `findManyFts()` and `countFts()` methods to Prisma models — methods that behave exactly like `findMany()` and `count()` but accept an optional `freeText` parameter that triggers advanced FTS filtering when appropriate.

Two PostgreSQL mechanisms are combined to give maximum search quality:
- **tsvector + tsquery** — word matching with English stemming and prefix support
- **pg_trgm** — trigram similarity for typo tolerance and partial word matching

The raw SQL is isolated to a single file (`lib/fts.ts`). All other application code continues to use normal Prisma patterns.

---

## How the Two Layers Work Together

These are complementary, not competing. They run in a single query via `OR` — if either layer finds a match, the row is returned.

**tsvector layer** answers: "does this row contain these words (or stems of them)?"
```
name:            "Book about Snow White building a snowman"
tsvector stores: 'book' 'snow' 'white' 'build' 'snowman'  ← stemmed, stop words removed

user types "built snowman"
  "built" → stems to "build" → matches "building"  ✅
  "snowman" → exact match                           ✅
```

**pg_trgm layer** answers: "are these strings similar enough character-by-character?"
```
user types "snowmna"  (transposed letters)
  trigrams of "snowmna": {sno, now, owm, wmn, mna}
  trigrams of "snowman": {sno, now, owm, wma, man}
  overlap: 3/5 = 60% similar → above threshold     ✅
```

Together they cover:
- Wrong word order → tsvector ✅
- English stemming (build/building/builds) → tsvector ✅
- Prefix mid-typing ("buil" → "building") → tsvector with `:*` ✅
- Single/double char typos → pg_trgm ✅
- Partial word matches → pg_trgm ✅

---

## Prerequisites

### 1. Enable extensions — once per database

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

`pg_trgm` is built into PostgreSQL — no install needed, just enable it.

### 2. Add `search_vector` column + indexes to each table

Every table that uses FTS needs three things: a generated `tsvector` column, a GIN index on that column, and a GIN trigram index on the raw `name` column.

Example for `export_settings`:

```sql
-- Generated tsvector column, computed automatically on insert/update
ALTER TABLE export_settings
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(name, ''))) STORED;

-- GIN index on tsvector for fast word matching
CREATE INDEX idx_export_settings_search_vector
  ON export_settings USING GIN(search_vector);

-- GIN trigram index on raw name for typo tolerance
CREATE INDEX idx_export_settings_name_trgm
  ON export_settings USING GIN(name gin_trgm_ops);
```

Repeat for every table that needs FTS. The column being indexed (`name`) may differ per table — adjust accordingly.

**Why `'english'` dictionary:**
`'english'` applies stemming — "building", "builds", "built" all reduce to the same lexeme "build", so any variant matches. All users are English-speaking so this is correct.

**Storage cost for 10,000 rows with 200 char names:**
```
tsvector column + GIN index:  ~1 MB
pg_trgm GIN index:            ~5 MB
Total:                        ~6 MB  (~1.2% of Neon 512 MB free tier)
Network transfer cost:        zero — indexes are server-side only
```

---

## Files to Create

### `lib/fts.ts` — new file

This file owns all FTS logic. Nothing else in the codebase needs to touch raw SQL for search.

```typescript
import { Prisma, PrismaClient } from '@prisma/client';
import { unstable_cache } from 'next/cache';

const basePrisma = new PrismaClient();

const MIN_FREETEXT_LENGTH = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the input string if it is a valid UUID v4, otherwise null.
 * Used to short-circuit FTS entirely when the user pastes or types an exact ID.
 * In that case a direct Prisma where: { id } lookup is faster and more correct
 * than running FTS against it.
 */
export function tryParseUuid(value: string): string | null {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value.trim()) ? value.trim() : null;
}

/**
 * Builds a tsquery string from the user's input.
 * Every word gets the :* prefix operator which means "starts with" in PostgreSQL.
 * This enables prefix matching — user typing "buil" will match "building".
 * Words are joined with & (AND) — all words must appear in the row.
 *
 * Example:
 *   "snow white build" → "snow:* & white:* & build:*"
 */
function buildTsQuery(freeText: string): string {
  return freeText
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(word => `${word}:*`)
    .join(' & ');
}

/**
 * Executes the combined FTS + trigram query against the given table.
 *
 * Two layers run in a single query via OR:
 *
 * Layer 1 — tsvector + tsquery:
 *   Fast, index-backed word matching with English stemming and prefix support.
 *   Catches: correct words in any order, word variants, partial words mid-typing.
 *
 * Layer 2 — pg_trgm similarity:
 *   Trigram-based similarity against the raw name column.
 *   Catches: typos, transposed letters, partial matches that tsvector misses.
 *   Threshold 0.2 is intentionally slightly loose for long 200+ char names —
 *   a user only needs a few matching trigrams to surface the right row.
 *   Tune this value up (stricter) or down (looser) based on real usage.
 *
 * Results are ordered by tsvector rank descending — exact word matches
 * appear before trigram-only matches.
 *
 * Requires:
 *   - search_vector tsvector column with GIN index on the table
 *   - GIN trigram index on the name column (gin_trgm_ops)
 *   - pg_trgm extension enabled
 */
async function resolveFtsIds(table: string, freeText: string): Promise<string[]> {
  const tsQuery = buildTsQuery(freeText);

  const rows = await basePrisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT id,
      ts_rank(search_vector, to_tsquery('english', ${tsQuery})) AS rank
    FROM ${Prisma.raw(table)}
    WHERE
      search_vector @@ to_tsquery('english', ${tsQuery})
      OR similarity(name, ${freeText}) > 0.2
    ORDER BY rank DESC
  `;

  return rows.map(r => r.id);
}

/**
 * Cached wrapper around resolveFtsIds.
 *
 * Cache key is scoped to [table, freeText] so each unique search term gets
 * its own cache entry. TTL is 60 seconds — fresh enough for search results,
 * long enough to absorb repeated identical queries.
 *
 * Cache tag matches the collection-level key from CACHE_KEYS (e.g. 'exportSetting').
 * This means any CRUD mutation that calls:
 *   invalidateCache(...CACHE_KEYS.exportSetting.invalidate())
 * automatically wipes ALL FTS cache entries for that table.
 * No extra invalidation work is required in route handlers.
 */
async function resolveFtsIdsCached(
  table: string,
  collectionCacheKey: string,
  freeText: string
): Promise<string[]> {
  return unstable_cache(
    () => resolveFtsIds(table, freeText),
    ['fts', collectionCacheKey, freeText],
    {
      revalidate: 60,
      tags: [collectionCacheKey],
    }
  )();
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Wraps a Prisma model delegate with two additional methods:
 *   findManyFts({ freeText?, ...findManyArgs })
 *   countFts({ freeText?, where? })
 *
 * Both methods are safe to call with an empty or undefined freeText —
 * they fall back to standard Prisma findMany/count with zero overhead.
 *
 * @param model              Prisma model delegate (e.g. basePrisma.exportSetting)
 * @param table              PostgreSQL table name (e.g. 'export_settings')
 * @param collectionCacheKey Top-level key from CACHE_KEYS (e.g. 'exportSetting')
 *                           Must match CACHE_KEYS.x.invalidate()[0] exactly —
 *                           this is what connects FTS cache to CRUD invalidation.
 */
export function withFts<
  TModel extends {
    findMany: (args?: any) => Promise<any[]>;
    count: (args?: any) => Promise<number>;
  }
>(model: TModel, table: string, collectionCacheKey: string) {
  return {
    ...model,

    /**
     * Drop-in replacement for findMany() with optional freeText parameter.
     *
     * Decision tree:
     *
     *   1. freeText empty, whitespace only, or shorter than MIN_FREETEXT_LENGTH
     *      → plain findMany(args), zero extra DB calls
     *
     *   2. freeText is a valid UUID
     *      → findMany({ ...args, where: { ...args.where, id: uuid } })
     *      → zero extra DB calls, exact lookup
     *
     *   3. freeText is a real search term
     *      → resolveFtsIdsCached() — FTS + trigram query, result cached 60s
     *      → if no IDs found, return [] immediately, skip second DB call
     *      → findMany({ ...args, where: { ...args.where, id: { in: ids } } })
     *
     * All existing args (select, orderBy, skip, take, where) pass through
     * untouched. The FTS result is injected into where as id: { in: ids },
     * which combines cleanly with any existing where conditions including
     * checkbox filters, user scoping, and any other Prisma where clauses.
     */
    async findManyFts<T extends Parameters<TModel['findMany']>[0]>({
      freeText,
      ...args
    }: T & { freeText?: string }): Promise<Awaited<ReturnType<TModel['findMany']>>> {

      // Guard 1 — empty or too short, plain findMany
      if (!freeText?.trim() || freeText.trim().length < MIN_FREETEXT_LENGTH) {
        return model.findMany(args);
      }

      // Guard 2 — valid UUID, exact lookup
      const uuid = tryParseUuid(freeText);
      if (uuid) {
        return model.findMany({
          ...args,
          where: { ...args.where, id: uuid },
        });
      }

      // FTS + trigram path
      const ids = await resolveFtsIdsCached(table, collectionCacheKey, freeText.trim());

      if (ids.length === 0) return [];

      return model.findMany({
        ...args,
        where: { ...args.where, id: { in: ids } },
      });
    },

    /**
     * Drop-in replacement for count() with optional freeText parameter.
     * Follows identical decision tree as findManyFts().
     * Must always be used alongside findManyFts() — using plain count() when
     * freeText is present will return wrong totals and break pagination.
     */
    async countFts({
      freeText,
      where,
    }: {
      freeText?: string;
      where?: Parameters<TModel['count']>[0]['where'];
    }): Promise<number> {

      // Guard 1 — empty or too short
      if (!freeText?.trim() || freeText.trim().length < MIN_FREETEXT_LENGTH) {
        return model.count({ where });
      }

      // Guard 2 — valid UUID
      const uuid = tryParseUuid(freeText);
      if (uuid) {
        return model.count({ where: { ...where, id: uuid } });
      }

      // FTS + trigram path — reuses same cached IDs as findManyFts
      const ids = await resolveFtsIdsCached(table, collectionCacheKey, freeText.trim());

      if (ids.length === 0) return 0;

      return model.count({
        where: { ...where, id: { in: ids } },
      });
    },
  };
}
```

---

## Files to Update

### `lib/prisma.ts`

Import `withFts` and register every model that needs FTS. The third argument (`collectionCacheKey`) must exactly match the first element returned by `CACHE_KEYS.x.invalidate()` for that model. Getting this wrong means FTS cache will not invalidate on CRUD mutations.

```typescript
import { PrismaClient } from '@prisma/client';
import { withFts } from './fts';

const basePrisma = new PrismaClient();

export const prisma = basePrisma.$extends({
  model: {
    exportSetting: withFts(basePrisma.exportSetting, 'export_settings', 'exportSetting'),
    // Add further models here as needed — one line per model:
    // mapping: withFts(basePrisma.mapping, 'mappings', 'mapping'),
    // logo:    withFts(basePrisma.logo,    'logos',    'logo'),
  },
});
```

Only register models whose tables have the `search_vector` column and both GIN indexes. Registering a model without them will cause a runtime error when FTS is triggered.

---

## Usage in Route Handlers

Replace `findMany` with `findManyFts` and `count` with `countFts`. Pass `freeText` from the request search params. Both methods are safe to call with an empty string — they fall back to normal Prisma automatically.

Always pass `freeText` into the cache key functions so each unique search term gets its own cache entry:

```typescript
const freeText = new URL(req.url).searchParams.get('q') ?? '';

const [data, total] = await Promise.all([
  cached(
    () =>
      prisma.exportSetting.findManyFts({
        freeText,
        where,
        select: EXPORT_SETTING_SELECT_PAGED,
        orderBy: { name: 'asc' },
        skip: page * pageSize,
        take: pageSize,
      }),
    CACHE_KEYS.exportSetting.paged(userId, page, pageSize, freeText)
  ),
  cached(
    () => prisma.exportSetting.countFts({ freeText, where }),
    CACHE_KEYS.exportSetting.count(userId, freeText)
  ),
]);
```

---

## Cache Invalidation

No changes required to existing CRUD invalidation. The FTS cache shares the same collection tag as the rest of the model cache. Any existing mutation that calls `invalidateCache(...CACHE_KEYS.x.invalidate())` automatically wipes all FTS cache for that table.

```typescript
// Existing CRUD handler — no changes needed
invalidateCache(
  ...CACHE_KEYS.exportSetting.invalidate(),  // wipes FTS cache too ✅
  ...CACHE_KEYS.exportSetting.byId(id),
);
```

---

## Decision Flow

```
findManyFts({ freeText, ...args }) called
        ↓
freeText empty / whitespace / length < 3?
  YES → findMany(args)                           0 extra DB calls
        ↓
freeText is valid UUID?
  YES → findMany({ where: { ...where, id } })    0 extra DB calls
        ↓
resolveFtsIdsCached(table, key, freeText)        1 DB call (cached 60s)
  Layer 1 — tsvector: word match + stemming + prefix :*
  Layer 2 — pg_trgm:  typo tolerance + partial match
  Both run in single query via OR
        ↓
ids.length === 0?
  YES → return []                                0 extra DB calls
        ↓
findMany({ where: { ...where, id: { in: ids } } })
  All original filters (userId, status, etc) still apply ✅
```

---

## Checklist for Adding FTS to a New Model

- [ ] Run `CREATE EXTENSION IF NOT EXISTS pg_trgm` if not already done (once per database)
- [ ] Add `search_vector` generated column via Prisma migration
- [ ] Add GIN index on `search_vector`
- [ ] Add GIN trigram index on `name` column using `gin_trgm_ops`
- [ ] Register model in `prisma.$extends` in `lib/prisma.ts` with correct table name and cache key
- [ ] Replace `findMany` → `findManyFts` in route handler
- [ ] Replace `count` → `countFts` in route handler
- [ ] Pass `freeText` into `CACHE_KEYS.x.paged()` and `.count()` cache keys
- [ ] Verify `invalidateCache(...CACHE_KEYS.x.invalidate())` exists in all CRUD mutations for that model
