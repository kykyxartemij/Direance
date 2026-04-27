# TODO: Small Art Library Adjustments

Small improvements that don't warrant their own migration doc. Pick up individually.

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
