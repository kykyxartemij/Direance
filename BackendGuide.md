# Backend Guide

Read alongside `UncontrolledInputsGuide.md` and `ImageBytesGuide.md`.

## Quick reference

| Pattern | Rule |
|---------|------|
| Prisma client | Import from `@/lib/prisma` — never `new PrismaClient()` |
| Auth | `requireAuth` / `requireAuth` / `requirePermission` — pick right one |
| Route file | Thin adapter only — all logic in service |
| Error handling | Always `try/catch` → `handleApiError(error, context)` |
| ID from route | `parseIdFromRoute(await params)` — never raw `params.id` |
| Yup validation | Always `{ abortEarly: false }` |
| Prisma reads | Always wrap in `cached()` — never call bare |
| Cache keys | Always `CACHE_KEYS.*` — never raw string arrays |
| Update/Delete | `updateManyAndReturn` / `deleteMany` — ownership in WHERE clause |
| ID lookup | `findFirstOrThrow` — auto-throws P2025 → 404 |
| Pagination | `Promise.all([data, count])` — never sequential awaits |
| Select | Always explicit `select` — never bare `findMany` |
| File upload | FormData + sharp — see `ImageBytesGuide.md` |

---

## Auth helpers

```ts
// Read endpoint — userId only
const userId = await requireAuth;

// Mutating endpoint — userId + permissions
const { userId, permissions } = await requireAuth();
checkUserRequestLimit(req, userId, permissions);
await checkUserDbLimits(userId, permissions);

// Permission-gated endpoint (admin pages)
const userId = await requirePermission(Permission.IS_ADMIN);
```

> Permissions embedded in JWT at sign-in — no DB call on subsequent requests.  
> Auth.js v5 caches `auth()` per request — calling `requireAuth` and `requireAuth` in the same handler is one JWT decode.  
> Permission changes take effect on next sign-in.

---

## Route structure

```ts
// route.ts — binding only
export async function GET(req: NextRequest) {
  return getPagedMappings(req); // all logic in service
}

// service.ts — owns everything
export async function getPagedMappings(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = await requireAuth;
    // ... validate, DB, cache
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'GET /api/mapping/paged');
  }
}
```

---

## Error handling

`handleApiError` maps automatically:

| Thrown | Status |
|--------|--------|
| `ApiError(msg, status)` | `.status` |
| Yup `ValidationError` | 400 + `details.fieldErrors` |
| Prisma P2025 / P2003 | 404 |
| Prisma P2002 | 409 |
| Axios error | Proxied |
| Unknown | 500 |

```ts
throw new ApiError('Mapping not found', 404);
throw new ApiError('Limit reached: max 20 mappings', 403);
```

---

## parseIdFromRoute

```ts
// ❌ params.id — raw string, skips UUID check, malformed input reaches Prisma
// ✅
const id = parseIdFromRoute(await params); // throws sync → handleApiError → 400
```

---

## Yup validation

```ts
// Always abortEarly: false — collect all field errors, not just first
const data = await MyValidator.validate(body, { abortEarly: false });
```

Validators live in model files (`src/models/*.models.ts`) alongside their types.

---

## Shared validators — BE + FE

Define once in model file, import on both sides. `File` is the shared type — FE unwraps `FileList[0]`.

```ts
// src/models/report.models.ts
export const ExcelUploadValidator = yup.object({
  file: yup.mixed<File>().required().test('type', 'Only .xlsx/.xls', (v) =>
    v instanceof File && EXCEL_MIME_TYPES.includes(v.type)),
});

// BE — formData.get() returns File directly
const { file } = await ExcelUploadValidator.validate(
  { file: formData.get('file') }, { abortEarly: false },
);

// FE — input.files is FileList, unwrap to File first
const file = e.target.files?.[0];
await ExcelUploadValidator.validate({ file }, { abortEarly: false });
```

---

## FormData uploads

```ts
// FE — never set Content-Type (browser sets multipart boundary automatically)
const fd = new FormData();
fd.append('file', file); // File, not FileList
await axios.post('/api/report/upload', fd);

// BE — formData not json
const formData = await req.formData();
const { file } = await ExcelUploadValidator.validate(
  { file: formData.get('file') }, { abortEarly: false },
);
```

For binary/image uploads (logos, files stored as `Bytes` in DB) — see `ImageBytesGuide.md`.

---

## unstable_cache

```ts
// Every Prisma read must go through cached()
const mappings = await cached(
  () => prisma.fieldMapping.findMany({ where, select }),
  CACHE_KEYS.mapping.paged(userId, page, pageSize),
);

// After mutation: invalidate, then seed by-ID to avoid extra DB call on next GET
invalidateCache(...CACHE_KEYS.mapping.invalidate());
await cached(() => Promise.resolve(mapping), CACHE_KEYS.mapping.byId(mapping.id));
```

> Don't set TTL manually — rely on global cache settings. TTL override exists if needed but should be rare.

---

## updateManyAndReturn / deleteMany

> Ownership check lives in WHERE, not in code. One round trip. No TOCTOU.

```ts
// ❌ Two-step — TOCTOU race, extra DB round trip, leaks existence info
const existing = await prisma.fieldMapping.findFirst({ where: { id } });
if (!existing) throw new ApiError('Not found', 404);
if (existing.userId !== userId) throw new ApiError('Forbidden', 403); // ← tells attacker record exists
await prisma.fieldMapping.update({ where: { id }, data });

// ✅ One step — ownership enforced atomically in WHERE
const results = await prisma.fieldMapping.updateManyAndReturn({
  where: { id, userId }, // wrong owner → results.length === 0, same as not found
  data,
  select: MAPPING_SELECT,
});
if (results.length === 0) throw new ApiError('Mapping not found', 404);
// Don't distinguish "not found" from "wrong user" — 404 for both = no info disclosure

// Delete
const { count } = await prisma.fieldMapping.deleteMany({ where: { id, userId } });
if (count === 0) throw new ApiError('Mapping not found', 404);
```

