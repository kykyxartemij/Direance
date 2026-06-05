# Direance — Project Conventions for Claude

## ==== Project Philosophy ====

This project is about **architecture and rules**, not shipping fast. Every decision should account for:

- **React re-renders** — uncontrolled inputs, memoization in Art lib only, no inline objects as props
- **Network transfer** — minimal select projections, bytes on dedicated endpoints, no over-fetching
- **Storage space** — compress images before store, per-user DB limits, lazy cleanup instead of accumulation

**No dev/prod separation.** There is one environment — treat every change as production. No "fix it later", no hardcoded test data, no skipped validation.

This is an ecosystem project, not a single website. Rules and reusability apply on both BE and FE. A quick solution that doesn't fit the pattern is wrong even if it works.

---

## ==== Extended Guides ====

When working in an area, read the relevant guide first:

| Area | Guide |
|------|-------|
| Backend services, Prisma, caching, auth | `BackendGuide.md` |
| Images, binary storage, BytesResponse | `ImagesGuide.md` |
| Forms, uncontrolled inputs, RHF | `UncontrolledInputsGuide.md` |
| TanStack Query mutations, optimistic updates | `TanStackMutationGuide.md` |
| Navigation, loading states, page structure | `InstantNavigationAndLoadingState.md` |
| Layout, ArtTitle, page conventions | `LayoutGuide.md` |

---

## ==== Comment Style ====

Section headers inside files use exactly this format:

```ts
// ==== Title ====
```

No other decoration (`─`, `*`, `-`, etc.). This applies to all `.ts`, `.tsx`, `.js`, `.jsx` files.

---

## ==== Interactive State Rule ====

Every clickable/selectable UI element must implement **4 distinct visual states** in this exact CSS cascade order (later = higher priority):

| Layer   | State            | How triggered              | Mechanism          |
|---------|------------------|----------------------------|--------------------|
| 1 base  | default          | resting, nothing happening | base CSS class     |
| 2 hover | cursor over it   | `:hover`                   | pure CSS           |
| 3 press | being clicked    | `:active` or `[data-pressing]` | CSS or DOM attr |
| 4 sel   | persistently on  | `--selected` / `checked`   | JS class + CSS     |

**Each state must be visually distinct from the others.** Hover must not look like selected. Press must look more active than hover.

### Why `[data-pressing]` instead of `:active` for listbox options

Listbox options call `e.preventDefault()` on `mousedown` to keep the input focused (required for multi-select). The browser silently cancels `:active` as a side effect of that call. The fix: set a `data-pressing` attribute directly on the DOM element (no React re-render) and use it in CSS:

```ts
// ArtListbox — onMouseDown on each <li>
e.preventDefault();                          // keep input focused
const el = e.currentTarget;
el.setAttribute('data-pressing', '');        // triggers CSS [data-pressing]
window.addEventListener('mouseup', () =>
  el.removeAttribute('data-pressing'), { once: true });
```

For elements that do NOT call `e.preventDefault()` (ArtButton, links, etc.), use pure CSS `:active` — no JS needed.

### CSS cascade order requirement

`:active` / `[data-pressing]` rules **must appear AFTER** `:hover` rules in the stylesheet. Same specificity = last rule wins. If press appears before hover, hovering while pressing will show the wrong state.

### Neutral state values (dark theme)

```
default:  transparent
hover:    var(--border)                                   (#333)
pressing: color-mix(in srgb, white 18%, var(--border))   (~#585)
selected: color-mix(in srgb, white  8%, var(--border))   (~#434)  ← between default and hover
```

### Colored variants

```
default:  color: var(--art-accent); background: transparent
hover:    background: color-mix(in srgb, var(--art-accent) 10%, transparent)
pressing: background: color-mix(in srgb, var(--art-accent) 22%, transparent)
selected: background: color-mix(in srgb, var(--art-accent) 14%, transparent)
```

---

## ==== Navigation Rule ====

Every `page.tsx` that fetches data must have a sibling `loading.tsx` that exports `GlobalPageLoader`. Components own their loading state via a `loading?: boolean` prop — they render their own skeleton rather than relying on a parent loader.

See `InstantNavigationAndLoadingState.md` for full pattern.

---

## ==== Theme System ====

Themes are set via a class on `<html>` (toggled in JS via `document.documentElement.classList`):
- Dark (default): no class needed — `:root` in `globals.css` defines dark tokens
- Light: `className="theme-light"`
- High Contrast: `className="theme-contrast"`

