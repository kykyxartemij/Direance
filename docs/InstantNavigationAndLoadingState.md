# Instant Navigation & Loading State

Users see chrome (title, actions, nav) instantly. Data arrives after. No blank page, no
full-page spinner on navigation.

---

## Page structure — `ArtPage`, one file

A content route is **one** `page.tsx` with `<ArtPage>` as its root — no sibling `layout.tsx`,
no sibling `loading.tsx`. `ArtPage` owns chrome, the Suspense boundary, and the error fallback.

```
app/mappings/[id]/
  page.tsx          ← metadata + <ArtPage> + feature component

page/mappings/
  MappingFormPage.tsx   ← useQuery, gates on isLoading
```

**page.tsx** — static metadata, `ArtPage` as the root element:

```tsx
import type { Metadata } from 'next';
import ArtPage from '@/components/ArtPage';
import { MappingFormEdit } from '@/page/mappings/MappingFormPage';

export const metadata: Metadata = { title: 'Mapping Detail' };

export default function Page() {
  return (
    <ArtPage title="Mapping Detail">
      <MappingFormEdit />
    </ArtPage>
  );
}
```

`ArtPage` props: `title`, `description?`, `actions?` (page-level buttons), `maxWidth?`
(`'2xl' | '5xl' | '7xl'`, default `5xl`), `className?`.

Enforced by the `local/require-art-page` ESLint rule: a `page.tsx` whose root isn't
`<ArtPage>` fails lint.

### The three exceptions

Each is a route that isn't an `ArtPage`-shaped header+content page. Each carries an explicit
`/* eslint-disable local/require-art-page */` plus a `// NOTE:` saying why — never a silent
disable. Don't add a fourth without the same treatment.

| Route | Why not `ArtPage` | Chrome / loading from |
|---|---|---|
| `app/layout.tsx` | root layout — providers, `Navbar`, `ReportSidebar`, `GlobalLoaderBlur`, `GlobalMutationSnackbar` | itself |
| `app/auth/**` | centered card, no header/actions chrome | `app/auth/layout.tsx` + `AuthFormLayout`; `loading.tsx` → `GlobalLoader` |
| `app/admin/**` | parallel routes — `page.tsx` is an empty shell, `@stats`/`@users` slots compose in `admin/layout.tsx` (an `ArtPage` there would nest a second max-width container) | slot `layout.tsx`; slot `loading.tsx` → `GlobalLoader` |

So `loading.tsx` still exists — but only for routes with **no** `ArtPage` above them. If a
route renders `ArtPage`, its loading story is `ArtPage` + the gates below, never a
`loading.tsx`.

(`app/ui/**` is the Art component showcase/dev page — exempt from this convention entirely,
lint-dirty by design.)

### What the Suspense boundary in `ArtPage` is for

It is a **safety net**, not a data-loading mechanism. It covers `useSearchParams` (which
suspends during prerender) and any lazy child. It is **not** a licence for
`useSuspenseQuery`.

---

## Never `useSuspenseQuery`

Always `useQuery`. The component that owns the fetch owns its loading state.

`useSuspenseQuery` re-suspends the whole subtree on refetch (blanking rendered UI), can't be
`enabled`-gated, and moves loading state somewhere the component can't control. It buys
nothing here.

```tsx
// ✅ the only way
const { data, isLoading } = useGetMappingById(id);
if (isLoading || !data) return <PageLoader />;
return <MappingForm mapping={data} />;
```

---

## The four loading states

| Case | What to use |
|---|---|
| First load, whole page is useless without the data | gate → `<PageLoader />` |
| First load, component can render its own shape | pass `loading` prop (component renders skeleton) |
| Fetch on an already-visible page, **scoped** to it | `meta: { withPageLoaderBlur: true }` |
| Fetch on an already-visible page, **app-wide** | `meta: { withGlobalLoaderBlur: true }` |

### 1. Gate → `PageLoader`

For form pages where the form seeds itself from fetched data — it must not mount until the
record is in hand.

```tsx
const { data: existing, isLoading } = useGetConnectionById(id);
if (isEdit && (isLoading || !existing)) return <PageLoader />;
return <ConnectionForm initial={existing} />;
```

### 2. Component owns its skeleton

Preferred when the component can render its own shape. Don't gate a whole page on data a
single component can represent as empty — see `docs/UIConsistencyGuide.md`.

```tsx
<ArtData data={rows} loading={isLoading} … />
```

