# Direance — Project Conventions for Claude

## ==== Project Philosophy ====

This project is about **architecture and rules**, not shipping fast. Every decision should account for:

- **React re-renders** — uncontrolled inputs, memoization in Art lib only, no inline objects as props
- **Network transfer** — minimal select projections, bytes on dedicated endpoints, no over-fetching
- **Storage space** — compress images before store, per-user DB limits, lazy cleanup instead of accumulation
- **Reusability & extendability** — design everything as if it will grow infinitely. It won't, but the assumption forces shared helpers/extensions over one-offs, generic over special-cased, and a new model/route to drop into existing patterns with no rewrite

**No dev/prod separation.** There is one environment — treat every change as production. No "fix it later", no hardcoded test data, no skipped validation.

**Exception: `src/app/ui/**`.** This is the Art component showcase/dev page, not shipped product surface. It's ok for it to be lint-dirty or break convention (metadata, console.log, em dashes, etc.). Don't "fix" warnings here unless asked.

This is an ecosystem project, not a single website. Rules and reusability apply on both BE and FE. A quick solution that doesn't fit the pattern is wrong even if it works.

---

## ==== Known Lint False Positives ====

- **`react-doctor/nextjs-no-use-search-params-without-suspense`** — false positive project-wide. Every page that calls `useSearchParams()` has a sibling `loading.tsx`, which is itself the Suspense boundary (see Navigation Rule). Leave the warning visible, do not suppress or refactor around it.
- **`react-doctor/async-parallel`** / **`react-doctor/server-sequential-independent-await`** — false positive on BE handler files. Sequential awaits there are a gate chain (validate → rate limit → DB limit → write); `Promise.all` would bypass gates. Already config-disabled for BE files in `eslint.config.mjs` (see Backend Handler Rule) — this is the one sanctioned config-level suppression, not a silent inline disable.
- **`react-doctor/exhaustive-deps`** — NOT a blanket false positive, mostly accurate. The rule's own docs name one narrow exception: a captured value intentionally excluded (mount-only effect, or a function known to be referentially stable) that the static check can't prove safe. Only in that exact case is a justified `// eslint-disable-next-line` + `// NOTE:` acceptable, matching the existing Comment Style policy. Anywhere else, a missing-dep warning is a real bug — fix it, don't suppress it.

---

## ==== Extended Guides ====

When working in an area, read the relevant guide first:

| Area | Guide |
|------|-------|
| Backend services, withHandler, Prisma, caching, auth | `docs/BackendGuide.md` |
| Images, binary storage, BytesResponse | `docs/ImagesGuide.md` |
| Forms, uncontrolled inputs, RHF | `docs/UncontrolledInputsGuide.md` |
| TanStack Query mutations, optimistic updates | `docs/TanStackMutationGuide.md` |
| Navigation, links, loading states, page structure (page/layout/loading.tsx), ArtTitle | `docs/InstantNavigationAndLoadingState.md` |
| Tailwind CSS reference — width/height, flex, grid, positioning, overflow, breakpoints, z-index | `docs/LayoutGuide.md` |

---

## ==== Backend Handler Rule ====

Every API handler is wrapped in `withHandler` (or `withPublicHandler` for public routes) —
never a hand-written `try/catch`. The wrapper owns auth, the permission gate, error
handling and the ambient request context. The body is a standard Next.js handler
`(req, { params })`. Inside, work in order: **auth (done by wrapper) → validate request →
checks (rate limit, DB limit, `assertLimit`) → work**. Validation runs before the
DB-hitting checks so malformed requests fail cheap. See `docs/BackendGuide.md`.

**Sequential awaits in handlers are intentional — do not parallelize them.**
`react-doctor/async-parallel` and `react-doctor/server-sequential-independent-await` flag
this pattern as a false positive. Both rules are disabled for BE files in `eslint.config.mjs`.
The order is a gate chain: validate (no DB, fails cheap) → rate limit → DB limit → write.
Each step must complete and not throw before the next runs. `Promise.all` would bypass the
gates and hit the DB even when validation or rate-limiting should have stopped the request.

### `requireAuth()` vs `getAuth()` — same data, different usage

Both return `{ userId, permissions }`:

- **`requireAuth(permission?)`** — runs once at the edge, *inside the wrapper*. Resolves the
  session and **throws** (401 anonymous / 403 missing permission). You never call it in a
  handler body.
- **`getAuth()`** — reads the identity the wrapper already seeded into the request context.
  Call this in the handler body and any downstream service. No session hit. Throws only if
  used outside a request.
