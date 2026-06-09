# Backend Guide

Read alongside `UncontrolledInputsGuide.md`.

## Quick reference

| Pattern | Rule |
|---------|------|
| Prisma client | Import from `@/lib/prisma` — never `new PrismaClient()` |
| Handler | Every handler is `withHandler(body[, { permission }])` — never a raw `try/catch` |
| Auth | `getAuth()` inside a handler; `requireAuth()` only seeds it once, in the wrapper |
| Route file | Thin adapter only — all logic in service |
| Handler order | 1. auth (wrapper) → 2. validate request → 3. checks (rate limit, DB limit) → 4. work |
| Error handling | `withHandler` owns the `try/catch` → `handleApiError` — never hand-write it |
| ID from route | `parseIdFromRoute(await params)` — never raw `params.id` |
| Yup validation | Always `{ abortEarly: false }` |
| Prisma reads | Always wrap in `cached()` — never call bare |
| Cache keys | Always `CACHE_KEYS.*` — never raw string arrays |
| Update | `updateManyAndReturn` — ownership in WHERE clause (Prisma native) |
| Delete | `deleteManyAndReturn` — ownership in WHERE clause (custom extension) |
| Upsert | `upsertAndReturn` — single roundtrip, returns `wasUpdated: boolean` (custom extension) |
| Ownership fail | Throw 404, not 403 — no info disclosure |
| DB calls | Encode logic in WHERE — no pre-fetch to check ownership |
| ID lookup | `findFirstOrThrow` — auto-throws P2025 → 404 |
| Pagination | `Promise.all([data, count])` — never sequential awaits |
| FTS | `findManyFts` / `countFts` — never raw `$queryRaw` for search |
| Select | Always explicit `select` — never bare `findMany` |
| File upload | FormData + sharp — see `ImagesGuide.md` |

---

## withHandler — the standard route wrapper

**Every service handler is `withHandler` (or `withPublicHandler`) — required.** It owns
the entire request lifecycle in one place: auth, the permission gate, rate-limit /
error-handling and the ambient request context. A hand-written `try/catch` still works,
but it repeats that lifecycle in every handler and makes the code harder — the wrapper
keeps the body pure, the order consistent, and a route can't ship without auth.

### What it does

`withHandler` wraps your handler with the whole request lifecycle so the body stays pure:

```
requireAuth (401/403)  →  seed ambient request context  →  run your body  →  try/catch → handleApiError
```

The body you write is a **standard Next.js route handler** — `(req, { params })`. No
custom ctx object, nothing new to learn. Identity comes from `getAuth()`.

### The handler does its work in a fixed order

Inside the body, always in this sequence (the wrapper has already done auth):

1. **Auth check** — done *for you* by the wrapper before the body runs (`requireAuth`,
   plus the optional `{ permission }` gate). Read the result with `getAuth()`.
2. **Request validation** — parse + validate the input (`parseIdFromRoute`, Yup
   `validate(..., { abortEarly: false })`). Cheap, no DB. Reject malformed input here.
3. **Additional checks** — anything that hits the DB or external state: rate limit
   (`checkUserRequestLimit`), storage limit (`checkUserDbLimits`), and any custom guard.
   These run **after** validation so a bad request never costs a DB round-trip.
4. **The actual work** — DB read/write, cache, response.

> Why 2 before 3: validation is free, the checks cost DB calls. Validate first, fail
> cheap. Doing the checks first (the old order) wasted round-trips on invalid requests.

```ts
// service.ts
export const updateMapping = withHandler<{ id: string }>(async (req, { params }) => {
  const { userId, permissions } = getAuth();
  const id = parseIdFromRoute(await params);

  const data = await UpdateMappingValidator.validate(await req.json(), { abortEarly: false });

  await checkUserRequestLimit(req, userId, permissions);   // limit checks AFTER validate
  await checkUserDbLimits(userId, permissions);
  // ... DB, cache
  return NextResponse.json(mapping);
});

// route.ts — unchanged, thin binding
export const PATCH = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) =>
  updateMapping(req, ctx);
```

