# Backend Guide

Read alongside `UncontrolledInputsGuide.md`. Every rule below traces through real handlers —
mainly `src/services/mapping.service.ts`, with `invite.service.ts`, `connection.service.ts` and
`currency.service.ts` for the patterns mapping doesn't cover. Open them side by side.

## Quick reference

| Pattern | Rule |
|---------|------|
| Prisma client | Import from `@/lib/prisma` — never `new PrismaClient()` |
| Handler | Every handler is `withHandler(body[, { permission }])` — never a raw `try/catch` |
| Auth | `getAuth()` inside a handler; `requireAuth()` only seeds it once, in the wrapper |
| Route file | Thin adapter only — all logic in service |
| Handler order | 1. auth (wrapper) → 2. validate/parse request → 3. checks, cheapest first → 4. work |
| Error handling | `withHandler` owns the `try/catch` → `handleApiError` — never hand-write it |
| ID from route | `parseIdFromRoute(await params)` — never raw `params.id` |
| Yup validation | Always `{ abortEarly: false }` |
| Prisma reads | Always wrap in `cached()` — never call bare |
| Cache keys | Always `CACHE_KEYS.*` — never raw string arrays |
| Update | `updateManyAndReturn` — ownership in WHERE clause (Prisma native) |
| Delete | `deleteManyAndReturn` — ownership in WHERE clause (custom extension) |
| Upsert | `upsertAndReturn` — single roundtrip, returns `wasUpdated: boolean` (custom extension) |
| Relations | FK assigned directly (`{ ...data, userId }`) — Prisma `connect` never used |
| Ownership fail | Throw 404, not 403 — no info disclosure |
| DB calls | Encode logic in WHERE — no pre-fetch to check ownership |
| ID lookup | `findFirstOrThrow` — auto-throws P2025 → 404 |
| In-memory guards | `assertInstanceCapacity`/`assertIpCapacity`/`assertUserCapacity` — automatic in `withHandler`, per-instance trip-wires, not authoritative |
| DB-cost checks | `checkUserRequestLimit`/`checkPublicRequestLimit` move inside `cached()` when it wraps the *entire* unit of work — never for mutations, never for paged `total`/count |
| Pagination | `Promise.all([data, count])` — never sequential awaits |
| FTS | `findManyFts` / `countFts` — never raw `$queryRaw` for search |
| Select | Always explicit `select` — never bare `findMany` |
| External APIs | BE always proxies (currency CDN, Merit/Odoo) — client never calls out directly |
| File upload | FormData + sharp — see `ImagesGuide.md` |

---

## The pipeline

Every handler body runs the same steps, in this order. Skipping or reordering one is the most
common review comment on a new route — treat this as the checklist.

```
1. withHandler          entry point — auth, permission gate, try/catch already done
2. getAuth()             read the identity the wrapper resolved
3. validate/parse        Yup validators + route/query parsing — no DB yet
4. checks, cheapest first  rate limit → custom guards → DB limit → permission/ownership
5. the Prisma call        cache wrap, select tier, FTS, batch loader, CRUD extension
6. (FTS only) DB setup   prisma/fts.sql — one-time per searchable table
7. aftermath             invalidateCache() + reseed the by-id entry
8. paged responses       Promise.all([data, count]) + related-model selects
```

Steps 1–4 exist to protect step 5. Every check up to that point is there because the real
Prisma call is the most expensive thing in the pipeline — cheap checks fail the request before
it costs anything, and the call itself is the one thing that gets cached.

---

## Step 1 — layering: route.ts → service.ts → withHandler

Next.js gives every route file (`route.ts`) a fixed job: bind an HTTP verb to a function. It's
a **path-through, not a place for logic** — the file exists because Next.js routing requires
it, nothing more.

```ts
// route.ts — the entire file. No logic, no imports beyond the service.
export const PATCH = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) =>
  updateMapping(req, ctx);
```

`updateMapping` is defined in `service.ts` and already wrapped in `withHandler` — that's the
real handler. Two consequences of keeping the wrapper at the **service** export, not the route:

- A service function can be called directly from a server component or another service (no
  HTTP round-trip — see Reference → Data flow), and it's still fully protected.
- A route **cannot** ship without auth, rate-limiting and error-handling, because those live in
  the thing the route file imports, not in the route file itself.

### `withHandler`, the entry point

**Every service handler is `withHandler` (or `withPublicHandler`) — required.** It owns the
whole request lifecycle in one place: auth, the permission gate, error handling and the ambient
request context, so the body itself stays pure business logic.

```
assertInstanceCapacity → assertIpCapacity → requireAuth → assertUserCapacity → seed context → body → try/catch → handleApiError
```

