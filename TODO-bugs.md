# Bug Triage — User Testing Round

## New — Awaiting fix

### Invite send fails locally: `connect ECONNREFUSED 127.0.0.1:587`

`sendInviteEmail` tries SMTP on localhost:587 — no SMTP server running in the dev env. Either:
- Configure an SMTP host/port via env (Mailtrap / Resend / SES) and read in `src/lib/email.ts`.
- Or stub the email transport in dev: log the invite URL to console when `NODE_ENV !== 'production'`, send for real only in prod.

Lean **(b) dev stub** — keeps the invite flow testable without a live SMTP credential. Confirm preference, then I'll wire it.

---

## Fixed this pass

- **Mapping Edit href wrong** — pointed to `exportSettingById`, now `mappingById` in `MappingsPage.tsx:68`.
- **Invite send P2010 (`null value in column "id"`)** — `@default(cuid())` is Prisma-middleware-level, bypassed by `withCrud.upsertAndReturn` raw SQL. Fixed by passing explicit `id: crypto.randomUUID()` in `sendInvite` create. **Same trap will hit any future raw-SQL upsert on a model with Prisma-side default id** — consider documenting in `BackendGuide.md` next to the `@updatedAt` caveat, or auto-injecting `gen_random_uuid()` in `upsertAndReturn` when `id` is missing from `create`.

---

## Need your input before fixing

### 1. Sign-in flow — flash of unauthenticated header

**Symptom:** after submitting sign-in, homepage loads but header shows "Sign in" again until session hydrates. User has to click sign-in twice or wait.

**Root cause:** `next/navigation` push fires before Auth.js session cookie is set / before `useSession()` revalidates on the client.

**Possible fixes — pick one:**
- (a) After sign-in success, `await getSession()` (or `update()`) before `router.push('/')`. Block the button in loading state until session is real.
- (b) Show `GlobalPageLoader` over the entire app while session status is `'loading'` on first paint (root layout gate).
- (c) Use `router.refresh()` + `redirect()` from a server action instead of client push.

**Question:** which feels right? (a) is least intrusive, (b) is what your "global loading between" comment suggests. I lean (a) + a brief blocking spinner.

### 2. Header centered when logged out

Easy. Layout currently always renders left-aligned nav. When `session === null` → render header in centered mode (single brand block, no menu). **Confirm:** is there a logged-out home page design you want, or just centered brand + sign-in button?

### 3. Dashboard ArtDataTable broken

You said: "cause of new way of handling column width." Need specifics:
- Which column / which sizing mode misbehaves?
- Screenshot or repro steps?
- Was this working in commit `20571da feat(ui): rework ArtDataTable — ArtCut, pct widths, skeleton wrap`? If yes, the regression is in that commit — bisect from there.

I can fix once I know the failure mode (overflow? collapse to 0? horizontal scroll?).

### 4. "Uploaded reports" reapply → empty mapping

**Symptom:** clicking an already-mapped uploaded report to re-edit shows empty mapping.

**Your hypothesis:** mapping settings should be saved next to actual upload, not standalone.

**Architecture question** — this is a real schema decision, not a quick fix:
- Currently `FieldMapping` is a reusable template. Re-uploading loses the per-upload tweaks.
- Option A: snapshot the `FieldMapping.config` onto the upload record at apply time (denormalize).
- Option B: introduce `UploadedReport` model linking to `FieldMapping` with an override JSON.
- Option C: every apply clones the mapping into a per-upload copy.

**Need:** which direction? I'd push (A) — simplest, matches your "save near uploads" instinct, no extra model.

### 5. Row Mapping stays open when parent Mapping changes

Fix is small: on mapping selection change, close the row-mapping panel (clear selected row state in parent). No re-render needed — just `setSelectedRow(null)` in the same handler that swaps mapping. Want me to do this now? I held off because I don't know if "row mapping" is a modal, a sidebar, or inline — point me at the file.

### 6. Two different colors for one value — broken

This is the biggest one. Your proposal:
- Move colors from `FieldMapping` → `ExportSetting.mappedValueNames` (color per named category).
- `FieldMapping` row's color disabled when its display name matches a category in the linked ExportSetting.
- Dashboard gets an `ExportSetting` ComboBox to switch context.
- ComboBox option rows show the color swatch.
- Enables "Total column" to render immediately.

**This is a multi-day refactor touching:**
- Prisma schema (`ExportSetting.mappedValueNames: String[]` → `Json` with `{ name, color }[]` or new join model).
- All places reading `FieldMapping` row color (Dashboard, ExportSettings form, mapping edit).
- New dashboard ComboBox + state.
- Backend selects + caches.

**Question:** ready to commit to this? If yes, I want a separate planning session to lay out the schema migration and component changes before writing code. Don't want to start piecewise.

### 7. ExportSettings page — section markers + Total column option

Cosmetic + small feature:
- Add section headers / dividers for: name, logo, header layout, value categories.
- Add `hasTotalColumn: Boolean` to `ExportSetting`.

Easy to do — bundle with the #6 refactor since both touch `ExportSetting`. Don't want to ship them separately and re-migrate.

---

## Suggested order

1. Fix sign-in flow (#1, #2) — user-facing first impression.
2. Fix dashboard table (#3) — blocking core view, need repro.
3. Fix row mapping close-on-change (#5) — trivial once file pointed at.
4. Schema refactor (#6 + #7 + #4 if Option A) — single planned migration. Big commit, dedicated session.
