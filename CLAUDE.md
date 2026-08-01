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

- **`react-doctor/nextjs-no-use-search-params-without-suspense`** — false positive project-wide. Every page that calls `useSearchParams()` renders under `<ArtPage>`, which provides the Suspense boundary (see Navigation Rule). Leave the warning visible, do not suppress or refactor around it.
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
| Navigation, links, loading states, page structure (ArtPage), URL filters | `docs/InstantNavigationAndLoadingState.md` |
| Tailwind CSS reference — width/height, flex, grid, positioning, overflow, breakpoints, z-index | `docs/LayoutGuide.md` |
| UI consistency — don't gate components on empty data, let them own their empty state | `docs/UIConsistencyGuide.md` |
| Models & validators — yup field-once pattern, Prisma-derived response models, Json column typing | `docs/ModelsAndValidationGuide.md` |

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

Section headers: `// ==== Title ====` exactly, no other decoration (`─`, `*`, `-`). Bare —
no trailing explanation unless it's one line of genuine "why."

**Every comment says why, never what.** The code already says what it is. Skip anything that
restates a type, a name, or an obvious prop (`isLoading`, `disabled`, a self-describing name
like `onlyFetchActiveByMappingBasedOnExportSetting`). Only comment when the name can't carry
the reason — a non-obvious default, a unit, a cross-file contract, a driver-specific quirk
(see the Odoo/Merit fields in `connection.models.ts`).

**Max 1–2 lines.** If the why needs a paragraph, fix the code instead (better name, smaller
function) — don't write more prose. Never stack 4+ line blocks: no API-spec trivia, no
restating a pattern already established elsewhere in the file, no justifying a choice nobody
questioned.

**`/** */` vs `//`:** audience split, not style pick. `/** */` on exported helpers/factories/
components callers won't open source for (`handleApiError`, `withCrud`, Art components).
`//` for everything internal — logic, locals, section headers.

**Naming beats commenting.** If a better name fits the why, rename — don't comment. Comment
is fallback only for stuff no name can carry (external quirk, magic number, cross-file
contract).

**Before writing any comment, gate it through 3 questions:**
1. **Why here?** — real hidden reason, and no rename fixes it? No reason or rename works →
   no comment.
2. **Short** — caveman it. Drop articles/filler. One line, not paragraph.
3. **Explanatory** — reader gets the *why* in that one line, not restated *what*.

```ts
// bad — restates name, no why
// gets user id by auth token
function getUserIdByAuthToken(token: string) { ... }

// bad — name could just say this, comment is a crutch
// verifies token from merit
function verifyMeritToken(token: string) { ... }

// good — no name fixes this, external system quirk
// Merit hashes token before send; hashing again here breaks auth silently.
function verifyMeritToken(token: string) { ... }

/** Central error → HTTP response mapper. Callers outside this file don't read impl. */
export function handleApiError(err: unknown) { ... }
```

**`// NOTE:`** flags something surprising the code can't show itself — e.g. `ArtListbox`
using `role="option"` on `<li>` instead of a native `<option>` (custom widget, no native
equivalent), or a genuine catch-22 with no clean fix. Write it once, on first occurrence —
not repeated on every sibling that follows the same pattern.

**Never use `// NOTE:` to excuse a fixable lint warning.** Fix exists → fix it. No fix and a
genuine false positive → leave the warning visible and flag it, don't hide it behind a NOTE.
Same for an existing `// eslint-disable`: if you know the fix, propose it instead of leaving
the suppression.

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
- **Docs describe the system as it should be built right now, not a timeline.** Never write
  "in future", "in a real implementation", "currently we don't do this", "eventually", or
  similar hedging in any doc or `CLAUDE.md`. If something isn't implemented, either implement
  it or leave it out of the doc — don't narrate a future or hypothetical state as if it were
  a caveat on the present one.
- **Narrate mid-task, not just at the end.** During longer work, check in periodically with a
  short status, not raw tool output: what's been done, any moment that looked risky or
  surprising, what you concluded from it, what's next. Not a transcript of every command run —
  the developer's mental model of progress, in a few sentences. Skip this for single-step tasks;
  it's for multi-step work where silently moving from step to step hides the reasoning.

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