- **`getAuthOptional()`** — `AuthCtx | null`, for `withPublicHandler` bodies (never throws).

---

## ==== Comment Style ====

Section headers inside files use exactly this format:

```ts
// ==== Title ====
```

No other decoration (`─`, `*`, `-`, etc.). This applies to all `.ts`, `.tsx`, `.js`, `.jsx` files.

Comments (`//`) must be short and explanatory. Write **why it's here**, not **what it is** —
the code already says what it is. Skip comments that restate an obvious type or name.

`// NOTE:` is for **one purpose only**: pointing out something a future developer would find surprising or confusing that the code itself cannot show. Examples that qualify:
- `ArtListbox` uses `role="option"` on `<li>` instead of a native `<option>` — non-obvious because it's a custom multi-select widget with no native equivalent.
- A ref lazy-init pattern that conflicts with another lint rule — genuine catch-22 with no clean fix. In this specific case `// eslint-disable-next-line` is also acceptable since there is truly no alternative.

**`// NOTE:` is NOT a lint suppression tool.** Do not write a NOTE to explain "I didn't fix this lint rule because...". If a lint rule fires:
- Fix exists → fix it, even if it needs a small refactor.
- No fix and genuinely a false positive → leave the warning visible, flag it to the developer, move on. A broken lint rule in the open is better than one hidden behind a NOTE.

Do **not** use `// NOTE:` to excuse a rule that has a fix. If no fix exists and you cannot ask the developer, leave the lint warning and continue — do not suppress it.

If you encounter an existing `// eslint-disable` and know how to fix the underlying code, propose the fix to the developer instead of leaving the suppression.

---

## ==== Working With Claude ====

- **Use caveman mode** (`/caveman`). Be short. Don't over-complicate a task. When real
  complexity appears, validate the approach with the developer before building.
  - **Drop:** articles (a/an/the), filler (just/really/basically/actually/simply),
    pleasantries (sure/certainly/happy to), hedging.
  - **Keep:** technical terms exact, error text quoted exact, code blocks unchanged.
  - **Style:** fragments OK, short synonyms (big > extensive, fix > implement a solution for).
    Pattern: `[thing] [action] [reason]. [next step].`
  - **Levels:** `lite` (light trim), `full` (default), `ultra` (maximum compression).
  - **Drop caveman (write normal) for:** code / commits / PRs, security warnings,
    irreversible-action confirmations, and any multi-step sequence where clipped wording
    risks a misread. Resume after.
- **Never disable eslint rules.** A blocked rule should be **fixed** — even if the fix means
  a small refactor or separating concerns into a new component. Only when there is genuinely
  no fix (a true false positive, or no native/clean alternative) do you validate with the
  developer and, if agreed, leave it visible with a `// NOTE:`. Config-level scoping is a
  developer decision, never a silent inline `// eslint-disable`.
- **Never delete hooks or helpers because a linter flags them as "unused".** This project follows one-API-one-hook: every API route has a matching hook, and infrastructure helpers (`withPublicHandler`, `getAuthOptional`, etc.) exist before their callers do. "No current imports" is not a reason to delete. Only delete when you can confirm there is no corresponding API route AND no planned use — and even then, ask first.
- **Answer format:** start with a short answer that explains your thinking, using real
  code for the explanation. After the short summary, describe whatever else needs detail.

---

## ==== How to Validate Your Code ====

After **every** change:
- **Types:** `npx tsc --noEmit` — no new errors (ignore pre-existing unrelated ones).
- **Lint:** `npx eslint <changed files>` — real-time, per-file. Runs the React Doctor *lint
  rules*, so a clean eslint pass covers those for normal edits.
- **Security:** run the `vibe-security` skill on any backend or Vercel/deployment work —
  always, regardless of which files changed — and on anything touching auth, payments, DB
  access, API keys, secrets, or user data.

Only after a **big change** (new feature, cross-file refactor, multiple files):
- **React Doctor (full codebase):** `npx react-doctor` or `npx react-doctor@latest --verbose`. This is **not** the same as eslint —
  the CLI analyses the whole codebase: lint + dead code (unused files/exports/deps, circular
  imports) + a health score. eslint is the per-file helper; this is the full diagnosis.
- **Build:** `npm run build` — also a full-codebase analysis (types + bundle).

Both are expensive — don't run them on every small edit. For local changes, per-file eslint +
tsc is enough.

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

See `docs/InstantNavigationAndLoadingState.md` for full pattern.

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
