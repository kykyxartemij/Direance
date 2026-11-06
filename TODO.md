# TODO / Backlog

Working notes — not shipped docs. Move items into `docs/*Guide.md` once a pattern is settled.

---

# Roadmap (2026-11-02)

Priority order. Older sections below stay as detail for their own topics.

## 1. Fix now

- [ ] **Merged report table (see report with one connection + one upload).** Uploaded file shows its header as a data row (`Description | Period 1`), its column is labelled `Column 3`, and its subtotals show `0`. Cause not checked yet: start with the mapping's `headerRow` and formula cells without saved values.
- [ ] **Snackbar grouping.** `enqueue` matches any active snackbar, so `n1, n2, n1` becomes `n1 x2, n2`. Compare only with the newest one: `n1, n1, n2` gives `n1 x2, n2`, and `n1, n2, n1` stays three.
- [ ] **Periods input fetches on each keystroke and arrow click.** Commit on blur/Enter or debounce, same idea as `ArtDatePicker`.
- [ ] **Spinner on cached pages.** Opening a page cached by Next and TanStack still shows the loader. Find which boundary fires, and use one spinner path through `ArtPage`.

## 2. Remove unused code (first big task)

- [ ] Find unused props and boolean flags with large branches that do nothing. React Doctor misses these: it tracks unused files and exports, not unused props or dead branches.
- [ ] Go through Art components first (`ArtPagination` already has a TODO about unused features).
- [ ] Review AI-written code flagged by TODO comments: `applyMapping.ts`, `SaveMappingDialog.tsx`, `ExcelViewer.tsx` ("isn't working right").

## 3. Account and invites

- [ ] Change password: current + new + confirm. `confirmPassword` is FE-only, never in models.
- [ ] Change name and other basic info. `PATCH /api/user/me` is soft-removed, `patchMe`/`useUpdateUser` are kept.
- [ ] Change email: require current password, confirm by email.
- [ ] Remember me on sign-in: session cookie without it, 30-day JWT with it.
- [ ] Delete own account (danger zone on Profile).
- [ ] Delete users. Decide what happens to their connections and mappings (Prisma cascades today).
- [ ] Password reset by email.
- [ ] Show who each invite was sent to.
- [ ] New permission to see emails. Invite list and user list both depend on it.
- [ ] Invite resend cooldown. `sendInvite` upserts and sends again with no wait, so one address can be spammed.
- [ ] Revoking permissions takes effect at once (JWT keeps them until next sign-in).
- [ ] Google/GitHub login. Adapter and `Account` table are kept, sign-up must stay invite-only.
- [ ] Avatar system, reusable across projects: `{ bg, body, hat, ... }` as numbers in DB, SVG layers composed on FE, or the auth provider's picture.

## Security and state

- [ ] Stale sessions: permissions live in the JWT, so a revoked or deleted user stays valid until it expires. Add `sessionVersion` on `User`, check it through `cached()` in `requireAuth`, and clear that key on permission change or delete. Credentials login needs JWT, so database sessions aren't a drop-in.
- [ ] Shorter session `maxAge` (Auth.js default is 30 days). Pair with Remember me.
- [ ] Add `checkUserRequestLimit` to `testPnlConnection` and `testFinancialPositionConnection`: they call external APIs with no limit.
- [ ] Odoo URL is user input the server calls. Allow `https` only and block private/internal addresses.
- [ ] Store invite tokens hashed, so a DB leak can't accept invites.
- [ ] Move connection secrets from pgcrypto to app-level AES-256-GCM (`src/lib/crypto.ts`), so the key never travels to the DB. Needs a one-time re-encrypt and a key version for rotation.
- [ ] Replace manual loading `useState` with TanStack state, e.g. `exporting` in `ExportDialog` becomes `useMutation` + `isPending`.

## 4. Data table and filters

