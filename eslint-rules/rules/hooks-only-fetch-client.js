/**
 * Rule: hooks-only-fetch-client
 *
 * fetchClient must only be imported inside src/hooks/ files.
 * All BE calls from components, pages, and providers must go through
 * a TanStack Query hook (useQuery / useMutation) defined in src/hooks/.
 *
 * ✅ Good:
 *   // src/hooks/connection.hooks.ts
 *   import fetchClient from '@/lib/fetchClient';
 *   export function useGetConnection(id) {
 *     return useQuery({ queryKey: queryKeys.connection.byId(id), queryFn: () => fetchClient.get(...) });
 *   }
 *
 *   // src/page/dashboard/MyPage.tsx
 *   import { useGetConnection } from '@/hooks/connection.hooks';
 *
 * ❌ Bad:
 *   // src/page/dashboard/MyPage.tsx
 *   import fetchClient from '@/lib/fetchClient';
 *   const { data } = await fetchClient.get('/api/connections/123');
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'fetchClient must only be used inside src/hooks/ files. ' +
        'All BE calls from components and pages must go through TanStack Query hooks.',
    },
    messages: {
      hooksOnlyFetchClient:
        'Do not import fetchClient here. ' +
        'Move the BE call to a TanStack Query hook in src/hooks/ and import that hook instead.',
    },
    schema: [],
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (
          source === '@/lib/fetchClient' ||
          source.endsWith('/lib/fetchClient') ||
          source.endsWith('/fetchClient')
        ) {
          context.report({ node, messageId: 'hooksOnlyFetchClient' });
        }
      },
    };
  },
};
