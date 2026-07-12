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
the shape of a minimal wrapper: it doesn't reinvent date input, it wraps `ArtInput` and
narrows the API to what callers actually need (`value: string`, `onChange: (value: string)
=> void`).

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
