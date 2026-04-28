# MePipe — Project Conventions for Claude

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

Selected sits between hover and pressing so it reads as "active choice at rest" without competing with interaction feedback.

### Colored variants

Follow the same 4-layer structure using `var(--art-accent)` tints:

```
default:  color: var(--art-accent); background: transparent
hover:    background: color-mix(in srgb, var(--art-accent) 10%, transparent)
pressing: background: color-mix(in srgb, var(--art-accent) 22%, transparent)
selected: background: color-mix(in srgb, var(--art-accent) 14%, transparent)
```

---

## ==== Navigation Rule ====

Every `page.tsx` that fetches data must have a sibling `loading.tsx` that renders a skeleton layout. Components own their loading state via a `loading?: boolean` prop — they render their own skeleton rather than relying on a separate loader component.

---

## ==== Theme System ====

See `TailwindTheme.md` for full token documentation.

Themes are set via a class on `<html>`:
- Dark (default): no class needed, `:root` defines dark tokens
- Light: `className="theme-light"`
- High Contrast: `className="theme-contrast"`

---

## ==== Page Metadata Rule ====

Every `page.tsx` must export a title. The root layout defines `title.template: '%s | MePipe'` — pages only set the short name, Next.js appends the suffix automatically.

Static page:
```ts
export const metadata: Metadata = { title: 'Upload' };  // → "Upload | MePipe"
```

Dynamic page (data-driven title):
```ts
export async function generateMetadata({ params }): Promise<Metadata> {
  const video = await getVideoById((await params).id);
  return { title: video.title };  // → "My Video | MePipe"
}
```

The browser tab title and the on-page `<h1>`/`<h2>` should always match.

---

## ==== Page Layout Convention ====

Every page with a visible title uses `<PageHeader title="..." />` from `src/components/PageHeader.tsx`.

The optional `actions` slot is for **page-level** buttons — buttons that are NOT part of a form (navigation, opening a dialog, triggering a mutation directly). Never put a `type="submit"` button here.

```tsx
// List page — "Create" is a page action, not a form submit
<PageHeader title="Videos" actions={<ArtButton color="primary">Create</ArtButton>} />

// Form page — no actions, submit button lives inside the form
<PageHeader title="Upload Video" />
<UploadForm />   // ← submit button is at the bottom of this form
```

### Form button convention

Form action buttons stay **inside** the form component (they need the loading state and mutation).
Always at the bottom, consistent order: secondary actions left, primary action right.

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
| `src/models/*.models.ts` | Backend | API request body contracts. Fields follow HTTP semantics: `required` for POST, `optional` for PATCH. Used by services via `.validate(body, { abortEarly: false })`. |
| Page / component file | Frontend | Form validation only. Always strict — required where a field is shown. Never exported; local to the file. |

**Rules:**
- Never add a validator to `models/` solely because a form needs it.
- FE forms define a local `schema` + `type FormValues`. They may mirror a model validator or be stricter.
- FE-only fields (e.g. `confirmPassword`) exist only in the local schema — never in models.
- When yup `InferType` causes TS errors (optional vs required key mismatch), define `FormValues` explicitly instead of using `InferType`, and cast the resolver: `yupResolver(schema) as Resolver<FormValues>`.
- When `FormValues` uses a wider type (e.g. `string`) but the mutation expects a union (e.g. `ReportType`), cast at the call site: `reportType: data.reportType as ReportType`.

---

## ==== Validation Rule ====

All Yup validation calls must use `{ abortEarly: false }`:

```ts
const data = await MyValidator.validate(body, { abortEarly: false });
```

**Why:** `abortEarly: true` (the default) stops at the first error. `abortEarly: false` collects all errors and returns them together — the user sees every problem at once instead of fixing one at a time. Applies to every `.validate()` call regardless of how many fields the schema has.

---

## ==== CSS Architecture ====

- `globals.css` — Art component styles only. Feature-level UI uses Tailwind inline.
- `art-scrollable` — shared thin scrollbar class. Add to any scrollable Art element.
- All colors reference CSS custom properties (`var(--surface)`, `var(--border)`, etc.) — never hardcode hex inside component CSS.
- Memoization (`React.memo`, `useMemo`) only in Art library components, not in feature components.