Benefits: fewer DB calls, no race condition, no info disclosure (attacker can't probe whether a record exists).

---

## findFirstOrThrow

Prefer `OrThrow` variants for all single-record lookups — Prisma throws P2025 → `handleApiError` maps to 404 automatically. No manual null check needed.

```ts
// ✅ ID lookup — throws automatically if not found
const mapping = await prisma.fieldMapping.findFirstOrThrow({
  where: { id, OR: [{ userId }, { isGlobal: true }] },
  select: MAPPING_SELECT,
});

// findFirst OK for: existence checks before create, optional relations
// count() OK for: pagination totals, row limit checks
```

---

## Pagination

```ts
const { page, pageSize } = await parsePaginationFromUrl(new URL(req.url).searchParams);
// parsePaginationFromUrl: URL is 1-indexed → internal is 0-indexed
// createPaginatedResponse: converts back to 1-indexed automatically — never pass page + 1

const [data, total] = await Promise.all([ // parallel — never sequential
  cached(() => prisma.model.findMany({ where, skip: page * pageSize, take: pageSize }),
    CACHE_KEYS.model.paged(userId, page, pageSize)),
  cached(() => prisma.model.count({ where }),
    CACHE_KEYS.model.count(userId)), // count key is user-level, not page-level
]);

return NextResponse.json(createPaginatedResponse(data, page, pageSize, total));
// total is optional — skip if FE doesn't use it
```

> Never do `findMany` without pagination — no `getAll`. Even 1,000 rows is a problem.  
> `total` is a convenience for FE to render page count. If FE doesn't need it, omit the count query.

---

## Full-text search

> Raw SQL required — Prisma's `fullTextSearch` preview uses `to_tsquery` (crashes on raw user input). Always use `plainto_tsquery` for safety.

```ts
// Requires GIN index in migration:
// CREATE INDEX idx_name_fts ON "Model" USING GIN (to_tsvector('english', name));

const results = await prisma.$queryRaw<Row[]>`
  SELECT id, name
  FROM "Model"
  WHERE "userId" = ${userId}
    AND to_tsvector('english', name) @@ plainto_tsquery('english', ${freeText})
  ORDER BY ts_rank(to_tsvector('english', name), plainto_tsquery('english', ${freeText})) DESC
  LIMIT ${pageSize} OFFSET ${page * pageSize}
`;
// plainto_tsquery = safe for user input. to_tsquery = crashes on raw input — never use.

// Trigram fuzzy (pg_trgm) — for typo tolerance:
// CREATE EXTENSION IF NOT EXISTS pg_trgm;
// CREATE INDEX idx_name_trgm ON "Model" USING GIN (name gin_trgm_ops);
// WHERE similarity(name, ${freeText}) > 0.3

// Cache must include freeText in key
cached(() => ..., CACHE_KEYS.model.paged(userId, page, pageSize, freeText));
```

> Neon supports all standard Postgres extensions including `pg_trgm` and `pgvector`. For semantic search (AI embeddings), `pgvector` + `vector` column type. Decide per resource: FTS for keyword match, trigram for typo tolerance, pgvector for semantic.

---

## Rate limiting + DB limits

```ts
// Every mutating endpoint — after requireAuth(), before doing work
const { userId, permissions } = await requireAuth();
checkUserRequestLimit(req, userId, permissions);
// Limits (rateLimiter.ts): 5/min per user, 20/min per IP, 200/min global. Global never bypassed.

// DB size — before CREATE and UPDATE (not DELETE)
await checkUserDbLimits(userId, permissions);
// Measures all user content (mapping configs + logo bytes + header layouts)
// Throws 403 if total > USER_DB_LIMIT_BYTES (1 MB). No-op for NO_DB_SIZE_LIMITS.

// Row limit — before CREATE only (defense: prevents index bloat from many tiny rows)
// eslint-disable-next-line local/no-uncached-prisma
await checkRowLimit(() => prisma.model.count({ where: { userId } }), ROW_LIMITS.model, 'models', permissions);
```

> Rate limiter uses in-memory sliding window — works on single-instance deployments. On Vercel (serverless), each cold start gets a fresh window. Acceptable for low-traffic graduation project; replace with Upstash Redis for production multi-instance.

---

## Select projections

```ts
// Three tiers per resource — always explicit select, never bare findMany
const MODEL_SELECT_LIGHT  = { id: true, name: true } as const;
const MODEL_SELECT_PAGED  = { ...MODEL_SELECT_LIGHT, ...displayFields } as const;
const MODEL_SELECT        = { ...MODEL_SELECT_PAGED, config: true } as const;
//                                                    ↑ heavy fields (JSON) — full only
// Bytes (logos/files) never appear in any select tier — dedicated endpoint only
```

| Tier | Fields | Use |
|------|--------|-----|
| `_LIGHT` | id + name only | Dropdowns, combobox options |
| `_PAGED` | + display fields (flags, refs) | Paged list rows |
| Full (`_SELECT`) | + heavy fields (JSON, relations) | Detail / edit — no `Bytes` ever |

Complex relation example:

```ts
prisma.video.findMany({
  where: {
    id: { not: videoId },
    genres: {                          // video → genre junction
      some: {
        videos: {                      // genre → other videos junction
          some: { id: videoId },
        },
      },
    },
  },
  skip: page * pageSize,
  take: pageSize,
  orderBy: { publishedAt: 'desc' },
  select: {
    id: true,
    title: true,
    thumbnailUrl: true,
    description: true,
    durationSeconds: true,
  },
});
```
