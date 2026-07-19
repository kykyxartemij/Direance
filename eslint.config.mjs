import nextConfig from 'eslint-config-next';
import localPlugin from './eslint-rules/index.js';
import tanstackQuery from '@tanstack/eslint-plugin-query';
import reactDoctor from 'eslint-plugin-react-doctor';

// ==== File scopes ====

// Server-side code: lib utilities, service layer, API routes, server actions
const BE_FILES = [
  'src/lib/**/*.{ts,js}',
  'src/services/**/*.{ts,js}',
  'src/app/**/route.{ts,js}',
  'src/app/**/actions.{ts,js}',
];

// Route handlers only (services + Next.js routes) — tighter than BE_FILES
// so lib utility functions don't get flagged by handler-specific rules.
const ROUTE_FILES = [
  'src/services/**/*.{ts,js}',
  'src/app/**/route.{ts,js}',
];

// Client-side code: components, pages, hooks, providers
const FE_FILES = [
  'src/components/**/*.{ts,tsx}',
  'src/app/**/*.tsx',
  'src/page/**/*.{ts,tsx}',
  'src/hooks/**/*.{ts,tsx}',
  'src/providers/**/*.{ts,tsx}',
];

// FE files that must NOT call fetchClient directly — hooks/ is excluded because
// that is exactly where fetchClient is allowed (inside TanStack Query wrappers).
const FE_NON_HOOKS_FILES = [
  'src/components/**/*.{ts,tsx}',
  'src/app/**/*.tsx',
  'src/page/**/*.{ts,tsx}',
  'src/providers/**/*.{ts,tsx}',
];

// ==== Config ====

