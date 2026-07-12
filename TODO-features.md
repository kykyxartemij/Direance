# Feature TODOs

## Check and test Odoo

Verify Odoo connection flow end-to-end: auth, fetch, field mapping.

---

## Profile Page

### 1. Name / profile fields — PATCH
- Field(s): display name, other basic info
- `PATCH /api/user/profile` → update name etc.

### 2. Email change — POST
- `POST /api/user/email` → send verification email, confirm on click
- Guard: require current password before accepting new email

### 3. Password change — POST
- `POST /api/user/password` → require current + new + confirm
- FE-only `confirmPassword` field (never in models)

### 4. Avatar — SVG layers
- DB: store indices, not SVG. Example columns: `avatarBody`, `avatarHat`, `avatarVariant` (integers)
- Render: compose SVG layers client-side from indices (`body=goblin`, `hat=cap`, `variant=neutral`)
- `PATCH /api/user/avatar` → update indices

### 5. Logo management — full CRUD inside Profile
- `POST /api/logos` — create logo
- `DELETE /api/logos/[id]` — delete logo
- List + preview inside profile page
- One hook per route (`useCreateLogo`, `useDeleteLogo`, `useLogos`)

---

## Global Mappings — real source data needed

Before seed script can be written, need actual Excel/API output samples to extract real source row names:

- **Merit Eesti → Merit English** (P&L + Financial Position) — need Estonian Merit export
- **Merit Poland → Merit English** (P&L + Financial Position) — need Polish Merit export  
- **Odoo → Merit English** — need real `account.move.line` sample (fields: date, account_id, name, debit, credit, balance, journal_id, partner_id)
- **mb others** — TBD once above samples reviewed

Once real field names are confirmed → write seed script below.

---

## Auto-generate Global Mappings — seed script

Write a script (e.g. `scripts/seed-global-mappings.ts`) that inserts the standard set of global mappings into the DB.

- Run via `npx tsx scripts/seed-global-mappings.ts` (or `ts-node`)
- Idempotent: upsert, not insert — safe to re-run
- Scope: global mappings only (not per-user/per-connection)
- No hardcoded env — reads `DATABASE_URL` from `.env` via existing Prisma client
