---
name: react-doctor
description: Run and resolve eslint-plugin-react-doctor warnings in the Direance Art component library, following this project's never-disable policy. Use when the user asks to "run react doctor", "fix lint", "check the Art library", mentions react-doctor rules (prefer-tag-over-role, no-derived-useState, no-static-element-interactions, etc.), or when editing src/components/ui/* and lint warnings appear.
metadata:
  scope: project
  version: "1.0"
---

React Doctor is `eslint-plugin-react-doctor` (~300 rules: bugs, re-render perf, a11y, design, security), wired into `eslint.config.mjs`. This skill is how to run it and resolve findings the Direance way.

## Run it

```bash
# Whole UI lib, tally by rule
npx eslint src/components/ui/ 2>&1 | grep -oE "react-doctor/[a-z-]+" | sort | uniq -c | sort -rn

# One file, full messages
npx eslint src/components/ui/ArtFoo.tsx
```

Always re-run after a fix. Also run `npx tsc --noEmit` — fixes often touch types.

## The one hard rule: never disable

A blocked rule is **fixed**, even if the fix needs a small refactor or splitting a component. Never write `// eslint-disable`. Only when there is genuinely no fix do you validate with the developer and, if agreed, leave it visible with a `// NOTE:` explaining why (a true false positive).

`// NOTE:` is for false positives only — never to excuse a rule that has a real fix.

## Fix patterns established in this codebase

- **forwardRef** → React 19 ref-as-prop: add `ref?: Ref<T>` to props, drop `forwardRef`.
- **Merging a local + forwarded ref** → `mergeRefs(localRef, forwardedRef)` from `art.utils.ts` (never write `ref.current` inside a component body — that trips `react-hooks/refs`).
- **`useRef(new Map())`** (rerender-lazy-ref-init) → `useLazyRef(() => new Map())` from `art.hooks.ts`. Add the returned ref to useCallback deps (it's stable; exhaustive-deps can't tell it's a ref).
- **no-derived-useState** → derive during render, or drop the copy. Exception: state that must *lag* a prop through an animation is legitimate (NOTE it).
- **prefer-useReducer** (many useState that change together) → one `useReducer`; encode shared resets (e.g. "any filter change resets page") in the reducer.
- **js-tosorted-immutable** → `arr.toSorted()` not `[...arr].sort()`.
- **jsx-no-constructed-context-values** → wrap provider `value` in `useMemo`.
- **no-react19-deprecated-apis** → `use(Context)` not `useContext(Context)`.
- **no-render-in-render** → turn an inline `renderX()` call into a `<XComponent />`.
- **only-export-components** → move non-component exports to a sibling `*.utils.ts`.
- **no-static-element-interactions / click-events-have-key-events** on a wrapper → `cloneElement` to put the handler on the real trigger element (see ArtMenu/ArtPopover/ArtDialog), or use a native `<label htmlFor>` (see ArtUpload, ArtComboBox chips).
- **prefer-tag-over-role** → use the native element when one fits: `<hr>` (separator), `<progress>` (ArtProgress), `<dialog>` (ArtDialog), `<input type=range>` (ArtSlider), `<label>` for click-to-focus/activate. If the native element genuinely can't render the widget, see exceptions below.
- **a11y handler lint on a native element you can't change** (e.g. backdrop click on `<dialog>`) → attach the listener via `ref` + `addEventListener` in an effect; the rule only scans JSX props.

## Known false positives (NOTEd, do not "fix")

- **ArtListbox** `prefer-tag-over-role` ×3 — custom ARIA combobox (icons, action rows, skeletons, infinite scroll). Native `<option>/<datalist>` can't render it. Developer reviews this himself.
- **ArtIcon** `no-barrel-import` — `import * as Icons` is the icon registry; every icon is reachable by dynamic name, nothing to split.

## Config

`no-giant-component` is **off** globally on purpose (line-count heuristic, not a correctness signal). Turning a rule off lives in `eslint.config.mjs` with a justification comment — a developer decision, never an inline disable.