The three `assert*Capacity` calls are automatic — you never call them yourself, `withHandler`
does it before your body runs at all. They're in-memory, per-instance trip-wires (`src/lib/rateLimiter.ts`),
not the authoritative limit — see Step 4 for the real, cluster-accurate checks you do call
explicitly. Three reasons there are three of them, not one:

- `assertInstanceCapacity` — global per-instance count, catches raw volume before spending a
  cycle on anything, including auth.
- `assertIpCapacity` — pre-auth, per IP (only identity available before `requireAuth` runs).
- `assertUserCapacity` — post-auth, per `userId`. Catches what the IP guard structurally can't:
  one account cycling IPs (VPN/proxy hop) resets the IP counter every time, but `userId` doesn't.

The body you write is a **standard Next.js route handler** — `(req, { params })`. No custom ctx
object.

```ts
// service.ts
export const updateMapping = withHandler<{ id: string }>(async (req, { params }) => {
  // steps 2–8 go here
});
```

`updateMapping` is the function `withHandler` *returns* (already async) — you only write the
body, `async` is required because it `await`s.

### Permission-gated routes

Pass `{ permission }` as the second arg — it goes straight to `requireAuth(permission)`, which
throws **403** if the user lacks it:

```ts
export const getAdminStats = withHandler(
  async (req) => { /* ... */ },
  { permission: Permission.CAN_ACCESS_STATS },   // ← gate. 403 if missing.
);
```

| Need | Call |
|------|------|
| Any authenticated user | `withHandler(body)` |
| Must hold a permission | `withHandler(body, { permission: Permission.X })` |
| Public, optional user | `withPublicHandler(body)` |

---

## Step 2 — `getAuth()`

**Same underlying data (`{ userId, permissions }`) as `requireAuth()`, different usage.**

| Function | Where | Behavior |
|----------|-------|-----------|
| `requireAuth()` | the **edge** — the wrapper calls it once per request, you don't | resolves the session; **throws** 401 if anonymous, 403 if missing permission |
| `getAuth()` | **your handler body + anything downstream** | reads the identity `withHandler` already seeded. No session call. Throws only if used outside a request |
| `getAuthOptional()` | `withPublicHandler` bodies / maybe-anonymous code | returns `AuthCtx \| null` — never throws |

Rule: in a handler you call **`getAuth()`** — never `requireAuth()` directly.

```ts
const { userId, permissions } = getAuth();   // first line of every withHandler body
const auth = getAuthOptional();              // AuthCtx | null — in withPublicHandler bodies
```

> Permissions are embedded in the JWT at sign-in — no DB call on subsequent requests.
> Permission changes take effect on next sign-in.

### How it works — ambient request context

`withHandler` seeds a per-request store (`src/lib/requestContext.ts`, backed by Node
`AsyncLocalStorage`) with the authed identity. Any service in the call tree reads it via
`getAuth()` without threading `userId`/`permissions` through every signature.

- **Write-once:** a `withHandler`-wrapped fn called from inside another won't overwrite the
  outer identity — auth can't be swapped mid-request.
- **`withPublicHandler`:** same standard body, auth optional. Uses `tryAuth()` (soft
  `requireAuth` — returns `null` instead of throwing), seeds context if signed in, runs
  anonymous requests anyway. Read with `getAuthOptional()`.
- **Never call `getAuth()` outside a request** (cron jobs, scripts) — it throws. Pass identity
  explicitly there.
- Store **only** ambient, derived-once, read-only, widely-needed data (auth). Business inputs
  (`id`, request body) stay explicit arguments.

---

## Step 3 — validate / parse the request

Everything here is free — no DB. It exists to protect step 4/5 from doing expensive work on a
request that was never going to succeed.

### Yup validators (`src/models/*.models.ts`)

```ts
const data = await UpdateMappingValidator.validate(await req.json(), { abortEarly: false });
```

- Always pass `{ abortEarly: false }` — collects all field errors at once, not just the first.
- Live in model files, next to the type they validate. See Validation Architecture in
  the project rules in CLAUDE.md for the BE/FE split (models = API contract, page/component = form-only rules).
- **Shared BE + FE — nice to have, not required.** A model validator *can* be reused on the FE
  as-is. In practice BE and FE shapes diverge often enough (HTTP-semantics fields on BE,
  FE-only fields like `confirmPassword`) that most forms end up with their own local `schema`.
  Reuse it when it lines up, don't force it when it doesn't.

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

### FormData uploads

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

### Route/query parsing — same tier as validators, still free

```ts
const id = parseIdFromRoute(await params);
// validates UUID format, throws 400 on malformed input
// ❌ raw params.id — skips the UUID check, malformed input reaches Prisma

const searchParams = new URL(req.url).searchParams;
const { page, pageSize } = await parsePaginationFromUrl(searchParams);
// URL is 1-indexed → internal page is 0-indexed; createPaginatedResponse() converts back

const freeText = parseFreeTextFromUrl(searchParams);
// feeds findManyFts / countFts — see Step 5
```