const eslintConfig = [
  // Next.js recommended rules (react, hooks, core-web-vitals, typescript)
  ...nextConfig,

  // TanStack Query — exhaustive queryKey deps, stable QueryClient, no rest destructuring
  ...tanstackQuery.configs['flat/recommended'],

  // BE — server-side conventions
  {
    files: BE_FILES,
    plugins: { local: localPlugin },
    rules: {
      // Warn when a prisma read call is not wrapped in cached().
      'local/no-uncached-prisma': 'warn',

      // Warn when cached() is called with a raw array instead of CACHE_KEYS.*
      'local/require-cache-keys-constant': 'warn',

      // Warn when .validate() is called without { abortEarly: false }.
      // Default abortEarly: true stops at the first error — users see only one problem at a time.
      'local/require-abort-early-false': 'warn',

      // Warn when withFts(collectionCacheKey) doesn't match CACHE_KEYS.<key>.invalidate()[0].
      // Drift = mutations stop invalidating the FTS server cache.
      'local/require-fts-cache-key-match': 'warn',
    },
  },

  // Route handlers — stricter rules that would false-positive on lib utilities
  {
    files: ROUTE_FILES,
    plugins: { local: localPlugin },
    rules: {
      // Warn when an exported async function has no try/catch with handleApiError.
      'local/require-api-try-catch': 'warn',

      // Warn when route params.id is accessed raw instead of via parseIdFromRoute().
      'local/require-parse-id': 'warn',
    },
  },

  // Shared — applies to all source files
  {
    files: ['src/**/*.{ts,tsx,js}'],
    plugins: { local: localPlugin },
    rules: {
      // Warn when importing fetchClient — use fetchClient from @/lib/fetchClient instead.
      'local/use-fetch-client': 'warn',
    },
  },

  // react-doctor — all source files (JS patterns, security, Next.js universal)
  {
    files: ['src/**/*.{ts,tsx,js}'],
    plugins: { 'react-doctor': reactDoctor },
    rules: {
      // JS performance
      'react-doctor/js-combine-iterations': 'warn',
      'react-doctor/js-tosorted-immutable': 'warn',
      'react-doctor/js-cache-property-access': 'warn',
      'react-doctor/js-early-exit': 'warn',
      'react-doctor/js-flatmap-filter': 'warn',
      'react-doctor/js-hoist-regexp': 'warn',
      'react-doctor/js-index-maps': 'warn',
      'react-doctor/js-length-check-first': 'warn',
      'react-doctor/js-min-max-loop': 'warn',
      'react-doctor/js-set-map-lookups': 'warn',
      // Security
      'react-doctor/no-eval': 'warn',
      'react-doctor/no-secrets-in-client-code': 'warn',
    },
  },

  // react-doctor — BE services (async patterns)
  {
    files: BE_FILES,
    plugins: { 'react-doctor': reactDoctor },
    rules: {
      'react-doctor/async-await-in-loop': 'warn',
      'react-doctor/server-no-mutable-module-state': 'warn',
      'react-doctor/server-cache-with-object-literal': 'warn',
      'react-doctor/server-auth-actions': 'warn',
      'react-doctor/server-fetch-without-revalidate': 'warn',
      'react-doctor/server-hoist-static-io': 'warn',
    },
  },

  // react-doctor — FE components, pages, hooks, providers
  {
    files: FE_FILES,
    plugins: { 'react-doctor': reactDoctor },
    rules: {
      // Bugs — state/effect anti-patterns
      'react-doctor/no-derived-useState': 'warn',
      'react-doctor/no-derived-state': 'warn',
      'react-doctor/no-derived-state-effect': 'warn',
      'react-doctor/no-event-handler': 'warn',
      'react-doctor/no-prop-callback-in-effect': 'warn',
      'react-doctor/no-pass-data-to-parent': 'warn',
      'react-doctor/no-pass-live-state-to-parent': 'warn',
      'react-doctor/no-mirror-prop-effect': 'warn',
      'react-doctor/no-adjust-state-on-prop-change': 'warn',
      'react-doctor/no-reset-all-state-on-prop-change': 'warn',
      'react-doctor/no-self-updating-effect': 'warn',
      'react-doctor/no-effect-chain': 'warn',
      'react-doctor/no-effect-with-fresh-deps': 'warn',
      'react-doctor/no-set-state-in-render': 'warn',
      'react-doctor/no-direct-state-mutation': 'warn',
      'react-doctor/no-cascading-set-state': 'warn',
      'react-doctor/no-initialize-state': 'warn',
      'react-doctor/no-mutable-in-deps': 'warn',
      'react-doctor/no-random-key': 'warn',
      'react-doctor/no-array-index-as-key': 'warn',
      'react-doctor/no-event-trigger-state': 'warn',
      'react-doctor/no-fetch-in-effect': 'warn',
      'react-doctor/hooks-no-nan-in-deps': 'warn',
      'react-doctor/hook-use-state': 'warn',
      // Bugs — TanStack Query
      'react-doctor/query-mutation-missing-invalidation': 'warn',
      'react-doctor/query-no-query-in-effect': 'warn',
      'react-doctor/query-no-usequery-for-mutation': 'warn',
      'react-doctor/query-no-void-query-fn': 'warn',
      // Bugs — Next.js
      'react-doctor/nextjs-no-client-side-redirect': 'warn',
      'react-doctor/nextjs-no-use-search-params-without-suspense': 'warn',
      'react-doctor/nextjs-async-client-component': 'warn',
      'react-doctor/nextjs-no-redirect-in-try-catch': 'warn',
      'react-doctor/nextjs-missing-metadata': 'warn',
      'react-doctor/nextjs-image-missing-sizes': 'warn',
      'react-doctor/nextjs-no-client-fetch-for-server-data': 'warn',
      // Bugs — forms/inputs
      'react-doctor/button-has-type': 'warn',
      'react-doctor/no-uncontrolled-input': 'warn',
      // Performance — rendering
      'react-doctor/jsx-no-constructed-context-values': 'warn',
      'react-doctor/jsx-no-new-array-as-prop': 'warn',
      'react-doctor/jsx-no-new-function-as-prop': 'warn',
      'react-doctor/jsx-no-new-object-as-prop': 'warn',
      'react-doctor/jsx-no-jsx-as-prop': 'warn',
      'react-doctor/no-unstable-nested-components': 'warn',
      'react-doctor/no-render-in-render': 'warn',
      'react-doctor/no-nested-component-definition': 'warn',
      'react-doctor/no-inline-prop-on-memo-component': 'warn',
      'react-doctor/no-create-context-in-render': 'warn',
      // Performance — re-renders
      'react-doctor/rerender-memo-with-default-value': 'warn',
      'react-doctor/rerender-lazy-ref-init': 'warn',
      'react-doctor/rerender-lazy-state-init': 'warn',
      'react-doctor/rerender-state-only-in-handlers': 'warn',
      'react-doctor/rerender-functional-setstate': 'warn',
      'react-doctor/rerender-derived-state-from-hook': 'warn',
      'react-doctor/rerender-memo-before-early-return': 'warn',
      'react-doctor/rerender-dependencies': 'warn',
      // Performance — imports / code splitting
      'react-doctor/no-barrel-import': 'warn',
      'react-doctor/no-full-lodash-import': 'warn',
      'react-doctor/prefer-dynamic-import': 'warn',
      // Performance — async
      'react-doctor/async-parallel': 'warn',
      'react-doctor/async-await-in-loop': 'warn',
      'react-doctor/client-passive-event-listeners': 'warn',
      'react-doctor/no-undeferred-third-party': 'warn',
      // Performance — misc
      'react-doctor/prefer-module-scope-pure-function': 'warn',
      'react-doctor/prefer-module-scope-static-value': 'warn',
      'react-doctor/no-usememo-simple-expression': 'warn',
      'react-doctor/prefer-stable-empty-fallback': 'warn',
      // Maintainability
      'react-doctor/no-react19-deprecated-apis': 'warn',
      'react-doctor/no-react-dom-deprecated-apis': 'warn',
      'react-doctor/no-legacy-class-lifecycles': 'warn',
      'react-doctor/no-legacy-context-api': 'warn',
      'react-doctor/only-export-components': 'warn',
      // Off by choice: line-count is a subjective heuristic, not a correctness/perf/a11y
      // signal. Several Art components (ArtComboBox, ArtDataTable) are inherently large
      // because they own a lot of interaction logic — splitting them for a line target
      // would scatter tightly-coupled state and hurt debuggability more than it helps.
      'react-doctor/no-giant-component': 'off',
      'react-doctor/prefer-useReducer': 'warn',
      'react-doctor/prefer-function-component': 'warn',
      'react-doctor/prefer-html-dialog': 'warn',
      'react-doctor/prefer-tag-over-role': 'warn',
      'react-doctor/no-many-boolean-props': 'warn',
      'react-doctor/no-polymorphic-children': 'warn',
      'react-doctor/forward-ref-uses-ref': 'warn',
      // Design / CSS
      'react-doctor/no-transition-all': 'warn',
      'react-doctor/no-layout-property-animation': 'warn',
      'react-doctor/no-long-transition-duration': 'warn',
      'react-doctor/no-outline-none': 'warn',
      'react-doctor/no-z-index-9999': 'warn',
      'react-doctor/design-no-redundant-padding-axes': 'warn',
      'react-doctor/design-no-redundant-size-axes': 'warn',
      'react-doctor/design-no-space-on-flex-children': 'warn',
      'react-doctor/design-no-vague-button-label': 'warn',
      'react-doctor/design-no-em-dash-in-jsx-text': 'warn',
      'react-doctor/design-no-three-period-ellipsis': 'warn',
      // Accessibility
      'react-doctor/control-has-associated-label': 'warn',
      'react-doctor/no-static-element-interactions': 'warn',
      'react-doctor/click-events-have-key-events': 'warn',
      'react-doctor/no-noninteractive-element-to-interactive-role': 'warn',
      'react-doctor/no-noninteractive-element-interactions': 'warn',
      'react-doctor/no-noninteractive-tabindex': 'warn',
      'react-doctor/no-interactive-element-to-noninteractive-role': 'warn',
      'react-doctor/interactive-supports-focus': 'warn',
      'react-doctor/alt-text': 'warn',
      'react-doctor/anchor-has-content': 'warn',
      'react-doctor/anchor-is-valid': 'warn',
      'react-doctor/aria-props': 'warn',
      'react-doctor/aria-proptypes': 'warn',
      'react-doctor/aria-role': 'warn',
      'react-doctor/aria-unsupported-elements': 'warn',
      'react-doctor/heading-has-content': 'warn',
      'react-doctor/label-has-associated-control': 'warn',
      'react-doctor/no-access-key': 'warn',
      'react-doctor/no-aria-hidden-on-focusable': 'warn',
      'react-doctor/no-autofocus': 'warn',
      'react-doctor/no-redundant-roles': 'warn',
      'react-doctor/role-has-required-aria-props': 'warn',
      'react-doctor/role-supports-aria-props': 'warn',
      'react-doctor/tabindex-no-positive': 'warn',
      'react-doctor/iframe-has-title': 'warn',
      'react-doctor/iframe-missing-sandbox': 'warn',
      'react-doctor/jsx-no-target-blank': 'warn',
    },
  },

  // FE — fetchClient must not be used outside src/hooks/
  {
    files: FE_NON_HOOKS_FILES,
    plugins: { local: localPlugin },
    rules: {
      'local/hooks-only-fetch-client': 'warn',
    },
  },

  // FE — client-side and UI conventions
  {
    files: FE_FILES,
    plugins: { local: localPlugin },
    rules: {
      // Warn when <Link href="/..."> is missing explicit `prefetch`.
      // Next.js 15 defaults to hover-only prefetch — without this, quick clicks
      // show a blank gap before the skeleton. With prefetch, skeleton appears instantly.
      'local/require-link-prefetch': 'warn',

      // Warn when <Link> or <FSLink> uses hardcoded href instead of HREF constants.
      // HREF constants in src/lib/href.ts centralize routes for safe refactoring.
      'local/require-href-constant': 'warn',

      // Warn when a page.tsx doesn't render <ArtPage> as its root.
      // ArtPage owns chrome, the Suspense boundary, and the loading/error gate that
      // layout.tsx/loading.tsx used to split across sibling files.
      'local/require-art-page': 'warn',

      // Warn when an ArtDialog / ArtConfirmDialog trigger child has its own onClick
      // (it is silently overwritten by ArtDialog at runtime), or when a buttons array
      // item has no onClick (the button will only close the dialog, same as cancelButton).
      'local/no-dialog-trigger-onclick': 'warn',

      // Warn when queryKey in useQuery / useInfiniteQuery is a raw array.
      // Use queryKeys.* constants from src/lib/queryKeys.ts for traceability.
      'local/require-query-keys-constant': 'warn',

      // Warn when onClick contains only router.push() — use <Link prefetch> instead.
      // router.push skips prefetch and disables right-click / cmd+click behaviors.
      'local/no-router-push-navigation': 'warn',

      // No raw console.log in UI code — use console.error / console.warn only (errors/warnings).
      // ArtErrorBoundary already uses console.error — that's fine.
      'no-console': ['warn', { allow: ['error', 'warn'] }],

      // React Hook Form — prevent accidentally passing async functions to non-async event handlers.
      // RHF's handleSubmit wraps the callback, so the returned fn must NOT be async itself.
      // This is enforced by no-misused-promises once type-checking is wired up.
      // For now: flag passing async fns directly to onClick / onChange without wrapping.
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'JSXAttribute[name.name=/^on[A-Z]/] > JSXExpressionContainer > ArrowFunctionExpression[async=true]',
          message: 'Avoid async arrow functions directly in JSX event handlers — extract or wrap with handleSubmit.',
        },
      ],
    },
  },
];

export default eslintConfig;
