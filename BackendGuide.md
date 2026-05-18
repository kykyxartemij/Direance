# Backend Guide

Read alongside `UncontrolledInputsGuide.md`.

## Quick reference

| Pattern | Rule |
|---------|------|
| Prisma client | Import from `@/lib/prisma` — never `new PrismaClient()` |
| Auth | `requireAuth()` / `requireAuth(Permission.X)` — always call with `()` |
| Route file | Thin adapter only — all logic in service |
| Error handling | `try/catch` → `handleApiError(error, method, url)` |
| ID from route | `parseIdFromRoute(await params)` — never raw `params.id` |
| Yup validation | Always `{ abortEarly: false }` |
| Prisma reads | Always wrap in `cached()` — never call bare |
| Cache keys | Always `CACHE_KEYS.*` — never raw string arrays |
| Update | `updateManyAndReturn` — ownership in WHERE clause (Prisma native) |
| Delete | `deleteManyAndReturn` — ownership in WHERE clause (custom extension) |
| Ownership fail | Throw 404, not 403 — no info disclosure |
| DB calls | Encode logic in WHERE — no pre-fetch to check ownership |
| ID lookup | `findFirstOrThrow` — auto-throws P2025 → 404 |
| Pagination | `Promise.all([data, count])` — never sequential awaits |
| FTS | `findManyFts` / `countFts` — never raw `$queryRaw` for search |
| Select | Always explicit `select` — never bare `findMany` |
| File upload | FormData + sharp — see `ImagesGuide.md` |

---

## Auth

One function — optional permission check:

```ts
// Any authenticated endpoint
const { userId, permissions } = await requireAuth();

// Permission-gated endpoint
const { userId, permissions } = await requireAuth(Permission.IS_ADMIN);
// throws 403 if user lacks that permission
```

> Permissions embedded in JWT at sign-in — no DB call on subsequent requests.
> Permission changes take effect on next sign-in.

---

## Route structure

```ts
// route.ts — thin adapter, binding only
export async function GET(req: NextRequest) {
  return getPagedMappings(req);
}

// service.ts — owns all logic
export async function getPagedMappings(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId, permissions } = await requireAuth();
    await checkUserRequestLimit(req, userId, permissions);
    // ... validate, DB, cache
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'GET', API.mapping.paged(0, 0));
  }
}
```

---

## Error handling

`handleApiError(error, method, url)` — 3 args, always:

```ts
return handleApiError(error, 'GET', API.mapping.byId(':id'));
return handleApiError(error, 'POST', API.mapping.list());
```

Maps automatically:

| Thrown | Status |
|--------|--------|
| `ApiError(msg, status)` | `.status` |
| Yup `ValidationError` | 400 + `details.fieldErrors` |
| Prisma P2025 / P2003 | 404 |
| Prisma P2002 | 409 |
| Unknown | 500 |

```ts
throw new ApiError('Mapping not found', 404);
throw new ApiError('Limit reached: max 20 mappings', 403);
```

---

## parseIdFromRoute

```ts
// ❌ Raw string — skips UUID check, malformed input reaches Prisma, ensures no broken BE calls
// ✅
const id = parseIdFromRoute(await params); // validates UUID format, throws 400 on malformed input
```

---

## Yup validation

```ts
// Always abortEarly: false — collect all field errors at once
const data = await MyValidator.validate(body, { abortEarly: false });
```

Validators live in model files (`src/models/*.models.ts`) alongside their types.

---

## Shared validators — BE + FE

Define once in model file (`src/models/*.models.ts`), import on both sides. FE may reuse or define its own stricter version.

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
```

---

## FormData uploads

```ts
// FE — never set Content-Type (browser sets multipart boundary automatically)
const fd = new FormData();
fd.append('file', file); // File, not FileList
await fetchClient.post('/api/report/upload', fd);

