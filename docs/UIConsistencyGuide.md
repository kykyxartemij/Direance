# UI Consistency Guide

## ==== Reuse Art components — don't invent new ones ====

Before writing a raw `<input>`, `<select>`, or a bespoke widget, check `src/components/ui/`
first. Almost every primitive already exists (`ArtInput`, `ArtSelect`, `ArtComboBox`,
`ArtCheckbox`, `ArtDatePicker`, ...). A feature file using a native element where an Art
component covers the same job is a regression — it skips the shared states (hover/press/
selected per the Interactive State Rule), shared label/helperText layout, and shared theme
tokens.

If no Art component fits, that's a signal to add one to `src/components/ui/` (simple,
generic, reusable) — not to one-off it inside a feature file. See `ArtDatePicker.tsx` for
the shape: it builds on `ArtInput` and `useAnchoredPanel`, and narrows the API to what
callers need (`value: string`, `onChange: (value: string) => void`). Its `onChange` fires only
for a chosen date, never while browsing months, so a filter can fetch on every `onChange`.

## ==== Never gate a component on "does it have data" ====

**The mistake (recurring):**

```tsx
{options.length > 0 && (
  <ArtSelect options={options} ... />
)}
```

This hides the control entirely when there's nothing to select. It looks like a bug to
the user ("where did the field go?"), and it's extra branching for no real benefit — the
component already has an empty state (placeholder text, disabled look, "no options"
message in the dropdown).

**The fix:** render the component unconditionally. Let it own its own empty state.

```tsx
<ArtSelect options={options} placeholder="Select connection…" />
```

If `options` is empty, the combobox just opens to nothing or shows its built-in
no-options message. That's expected, consistent behavior — not a layout shift.

This is the general rule: **"show this control, or not" is almost never the right
question.** The right question is "what state should this control be in" — empty,
disabled, loading, populated. Swapping a control in and out of the tree is harder to
reason about for both the developer (extra branch, extra test case) and the user (the
layout jumps, the field they used a second ago is gone).

### Empty list vs. disabled — pick the one that matches reality

- **Combobox/select with zero options right now, but options could appear later** (e.g. a
  connection list scoped to a report type, a search-as-you-type result list) → render it
  enabled, showing its built-in "no options" state. The user can still see the field
  exists and what it's for.
- **A field that genuinely cannot be used in this context** (e.g. Merit's API has no
  `dateFrom`/`dateTo` — only `endDate` + `perCount`) → render it `disabled`, not hidden.
  Disabled communicates "this exists, not applicable here"; hiding communicates nothing
  and just deletes the row, breaking the grid/layout other fields rely on.

```tsx
// Merit driver: dateFrom/dateTo don't apply — disabled, not omitted, keeps the 4-col grid intact
<ArtDatePicker label="Date from" disabled value="" onChange={() => {}} helperText="Not supported by Merit — only period end date + periods." />
```

### More examples

```tsx
// Bad — hides the button when there's nothing to act on yet
{rows.length > 0 && <ArtButton onClick={exportAll}>Export</ArtButton>}

// Good — button stays, disabled state communicates why it can't be used
<ArtButton onClick={exportAll} disabled={rows.length === 0}>Export</ArtButton>
```

```tsx
// Bad — combobox vanishes while the list is loading
{!isLoading && <ArtComboBox options={items} ... />}

// Good — combobox stays mounted, shows a loading state inside
<ArtComboBox options={items} loading={isLoading} ... />
```

### When a conditional IS correct

Gate rendering on **structural** conditions, not data-count:
- A field that only applies to one mode/type (`connectionType === 'odoo'`) — correct, the
  field is meaningless for the other type.
- A field that depends on a prop not being passed at all (`reportType` omitted entirely) —
  correct, the feature isn't wired into this context.
- Data that doesn't exist yet for this row (e.g. a manual upload has no `fetchedAt`) — fine
  to omit that one piece of text; this isn't hiding a whole interactive control.

The anti-pattern is specifically: hiding an interactive element (select, button, input)
because its **option/result list happens to be empty right now**, or because it's
**temporarily inapplicable**. Both of those are states the component should render
(empty/disabled), not states the parent should branch the tree on.

## ==== Theme ====

Dark only. Token definitions live in `src/app/globals.css`. Art component overrides live in
`src/components/ui/art.style.css`. All colors reference CSS custom properties
(`var(--surface)`, `var(--border)`, etc.) — never hardcode hex in component CSS.

## ==== CSS Architecture ====

- `src/app/globals.css` — theme tokens (CSS custom properties) + feature-level global styles.
- `src/components/ui/art.style.css` — Art component styles and text color classes. Feature UI
  uses Tailwind for layout and spacing.
- `art-scrollable` — shared thin scrollbar class defined in `art.style.css`. Add to any
  scrollable Art element.
- Memoization (`React.memo`, `useMemo`) only in Art library components, not in feature
  components.

## ==== Styling rule — components own the look ====

