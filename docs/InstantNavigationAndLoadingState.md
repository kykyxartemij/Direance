# Instant Navigation & Loading State Pattern

Users see layout + title instantly. Data loads in background. No blank page, no waiting.

## How it works

| Step | What happens | Who does it |
|------|--------------|------------|
| User clicks link | Route changes | Next.js |
| Route mounts | `page.tsx` renders (sync, instant) | Server |
| Suspense boundary activates | `loading.tsx` shows `GlobalPageLoader` | Next.js (while awaiting data) |
| Client component mounts | `useQuery` starts fetching data | Browser |
| While fetching | Page component returns `GlobalPageLoader` (same visual as loading.tsx) | Browser |
| Data arrives | Real UI renders, replaces loader | Browser |

**Key:** Same `GlobalPageLoader` in both `loading.tsx` and page component = seamless visual transition, no flicker.

## Routing & Links

### HREF

All routes centralized in `src/lib/href.ts`. Import and use:

```ts
// src/lib/href.ts
export const HREF = {
  mappings: '/mappings',
  mappingById: (id: string) => `/mappings/${id}`,
  mappingNew: '/mappings/new',
};
```

```tsx
import { HREF } from '@/lib/href';

<Link href={HREF.mappings} prefetch>Mappings</Link>
<FSLink href={HREF.mappingById(id)}>Details</FSLink>
```

### Link Patterns

| Pattern | Prefetch | Use when |
|---------|----------|----------|
| `<Link prefetch>` | Immediate | Hot routes (Navbar, main nav) |
| `<FSLink>` | On user intent | BE-driven lists (avoid prefetch spam) |
| `router.back()` | N/A | After save, user navigation |

**FSLink:** Predictive prefetch. Foresight.js detects cursor motion → prefetch only likely routes.

```tsx
import { FSLink } from '@/components/FSLink';

<FSLink href={HREF.mappingById(id)}>View</FSLink>
```

**router.back():** Expected behavior after form submit.

```tsx
import { useRouter } from 'next/navigation';

const router = useRouter();
router.back();
```

## Creating Routes

Three files per data-driven route:

```
app/mappings/
  [id]/
    page.tsx           ← metadata, sync mount
    loading.tsx        ← export GlobalPageLoader
    layout.tsx         ← ArtTitle, structure
    
page/mapping/
  MappingDetailPage.tsx  ← useQuery, gate render
```

**page.tsx:**
```tsx
import type { Metadata } from 'next';
import MappingDetailPage from '@/page/mapping/MappingDetailPage';

export const metadata: Metadata = { title: 'Mapping Detail' };

export default function Page() {
  return <MappingDetailPage />;
}
```

**layout.tsx:**
```tsx
import ArtTitle from '@/components/ui/ArtTitle';
import ArtButton from '@/components/ui/ArtButton';
import { HREF } from '@/lib/href';
import Link from 'next/link';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl py-8">
      <div className="flex items-start justify-between mb-6">
        <ArtTitle title="Mappings" />
        <Link href={HREF.mappingNew} prefetch>
          <ArtButton color="primary">New Mapping</ArtButton>
        </Link>
      </div>
      {children}
    </div>
  );
}
```

**loading.tsx:**
```tsx
import GlobalPageLoader from '@/components/GlobalPageLoader';

export default GlobalPageLoader;
```

**MappingDetailPage.tsx:**
```tsx
'use client';

import { useParams } from 'next/navigation';
import { useGetMappingById } from '@/hooks/mapping.hooks';
import GlobalPageLoader from '@/components/GlobalPageLoader';

export default function MappingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: mapping, isLoading } = useGetMappingById(id);

  if (isLoading || !mapping) return <GlobalPageLoader />;

  return (
    <div>
      <MappingForm mapping={mapping} />
    </div>
  );
}
```

## TanStack Query

### useQuery

```tsx
const { data, isLoading } = useGetMappingById(id);
if (isLoading || !data) return <GlobalPageLoader />;
return <MappingForm data={data} />;
```

Hook:
```ts
export function useGetMappingById(id: string | undefined) {
  return useQuery({
    queryKey: ['mapping', id],
    queryFn: async () => {
      const { data } = await fetchClient.get(`/api/mappings/${id}`);
      return data;
    },
    enabled: !!id,
  });
}
```