---

## Step 4 — checks, cheapest first

Once step 3 confirms the request is well-formed, run the checks that cost something —
**cheapest first, so an abusive or over-limit caller is rejected before the more expensive
checks (and the DB call itself) ever run.**

```
rate limit  →  custom guards (e.g. assertLimit)  →  DB storage limit  →  permission/ownership
```

### 1. Rate limit — cheap, applies almost everywhere

```ts
await checkUserRequestLimit(req, userId, permissions);   // mutations — always unconditional, see below for reads
```

Backed by a Postgres `check_rate_limit()` function (`src/lib/rateLimiter.ts`, body in
`prisma/functions.sql`) — one indexed DB call, works across all Vercel instances (not an
in-memory window).

**For reads, this check lives inside the `cached()` call in Step 5, not here.** A cache hit
costs zero DB, so the check only runs when there's an actual query to protect. See Step 5,
"Cache-wrapping the DB-cost check," for the exact placement and the paged/mutation exceptions.
This section is the reference for mutations, where the check is always unconditional since a
write happens regardless of cache state.

Applies to reads too, not just mutations — the deciding question isn't "does this write to the
DB," it's **"does a hit cost us something real."** A DB write is one way to cost something; so
is an outbound call to a third-party API using the caller's own credentials. `connection.service.ts`
is the clearest example of both ends:

```ts
// fetchProfitConnectionsByIds — hits our DB (via batch loader) + calls Merit/Odoo. Rate-limited.
await checkUserRequestLimit(req, userId, permissions);

// testPnlConnection — pure external call, no DB read/write of ours at all. No rate limit —
// auth alone (from withHandler) is the only gate. The call costs the caller's own external
// service, not us, and there's nothing here to cache or abuse for DB cost.
export const testPnlConnection = withHandler(async (req) => {
  const { type, config, secret } = await TestConnectionValidator.validate(await req.json(), { abortEarly: false });
  await testPnlConnectionDriver({ type, config, secret: secret as ConnectionSecret });
  return new NextResponse(null, { status: 204 });
});
```

Keep the rate limit when the endpoint can be turned into an amplification or probing vector
(hammering a third party through our server, or using a user-supplied `config.url` to probe
internal hosts) — skip it when the call genuinely costs us nothing beyond the request itself.

`fetchProfitConnectionsByIds` above is also a deliberate exception to the cache-wrap move: the
check applies once per request, but the real cost is per-id inside a batch loader (Step 5) — N
possible cache misses, each triggering its own Postgres/external call. One request-level check
doesn't map cleanly onto that per-id cost, so it stays unconditional rather than guessing at
which granularity is "right." Left as an open judgment call, not mechanically converted.

### 2. Custom guards — endpoint-specific, still before the expensive checks

Anything that doesn't fit `checkUserRequestLimit`/`checkUserDbLimits` but still needs to run
before the DB write. `prisma.invite.assertLimit()` (`invite.service.ts`) is the reference case
— see Lazy cleanup below.

### 3. DB storage limit — before CREATE and UPDATE only

```ts
await checkUserDbLimits(userId, permissions);
```

Not on DELETE (frees space, nothing to guard) and not on pure reads. Skipped entirely on
endpoints with no DB write of ours — `testPnlConnection` above needs neither this nor the rate
limit's DB-cost reasoning, since there's no storage being touched.

### 4. Permission + ownership, resolved in JS, encoded into the query

The last check before the Prisma call. It decides **what the caller is actually allowed to
do**, not just whether they're allowed to call the endpoint at all. Never fetch-then-check.
Resolve the permission in JS and encode ownership into the `where` so one query does auth,
ownership and visibility together, one round trip instead of a fetch plus a check plus a write.
Same reason every check in this step exists: minimize what crosses the wire (Network Transfer
rule). The mapping CRUD trio is the canonical example, same shape repeated for create, update,
delete:

