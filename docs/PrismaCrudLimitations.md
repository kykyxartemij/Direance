# prismaCrud limitations + future fix

## ==== What works ====

Prisma **native** methods — `create`, `update`, `updateManyAndReturn`, `delete`,
`deleteMany`, `findMany`, etc. — go through the Query Engine and respect:

- `@default(uuid())`, `@default(now())`, `@default("...")`
- `@updatedAt`
- Prisma middleware (`$extends({ query: ... })`)
- Nested writes (`create: { related: { ... } }`)
- Type-safe `select`/`include`

## ==== What does NOT work ====

Custom `withCrud` helpers in `src/lib/prismaCrud.ts` use raw `$queryRaw`:

| Method | Status |
|---|---|
| `upsertAndReturn`     | Custom raw SQL — Prisma middleware bypassed |
| `deleteManyAndReturn` | Custom raw SQL — Prisma middleware bypassed |

Consequences when used:

- `@updatedAt` does NOT auto-update — caller must pass `{ updatedAt: new Date() }` explicitly
- `@default(uuid())` does NOT fire on INSERT through `upsertAndReturn` — caller must `crypto.randomUUID()`
- `@default(now())` for `createdAt` DOES fire (DB-level default, applied by Postgres)
- Cascades (`onDelete: Cascade`) DO fire (DB-level FK constraints)
- Prisma `$extends({ query })` middleware is skipped entirely

Why we wrote them: Prisma had no `upsert ... RETURNING` until v7 (still no
single-call `wasUpdated` discriminator), and `deleteMany` doesn't return rows.

## ==== What still works under raw helpers ====

These are DB-level, not Prisma-level, so raw `$queryRaw` triggers them fine:

- `@default(now())` on `createdAt` — Postgres column default
- `onDelete: Cascade`, `onDelete: SetNull` — FK constraint actions
- `onUpdate: Cascade` — FK constraint actions
- `@unique`, composite `@@unique`, `@@index` — DB indexes
- CHECK constraints, NOT NULL constraints
- Any `@db.*` type override

## ==== Proposed direction — push Prisma-side behavior to Postgres ====

Move every Prisma-managed behavior into the DB itself so raw SQL works
correctly without parallel JS bookkeeping. Each is a one-time SQL block
per model, lives in `prisma/*.sql`, idempotent (`IF NOT EXISTS` /
`CREATE OR REPLACE`).

```sql
-- @default(uuid()) — let Postgres generate ids
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE "Connection"
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- @updatedAt — touch on every UPDATE
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW."updatedAt" := NOW(); RETURN NEW; END $$;

CREATE TRIGGER connection_touch BEFORE UPDATE ON "Connection"
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
```

To keep Prisma honest, mirror in schema so `prisma db push` doesn't fight us:

```prisma
id        String   @id @default(dbgenerated("gen_random_uuid()::text"))
updatedAt DateTime @default(now())   // trigger keeps it fresh
```

### What still needs JS care after this

- **Prisma middleware** (`$extends({ query })`) — anything in JS-side hooks won't
  fire for raw paths. We don't currently use this beyond `withFts` (already
  pre-computes via separate query), so no impact yet.
- **Nested writes** — raw `INSERT … RETURNING` can't `create: { related: {...} }`
  in one call. Caller does two writes when needed.

### Cost

- Trigger overhead: microseconds per UPDATE — unmeasurable at our scale
- Schema discipline: every new model with `@updatedAt` needs the trigger added
  to its `*.sql` companion file (one line)
- Network/storage: zero impact — same bytes flow, same rows

### Win

- Raw helpers stay single-query, work correctly with `@default`/`@updatedAt`
- Cascades, defaults, indexes, FKs all already work — extends the same DB-as-truth model
- New raw helpers we write later (e.g. `insertAndReturn` with `RETURNING`) inherit correct behavior for free

## ==== Until then (current state) ====

- Connection uses native `prisma.connection.updateManyAndReturn` + `deleteMany` —
  both native, work fully. No raw helpers needed for this model.
- Invite + FieldMapping continue with their existing raw helpers; pass
  `createdAt` / `updatedAt` explicitly where needed (already done).
- When next adding a model that wants raw + `@default(uuid())` / `@updatedAt`,
  apply the DB-trigger block above and add to `prisma/*.sql`.