The Art library is independent: it works in a project with no Tailwind installed.

| Where | Allowed |
|-------|---------|
| Art components (`src/components/ui/`) | Plain CSS classes in `art.style.css` with theme tokens. No Tailwind, no `@apply`. |
| Feature pages: layout and spacing | Tailwind classes (`flex flex-col gap-2`), including `className` on Art components |
| Feature pages: text color | `art-text-default` (only under a parent that changes color, like a link or muted text), `art-text-muted`, `art-text-primary`, `art-text-success`, `art-text-warning`, `art-text-danger` |
| Feature pages: component looks | Art props (`color="primary"`, `size="sm"`) |
| `style={{ }}` | Values known only at runtime (computed width, position) |

```tsx
// bad
<p style={{ color: 'var(--text-muted)' }}>Saved</p>

// good
<p className="text-sm art-text-muted">Saved</p>
```

Tailwind utilities load after Art's `@layer components`, so a page's `className` overrides Art's own CSS.

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

Values:

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

## ==== Page Metadata — always static ====

Every `page.tsx` exports a **static** metadata title. Dynamic data (e.g. a record's name) goes
in the on-page heading via `<ArtPage title={...}>` — never in `generateMetadata`.

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

## ==== Page / Feature-Component Split ====

`page.tsx` is a thin shell rendering `<ArtPage>` (which owns chrome — see
`InstantNavigationAndLoadingState.md`), and the feature component owns the content.

```
app/mappings/(list)/
  page.tsx      ← export metadata + <ArtPage title="Mappings" actions={...}><MappingsPage /></ArtPage>
```

Title and page-level actions are `ArtPage` props (`title`, `description`, `actions`) — never
set inside the feature component. `maxWidth` defaults to `5xl`.

### Form button convention

Form action buttons stay **inside** the form component. Always at the bottom, consistent
order: secondary left, primary right.

| Action      | Props                                    |
|-------------|-------------------------------------------|
| Submit/Save | `color="primary" type="submit"`          |
| Cancel      | `variant="ghost" type="button"`          |
| Delete      | `color="danger" type="button"`           |

---

## ==== Permission-gated pages — PermissionPage, 404 never 403 ====

A page not meant for everyone wraps its `<ArtPage>` in `<PermissionPage permission={...}>`.
It checks the session on the server and calls `notFound()` when the check fails — a 403 would
confirm the page exists to someone who shouldn't know it does.

```tsx
export default function Page() {
  return (
    <PermissionPage permission={Permission.CAN_INVITE_USERS}>
      <ArtPage title="Invite User" maxWidth="2xl">
        <InvitePage />
      </ArtPage>
    </PermissionPage>
  );
}
```

Takes the same `PermissionCheck` as `hasPermission` — a bare `Permission`, or `{ anyOf }` /
`{ allOf }`. Gate a whole route subtree from its `layout.tsx` instead of per-page.

**Not a prop on `ArtPage`.** `ArtPage` is `'use client'`, so a check inside it runs in the
browser after session load: the page's JS and its data fetches still reach a user who fails
the check, and `notFound()` lands only after a blank frame. `PermissionPage` is a server
component, so gated content never reaches the client at all.

`PermissionGuard` is the client-side sibling for hiding *part* of a page (a button, a form
field) from a user who is otherwise allowed to be there. Pages use `PermissionPage`; pieces
inside a page use `PermissionGuard`.

Gating the page is never the only check — the API handler still enforces its own
`permission`, since the route is reachable without the page.

---

## ==== Memoize JSX passed as a prop ====

Any element built inline and passed as a prop (e.g. `advancedFilters` on `ArtData`) is a new
reference every render, which trips `react-doctor/jsx-no-jsx-as-prop`. Wrap it in `useMemo`
with the values it reads as deps — this is the standard pattern across every list page
(`ConnectionsListPage`, `MappingsPage`, `ExportSettingsListPage`, the report pages). No comment
needed at each call site; this doc is the one place that explains why.

```tsx
const advancedFilters = useMemo(
  () => <ArtSelect label="Type" options={TYPE_OPTIONS} selected={selectedType} onChange={...} clearable />,
  [selectedType, setFilter],
);
```

---

## ==== Section dividers — ArtDivider, not FormSection ====

Use `ArtDivider` with a `label` to break a form into labeled sections. Do not reach for a
one-off wrapper component for this — `ArtDivider` already covers it.

```tsx
<ArtDivider label="Odoo" />
```

---

## ==== Required fields — prop only, never spell it out in the label ====

Mark a required field with `required` on the field component (`ArtFormInput`, `ArtFormSelect`,
etc.) — it renders the `*` indicator via `ArtLabel`. Every field without `required` is
optional by default; don't also write "(optional)" into the label text.

```tsx
// bad
<ArtFormInput name="name" label="Display name (optional)" />

// good
<ArtFormInput name="name" label="Display name" />

// good — required field
<ArtFormInput name="email" label="Email" required />
```