```ts
export const createMapping = withHandler(async (req) => {
  const { userId, permissions } = getAuth();
  const data = await CreateMappingValidator.validate(await req.json(), { abortEarly: false });

  await checkUserRequestLimit(req, userId, permissions);
  await checkUserDbLimits(userId, permissions);

  const canModifyGlobal = hasPermission(permissions, Permission.CAN_MODIFY_GLOBAL);
  if (!canModifyGlobal && data.isGlobal) throw new ApiError('Only users with permission CAN_MODIFY_GLOBAL can create global mappings.', 403);

  const mapping = await prisma.fieldMapping.create({
    data: { ...data, userId },   // FK assigned directly — Prisma `connect` never used, extra round trip
    select: MAPPING_SELECT,
  });
  // ... invalidate + reseed, see Step 7
});

export const updateMapping = withHandler<{ id: string }>(async (req, { params }) => {
  const { userId, permissions } = getAuth();
  const id = parseIdFromRoute(await params);
  const data = await UpdateMappingValidator.validate(await req.json(), { abortEarly: false });

  await checkUserRequestLimit(req, userId, permissions);
  await checkUserDbLimits(userId, permissions);

  const canModifyGlobal = hasPermission(permissions, Permission.CAN_MODIFY_GLOBAL);
  if (!canModifyGlobal && data.isGlobal) throw new ApiError('Only users with permission CAN_MODIFY_GLOBAL can modify global mappings.', 403);
  const where = canModifyGlobal
    ? { id, OR: [{ userId }, { isGlobal: true }] }
    : { id, userId, isGlobal: false };

  const results = await prisma.fieldMapping.updateManyAndReturn({ where, data, select: MAPPING_SELECT });
  if (results.length === 0) throw new ApiError('Mapping not found', 404);
  // ... invalidate + reseed, see Step 7
});

export const deleteMapping = withHandler<{ id: string }>(async (req, { params }) => {
  const { userId, permissions } = getAuth();
  const id = parseIdFromRoute(await params);
  await checkUserRequestLimit(req, userId, permissions);

  const canModifyGlobal = hasPermission(permissions, Permission.CAN_MODIFY_GLOBAL);
  const where = canModifyGlobal
    ? { id, OR: [{ userId }, { isGlobal: true }] }
    : { id, userId, isGlobal: false };

  const deleted = await prisma.fieldMapping.deleteManyAndReturn({ where, select: { isGlobal: true } });
  if (deleted.length === 0) throw new ApiError('Mapping not found', 404);
  // ... invalidate, see Step 7
});
```

The `where` is doing three jobs in one round trip: does the row exist, does the caller own it
or is it global, is the caller allowed to touch a global row. `results.length === 0` covers all
three failure modes identically — **404 for all of them, never 403 for "exists but not
yours."** Distinguishing the two would leak record existence to an attacker probing ids; a
plain "not found" costs the attacker nothing to learn from, which is also less to send over the
wire (Network Transfer rule) than a more specific error body would be.

### Lazy cleanup (`withLazyCleanup`) — the custom-guard example

TTL'd tables (invites, tokens) **clean themselves on access** instead of accumulating —
matches the "lazy cleanup instead of accumulation" rule. `withLazyCleanup`
(`src/lib/prismaLazyCleanup.ts`) adds raw helpers whose single query DELETEs expired rows in a
CTE, then reads/counts only the live ones.

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

```ts
// invite.service.ts — sendInvite: custom guard sits right where step 4 says it should
await checkUserRequestLimit(req, inviterId, inviterPerms);
await prisma.invite.assertLimit();   // custom guard — DELETE expired, then 429 if still over cap
```

| Method | What it does |
|--------|--------------|
| `findFirstWithCleanup({ where, select })` | DELETE expired + return one live row (or null) in one query |
| `findManyWithCleanup({ where, select, orderBy, take, skip })` | DELETE expired + return live rows |
| `assertLimit(where?)` | DELETE expired, then throw **429 `LIMIT_EXCEEDED`** if remaining ≥ `limit` |
| `cleanupExpired()` | DELETE expired, return count. Auto-registered for cron |
| `runAllCleanups()` (module fn) | run every registered `cleanupExpired` — the cron entry point |

- **Why a CTE with `AND NOT (expired)`:** the `DELETE` and `SELECT` run on the same pre-DELETE
  snapshot, so without the guard just-deleted rows would still show up.
- **Lazy first, cron as backstop:** reads clean their own scope on every access; the cron
  (`runAllCleanups`) sweeps tables that aren't being read so nothing lingers forever.

---

## Step 5 — the Prisma call

Everything above exists to protect this. It's the most expensive step in the pipeline, and the
only one that gets cached.

### Custom Prisma extensions — where each one lives

All raw-SQL capability the codebase adds on top of Prisma ORM, in one place:

| Extension | File | Adds |
|-----------|------|------|
| `withCrud` | `src/lib/prismaCrud.ts` | `deleteManyAndReturn`, `upsertAndReturn` |
| `withFts` | `src/lib/prismaFts.ts` | `findManyFts`, `countFts` |
| `withLazyCleanup` | `src/lib/prismaLazyCleanup.ts` | `findFirstWithCleanup`, `findManyWithCleanup`, `assertLimit`, `cleanupExpired` |

`updateManyAndReturn` is the one exception — it's Prisma-native (5.x), not a custom extension.

### Cache wrapping — `cached` / `populateCache`

**Every Prisma read goes through `cached()`.** Cache keys always come from `CACHE_KEYS.*`
(`src/lib/cacheKeys.ts`) — never a raw string array, so every consumer invalidates the same tag.