- [ ] Rebuild `ArtDataTable` from scratch. Problems: sticky columns, loading, sizing, developer experience, poor layout on the report page.
- [ ] Link it with `useUrlFilters`, BE pagination helpers and TanStack hooks, so a paged list needs little wiring.
- [ ] Decide whether to adopt an existing table helper such as TanStack Table before writing our own.
- [ ] More BE filters (see "Advanced filters for paged endpoints" below).

## 5. Report data model

- [ ] One report shape in the provider:
  - `OriginalExcelFile`
  - `ExtractedExcelFile`
  - `Mapping` (full copy, so manual overrides work)
  - `Connection` (if any)
  - `FinalView` (what the UI shows)
- [ ] "Include original sheets" uses `OriginalExcelFile`.
- [ ] Uploaded reports keep a mapping snapshot: edits show only after re-applying. Fix with this model.
- [ ] Combined reports lose `totalColumns`, so Excel export has values but no `SUM` formulas.
- [ ] Row Mappings "Sum columns" shows no chips when `valueColumns` is empty.
- [ ] Decide on `/api/report/upload`. Files are already parsed in the browser, and no client code calls this route.
- [ ] Find other expensive BE logic that can move to FE (export, mapping, connection).
- [ ] Test export end to end. Older note: if it can't be made reliable, hide it in FE.
- [ ] Global mappings for Merit Poland and Odoo, made with `create-mapping-from-connection`. Needs a real connection for each.
- [ ] Delete orphaned "Merit.ee — P&L" and "Merit.ee — Financial Position" rows from `FieldMapping`, if still in DB.
- [ ] Check `ConnectionFormPage` reportType field (Controller + ArtSelect) shows validation the same way as `ArtFormSelect`.

## 6. Design

- [ ] Theme: dark, white, pink contrast. Docs say dark-only, but `theme-light`/`theme-contrast` CSS and switching code still exist: restore or remove them.
- [ ] `helperText` and description styling for inputs.
- [ ] One loading pattern: when to use `ArtSkeleton`, spinner, blur. Apply everywhere, then write it in `docs/InstantNavigationAndLoadingState.md`.
- [ ] Remove Tailwind from the Art library only; pages keep it for layout. Left: about 30 utilities inside Art components, 54 `@apply` rules, and `tailwind-merge` in `cn` (use plain `clsx`). Art needs its own CSS reset so it works without Tailwind.
- [ ] Replace remaining `style={{ }}` in feature code that isn't a runtime value.

## Component folders (current thoughts, not final)

Rename `components/ui` to `components/art`. One folder = one `/ui` showcase group. Keep code next to what uses it.

```
components/
  art/
    art.style.css  art.types.ts  art.utils.ts   only truly shared, no core/ folder
    stupid/     Text, Row, Stack, Grid, Card, Divider, Title, Badge, art.layout
    icons/      Icon, IconButton, IconToggle, IconCycle, CopyButton, svg/
    controls/   Button, ButtonRow, Tabs, Switch, Checkbox, Radio, Slider, Collapse
    form/       Input + useArtDebounced, Textarea, DatePicker, Upload, Label, HelperText, Form, ArtForm* wrappers
    select/     ComboBox, Select, Listbox
    portal/     Tooltip, Popover, Menu, useAnchoredPanel, tooltip singleton
    providers/  Dialog, Snackbar + useLazyValue
    data/       Data, DataTable, DataFilters, Pagination, EmptyState, Cut
    image/      Image, later Avatar
    loading/    Skeleton, Progress, LoadingBar
    page/       ArtPage, ArtErrorBoundary
  permission/   PermissionPage, PermissionGuard, PermissionBadge, permissionMeta
  FSLink.tsx  GlobalMutationSnackbar.tsx
```

