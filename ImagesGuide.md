# Images Guide — Storing Images in the Database

No external storage (S3, CDN). Images stored as `Bytes` (Postgres `bytea`) directly in DB. Sharp compresses before write. Client caches bytes indefinitely — no re-fetch unless invalidated.

## Why no file storage?

Simpler stack — no bucket credentials, no CDN config, no signed URLs. Tradeoff: DB size grows with uploads. Mitigated by: sharp compression, 200 KB per-image limit, per-user DB size limit.

---

## Separate model for images

Images live in their own table, not embedded in parent records. Reasons:

- **Reusability** — one image can be shared across multiple records
- **Cheap list queries** — listing images never transfers bytes (separate endpoint)
- **Explicit fetch** — bytes only transferred when user explicitly requests preview

```prisma
model Logo {
  id        String   @id @default(uuid())
  userId    String
  data      Bytes             // raw bytes — never in list selects
  mime      String            // e.g. "image/webp"
  name      String
  createdAt DateTime @default(now())
}
```

---

## Two endpoint pattern

Split metadata from bytes. Bytes are expensive to transfer — never mix into list or paged queries.

| Endpoint | Returns | Cached? |
|----------|---------|---------|
| `GET /api/logos` | id, mime, name (no bytes) | Yes — `cached()` |
| `GET /api/logos/:id` | binary bytes + metadata in headers | No — bytes can't go through `cached()` |

**Why no server cache on bytes:** `cached()` serializes via JSON. `Buffer`/`Bytes` don't survive JSON round-trip — they deserialize as `{type:"Buffer",data:[...]}`, not a real `Buffer`. Client-side cache (`staleTime: Infinity`) handles persistence instead — fetched once, kept forever, invalidated only on mutation.

```ts
// BE — light endpoint (fast, cacheable)
const LOGO_SELECT_LIGHT = { id: true, mime: true, name: true } as const;
const logos = await cached(
  () => prisma.logo.findMany({ where: { userId }, select: LOGO_SELECT_LIGHT }),
  CACHE_KEYS.logo.light(userId),
);

// BE — bytes endpoint (no cache, returns binary)
// eslint-disable-next-line local/no-uncached-prisma
const logo = await prisma.logo.findFirst({
  where: { id, userId },
  select: { data: true, mime: true, name: true },
});
return new BytesResponse(logo.data, logo.mime, { name: logo.name });
```

---

## BE/FE bridge — BytesResponse + bytesClient

`BytesResponse` and `bytesClient` form a typed bridge for binary transfer. Define metadata once on the BE; read it back on the FE with no manual header strings.

**BE (`src/lib/BytesResponse.ts`)** — extends `NextResponse`:
```ts
// Keys auto-convert to X-* headers: { name } → X-Name, { createdAt } → X-Created-At
return new BytesResponse(logo.data, logo.mime, { name: logo.name, id: logo.id });
```

**FE (`src/lib/bytesClient.ts`)** — fetches binary, decodes to base64, reads X-* headers back as `meta`:
```ts
const result = await bytesClient.get(API.logo.byId(id));
// result: { data: string (base64), mime: string | null, meta: { name, id, ... } }
```

No manual `btoa`, no `headers.get('X-Logo-Name')`, no `as unknown as Buffer` casts.

---

## Client-side infinite cache

Bytes are fetched once and cached forever. Only way to update: explicit mutation or invalidation.

```ts
export function useGetLogoById(id: string) {
  return useQuery({
    queryKey: queryKeys.logo.byId(id),
    queryFn: async () => {
      const result = await bytesClient.get(API.logo.byId(id));
      return { id, data: result?.data ?? null, mime: result?.mime ?? null, name: result?.meta.name ?? null };
    },
    enabled: !!id,
    staleTime: Infinity,  // never considered stale
    gcTime: Infinity,     // never garbage collected
  });
}
```

**Why `enabled: !!id`:** Don't fetch until needed. Bytes only load on demand.

**Cache seeding after upload:** `useCreateLogo` decodes the binary create response and seeds `queryKeys.logo.byId` immediately — no extra round-trip to fetch the preview.

---

## Sharp processing (BE)

Always process before storing. Never save raw upload bytes. Output is always **WebP** — better compression than PNG/JPEG (~30% smaller on disk), supports transparency, supported in all modern browsers (Safari 14+).

**Pipeline:**
1. Resize to max 800px wide (`fit: 'inside'`, no upscale)
2. Encode as WebP at quality 85
3. If still over 200 KB — shrink to 600px at quality 65

```ts
const LOGO_MAX_BYTES = 200 * 1024; // 200 KB hard cap
const LOGO_MAX_WIDTH = 800;

let result = await sharp(buffer)
  .resize(LOGO_MAX_WIDTH, undefined, { fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 85 })
  .toBuffer();

if (result.length > LOGO_MAX_BYTES) {
  result = await sharp(buffer)
    .resize(600, undefined, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 65 })
    .toBuffer();
}
```

Accepted input formats: PNG, JPEG, WebP, GIF. Output always WebP.

---

## Upload (FE → BE)

```ts
// FE — FormData via bytesClient.post (handles binary response + meta headers)
const formData = new FormData();
formData.append('logo', file);
const result = await bytesClient.post(API.logo.list(), formData);
// result.meta.id — new logo ID (seeded into cache immediately)

// BE — read from FormData, process, store, return binary
const file = formData.get('logo') as File | null;
const processed = await processLogoFile(file); // validates mime, runs sharp
const logo = await prisma.logo.create({
  data: { userId, data: processed.data, mime: processed.mime, name: processed.name },
  select: LOGO_SELECT_LIGHT,
});
return new BytesResponse(processed.data, processed.mime, { id: logo.id, name: logo.name }, 201);
// ↑ FE reads processed bytes + metadata — no second fetch needed
```

---

## Adding images to a new resource

1. **Create separate model** — never embed `Bytes` in the parent model
2. **Two selects** — `_LIGHT` (no bytes) and full with `data` field
3. **Two endpoints** — list/light + bytes-by-id
4. **processLogoFile** — reusable from `logo.service.ts`, call before storing
5. **BytesResponse** — use for all binary endpoints, pass metadata as plain keys
6. **Client hook** — `bytesClient.get/post`, `staleTime: Infinity, gcTime: Infinity, enabled: !!id`
7. **No server cache on bytes** — suppress with `// eslint-disable-next-line local/no-uncached-prisma`
8. **Seed cache on create** — decode binary response in `onSuccess`, call `queryClient.setQueryData`