```ts
const mappings = await cached(
  () => prisma.fieldMapping.findMany({ where, select }),
  CACHE_KEYS.mapping.paged(userId, page, pageSize),
);
```

`populateCache` — for when you need the DB's current value right now (e.g. an existence check
right after a write, where a stale cache hit would be wrong), but the result still has to end
up cached — otherwise the very next call pays the same DB/network cost again for no reason. It
fetches fresh, invalidates the stale entry, and seeds the cache with the new value in one call:

```ts
const existing = await populateCache(
  () => prisma.user.findUnique({ where: { email }, select: { id: true } }),
  CACHE_KEYS.user.byEmail(email),
);
```

### Cache-wrapping the DB-cost check

`checkUserRequestLimit`/`checkPublicRequestLimit` cost one Postgres call, same as the read
they're guarding. Placed **inside** the `cached()` callback, the check only runs when there's
an actual DB call to protect, a cache hit costs zero DB either way:

```ts
// getConnectionById — the whole rule in one example
const connection = await cached(
  async () => {
    await checkUserRequestLimit(req, userId, permissions);   // only pays on a real miss
    return prisma.connection.findFirstOrThrow({ where: { id, userId }, select: CONNECTION_SELECT });
  },
  CACHE_KEYS.connection.byId(userId, id),
);
```

**Only valid when the `cached()` call covers 100% of the request's DB cost** — the moment
something else in the handler hits the DB regardless of cache state, moving the check inside
stops protecting that other work. Three consequences:

- **Never for mutations.** A write always happens — there's no cache branch that skips it, so
  there's nothing to gate the check on. Stays unconditional, before any work (Step 4 above).
- **`acceptInvite` vs `lookupInvite` (`invite.service.ts`) is the clean contrast.**
  `lookupInvite`'s `cached()` call *is* the entire handler — check moves inside.
  `acceptInvite`'s `cached()` call only wraps the token lookup; a `populateCache` existence
  check and a `$transaction` (user create + invite delete) still run after it regardless of
  whether that lookup was cached. The check stays unconditional, at the top:

  ```ts
  // acceptInvite — real work follows the cache lookup either way, check can't move
  export const acceptInvite = withPublicHandler(async (req) => {
    const data = await AcceptInviteValidator.validate(await req.json(), { abortEarly: false });
    await checkPublicRequestLimit(req);   // unconditional — populateCache + $transaction come next regardless

    const invite = await cached(/* token lookup only */);
    // ...populateCache existence check, then $transaction — real DB cost either way
  });

  // lookupInvite — cached() is the entire unit of work, check moves inside
  export const lookupInvite = withPublicHandler(async (req) => {
    const token = req.nextUrl.searchParams.get('token') ?? '';
    if (!token) throw new ApiError('Token is required', 400);

    const invite = await cached(async () => {
      await checkPublicRequestLimit(req);
      return prisma.invite.findFirstWithCleanup({ where: { token }, select: { /* ... */ } });
    }, CACHE_KEYS.invite.byToken(token));

    if (!invite) throw new ApiError('Invite link is invalid, expired, or already used', 400);
    return NextResponse.json({ email: invite.email });
  });
  ```

- **Paged reads: check goes in the `data` branch only, never `total`.** `total`/count is
  page-invariant, the same cache entry serves every page of the same filter (Step 8). Checking
  in both branches makes a single GET silently consume 1 or 2 units of the rate-limit budget
  depending on what happened to be cached, not something to leave implicit. `data` is the
  branch that varies per page and carries the larger cost, so that's where the check goes:

  ```ts
  const [data, total] = await Promise.all([
    cached(async () => {
      await checkUserRequestLimit(req, userId, permissions);
      return prisma.fieldMapping.findManyFts({ freeText, userId, where, select: MAPPING_SELECT_PAGED, orderBy: { name: 'asc' }, skip: page * pageSize, take: pageSize });
    }, CACHE_KEYS.mapping.paged(userId, page, pageSize, freeText)),

    cached(() => prisma.fieldMapping.countFts({ freeText, userId, where }), CACHE_KEYS.mapping.count(userId, freeText)),
  ]);
  ```

### Select projections — three tiers, always explicit

Never bare `findMany` — always pass `select`. The three tiers exist to bound Network Transfer:
each one should only carry what the screen that calls it actually renders.

```ts
const MAPPING_SELECT_LIGHT = { id: true, name: true, reportType: true } as const;
const MAPPING_SELECT_PAGED = { ...MAPPING_SELECT_LIGHT, isGlobal: true, exportSetting: { select: { id: true, name: true } } } as const;
const MAPPING_SELECT       = { ...MAPPING_SELECT_PAGED, config: true, exportSetting: { select: { id: true, name: true, mappedValues: true, hasTotalColumn: true } } } as const;
//                                                        ↑ heavy fields (JSON) — full only
// Bytes (logos/files) never appear in any select tier — dedicated endpoint only
```