Token definitions live in `src/app/globals.css`. Art component overrides live in `src/components/ui/art.style.css`.

---

## ==== Page Metadata Rule ====

Every `page.tsx` exports a **static** metadata title. Dynamic data (e.g. record name) lives in the layout via `<ArtTitle>` — never in `generateMetadata`.

```ts
// page.tsx — always static
export const metadata: Metadata = { title: 'Mapping Detail' };

export default function Page() {
  return <MappingDetailPage />;
}
```

Root layout defines `title.template: '%s | Direance'` — pages only set the short name.

---

## ==== Page Layout Convention ====

Page structure: layout owns chrome (title, actions slot), page.tsx is a thin shell, feature component owns the content.

```
app/mappings/(list)/
  layout.tsx    ← ArtTitle + actions (New Mapping button)
  page.tsx      ← export metadata + render <MappingsPage />
  loading.tsx   ← export GlobalPageLoader
```

Title and page-level actions live in `layout.tsx` via `<ArtTitle title="..." actions={...} />`. Never in `page.tsx` or the feature component.

### Form button convention

Form action buttons stay **inside** the form component. Always at the bottom, consistent order: secondary left, primary right.

| Action      | Props                                    |
|-------------|------------------------------------------|
| Submit/Save | `color="primary" type="submit"`          |
| Cancel      | `variant="ghost" type="button"`          |
| Delete      | `color="danger" type="button"`           |

---

## ==== Validation Architecture ====

Validators live in two places with distinct responsibilities:

| Location | Owner | Purpose |
|---|---|---|
| `src/models/*.models.ts` | Backend | API request body contracts. Fields follow HTTP semantics: `required` for POST, `optional` for PATCH. |
| Page / component file | Frontend | Form validation only. Always strict. Never exported. |

**Rules:**
- Never add a validator to `models/` solely because a form needs it.
- FE forms define a local `schema` + `type FormValues`. They may mirror a model validator or be stricter.
- FE-only fields (e.g. `confirmPassword`) exist only in the local schema — never in models.
- When yup `InferType` causes TS errors, define `FormValues` explicitly and cast the resolver: `yupResolver(schema) as Resolver<FormValues>`.
- When `FormValues` uses a wider type but the mutation expects a union, cast at the call site: `data.reportType as ReportType`.

---

## ==== Validation Rule ====

All Yup validation calls must use `{ abortEarly: false }`:

```ts
const data = await MyValidator.validate(body, { abortEarly: false });
```

Collects all field errors at once. Applies to every `.validate()` call regardless of field count.

---

## ==== Raw SQL + Prisma Middleware ====

`withCrud` extensions (`upsertAndReturn`, `deleteManyAndReturn`) use `$queryRaw` — Prisma middleware does not run.

### Never use JS-side Prisma features in schema

| What to avoid | Why | Use instead |
|---|---|---|
| `@updatedAt` | JS-side injection, skipped by `$queryRaw` | `@default(now())` — trigger in `functions.sql` handles UPDATE |
| `@default(cuid())` | JS-side, no DB DEFAULT | `@default(dbgenerated("gen_random_uuid()"))` |
| `@default(uuid())` | JS-side, no DB DEFAULT | `@default(dbgenerated("gen_random_uuid()"))` |

When you need auto-behavior that Prisma can't express via a DB-level `@default(...)`, the solution is always a PostgreSQL function or trigger in `functions.sql` — not JS-side workarounds.

### What works automatically with `$queryRaw`

- `@default(now())` — DB-level, applies on INSERT. Omit from `create`.
- `@default(dbgenerated("gen_random_uuid()"))` — DB-level. Do **not** pass `id` in `create`.
- All scalar defaults (`@default(false)`, `@default("pnl")`, `@default("{}")`) — DB-level. Omit from `create`.
- `updatedAt` — auto-set by `set_updated_at` trigger (see `functions.sql`). Do **not** pass in `update`.
- `onDelete: Cascade` / `onDelete: SetNull` — DB-level FK constraints, always apply.

---

## ==== CSS Architecture ====

- `src/app/globals.css` — theme tokens (CSS custom properties) + feature-level global styles
- `src/components/ui/art.style.css` — Art component styles only. Feature UI uses Tailwind inline.
- `art-scrollable` — shared thin scrollbar class defined in `art.style.css`. Add to any scrollable Art element.
- All colors reference CSS custom properties (`var(--surface)`, `var(--border)`, etc.) — never hardcode hex in component CSS.
- Memoization (`React.memo`, `useMemo`) only in Art library components, not in feature components.
