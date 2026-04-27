# Limits Guide

Two independent limit systems protect the app: **rate limiting** (request frequency) and **storage limits** (DB size per user).

---

## Rate Limiting

### How it works

Every mutating endpoint calls `checkUserRequestLimit` before doing any work. It checks three counters:

| Counter | Limit | Window | Bypass |
|---------|-------|--------|--------|
| Per user | 5 req/min | 1 min | `IS_ADMIN`, `NO_DB_REQUEST_LIMITS` |
| Per IP | 20 req/min | 1 min | `IS_ADMIN`, `NO_DB_REQUEST_LIMITS` |
| Global | 200 req/min | 1 min | nobody |

Login attempts use a separate `checkLoginRate` check: 3 attempts per email per 5 minutes.

### Storage

Counters live in the `RateLimit` Postgres table — one row per unique key (`user:<id>`, `ip:<addr>`, `global`, `login:<email>`). Each row is ~50 bytes. With 100 users the table stays under 50 KB.

### Why Postgres (not in-memory)

Vercel deploys serverless functions. Each cold start gets a fresh in-memory state — a `Map`-based counter resets on every new instance. Postgres is shared across all instances, so limits are enforced correctly regardless of how many Vercel lambdas are running.

### Setup — run once after `prisma db push`

The `check_rate_limit()` Postgres function must be created manually (Prisma schema manages tables, not functions). Run `prisma/functions.sql` against your Neon database once:

```bash
# Using psql with your Neon connection string
psql "$DATABASE_URL" -f prisma/functions.sql
```

Re-running is safe (`CREATE OR REPLACE`).

### Usage

```ts
// Every mutating endpoint — after requireAuth(), before work
const { userId, permissions } = await requireAuth();
await checkUserRequestLimit(req, userId, permissions);

// Login — inside Credentials authorize()
if (!await checkLoginRate(email)) return null;
```

### Limits config

Edit `RATE_LIMITS` in `src/lib/rateLimiter.ts`:

```ts
export const RATE_LIMITS = {
  user_ops:       { max: 5,   windowMs: 60_000 },
  ip_ops:         { max: 20,  windowMs: 60_000 },
  global_ops:     { max: 200, windowMs: 60_000 },
  login_attempts: { max: 3,   windowMs: 5 * 60_000 },
};
```

---

## Storage Limits

### How it works

Every CREATE and UPDATE endpoint calls `checkUserDbLimits` to ensure the user's total stored data stays within budget.

**Budget: 1 MB per user** (shown in error messages)  
**Internal threshold: 0.95 MB** — a hidden 5% buffer prevents users from reaching 100% and then being blocked from making any edits (e.g. uploading a logo at 99.9% capacity).

### What is measured

A single Postgres query sums all user-owned content:

```
FieldMapping.config (JSON text)
+ ExportSetting.logoData (binary bytes)
+ ExportSetting.headerLayout (JSON text)
```

### Bypass

Users with `NO_DB_SIZE_LIMITS` permission skip both the rate limit bypass and the storage check. Useful for admin/test accounts.

### Usage

```ts
// CREATE and UPDATE endpoints — after checkUserRequestLimit
await checkUserDbLimits(userId, permissions);

// DELETE — skip (storage only decreases)
```

### Neon free tier impact

The `checkUserDbLimits` query uses `octet_length()` sums — one raw SQL call per mutation. On an already-awake Neon instance this adds ~5–10ms. Contribution to the 100 CU-hours/month free tier budget is negligible (under 5 minutes/month for typical traffic).