| Tier | Fields | Use |
|------|--------|-----|
| `_LIGHT` | id + name (+ a type/discriminator field if the dropdown needs to branch on it, e.g. connections) | Dropdowns, combobox options — retrieves the **whole** collection unpaginated, so keep it minimal |
| `_PAGED` | + display fields + light relation selects | Paged list rows — the search/browse view |
| Full (`_SELECT`) | + heavy fields (JSON, full relations) | `getById`, edit, detail view — never used for a list |

For a small collection, `_PAGED` and full can end up nearly identical — still worth defining
separately, so the tiers don't have to be re-split later if the collection grows or a heavy
field gets added.

### `findFirstOrThrow` — single-record lookups

Prefer `OrThrow` variants for all single-record lookups. Two things this buys over a plain
`findFirst` + manual null check:

- Prisma throws P2025 straight into `withHandler`'s `catch` → `handleApiError` maps it to 404 —
  no `if (!x) throw ApiError(...)` boilerplate repeated in every service.
- The throw happens **before** `cached()` would resolve, so a miss is never memoized as a
  cached `null` — the failure propagates as an error every time instead of being cached and
  silently reused.

```ts
const mapping = await prisma.fieldMapping.findFirstOrThrow({
  where: { id, OR: [{ userId }, { isGlobal: true }] },
  select: MAPPING_SELECT,
});

// findFirst OK for: optional relations (a real "may or may not exist" read)
// count() OK for: pagination totals, row limit checks
```

**Never pre-check existence before a create.** A `findFirst` "does this email already exist?"
before `create` is a wasted round-trip (Network Transfer rule) and opens a race window.

```ts
// ❌ extra DB call, and a race window between check and create
const existing = await prisma.user.findUnique({ where: { email } });
if (existing) throw new ApiError('Email taken', 409);
await prisma.user.create({ data });

// ✅ one call — the @unique constraint throws P2002 → handleApiError maps to 409
await prisma.user.create({ data });
```

Requires the `@unique` (or `@@unique`) constraint in the schema — the DB is the source of
truth, not a JS pre-check.

### `updateManyAndReturn` / `deleteManyAndReturn`

> Ownership check lives in WHERE, not in code. One round trip. No TOCTOU.

```ts
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

Postgres doesn't support `DELETE ... RETURNING` natively in Prisma ORM — `withCrud` adds it via
`$queryRaw`. Accepts Prisma-style `where` (equality + OR), `select`, and optional `limit`.
Return type is inferred from `select` — no manual generics at the call site.

Plain `update()` is the better call when `where` is just `{ id: userId }` straight from the
session, no ownership to encode. That's `patchMe` in `user.service.ts`. Everywhere else,
`updateManyAndReturn` is the standard even though `deleteManyAndReturn` (no native
`updateAndReturn` to pair with) is the only reason both ended up as `*ManyAndReturn`. Known
imperfect, kept anyway, update and delete stay symmetric across services.

### `createBatchLoader` — N cache-aware lookups, 1 DB call

Same category as the permission/ownership `where` above — it's another place where the query
has to enforce scoping the URL alone doesn't. Use when a handler needs several rows by id in
the same request (`fetchProfitConnectionsByIds`, right after its rate-limit + validation
checks). `createBatchLoader` (`src/lib/batchLoader.ts`) coalesces every key requested in the
same microtask into one `findMany`, then hands each caller back its own row:

```ts
const loadRow = createBatchLoader(
  (batchIds: string[]) =>
    prisma.connection.findMany({
      where: { id: { in: batchIds }, userId, reportType: 'pnl' }, // reportType — see caveat below
      select: { id: true, type: true, reportType: true, config: true, secret: true, mapping: { select: MAPPING_SELECT } },
    }),
  (row: { id: string }) => row.id,
);