- [ ] Decide where non-Art loaders go (`PageLoader`, `PageLoaderBlur`, `GlobalLoader`, `GlobalLoaderBlur`, `LoaderRingDots`, `useDebouncedActive`). Loading code belongs together, but Art and non-Art components must stay separate.
- [ ] Remove `art.hooks.ts`: each hook moves next to its only user.
- [ ] Merge or rename the two `ArtForm` files. `MappingStep` uses `ui/ArtForm.tsx`, the rest use `form/ArtForm.tsx`.
- [ ] Delete `computeAnchoredPos`, it has no callers.
- [ ] Move `ApiError` out of `ArtSnackbar`, so `art/` imports nothing from outside itself.
- [ ] Split `art.style.css` per folder during Tailwind removal.
- [ ] Do the move as one commit with no logic changes, then update `/ui` groups and the guide.

## Art component rules (current thoughts, not final)

- **Field** (takes a value): `label`, `helperText`, `errorText`, `required`, `disabled`, `readOnly`, `size`, `color`, and `ref` to its focusable element. Without `ref`, react-hook-form can't focus and scroll to the first invalid field. `ArtFormListbox` still has none.
- **Action** (clicked): `variant`, `color`, `size`, `disabled`, `loading`.
- **Display** (read only): `color`, plus `size` or `variant` where they change the look.
- **Layout**: spacing props only.
- `size` is `sm | md | lg`, `color` is `ArtColor`, `variant` is `default | outlined | ghost`.
- `disabled`: dimmed, skipped by Tab. `readOnly`: normal look, can focus and copy, can't change.
- [ ] Decide whether `errorText` replaces helper text while an error shows.
- [ ] Props required by a type stay with no caller; any other prop needs a real caller.
- [ ] Fill gaps: `ArtDatePicker`, `ArtRadio`, `ArtSlider`, `ArtTextarea` `size`, `ArtUpload` (`color`, and restore `readOnly` and `errorText`).

## 7. Hooks and performance

- [ ] Every mutation hook tells the user what happened (`meta` success/error messages).
- [ ] Measure re-renders with React DevTools Profiler, fix the worst first. Start with the data table and report page.

## 8. Pages

- [ ] Welcome page: greeting plus how to use the app (connect, map, view, export).
- [ ] Remove the Upload file page. Instead, a file dropped anywhere in the app loads automatically. Show a snackbar for invalid file types.
- [ ] Dashboard summary cards (revenue, profit) with a company selector.
- [ ] Add `error.tsx`/`global-error.tsx`. `ArtPage` only catches page content: a crash in Navbar, ReportSidebar or sign-in shows Next's default error screen.
- [ ] Stats: Vercel bandwidth and other service health. Check first whether Vercel's API exposes usage on our plan.

## 9. Before real launch

- [ ] Custom domain, blocked on EU.org approval. Steps: `DOMAIN_SETUP.md`.
- [ ] Make repo private. `COLLECTION_OF_MEMORY.md` is deleted but stays readable in git history while the repo is public.
- [ ] Check Vercel plan: Hobby doesn't allow commercial use.
- [ ] Content Security Policy headers in `next.config.ts`.
- [ ] Confirm production `DATABASE_URL` uses Neon's pooled connection.
- [ ] Full `npm run build` and `npx react-doctor` after recent work: only per-file `tsc` and `eslint` ran.
- [ ] Final docs: enough to rebuild the stack from `docs/` alone.
- [ ] Run `crypto.sql`, `functions.sql`, `fts.sql` on production DB and set `IS_ADMIN`, if not done.
- [ ] Odoo connection end to end: auth, fetch, field mapping.

---

## `parseFiltersFromUrl` — needs human review

**AI-written, not yet reviewed by a human.** Added in `src/models/index.ts` to replace unchecked `searchParams.get(x) as T` casts in services (first use: `MappingFilterValidator` in `getPagedMappings`). Mirrors `parsePaginationFromUrl`'s parse-at-the-boundary pattern — yup-validates arbitrary list filters instead of trusting raw query params.

- [ ] Author has further improvements in mind for this helper, not detailed yet — revisit before adopting it for more filters beyond `MappingFilterModel`
- [ ] Confirm the generic signature (`<S extends yup.ObjectSchema<yup.AnyObject>>`) is the right shape long-term, not just what satisfied the type-checker today

---

## API error handling — auto FE error reader

