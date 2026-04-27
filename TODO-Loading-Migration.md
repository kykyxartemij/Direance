# TODO: Migrate to GlobalPageLoader + Suspense Loading

Current loading strategy works but has two friction points: route-specific `loading.tsx` files duplicate boilerplate and get separately chunked per dynamic route, and manually threading `isLoading` from `useQuery` into every component. This migration fixes both. `loading` props on components stay — they're still valid. The shift is that pages stop managing loading state manually; Suspense handles it instead.

> **Reference:** MePipe uses the same component library (`ArtSkeleton`, `ArtData`, etc.). Check MePipe patterns before inventing new ones — the Art component conventions there apply here too.

> **`ArtAsync` is already created** at `src/components/ui/ArtAsync.tsx`. It is a living component — update it freely as migration progresses (adjust default skeleton shape, add props, change error UI, etc.).

---

## Current workflow

### How it works today

1. Each route has a `loading.tsx` that renders a route-specific skeleton via `ArtSkeleton`
2. `page.tsx` renders a client component that calls `useQuery`
3. The client component receives `isLoading` from `useQuery` and passes it as `loading` prop down the tree
4. Components render their own skeleton when `loading={true}`

```
User navigates → Next.js shows loading.tsx skeleton
→ Client JS hydrates → component mounts → useQuery fires
→ isLoading=true → component renders its own skeleton via loading prop
→ data arrives → component renders data
```

Double skeleton: once from `loading.tsx`, once from `isLoading`. Usually the second one is invisible because data is fast — but it's still dead code paths on every render.

### Current loading.tsx pattern (per route)

```tsx
// src/app/mappings/loading.tsx
import ArtSkeleton from '@/components/ui/ArtSkeleton';

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl py-8">
      <ArtSkeleton style={{ height: 32, width: 128, borderRadius: 6, marginBottom: 24 }} />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <ArtSkeleton key={i} style={{ height: 48, borderRadius: 6 }} />
        ))}
      </div>
    </div>
  );
}
```

Each route has its own version. 13 `loading.tsx` files currently. Dynamic routes (`/mappings/[id]`, `/export-settings/[id]`) each produce separate JS chunks, so prefetching 10 links = 10 chunk requests even though they all look nearly identical.

### Current component pattern

```tsx
// Page component — today
const { data, isLoading } = useGetPagedMappings(page, PAGE_SIZE);

<ArtData
  data={data?.data ?? []}
  loading={isLoading}    // ← prop threads through
  ...
/>
```

---

## New workflow

### Concept

**Phase 1 — GlobalPageLoader:** One shared loading component. All `loading.tsx` files re-export it. It gets bundled once and cached after the very first page load (F5). Every subsequent navigation shows it instantly from cache — no network request.

**Phase 2 — Suspense + ArtSkeleton:** Replace `useQuery` + `isLoading` with `useSuspenseQuery`. Components never receive a `loading` prop — they always render with data. Suspense boundaries in pages handle the in-flight state with a specific skeleton per data section.

**Result flow:**

```
F5 (first load) → GlobalPageLoader bundled into initial JS → cached

User navigates → GlobalPageLoader shows instantly (from cache)
→ Client JS for route loads → component mounts
→ useSuspenseQuery in flight → Suspense shows ArtSkeleton (route shape)
→ query resolves → renders data
```

If data is prefetched server-side (via `HydrationBoundary`), Suspense boundary never fires — user sees data immediately after `GlobalPageLoader` clears.

---

## GlobalPageLoader

Minimal, route-agnostic. Shows that navigation happened. Not a skeleton — just a visual "something is loading" indicator.

```tsx
// src/components/GlobalPageLoader.tsx
'use client';

export default function GlobalPageLoader() {
  return (
    <div className="mx-auto max-w-7xl py-8">
      <div className="art-global-loader" />
    </div>
  );
}
```

```css
/* globals.css */
.art-global-loader {
  height: 3px;
  width: 100%;
  background: color-mix(in srgb, var(--art-accent) 30%, transparent);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

.art-global-loader::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--art-accent);
  border-radius: 2px;
  animation: global-loader-slide 1.2s ease-in-out infinite;
}

@keyframes global-loader-slide {
  0%   { transform: translateX(-100%); }
  50%  { transform: translateX(0%); }
  100% { transform: translateX(100%); }
}
```

### How it gets preloaded on F5

Root `loading.tsx` (`src/app/loading.tsx`) is part of the initial JS bundle — always loaded on first visit. It imports `GlobalPageLoader`, so that component is included in the initial bundle and cached immediately. All other `loading.tsx` files import the same component → cache hit on every subsequent navigation.

```tsx
// src/app/loading.tsx  ← root loading, always in initial bundle
import GlobalPageLoader from '@/components/GlobalPageLoader';
export default GlobalPageLoader;
```

```tsx
// src/app/mappings/loading.tsx  ← all others are identical one-liners
import GlobalPageLoader from '@/components/GlobalPageLoader';
export default GlobalPageLoader;
```

```tsx
// src/app/mappings/[id]/loading.tsx
import GlobalPageLoader from '@/components/GlobalPageLoader';
export default GlobalPageLoader;

// ... same for all 13 loading.tsx files
```

