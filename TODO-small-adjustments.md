# TODO: Small Art Library Adjustments

Small improvements that don't warrant their own migration doc. Pick up individually.

---

## ArtComboBox — open/close opacity animation

Add a short fade-in on open, fade-out on close. Opacity only — no transform, no layout shift.

Fade-in via CSS keyframe (fires on mount automatically — no JS race condition).
Fade-out via `handleHide` wrapper — sets opacity 0 on `portalRef` directly, then delays `hide()`.

```css
/* portal wrapper */
.art-combobox-portal {
  animation: art-fade-in 80ms ease-out;   /* fires on mount */
  transition: opacity 80ms ease-out;      /* used by handleHide */
}

@keyframes art-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

```tsx
const FADE_MS = 80;

// No handleShow needed — CSS keyframe handles fade-in on mount.
const handleHide = () => {
  if (portalRef.current) {
    portalRef.current.style.opacity = '0';
    setTimeout(hide, FADE_MS);
  } else {
    hide();
  }
};
```

Replace all `hide()` call sites in ArtComboBox with `handleHide`. Add `art-combobox-portal` class to the portal wrapper div.

---

## ArtDataTable — `isFetching` prop

TanStack distinguishes `isPending` (first load, no data) from `isFetching` (background refetch, stale data shown). Table currently only has `loading`. Add `isFetching?: boolean` — when true and data is present, show a subtle top-of-table progress bar or reduce row opacity instead of re-rendering the full skeleton.

```tsx
// Proposed API
<ArtDataTable
  data={data}
  loading={isPending}      // full skeleton — no data yet
  isFetching={isFetching}  // subtle indicator — data shown, refetch in flight
/>
```

---

## CSS — split art.style.css from globals.css

`globals.css` currently holds theme tokens, Tailwind import, AND all Art component class definitions. Extract Art component classes (`.art-field`, `.art-combobox-*`, `.shimmer`, `.art-data-*`, etc.) into `src/components/ui/art.style.css`. Import it once in root layout alongside globals. Keeps globals.css for tokens + Tailwind only.

---

## ArtTooltip — shared position utility

`ArtTooltip` and `useAnchoredPanel` both compute `getBoundingClientRect()`-based fixed positions. If more components need manual positioning, extract `computeAnchoredPos(triggerEl, placement)` into `art.utils.ts`. Do not migrate ArtTooltip to `useAnchoredPanel` — tooltip is already DOM-only (no React state), which is the right call for performance.

---

## ESLint — type-checked rules (future)

`@typescript-eslint/no-floating-promises` and `@typescript-eslint/no-misused-promises` require TypeScript type information at lint time. Not added yet because they need `parserOptions.project` wired in the ESLint config, which slows linting noticeably. Worth enabling once the team decides the tradeoff is acceptable.

To enable, add to `eslint.config.mjs`:
```js
{
  languageOptions: {
    parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
  },
  rules: {
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
  },
}
```