### Never useSuspenseQuery

Breaks on refetch. Avoid entirely.

## Component Loading

**First load:** Gate render.
```tsx
if (isLoading || !data) return <GlobalPageLoader />;
return <RealComponent data={data} />;
```

**Refetch:** Show secondary indicator.
```tsx
<ArtDataTable data={items} isLoading={isLoading} />
```

## Global Loading Overlay (dependent fetches)

Third case, distinct from first-load (`GlobalPageLoader`, full gate) and refetch (local indicator, e.g. `ArtDataTable`'s `isLoading`): a fetch triggered by user selection on an already-visible page, where the component has **no local loading affordance** of its own (no skeleton, no button spinner). Example: `Dashboard.tsx` — picking an export setting from `ArtComboBox` fires `useGetExportSettingById`, which reflows table colors/columns with nothing showing in between.

**Opt in at the call site, not the hook definition.** The same hook is often reused across pages with different needs — `useGetExportSettingById` is used in a full-page edit form (`ExportSettingsFormPage`, already gated by `GlobalPageLoader`), a dialog (`ExportDialog`), and a background reflow (`Dashboard`, `RowMappingsSection`). Only the last two want the overlay. Every query/mutation hook in `src/hooks/*.hooks.ts` accepts an optional trailing `options` param that spreads into the underlying `useQuery`/`useMutation` call — pass `meta` there:

```ts
// src/hooks/export-settings.hooks.ts — hook stays generic
export function useGetExportSettingById(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ExportSettingModel, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<ExportSettingModel, ApiError>({
    queryKey: queryKeys.exportSetting.byId(id!),
    queryFn: async () => { /* ... */ },
    enabled: !!id,
    ...options,
  });
}
```

```tsx
// src/page/dashboard/Dashboard.tsx — call site decides
const { data: selectedExportSetting } = useGetExportSettingById(selectedExportSettingId ?? undefined, {
  meta: { waitForLoading: true },
});
```

`GlobalLoadingOverlay` (mounted once in root `layout.tsx`) uses `useIsFetching`/`useIsMutating` with a `meta.waitForLoading` predicate to count matching in-flight calls — no custom store needed, TanStack does the counting. While count > 0 it blurs the whole page (page stays visible underneath) and blocks interaction (`pointer-events: auto`) so the user doesn't act on stale state mid-update.

**Debounced on purpose** — a query flagged `waitForLoading` doesn't show the overlay instantly:

| Constant | Value | Why |
|---|---|---|
| `SHOW_DELAY_MS` | 80ms | Fetches that resolve faster than this never show anything — avoids a flash for near-instant responses. |
| `MIN_VISIBLE_MS` | 150ms | Once shown, stays at least this long — avoids a blink-off mid-fade if the fetch finishes right after the delay. |

Same visual language as `GlobalPageLoader` (ring + "Loading…" dots) so the two don't read as two different loaders — one is a full-page version of the other. Opacity + `backdrop-filter` both transition over 0.2s ease — slower than a typical button-hover transition (full-viewport change, an instant snap reads as a flicker) but short enough to stay snappy against the 150ms minimum-visible window above.

**Do not opt a query/mutation into `meta.waitForLoading` if it already has a local indicator** (`ArtDataTable`/`ArtData` `loading` prop, `ArtButton` `loading` prop, etc.) — that would double up two loading affordances for one fetch. Reserve it for the gap case: something changed, nothing on screen shows it's still catching up. This is opt-in per call site — adding `options` support to a hook does not retroactively add the overlay to existing callers.

## Form Pages (Create/Edit)

Create: No data fetch.
```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useCreateMapping } from '@/hooks/mapping.hooks';
import { HREF } from '@/lib/href';

export default function MappingNewPage() {
  const router = useRouter();
  const { mutate } = useCreateMapping();

  async function handleSubmit(data) {
    await mutate(data);
    router.back();
  }

  return <MappingForm onSubmit={handleSubmit} />;
}
```

Edit: Fetch first, gate render.
```tsx
const { data: existing, isLoading } = useGetMappingById(id);
if (isLoading || !existing) return <GlobalPageLoader />;
return <MappingForm initial={existing} />;
```
