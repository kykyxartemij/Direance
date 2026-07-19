# TODO / Backlog

Working notes — not shipped docs. Move items into `docs/*Guide.md` once a pattern is settled.

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