// BE
const formData = await req.formData();
const { file } = await ExcelUploadValidator.validate(
  { file: formData.get('file') }, { abortEarly: false },
);
```

For image/binary uploads stored as `Bytes` in DB — see `ImagesGuide.md`.

---

## Caching

```ts
// Every Prisma read goes through cached()
const mappings = await cached(
  () => prisma.fieldMapping.findMany({ where, select }),
  CACHE_KEYS.mapping.paged(userId, page, pageSize),
);

// After mutation: invalidate, then seed by-ID to avoid extra DB call on next GET
invalidateCache(...CACHE_KEYS.mapping.invalidate());
await cached(() => Promise.resolve(mapping), CACHE_KEYS.mapping.byId(mapping.id));
```

---

## updateManyAndReturn / deleteManyAndReturn

> Ownership check lives in WHERE, not in code. One round trip. No TOCTOU.

```ts
// ❌ Two-step — race condition, extra DB call, leaks existence to attacker
const existing = await prisma.fieldMapping.findFirst({ where: { id } });
if (!existing) throw new ApiError('Not found', 404);
if (existing.userId !== userId) throw new ApiError('Forbidden', 403); // tells attacker record exists
await prisma.fieldMapping.update({ where: { id }, data });

// ✅ Update — Prisma native (5.x)
const results = await prisma.fieldMapping.updateManyAndReturn({
  where: { id, userId }, // wrong owner → results.length === 0, same as not found
  data,
  select: MAPPING_SELECT,
});
if (results.length === 0) throw new ApiError('Mapping not found', 404);

// ✅ Delete — custom extension (withCrud in prismaCrud.ts)
const deleted = await prisma.fieldMapping.deleteManyAndReturn({
  where: { id, userId },
  select: { id: true },
});
if (deleted.length === 0) throw new ApiError('Mapping not found', 404);
```

Never distinguish "not found" from "wrong owner" — 404 for both = no info disclosure.

```
// ❌ "This item doesn't belong to you" — tells attacker the record exists
// ✅ 404 "Not found" for both missing and unauthorized — simpler code, no info leak
```

### One DB call — encode logic in WHERE

Permissions come from JWT, ownership from the `where` clause. Zero extra DB calls needed.

The mapping update is a good example: instead of fetching the mapping first, checking `isGlobal`, verifying `userId`, then updating — all logic is resolved upfront in JS and encoded into a single `where`:

```ts
const canModifyGlobal = hasPermission(permissions, Permission.CAN_MODIFY_GLOBAL);

// Guard — no DB call, pure permission check
if (!canModifyGlobal && data.isGlobal) {
  throw new ApiError('Only users with CAN_MODIFY_GLOBAL can modify global mappings.', 403);
}

// WHERE encodes all ownership + visibility rules in one shot
const where = canModifyGlobal
  ? { id, OR: [{ userId }, { isGlobal: true }] }  // can touch own + global
  : { id, userId, isGlobal: false };               // own non-global only

const results = await prisma.fieldMapping.updateManyAndReturn({ where, data, select });
if (results.length === 0) throw new ApiError('Mapping not found', 404);
// ↑ covers: doesn't exist, wrong owner, no permission — all 404, no info disclosure
```

No "fetch then check then act". One query does all three.

### deleteManyAndReturn (custom extension)

Postgres doesn't support `DELETE ... RETURNING` natively in Prisma ORM. `withCrud` in `src/lib/prismaCrud.ts` adds it as a Prisma extension using `$queryRaw` internally. Accepts Prisma-style `where` (equality + OR), `select`, and optional `limit`. Return type is inferred from `select` — no manual generics at the call site.

---

## findFirstOrThrow

Prefer `OrThrow` variants for all single-record lookups — Prisma throws P2025 → `handleApiError` maps to 404. No manual null check needed.

```ts
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
// createPaginatedResponse: converts back to 1-indexed automatically