`updateMapping` is the function `withHandler` *returns* (already async). You only write
the body; its `async` is required because it `await`s. Keeping the wrapper at the service
export makes it **impossible to ship a route without auth, rate-limit and error-handling**
— don't move it into `route.ts`.

### Permission-gated routes

Pass `{ permission }` as the second arg — it goes straight to `requireAuth(permission)`,
which throws **403** if the user lacks it. This is how endpoints that are only accessible
with a permission are declared:

```ts
export const getAdminStats = withHandler(
  async (req) => {
    const { userId, permissions } = getAuth();
    // ...
    return NextResponse.json(stats);
  },
  { permission: Permission.CAN_ACCESS_STATS },   // ← gate. 403 if missing.
);
```

| Need | Call |
|------|------|
| Any authenticated user | `withHandler(body)` |
| Must hold a permission | `withHandler(body, { permission: Permission.X })` |
| Public, optional user | `withPublicHandler(body)` |

### Permission + ownership in one query — no extra DB call

The `isGlobal` mapping update is the canonical example. A user may edit their own
mappings; only `CAN_MODIFY_GLOBAL` holders may touch global ones. **Don't fetch-then-check
— resolve the permission in JS and encode ownership into the `where`:**

```ts
export const updateMapping = withHandler<{ id: string }>(async (req, { params }) => {
  const { userId, permissions } = getAuth();
  const id = parseIdFromRoute(await params);
  const data = await UpdateMappingValidator.validate(await req.json(), { abortEarly: false });
  await checkUserRequestLimit(req, userId, permissions);
  await checkUserDbLimits(userId, permissions);

  const canModifyGlobal = hasPermission(permissions, Permission.CAN_MODIFY_GLOBAL);

  // Guard — pure permission check, no DB
  if (!canModifyGlobal && data.isGlobal)
    throw new ApiError('Only CAN_MODIFY_GLOBAL can modify global mappings.', 403);

  // WHERE encodes ownership + visibility in one shot
  const where = canModifyGlobal
    ? { id, OR: [{ userId }, { isGlobal: true }] }   // own + global
    : { id, userId, isGlobal: false };                // own non-global only

  const results = await prisma.fieldMapping.updateManyAndReturn({ where, data, select: MAPPING_SELECT });
  if (results.length === 0) throw new ApiError('Mapping not found', 404);
  // ↑ covers doesn't-exist, wrong-owner, no-permission — all 404, no info disclosure

  return NextResponse.json(results[0]);
});
```