const entries = await Promise.all(
  ids.map(async (id) => {
    const result = await cached(
      async () => {
        const row = await loadRow(id);          // batched: N calls here → 1 findMany
        if (!row) throw new ApiError('Connection not found', 404);
        // ... decrypt secret, run driver, return report
      },
      CACHE_KEYS.connection.fetch(userId, 'pnl', id, filters), // per-id cache entry
    );
    return [id, result] as const;
  }),
);
```

Each `ids.map` iteration calls `cached()` independently — on a full cache hit, `loadRow` never
runs at all. Only the misses hit `findMany`, and they collapse into one query no matter how
many ids miss in the same request.

**Caveat — every filter the handler is scoped to must also be in the batch `where`.** The
example above is pinned to `reportType: 'pnl'` (`fetchProfitConnectionsByIds`, a separate
function from the financial-position one — see the Validation Architecture rule in CLAUDE.md). If
`reportType` were left out of `where`, a `financial_position` connection id passed to this
endpoint would still match the `findMany` and leak through — the URL/endpoint choice alone
isn't enough, the DB query has to enforce it too. Same principle as the permission `where` in
Step 4: don't trust the caller's framing of the request, encode the real scope into the query.

### `upsertAndReturn` (custom extension)

Single-roundtrip `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`. Detects insert vs update via
the Postgres `xmax` trick — no extra query needed.

```ts
// invite.service.ts — sendInvite
const [{ id, wasUpdated }] = await prisma.invite.upsertAndReturn({
  where:  { email: data.email },                                          // conflict key
  create: { email: data.email, token, invitedBy: inviterId, permissions: data.permissions },
  update: { token, invitedBy: inviterId, permissions: data.permissions }, // createdAt untouched — trigger owns it
  select: { id: true },
});
// wasUpdated: true = row existed (UPDATE), false = fresh row (INSERT)
```

Every model has both `createdAt` and `updatedAt` by convention — never reset `createdAt`
manually in an `update`, that's what `updatedAt` (auto-touched by the DB trigger) is for.

**Raw SQL + DB-level behavior:** `withCrud` uses raw `$queryRaw`, so JS-side Prisma features
(`@updatedAt`, `@default(cuid()/uuid())`, middleware) don't run there. All auto-behavior is
instead pushed to Postgres so raw paths get it for free:

| Need | Schema | DB mechanism |
|------|--------|--------------|
| `updatedAt` auto-touch | `@default(now())` | `set_updated_at` trigger (`prisma/functions.sql`) fires on UPDATE |
| Generated id | `@default(dbgenerated("gen_random_uuid()"))` | column DEFAULT — don't pass `id` in `create` |
| `createdAt` | `@default(now())` | column DEFAULT on INSERT |

Never use JS-side `@updatedAt` / `@default(cuid())` (see the "Raw SQL + Prisma Middleware"
rule in CLAUDE.md). Still JS-only: Prisma `$extends({ query })` middleware and nested writes don't
fire on raw paths — split into separate writes when needed.

### `findManyFts` / `countFts` — full-text search

Use `findManyFts` / `countFts` — never write raw FTS SQL in a service.

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

Setting up a new searchable field/table is a DB-level step — see Step 6 below.

`$queryRaw` is used internally by `withFts` and `withCrud`. In service code, avoid it directly.
If a complex query can't be expressed in Prisma ORM: check if `withFts` or `withCrud` already
covers it; if truly unique (e.g. `checkDbConsumption` measuring raw storage across multiple
models), use `$queryRaw` directly; if the raw query is reusable, wrap it as a custom Prisma
extension (same pattern as `withFts`) so it gets Prisma-style typed props, caching, and test
isolation.

### External calls — always proxied through the BE

The same rule as everything else in this step: never let the client reach an external API
directly. `currency.service.ts` is the plain case — no auth-sensitive secret involved, just a
public CDN, and it's still fetched server-side and cached, never called from the browser:

```ts
async function fetchCurrencyList(): Promise<Record<string, string>> {
  const res = await fetch(CDN_LIST_URL);
  if (!res.ok) throw new Error(`Currency list fetch failed: ${res.status}`);
  return res.json();
}

export const getCurrencyList = withHandler(async () => {
  const data = await cached(fetchCurrencyList, CACHE_KEYS.currency.list(), CUSTOM_TTL);
  return NextResponse.json(data);
});
```

Two reasons, both apply even when there's no secret to hide: **security** — the client never
gets a direct network path to a third party through our app, so there's no user-supplied URL or
credential it could point at something else (see the Odoo `config.url` probing case in Step 4);
**Network Transfer** — one server-side cached fetch serves every user hitting it within the TTL,
instead of every browser round-tripping to the CDN itself. `connection.service.ts`'s
Merit/Odoo drivers follow the same rule for calls that *do* carry user credentials.

---

## Step 6 — FTS DB setup (one-time per searchable table)

`findManyFts`/`countFts` only work once the table has a `search_vector` column, its GIN index,
a trigram index, and a trigger that keeps `search_vector` current. All of this lives in
`prisma/fts.sql` — run it once against the DB after `prisma db push` adds the table, and again
any time you add a new searchable table (re-running is safe, every statement uses
`IF NOT EXISTS` / `CREATE OR REPLACE`).

To add FTS to a new table, append a block to `prisma/fts.sql` following the existing pattern
(this is exactly how `User`, searched by name/email, was added alongside `FieldMapping` and
`ExportSetting`):

```sql
-- ==== <TableName> ====

ALTER TABLE "TableName"
  ADD COLUMN IF NOT EXISTS search_vector tsvector NOT NULL DEFAULT ''::tsvector;

CREATE INDEX IF NOT EXISTS "TableName_search_vector_idx"
  ON "TableName" USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS "TableName_name_trgm_idx"
  ON "TableName" USING GIN (name gin_trgm_ops);