### 3 & 4. Blur — fetch on an already-visible page

The gap case: something changed on screen, a fetch is in flight, and **nothing on screen
shows it's catching up** (no skeleton, no button spinner). The page stays visible, blurs, and
blocks interaction so the user can't act on stale state.

Opt in **at the call site**, never in the hook body — the same hook gets reused by callers
with different needs:

```tsx
// blurs only this ArtPage's content area
useGetExportSettingById(id, { meta: { withPageLoaderBlur: true } });

// blurs the whole viewport
useGetExportSettingById(id, { meta: { withGlobalLoaderBlur: true } });
```

`PageLoaderBlur` (inside every `ArtPage`) and `GlobalLoaderBlur` (mounted once in root
`layout.tsx`) each use `useIsFetching`/`useIsMutating` with a `meta` predicate — TanStack does
the counting, no custom store. Both work for queries **and** mutations.

**Do not** add a blur flag to a fetch that already has a local indicator (`ArtData`'s
`loading`, `ArtButton`'s `loading`) — that doubles up two affordances for one fetch.

**Debounced on purpose** (`useDebouncedActive`, shared by both):

| Constant | Value | Why |
|---|---|---|
| `SHOW_DELAY_MS` | 80ms | fetches faster than this never flash anything |
| `MIN_VISIBLE_MS` | 150ms | once shown, stays — avoids a blink-off mid-fade |

---

## `meta` — the complete set

Four flags, all set at the call site:

| Key | Type | Effect |
|---|---|---|
| `successMessage` | `string` | success toast (mutations) |
| `errorMessage` | `boolean \| string` | error toast; `true` uses the caught `ApiError`'s own message |
| `withPageLoaderBlur` | `boolean` | blurs the owning `ArtPage`'s content |
| `withGlobalLoaderBlur` | `boolean` | blurs the whole viewport |

Snackbar flags are read by `GlobalMutationSnackbar`; blur flags by `PageLoaderBlur` /
`GlobalLoaderBlur`. See `docs/TanStackMutationGuide.md` for the snackbar details.

---

## Loader components

| Component | Use |
|---|---|
| `PageLoader` | first-load gate inside a page (centered, `60vh`) |
| `GlobalLoader` | full-viewport load (`100vh`, with subtitle) — auth gate |
| `PageLoaderBlur` | rendered by `ArtPage`; driven by `meta.withPageLoaderBlur` |
| `GlobalLoaderBlur` | mounted once in `layout.tsx`; driven by `meta.withGlobalLoaderBlur` |
| `LoaderRingDots` | the shared ring + "Loading…" visual all of the above use |

One visual language throughout — a blur and a page loader read as the same loader, not two.

---

## Errors

`ArtPage` wraps its content in `ArtErrorBoundary`. A throw inside the page renders a message
plus a Reload button, with chrome still in place. Nothing to wire per page.

For a query whose failure should surface that way, pass `throwOnError: true`:

```tsx
useGetPnlReportsByConnections(connections, filters, { throwOnError: true });
```

---

## Routing & links

All routes live in `src/lib/hrefUrl.ts` as `HREF`. Never hardcode a path.

```tsx
import { HREF } from '@/lib/hrefUrl';
```

| Pattern | Prefetch | Use for |
|---|---|---|
| `<Link href={…} prefetch>` | immediate | hot, known routes (Navbar, page-level actions) |
| `<FSLink href={…}>` | on intent | BE-driven lists — Foresight.js prefetches on cursor motion, avoids prefetch spam over N rows |
| `router.back()` | — | after a form submit |

---

## URL as filter state — `useUrlFilters`

Page/search/filter state lives in the URL: survives refresh, shareable, drives back/forward.
Never mirror it into `useState`.

```tsx
// filter-model form — keys come from the same validator the BE parses with
const { page, search, filters, setFilter, clearFilters, dataProps } =
  useUrlFilters(MappingFilterValidator);

// explicit-keys form — for pages with no shared filter model
const { filters, setFilter, clearFilters, activeCount } =
  useUrlFilters(['dateTo', 'periods'] as const);
```

`dataProps` spreads straight into `<ArtData {...dataProps} />`. Pair with `parseFiltersFromUrl`
on the BE so one schema drives both sides.

> `react-doctor/nextjs-no-use-search-params-without-suspense` fires on this hook — a known
> false positive: every consumer renders under `ArtPage`, which is the Suspense boundary.
> Left visible, never suppressed.