Already exists: `enqueueError(err: ApiError | Error | string, title?)` in `ArtSnackbar.tsx` reads `.message` off the caught error. BE already writes a real user-facing string into `ApiError.message` (see `handleApiError`), so most call sites don't need a custom title at all — `enqueueError(err)` alone is usually enough.

- [x] Reader/parser exists (`ApiError` class + `enqueueError`) — no new central parser needed
- [ ] Sweep call sites currently doing `onError: (err) => enqueueError(err, 'Failed to X')` — drop the redundant custom title where BE's own message already reads fine standalone

## TanStack mutation snackbar meta — DONE

Implemented via `src/components/GlobalMutationSnackbar.tsx`, mounted in `layout.tsx` next to `GlobalLoadingOverlay`. Subscribes to `queryClient.getMutationCache()`, fires `ArtSnackbar` off `mutation.meta`:

```ts
useSaveThing({ meta: { successMessage: 'Saved', errorMessage: true } })
```

- `errorMessage`: `boolean | string`, default `false`. `true` → auto-uses the caught `ApiError`'s own message. `string` → custom title.
- `successMessage`: `string` only, default unset (no toast). No inherent BE text for success, so always explicit.
- Set at the **call site**, never inside the hook body — the same hook gets reused across pages with different messaging needs.
- **Migration done**: every hook that used to call `useArtSnackbar()` internally (`connection.hooks.ts`, `invite.hooks.ts`) and every component doing manual `onSuccess`/`onError` → `enqueueSuccess`/`enqueueError` with a *static* message (`ProfilePage`, `ConnectionFormPage`, `ExportSettingsFormPage`, `ReportSidebar`'s `ConnectionRow`) now uses `meta` instead. Chosen over the old embedded pattern because it's one `mutationCache.subscribe()` app-wide vs. N `useArtSnackbar()` context reads (one per hook) — strictly cheaper, and unblocks call-site-specific messaging.
- Call sites with genuinely **dynamic** message content (needs runtime data the hook can't see, e.g. `` `Invite sent to ${data.email}` ``, or `` `Failed to ${load ? 'load' : 'remove'} connection` `` in `ReportSidebar`) correctly keep manual `enqueueSuccess`/`enqueueError` — `meta` only fits messages known at hook-call time.
- `docs/TanStackMutationGuide.md` updated to describe this pattern (old "Hook owns error reporting" section replaced).

## Hook option typing + `enabled` consistency

Every query/mutation hook should fully type its `options` param so TS can help, and so callers can pass `enabled` (a stock react-query option) without any custom contract:

```ts
options?: Omit<UseQueryOptions<Model, ApiError>, 'queryKey' | 'queryFn'>
options?: Omit<UseMutationOptions<TOutput, ApiError, TInput>, 'mutationFn'>
```

`enabled: !!x` inline at the call site is correct react-query usage, not a smell — no special "when to fetch" contract needed on top. The actual bug class (e.g. `MappingEditForm` fetching export settings before a mapping is confirmed) comes from hooks either not accepting `options` at all, or call sites not passing `enabled` when they should — same root cause as the typing gap below.

- [ ] Audit all hooks in `src/hooks/*.hooks.ts` for the full generic `options` shape — some are missing it entirely or partially
- [ ] Fix `useCurrentUser` and similar first (referenced as example)
- [ ] Audit call sites for premature fetches (start with `MappingEditForm` → export settings) and add `enabled` gating where missing

## Query vs Mutation convention

Currently inconsistent — causing real bugs (e.g. `react-doctor/query-mutation-missing-invalidation` on `useTestFinancialPositionConnection`, a call with no cache effect, doesn't even need mutation semantics maybe).

- [ ] Write down convention: when a hook should be `useQuery` vs `useMutation`
- [ ] Audit existing hooks against it, fix mismatches + missing invalidations

## FE must not import BE-only lib types directly — DONE

The `models/*.models.ts` folder is the shared BE↔FE contract: BE responses are shaped to
match a model, FE relies only on that model — not on Prisma-generated types or
server-only lib internals. Swept the whole codebase (`src/hooks`, `src/page`, `src/app`)
for FE code importing types from `@/lib/*` or `generated/prisma` directly. Found exactly
one offender: `src/hooks/user.hooks.ts` imported `DbConsumption` from `@/lib/userLimits.ts`
(an `import 'server-only'` file) and re-exported it — everything else already went
through `models/`.

- [x] Grepped `@/lib/` imports across `src/hooks`, `src/page`, `src/app` for server-only leaks — only `DbConsumption` qualified (`@/lib/permissions`, `@/lib/hrefUrl` etc. are legitimately shared isomorphic utils, not BE response models)
- [x] Moved `DbConsumption` into `src/models/user.models.ts` (alongside `UserModel` — same file already mixes response shape + request validators, matching existing convention)
- [x] `src/lib/userLimits.ts` now imports the type from `models/` instead of defining it
- [x] `src/hooks/user.hooks.ts` imports directly from `models/`, dropped the re-export

## `useUrlFilters.ts` — DONE (kept + wired up)

Was fully built but orphaned — zero call sites, only referenced in `ArtData`/`ArtDataFilters` doc-comments as an example. All 4 paged-list pages (`ConnectionsListPage`, `ExportSettingsListPage`, `MappingsPage`, `UsersSection`) were duplicating the same `useState(page)` + `useState(freeText)` + `handleSearch` reset-to-page-1 boilerplate the hook exists to replace.

- [x] Kept — not dead code, just unwired. Purpose confirmed: URL is the source of truth for page/search, survives refresh, shareable/bookmarkable, drives back/forward.
- [x] **Not moved** into a new `ArtData/` folder — checked `src/components/ui/`, it's entirely flat (no subfolders anywhere, not even for the existing 4-file `ArtData`/`ArtDataFilters`/`ArtDataTable`/`artData.utils` cluster). Also `useUrlFilters` renders nothing — it's page-orchestration state, same category as everything already in `src/hooks/`, not an Art-library primitive. Left in place.
- [x] Wired into all 4 list pages via `dataProps` (the hook already exposed this — `{ page, onPageChange, onSearch, activeFilterCount }` spreads straight into `<ArtData {...dataProps} />`, no per-page glue needed beyond `const { page, search, dataProps } = useUrlFilters([])`)
- [x] `UsersSection` also has a `pageSize` selector `useUrlFilters` doesn't manage — left as local `useState`, reset to page 1 via the hook's own `setPage(1)` on size change. (Possible future extension: add `pageSize` as a managed URL key too — not done here, scope was the existing page/search duplication.)

## Blur-while-loading pattern

General pattern needed: show blurred screen on first fetch, swap in real UI once loaded (not a full loader swap).

Scope it with `<Suspense>` — blur only the part of the page waiting on BE data, not the whole
page/service. Boundary goes around the fetching sub-tree, not the page root, so unrelated
parts of the page stay interactive while one section loads.

- [ ] Define general helper/pattern for this (where should it live — Art lib? per-feature?) — likely a small wrapper component pairing `<Suspense fallback={...}>` with a blur overlay, not a full-page loader
- [ ] Apply to `ReportProvider`: blur while first-time fetching `Connection`, unblur once loaded — should only blur the `Connection`-dependent section, not the whole report page

## Use `ArtDivider` more

- [ ] Sweep forms for manual "or"-style dividers / hand-rolled `<hr>` pairs, replace with `ArtDivider`

## Advanced filters for paged endpoints

- [ ] User: search/filter by permissions
- [ ] Mapping: filter by type
- [ ] Export settings: filter by "contains logo", etc.

## Minor: raw SQL CRUD extension naming

Low priority.

- [ ] Switch single-record update endpoints from `updateManyAndReturn` to a new `updateAndReturn` (more logical for single-row updates)
- [ ] Add analogous `deleteAndReturn` custom extension (currently only `deleteManyAndReturn` exists)