DROP TRIGGER IF EXISTS table_name_fts_update ON "TableName";
CREATE TRIGGER table_name_fts_update
  BEFORE INSERT OR UPDATE OF name ON "TableName"
  FOR EACH ROW EXECUTE FUNCTION update_name_search_vector();

-- Backfill existing rows
UPDATE "TableName"
  SET search_vector = to_tsvector('english', COALESCE(name, ''))
  WHERE search_vector = ''::tsvector;
```

The trigger function (`update_name_search_vector`) and the `pg_trgm` extension are shared —
defined once near the top of `fts.sql`, don't redefine per table. The trigger fires
`BEFORE INSERT OR UPDATE OF name`, so `search_vector` only recomputes when `name` actually
changes, not on every column update. If a table needs more than one searched column, extend the
shared trigger function rather than writing a per-table one.

---

## Step 7 — aftermath: invalidate, then reseed

After any create/update/delete: invalidate the tags that could now be stale, then immediately
reseed the by-id cache entry with the value you already have in hand — avoids an extra DB call
on the next GET for that record.

```ts
invalidateCache(...CACHE_KEYS.mapping.invalidate(userId));
if (data.isGlobal) invalidateCache(...CACHE_KEYS.mapping.invalidateAll());
await cached(() => Promise.resolve(mapping), CACHE_KEYS.mapping.byId(userId, mapping.id));
```

- Invalidate the **narrowest** tag that covers what changed first (`mapping.invalidate(userId)`
  clears that user's lists/paged/count), then the broader one only if the mutation could affect
  other users' views (`isGlobal` toggled → also clear `invalidateAll()`).
- The reseed always uses the value already returned by `updateManyAndReturn` /
  `deleteManyAndReturn` / `create` — never a fresh `findFirst` just to populate cache.
- Delete has no reseed step — there's nothing to cache, only the invalidate calls.

---

## Step 8 — paged responses + related models

Paged list endpoints run two Prisma calls in **parallel**, never sequential. The DB-cost check
goes in the `data` branch only, see Step 5, "Cache-wrapping the DB-cost check":

```ts
const where = { OR: [{ userId }, { isGlobal: true }] };
const [data, total] = await Promise.all([
  cached(
    async () => {
      await checkUserRequestLimit(req, userId, permissions);
      return prisma.fieldMapping.findManyFts({
        freeText, userId, where,
        select: MAPPING_SELECT_PAGED,
        orderBy: { name: 'asc' },
        skip: page * pageSize,
        take: pageSize,
      });
    },
    CACHE_KEYS.mapping.paged(userId, page, pageSize, freeText),
  ),
  cached(
    () => prisma.fieldMapping.countFts({ freeText, userId, where }),
    CACHE_KEYS.mapping.count(userId, freeText),
  ),
]);

return NextResponse.json(createPaginatedResponse(data, page, pageSize, total));
```

**Related models in `_PAGED`/full selects use a light nested `select`, never a bare
`include`.** A mapping row needs its export setting's name for the list column, not the whole
row:

```ts
const MAPPING_SELECT_PAGED = {
  id: true, name: true, isGlobal: true, reportType: true,
  exportSetting: { select: { id: true, name: true } },   // light — just what the row needs
} as const;

const MAPPING_SELECT = {
  ...MAPPING_SELECT_PAGED,
  config: true,
  exportSetting: { select: { id: true, name: true, mappedValues: true, hasTotalColumn: true } }, // full, detail view only
} as const;
```

Same Network Transfer rule as top-level selects: the paged tier's relation select stays as
narrow as the list UI actually renders; the full tier widens it for the detail view.

> Never `findMany` without pagination for user-facing lists — no `getAll`. Even 1,000 rows is a
> problem. Exception: `_LIGHT` queries (id + name only) are acceptable unpaginated — low cost,
> used for dropdowns.

---

## Reference

### Error handling

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

### Data flow & route protection

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
- **Per route, in the service** — `withHandler` (auth required) vs `withPublicHandler` (auth
  optional). This is the primary mechanism — prefer it.
- **Globally, in middleware** — `authorized()` in `src/auth.config.ts` decides which paths the
  edge middleware lets through before they ever reach a route. Add a path to a public allowlist
  there to skip the sign-in redirect:

```ts
// src/auth.config.ts
authorized({ auth, request: { nextUrl } }) {
  const publicRoutes = ['/about', '/api/webhook'];
  if (publicRoutes.some(r => nextUrl.pathname.startsWith(r))) return true;
  return !!auth?.user;   // everything else requires sign-in
}
```

### Prisma relations (cool example)

Not a pattern currently used anywhere in the codebase, but worth keeping in mind — Prisma can
express complex joins as pure TypeScript. This "find similar videos" query shows how deep
relation traversal looks — no raw SQL needed:

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
