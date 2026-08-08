# Prisma Guide — Raw SQL & DB-level Defaults

`withCrud` extensions (`upsertAndReturn`, `deleteManyAndReturn`) use `$queryRaw` — Prisma
middleware does not run. Every auto-behavior a model relies on has to be DB-level, not
JS-side, or it silently gets skipped on those code paths.

## Never use JS-side Prisma features in schema

| What to avoid | Why | Use instead |
|---|---|---|
| `@updatedAt` | JS-side injection, skipped by `$queryRaw` | `@default(now())` — trigger in `functions.sql` handles UPDATE |
| `@default(cuid())` | JS-side, no DB DEFAULT | `@default(dbgenerated("gen_random_uuid()"))` |
| `@default(uuid())` | JS-side, no DB DEFAULT | `@default(dbgenerated("gen_random_uuid()"))` |

When you need auto-behavior that Prisma can't express via a DB-level `@default(...)`, the
solution is always a PostgreSQL function or trigger in `functions.sql` — not a JS-side
workaround.

## What works automatically with `$queryRaw`

- `@default(now())` — DB-level, applies on INSERT. Omit from `create`.
- `@default(dbgenerated("gen_random_uuid()"))` — DB-level. Do **not** pass `id` in `create`.
- All scalar defaults (`@default(false)`, `@default("pnl")`, `@default("{}")`) — DB-level.
  Omit from `create`.
- `updatedAt` — auto-set by the `set_updated_at` trigger (see `functions.sql`). Do **not**
  pass in `update`.
- `onDelete: Cascade` / `onDelete: SetNull` — DB-level FK constraints, always apply.

## Full-text search — `withFts`

`findManyFts` / `countFts` (registered via `withFts` in `src/lib/prismaFts.ts`) are the only
sanctioned way to do free-text search — never hand-roll `$queryRaw` for it in a service.

Decision tree, both methods:

| Term | Behavior |
|---|---|
| Empty | No filter — return all |
| 1–4 chars | `contains` (case-insensitive) on search columns |
| Valid UUID | Exact `id` match |
| 5+ chars | FTS (tsvector + `plainto_tsquery`) + trigram similarity |

```ts
// Search + count — FTS IDs deduped via React cache(), only one SQL query fires
// even when findManyFts and countFts are called in Promise.all. userId is read from
// getAuthOptional() internally (cache-key tagging only) — never pass it as an arg.
await prisma.model.findManyFts({ freeText, where, select, orderBy, skip, take });
await prisma.model.countFts({ freeText, where });
```

Setting up a new searchable field/table is a DB-level step: add a `search_vector
Unsupported("tsvector")?` column managed by the trigger in `prisma/fts.sql`, plus a
`gin_trgm_ops` index on the search column for trigram matching.

`$queryRaw` is used internally by `withFts` and `withCrud`. In service code, avoid it
directly — if a complex query can't be expressed in Prisma ORM, check whether `withFts` or
`withCrud` already covers it first; if truly unique (e.g. `computeUserDbConsumption`
measuring raw storage across multiple models with `pg_column_size`), use `$queryRaw`
directly; if the raw query is reusable, wrap it as a custom Prisma extension (same pattern
as `withFts`) so it gets Prisma-style typed props, caching, and test coverage like every
other model method.

## Custom `$extends` methods

Two model-extension factories live in `src/lib/`, both registered on the Prisma client via
`$extends` and both bypassing Prisma middleware because they use `$queryRaw` under the hood
(see "Never use JS-side Prisma features" above — this is why).

| Factory | File | Registers | Use for |
|---|---|---|---|
| `withFts` | `src/lib/prismaFts.ts` | `findManyFts`, `countFts` | Free-text search + paged listing |
| `withCrud` | `src/lib/prismaCrud.ts` | `upsertAndReturn` | Single-roundtrip upsert |

### `upsertAndReturn` (`withCrud`)

`INSERT ... ON CONFLICT DO UPDATE ... RETURNING` in one roundtrip — no separate `findFirst` +
`create`/`update`. Detects insert vs update via the Postgres `xmax` trick (`xmax::text::int >
0` is true only on an UPDATE), so no extra query is needed to know which happened.

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

**Still JS-only even through `withCrud`:** Prisma `$extends({ query })` middleware and nested
writes don't fire on `$queryRaw` paths — split into separate writes when the operation needs
either.

### Registering a new `$extends` factory

Follow the same shape as `withFts`/`withCrud` for any new one:
1. Take `(client: PrismaClient, ...)` as the first args — the extension needs the raw client
   to run `$queryRaw` against.
2. Return a plain object of methods (`{ methodName: (...) => ... }`) — this is what gets
   spread onto the model via `$extends`.
3. Keep it generic over `TModel` (or the specific model shape) so the factory works for any
   table it's applied to, not hand-written per model.
4. Add typed test coverage the same way the model's other Prisma calls are covered — a
   `$queryRaw`-backed method has no compile-time guarantee the raw SQL matches the schema.
