# TODO: Small Art Library Adjustments

Small improvements that don't warrant their own migration doc. Pick up individually.

---

## Use ArtSnackbar for every hook, on catching errors, and etc.

create meta props: successMessage, errorMessage, invalidateQuery, and auto use it everywhere.
onSuccess: SuccessMessage via ArtSnackbar + invalidateQuery
onError: ErrorMessage via ArtSnackbar

no onSettled functionality. OnError we do not invalidateQuery for less BE calls.

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
