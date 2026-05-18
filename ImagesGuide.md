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

Three helpers live in `src/lib/images/`:

| File | Side | Purpose |
|------|------|---------|
| `BytesResponse.ts` | BE | Binary `NextResponse` with typed X-* meta headers |
| `bytesClient.ts` | FE | Fetch binary, decode to base64, read meta headers |
| `imageProcessor.ts` | BE | Sharp compression pipeline |

`BytesResponse<T>` and `bytesClient` form a typed bridge — define metadata once on the BE, read it back on the FE with no manual header strings. The generic `T` constrains which keys are valid.

**BE (`src/lib/images/BytesResponse.ts`)** — extends `NextResponse`:
```ts
// Keys auto-convert to X-* headers: { name } → X-Name, { id } → X-Id
return new BytesResponse<LogoMetadataModel>(logo.data, logo.mime, { name: logo.name, id: logo.id });
```

**FE (`src/lib/images/bytesClient.ts`)** — fetches binary, decodes to base64, reads X-* headers back as `meta`:
```ts
const result = await bytesClient.get<LogoMetadataModel>(API.logo.byId(id));
// result: { data: string (base64), mime: string | null, meta: { name, id } }
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

Implemented in `src/lib/images/imageProcessor.ts` — `processImage(buffer, maxBytes, maxWidth)`.

**Pipeline:**
1. Resize to max width (`fit: 'inside'`, no upscale), encode as WebP at quality 70
2. If still over limit — shrink proportionally: `width *= sqrt(limit / actual)`, retry once
3. Still over → throw 400

```ts
const LOGO_MAX_BYTES = 80 * 1024;  // 80 KB — logo displays at 180px in Excel, 400px is plenty
const LOGO_MAX_WIDTH = 400;

// src/lib/images/imageProcessor.ts
export async function processImage(buffer: Buffer, maxBytes: number, maxWidth: number) {
  const limit = Math.floor(maxBytes * 0.95); // 5% buffer so rounding never sneaks past
  let width = maxWidth;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await sharp(buffer)
      .resize(width, undefined, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();
    if (result.length <= limit) return { data: result, mime: 'image/webp' };
    width = Math.floor(width * Math.sqrt(limit / result.length));
  }
  throw new ApiError('Image too large to compress within limits', 400);
}
```

**Why 400px / 80 KB:** Excel renders logos at ~180px. 400px gives 2× retina headroom. 80 KB is generous at that size — proportional compression handles outliers without needing a fixed fallback width.

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
4. **`processImage`** — import from `src/lib/images/imageProcessor.ts`, call before storing
5. **`BytesResponse<T>`** — use for all binary endpoints, pass typed metadata as plain keys
6. **Define a `*MetadataModel`** — `{ id: string; name: string }` style, shared between BE and FE generic `T`
7. **Client hook** — `bytesClient.get<T>/post<T>`, `staleTime: Infinity, gcTime: Infinity, enabled: !!id`
8. **No server cache on bytes** — suppress with `// eslint-disable-next-line local/no-uncached-prisma`
9. **Seed cache on create** — decode binary response in `onSuccess`, call `queryClient.setQueryData`