const where = { OR: [{ userId }, { isGlobal: true }] };
const [data, total] = await Promise.all([ // always parallel
  cached(
    () => prisma.fieldMapping.findManyFts({
      freeText,
      userId,
      where,
      select: MAPPING_SELECT_PAGED,
      orderBy: { name: 'asc' },
      skip: page * pageSize,
      take: pageSize,
    }),
    CACHE_KEYS.mapping.paged(userId, page, pageSize, freeText),
  ),
  cached(
    () => prisma.fieldMapping.countFts({ freeText, userId, where }),
    CACHE_KEYS.mapping.count(userId, freeText),
  ),
]);

return NextResponse.json(createPaginatedResponse(data, page, pageSize, total));
```

> Never `findMany` without pagination for user-facing lists — no `getAll`. Even 1,000 rows is a problem.
> Exception: `_LIGHT` queries (id + name only) are acceptable unpaginated — low cost, used for dropdowns.

---

## Full-text search (findManyFts / countFts)

FTS is handled by the `withFts` Prisma extension (`src/lib/prismaFts.ts`). Use `findManyFts` / `countFts` — never write raw FTS SQL yourself.

**Decision tree (handled automatically by the extension):**

| Input | Strategy |
|-------|----------|
| Empty | No filter — return all |
| 1–4 chars | `contains` (case-insensitive) on search columns |
| Valid UUID | Exact `id` match |
| 5+ chars | FTS (tsvector + plainto_tsquery) + trigram similarity |

```ts
// Search + count — FTS IDs deduped via React cache(), only one SQL query fires
// even when findManyFts and countFts are called in Promise.all
await prisma.model.findManyFts({ freeText, userId, where, select, orderBy, skip, take });
await prisma.model.countFts({ freeText, userId, where });
```

The extension requires per-table DB setup: `search_vector` GIN index (tsvector) + trigram GIN index on the search column.

### $queryRaw — when to use

`$queryRaw` is used internally by `withFts` and `withCrud`. In service code, avoid it directly. If a complex query can't be expressed in Prisma ORM:

- Check if `withFts` or `withCrud` already covers it.
- If truly unique (e.g., `checkDbConsumption` measuring raw storage across multiple models), use `$queryRaw` directly.
- If the raw query is reusable, wrap it as a custom Prisma extension (same pattern as `withFts`) so it gets Prisma-style typed props, caching, and test isolation.

---

## Rate limiting + DB limits

```ts
// Every mutating endpoint — after requireAuth(), before doing work
const { userId, permissions } = await requireAuth();
await checkUserRequestLimit(req, userId, permissions);

// Before CREATE and UPDATE (not DELETE)
await checkUserDbLimits(userId, permissions);
```

> Rate limiter uses in-memory sliding window. On Vercel (serverless), each cold start resets the window. Acceptable for single-instance; replace with Upstash Redis for multi-instance production.

---

## Select projections

Three tiers per resource — always explicit select, never bare `findMany`:

```ts
const MODEL_SELECT_LIGHT = { id: true, name: true } as const;
const MODEL_SELECT_PAGED = { ...MODEL_SELECT_LIGHT, isGlobal: true, reportType: true } as const;
const MODEL_SELECT       = { ...MODEL_SELECT_PAGED, config: true } as const;
//                                                   ↑ heavy fields (JSON) — full only
// Bytes (logos/files) never appear in any select tier — dedicated endpoint only
```

| Tier | Fields | Use |
|------|--------|-----|
| `_LIGHT` | id + name only | Dropdowns, combobox options |
| `_PAGED` | + display fields (flags, refs) | Paged list rows |
| Full (`_SELECT`) | + heavy fields (JSON, relations) | Detail / edit — no `Bytes` ever |

---

## Prisma relations (cool example)

Prisma can express complex joins as pure TypeScript. This "find similar videos" query shows how deep relation traversal looks — no raw SQL needed:

```ts
// Find videos sharing at least one genre with videoId
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
  select: { id: true, title: true, thumbnailUrl: true, description: true, durationSeconds: true },
});
```