---

## Suspense + useSuspenseQuery

### Component migration

```tsx
// Before
const { data, isLoading } = useGetPagedMappings(page, PAGE_SIZE);
<ArtData data={data?.data ?? []} loading={isLoading} ... />

// After
const { data } = useGetPagedMappings(page, PAGE_SIZE); // hook uses useSuspenseQuery internally
<ArtData data={data.data} ... />                       // no loading prop, data always present
```

### Hook migration

```ts
// Before — in hooks file
import { useQuery } from '@tanstack/react-query';

export function useGetPagedMappings(page: number, pageSize: number) {
  return useQuery({
    queryKey: mappingKeys.paged(page, pageSize),
    queryFn: () => mappingService.getPaged(page, pageSize),
  });
}

// After
import { useSuspenseQuery } from '@tanstack/react-query';

export function useGetPagedMappings(page: number, pageSize: number) {
  return useSuspenseQuery({
    queryKey: mappingKeys.paged(page, pageSize),
    queryFn: () => mappingService.getPaged(page, pageSize),
  });
}
```

### Page with ArtAsync

```tsx
// src/page/mappings/MappingsPage.tsx — after migration
import ArtAsync from '@/components/ui/ArtAsync';
import ArtSkeleton from '@/components/ui/ArtSkeleton';

function MappingsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <ArtSkeleton key={i} style={{ height: 48, borderRadius: 6 }} />
      ))}
    </div>
  );
}

function MappingsList() {
  // useSuspenseQuery — throws promise if in flight, throws error if failed
  const { data } = useGetPagedMappings(page, PAGE_SIZE);
  return <ArtData columns={columns} data={data.data} rowKey={(row) => row.id} ... />;
}

export default function MappingsPage() {
  return (
    <div className="mx-auto max-w-5xl py-8">
      <PageHeader title="Mappings" ... />
      <ArtAsync fallback={<MappingsSkeleton />}>
        <MappingsList />
      </ArtAsync>
    </div>
  );
}
```

---

## ArtAsync — Suspense + ErrorBoundary in one wrapper

`useSuspenseQuery` throws on error instead of returning `isError`. Without an `ErrorBoundary`, an uncaught throw crashes the page. `ArtAsync` combines both concerns so you never forget one without the other.

```tsx
// src/components/ui/ArtAsync.tsx — already created
<ArtAsync>                          {/* default: generic ArtSkeleton bars */}
  <MappingsList />
</ArtAsync>

<ArtAsync fallback={<MappingsSkeleton />}>   {/* custom skeleton */}
  <MappingsList />
</ArtAsync>

<ArtAsync fallback={null}>          {/* no skeleton, just wait */}
  <MappingsList />
</ArtAsync>

<ArtAsync error={<p>Failed to load.</p>}>    {/* custom error UI */}
  <MappingsList />
</ArtAsync>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `fallback` | `ReactNode` | Generic ArtSkeleton bars | Suspense fallback. Pass `null` to disable. |
| `error` | `ReactNode` | Generic error message | Shown when query throws. |

---

## ESLint issues to expect during migration

| Issue | Where | Fix |
|-------|-------|-----|
| `'isLoading' is declared but its value is never read` | Call sites after switching to `useSuspenseQuery` | Remove `isLoading` from destructuring — prop on component stays |
| `React Hook "useSuspenseQuery" cannot be called conditionally` | Hooks inside conditionals | Move hook to top of component unconditionally |
| `Missing ErrorBoundary for useSuspenseQuery` | No lint rule for this — manual check | Audit every `useSuspenseQuery` call site |
| Exhaustive-deps warnings on `Suspense` wrapping inside `useEffect` | N/A — don't put Suspense in effects | — |

---

## Migration checklist

### Step 1 — GlobalPageLoader

- [ ] Create `src/components/GlobalPageLoader.tsx`
- [ ] Add `.art-global-loader` animation to `globals.css`
- [ ] Update `src/app/loading.tsx` → re-export `GlobalPageLoader`
- [ ] Update all other `loading.tsx` files (12 remaining) → re-export `GlobalPageLoader`

### Step 2 — ArtAsync

- [x] Create `src/components/ui/ArtAsync.tsx` — ErrorBoundary + Suspense + default skeleton
- [ ] Add `<ArtAsync>` at root level in `src/app/layout.tsx` as global catch-all safety net

### Step 3 — Migrate hooks + pages (one at a time)

- [ ] `MappingsPage` + `useGetPagedMappings` — good first candidate, simple list
- [ ] `ExportSettingsListPage` + `useGetPagedExportSettings`
- [ ] `MappingEditPage` + `useGetMappingById`
- [ ] `ExportSettingsFormPage` + `useGetExportSettingById`
- [ ] `AdminPage` + admin hooks
- [ ] `Dashboard` hooks

### Step 4 — Cleanup

- [ ] Remove `isLoading` destructuring from every migrated call site (no longer needed — Suspense handles it)
- [ ] Update CLAUDE.md — extend Navigation Rule to document Suspense pattern alongside existing `loading` prop convention
