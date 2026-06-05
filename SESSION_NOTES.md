# Session Notes — 2026-06-06

## What we built

Solved: `withCrud` / `withFts` use `$queryRaw`, bypassing Prisma middleware → JS-side defaults never fire.

---

## Rule: never use JS-side Prisma in schema

| Avoid | Reason | Use instead |
|---|---|---|
| `@default(cuid())` | JS-side, no DB DEFAULT | `@default(dbgenerated("gen_random_uuid()"))` |
| `@default(uuid())` | JS-side, no DB DEFAULT | `@default(dbgenerated("gen_random_uuid()"))` |
| `@updatedAt` | JS-side middleware injection | `@default(now())` + DB trigger (see functions.sql) |

`gen_random_uuid()` is built into PostgreSQL 13+ — no extension needed.
Columns stay `TEXT` (not `@db.Uuid`) — avoid FK cascade type changes from existing cuid data.
Already documented in `CLAUDE.md` under "Raw SQL + Prisma Middleware".

---

## Schema files changed

- `prisma/schema/invite.prisma` — `@default(cuid())` → dbgenerated, `@updatedAt` → `@default(now())`, added `updatedAt DateTime @default(now())`
- `prisma/schema/user.prisma` — same
- `prisma/schema/logo.prisma` — `@default(uuid())` → dbgenerated
- `prisma/schema/export-setting.prisma` — dbgenerated + added `@@index([userId])`
- `prisma/schema/field-mapping.prisma` — dbgenerated + added `@@index([userId])`
- `prisma/schema/auth.prisma` — Account + Session `@updatedAt` → `@default(now())`
- `prisma/schema/connection.prisma` — dbgenerated

---

## functions.sql — auto-discovery trigger

Replaced 7 individual `CREATE TRIGGER` statements with one DO block.
Scans `information_schema.columns` for any table with `updatedAt` column → creates `BEFORE UPDATE` trigger automatically.
Re-run after `prisma db push` to pick up new tables. Zero maintenance.

```sql
DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updatedAt' AND table_schema = 'public'
  LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      tbl || '_updated_at', tbl
    );
  END LOOP;
END;
$$;
```

---

## New file: src/lib/prismaLazyCleanup.ts

TTL cleanup + limit enforcement + Vercel Cron registry. Register once in `prisma.ts` — no boilerplate at call sites.

**Methods:**
- `cleanupExpired()` — single CTE, deletes expired, returns count
- `assertLimit()` — cleanup + count + throw 429 if >= limit
- `findFirstWithCleanup({ where, select? })` — CTE: DELETE expired + SELECT valid, one DB call
- `findManyWithCleanup({ where, select?, orderBy?, take?, skip? })` — same

**Key trick:** PostgreSQL CTE sees pre-DELETE snapshot. Fixed by automatically adding `AND NOT (expiredWhere)` to SELECT — expired rows excluded even from snapshot.

**Cron registry:** `withLazyCleanup` auto-pushes `cleanupExpired` to module-level `cronRegistry[]`.
`runAllCleanups()` exported — Vercel Cron imports it to sweep all registered tables in one daily call.

**Registration in prisma.ts:**
```ts
invite: {
  ...withCrud<InviteModel>(base, '"Invite"'),
  ...withLazyCleanup<InviteModel>(base, '"Invite"', {
    ttl:                  { field: 'createdAt', ms: 14 * 24 * 60 * 60 * 1000 },
    limit:                50,
    limitExceededMessage: 'Too many invites sent. Please try again later, after some invitations expire.',
  }),
},
```

**Call site (service) — zero TTL/limit boilerplate:**
```ts
await prisma.invite.assertLimit();   // replaces checkInviteLimits()

const invite = await prisma.invite.findFirstWithCleanup({
  where:  { token },
  select: { id: true, email: true, invitedBy: true, permissions: true },
});
```

---

## src/lib/prismaCrud.ts — SimpleWhere extended

Added `ComparisonOp` with `lt`, `lte`, `gt`, `gte`, `not`, `in` — same names as Prisma native.
`buildWhere` and `buildReturning` exported (used by `prismaLazyCleanup.ts`).

---

## invite.service.ts refactored

- `checkInviteLimits()` → deleted, replaced by `await prisma.invite.assertLimit()` in `sendInvite`
- `cleanupExpiredInvites()` → deleted, now internal to `withLazyCleanup`
- `INVITE_TTL_MS` constant → removed (baked into `prisma.ts` config)
- `fetchValidInvite` → uses `findFirstWithCleanup`, no TTL at call site

---

## New file: src/app/api/cron/cleanup/route.ts

```ts
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return 401;
  void prisma; // ensures withLazyCleanup registrations run
  const deleted = await runAllCleanups();
  return NextResponse.json({ deleted });
}
```

---

## New file: vercel.json

```json
{ "crons": [{ "path": "/api/cron/cleanup", "schedule": "0 3 * * *" }] }
```

---

## TODO before shipping

1. `prisma db push` — applies schema changes
2. Re-run `prisma/functions.sql` — creates auto-discovery triggers
3. Add `CRON_SECRET` to Vercel env vars (project settings → Environment Variables)
4. If adding lazy cleanup to other models → same pattern in `prisma.ts`, nothing else needed
