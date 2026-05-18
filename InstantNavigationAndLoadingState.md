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