Every clickable/selectable element needs **4 visually distinct states**, defined in this CSS
cascade order (later = higher priority, so later rules must come later in the stylesheet):

| Layer   | State           | Trigger                        | Mechanism        |
|---------|-----------------|---------------------------------|-------------------|
| 1 base  | default         | resting                        | base CSS class    |
| 2 hover | cursor over it  | `:hover`                       | pure CSS          |
| 3 press | being clicked   | `:active` or `[data-pressing]` | CSS or DOM attr   |
| 4 sel   | persistently on | `--selected` / `checked`       | JS class + CSS    |

Hover must not look like selected; press must look more active than hover.

**`:active` vs `[data-pressing]`:** default to `:active` (ArtButton, links, toggles — no JS
needed). Switch to `[data-pressing]` only where `e.preventDefault()` runs on `mousedown` —
that silently cancels `:active`. `ArtListbox` is the reference case (needs `preventDefault`
to keep the input focused for multi-select, and is hot-path enough that perf matters):

```ts
// onMouseDown on each <li>
e.preventDefault();
const el = e.currentTarget;
el.setAttribute('data-pressing', '');
window.addEventListener('mouseup', () => el.removeAttribute('data-pressing'), { once: true });
```

Dark theme values:

```
default:  transparent
hover:    var(--border)                                   (#333)
pressing: color-mix(in srgb, white 18%, var(--border))    (~#585)
selected: color-mix(in srgb, white  8%, var(--border))    (~#434, between default and hover)
```

Colored variant:

```
default:  color: var(--art-accent); background: transparent
hover:    background: color-mix(in srgb, var(--art-accent) 10%, transparent)
pressing: background: color-mix(in srgb, var(--art-accent) 22%, transparent)
selected: background: color-mix(in srgb, var(--art-accent) 14%, transparent)
```

---

## ==== Navigation Rule ====

Every content `page.tsx` renders `<ArtPage>` as its root — it owns chrome, the Suspense
boundary and the error fallback. No sibling `layout.tsx`, no sibling `loading.tsx`
(enforced by `local/require-art-page`; the auth/admin/root exceptions each carry an
explicit disable + `// NOTE:`).

**Never `useSuspenseQuery`** — always `useQuery`, gated by the component that owns the fetch.
Components own their loading state via a `loading?: boolean` prop — they render their own
skeleton rather than relying on a parent loader.

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

Every `page.tsx` exports a **static** metadata title. Dynamic data (e.g. record name) goes in the on-page heading via `<ArtPage title={...}>` — never in `generateMetadata`.

```tsx
// page.tsx — metadata always static, heading via ArtPage
export const metadata: Metadata = { title: 'Mapping Detail' };

export default function Page() {
  return (
    <ArtPage title="Mapping Detail">
      <MappingDetailPage />
    </ArtPage>
  );
}
```

Root layout defines `title.template: '%s | Direance'` — pages only set the short name.

---

## ==== Page Layout Convention ====

Page structure: `page.tsx` is a thin shell rendering `<ArtPage>` (which owns chrome), and the
feature component owns the content.

```
app/mappings/(list)/
  page.tsx      ← export metadata + <ArtPage title="Mappings" actions={...}><MappingsPage /></ArtPage>
```

Title and page-level actions are `ArtPage` props (`title`, `description`, `actions`) — never
set inside the feature component. `maxWidth` defaults to `5xl`.

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

**Request contracts (`Create`/`Update`/`Filter`) are always `yup.InferType<...>` — never
hand-typed alongside their validator.** Write the fields once, derive `Update` as
`CreateXValidator.partial()`, never a second hand-duplicated object. `FilterModel`s are named
`XFilterYupModel` — the `Filter` suffix alone doesn't read as validated the way `Create`/`Update`
do, `YupModel` makes it explicit.

**Response models (`XModel`, `XLightModel`, `XPagedModel`) are derived from Prisma, not
hand-typed.** `Prisma.TableGetPayload<{ select: typeof TABLE_SELECT }>` — the type can never
drift from what the query actually returns. A `Json` column comes back typed via
`prisma-json-types-generator`, not a hand-written field. See `docs/ModelsAndValidationGuide.md`
for the full pattern, including the `#region` layout for model files.

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
