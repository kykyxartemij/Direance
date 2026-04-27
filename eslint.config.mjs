import nextConfig from 'eslint-config-next';
import localPlugin from './eslint-rules/index.js';
import tanstackQuery from '@tanstack/eslint-plugin-query';

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
  'src/hooks/**/*.{ts,tsx}',
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

      // Warn when searchParams.get() for a text param is not wrapped in normalizeText().
      // Raw URL strings are untrimmed, case-sensitive, and unbounded.
      'local/require-normalize-text': 'warn',

      // Warn when .validate() is called without { abortEarly: false }.
      // Default abortEarly: true stops at the first error — users see only one problem at a time.
      'local/require-abort-early-false': 'warn',
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

  // FE — client-side and UI conventions
  {
    files: FE_FILES,
    plugins: { local: localPlugin },
    rules: {
      // Warn when <Link href="/..."> is missing explicit `prefetch`.
      // Next.js 15 defaults to hover-only prefetch — without this, quick clicks
      // show a blank gap before the skeleton. With prefetch, skeleton appears instantly.
      'local/require-link-prefetch': 'warn',

      // Warn when a page.tsx has no sibling loading.tsx.
      // loading.tsx is the Suspense skeleton — without it navigation shows a blank screen.
      'local/require-loading-page': 'warn',

      // Warn when an ArtDialog / ArtConfirmDialog trigger child has its own onClick
      // (it is silently overwritten by ArtDialog at runtime), or when a buttons array
      // item has no onClick (the button will only close the dialog, same as cancelButton).
      'local/no-dialog-trigger-onclick': 'warn',

      // Warn when queryKey in useQuery / useInfiniteQuery is a raw array.
      // Use queryKeys.* constants from src/lib/queryKeys.ts for traceability.
      'local/require-query-keys-constant': 'warn',

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