One query does ownership + visibility + permission. See
[updateManyAndReturn](#updatemanyandreturn--deletemanyandreturn) below for the full rule.

---

## Auth — `requireAuth()` vs `getAuth()`

**Same data (`{ userId, permissions }`), different usage.** Know which to call:

| Function | Where | Behavior |
|----------|-------|-----------|
| `requireAuth()` | the **edge** — the wrapper calls it once per request, you don't | resolves the session; **throws** 401 if anonymous, 403 if missing permission. The source of truth. |
| `getAuth()` | **your handler body + anything downstream** | reads the identity `withHandler` already seeded into the ambient request context. No session call. Throws only if used outside a request. |
| `getAuthOptional()` | `withPublicHandler` bodies / maybe-anonymous code | returns `AuthCtx \| null` — never throws. |

Rule: in a handler you call **`getAuth()`** — never `requireAuth()` directly. The wrapper
already ran `requireAuth` (and the `{ permission }` gate); your body just reads the result.

```ts
const { userId, permissions } = getAuth();   // in any withHandler body / downstream service
const auth = getAuthOptional();              // AuthCtx | null — in withPublicHandler bodies
```

> Permissions are embedded in the JWT at sign-in — no DB call on subsequent requests.
> Permission changes take effect on next sign-in.

### Ambient request context (how `getAuth()` works)

`withHandler` seeds a per-request store (`src/lib/requestContext.ts`, backed by Node
`AsyncLocalStorage`) with the authed identity. Any service in the call tree then reads it
via `getAuth()` without threading `userId`/`permissions` through every signature.

- **Write-once:** a `withHandler`-wrapped fn called from inside another won't overwrite
  the outer identity — auth can't be swapped mid-request.
- **`withPublicHandler`:** same standard body, auth optional. Uses `tryAuth()` (soft
  `requireAuth` — returns `null` instead of throwing), seeds context if signed in, runs
  anonymous requests anyway. Read with `getAuthOptional()`.
- **Never call `getAuth()` outside a request** (cron jobs, scripts) — it throws. Pass
  identity explicitly there.
- Store **only** ambient, derived-once, read-only, widely-needed data (auth). Business
  inputs (`id`, request body) stay explicit arguments.

> `AsyncLocalStorage` is a Node built-in, not a Next.js feature, but runs fine on the Node
> runtime. Next has no first-class request container — this is the standard answer.

---

## Data flow & route protection

Client-side data takes one path; server-side code skips the HTTP hop entirely:

```
React component → React Query hook (src/hooks/*.hooks.ts) → fetchClient (src/lib/fetchClient.ts)
  → /api/**/route.ts → service (withHandler) → Prisma → Neon DB
```

| Caller | How it reads data |
|--------|-------------------|
| Client component | `fetchClient` → API route → service → Prisma |
| Server component / server action | call the service directly — no HTTP round-trip |

`fetchClient` (axios) exists for two things raw `fetch` lacks: it strips `Content-Type` on
`FormData` so the browser sets the multipart boundary, and it normalizes 4xx/5xx into
`ApiError { message, status, code, details }` so hooks don't each parse errors.

**Protection layers:**
- **Per route, in the service** — `withHandler` (auth required) vs `withPublicHandler`
  (auth optional). This is the primary mechanism — prefer it.
- **Globally, in middleware** — `authorized()` in `src/auth.config.ts` decides which paths
  the edge middleware lets through before they ever reach a route. Add a path to a public
  allowlist there to skip the sign-in redirect:

```ts
// src/auth.config.ts
authorized({ auth, request: { nextUrl } }) {
  const publicRoutes = ['/about', '/api/webhook'];
  if (publicRoutes.some(r => nextUrl.pathname.startsWith(r))) return true;
  return !!auth?.user;   // everything else requires sign-in
}
```

---

## Error handling

You never call `handleApiError` yourself — `withHandler` owns the `try/catch` and reports
errors automatically. In the body you just **throw**; the wrapper maps it:

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

// populateCache — fetch fresh, invalidate stale entry, seed cache with new value.
// Use when you need the fresh DB value AND want it in cache (e.g. existence check after write).
const existing = await populateCache(
  () => prisma.user.findUnique({ where: { email }, select: { id: true } }),
  CACHE_KEYS.user.byEmail(email),
);
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

### upsertAndReturn (custom extension)

Single-roundtrip INSERT ... ON CONFLICT DO UPDATE ... RETURNING. Detects insert vs update via the Postgres `xmax` trick — no extra query needed.

```ts
const [{ createdAt, wasUpdated }] = await prisma.invite.upsertAndReturn({
  where:  { email },                        // conflict key
  create: { email, token, invitedBy, permissions },
  update: { token, invitedBy, permissions, createdAt: new Date() }, // reset clock
  select: { createdAt: true },
});
// wasUpdated: true = row existed (UPDATE), false = fresh row (INSERT)
```

**Raw SQL + DB-level behavior (resolved):** `withCrud` uses raw `$queryRaw`, so JS-side
Prisma features (`@updatedAt`, `@default(cuid()/uuid())`, middleware) don't run. Instead of
JS workarounds, all auto-behavior is pushed to Postgres so raw paths get it for free:

| Need | Schema | DB mechanism |
|------|--------|--------------|
| `updatedAt` auto-touch | `@default(now())` | `set_updated_at` trigger (`functions.sql`) fires on UPDATE |
| Generated id | `@default(dbgenerated("gen_random_uuid()"))` | column DEFAULT — don't pass `id` in `create` |
| `createdAt` | `@default(now())` | column DEFAULT on INSERT |

So `@updatedAt` is no longer a caveat — the trigger keeps it fresh on every write, raw or
native. Never use JS-side `@updatedAt` / `@default(cuid())` (see CLAUDE.md "Raw SQL +
Prisma Middleware"). Still JS-only: Prisma `$extends({ query })` middleware and nested
writes don't fire on raw paths — split into separate writes when needed.

---

## Lazy cleanup (withLazyCleanup)

TTL'd tables (invites, tokens) **clean themselves on access** instead of accumulating —
matches the "lazy cleanup instead of accumulation" rule. `withLazyCleanup` in
`src/lib/prismaLazyCleanup.ts` adds raw helpers whose single query DELETEs expired rows in
a CTE, then reads/counts only the live ones.

```ts
// model definition — compose onto the base client
invite: {
  ...withCrud<InviteModel>(base, '"Invite"'),
  ...withLazyCleanup<InviteModel>(base, '"Invite"', {
    ttl:   { field: 'createdAt', days: 14 },   // expiry window
    limit: 50,                                  // optional per-scope cap
    limitExceededMessage: 'Too many invites. Try again after some expire.',
  }),
},
```

| Method | What it does |
|--------|--------------|
| `findFirstWithCleanup({ where, select })` | DELETE expired + return one live row (or null) in one query |
| `findManyWithCleanup({ where, select, orderBy, take, skip })` | DELETE expired + return live rows |
| `assertLimit(where?)` | DELETE expired, then throw **429 `LIMIT_EXCEEDED`** if remaining ≥ `limit` |
| `cleanupExpired()` | DELETE expired, return count. Auto-registered for cron |
| `runAllCleanups()` (module fn) | run every registered `cleanupExpired` — the cron entry point |

- **Why a CTE with `AND NOT (expired)`:** the `DELETE` and `SELECT` run on the same
  pre-DELETE snapshot, so without the guard just-deleted rows would still show up.
- **Lazy first, cron as backstop:** reads clean their own scope on every access; the cron
  (`runAllCleanups`) sweeps tables that aren't being read so nothing lingers forever.
- Call `assertLimit()` in step 3 (checks), before creating a new row.

---

## findFirstOrThrow

Prefer `OrThrow` variants for all single-record lookups — Prisma throws P2025 → `handleApiError` maps to 404. No manual null check needed.

```ts
const mapping = await prisma.fieldMapping.findFirstOrThrow({
  where: { id, OR: [{ userId }, { isGlobal: true }] },
  select: MAPPING_SELECT,
});

// findFirst OK for: optional relations (a real "may or may not exist" read)
// count() OK for: pagination totals, row limit checks
```

**Never pre-check existence before a create.** A `findFirst` "does this email already
exist?" before `create` is a wasted round-trip (Network transfer rule). Let the DB throw
and map it:

```ts
// ❌ extra DB call, and a race window between check and create
const existing = await prisma.user.findUnique({ where: { email } });
if (existing) throw new ApiError('Email taken', 409);
await prisma.user.create({ data });

// ✅ one call — the @unique constraint throws P2002 → handleApiError maps to 409
await prisma.user.create({ data });
```

Requires the `@unique` (or `@@unique`) constraint in the schema — the DB is the source of
truth, not a JS pre-check. Same principle as encoding ownership in the `where`: let one
query enforce the rule instead of fetch-then-act.

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

In a `withHandler` body — step 3, after request validation:

```ts
const { userId, permissions } = getAuth();

// Every mutating endpoint
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
