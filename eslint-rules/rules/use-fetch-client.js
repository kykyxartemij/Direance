/**
 * Rule: use-fetch-client
 *
 * Disallow raw `fetch(...)` calls in client-side code.
 * Use `fetchClient` from `@/lib/fetchClient` instead — it handles timeout,
 * error normalization into ApiError, and JSON parsing consistently.
 *
 * ✅ Good:
 *   fetchClient.get('/api/something')
 *   fetchClient.post('/api/something', body)
 *
 * ❌ Bad:
 *   fetch('/api/something')
 *   await fetch(url, { method: 'POST' })
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow raw fetch() calls — use fetchClient from @/lib/fetchClient instead.',
    },
    messages: {
      useFetchClient:
        'Use fetchClient from @/lib/fetchClient instead of raw fetch(). ' +
        'fetchClient handles timeout, error normalization, and JSON parsing consistently.',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type === 'Identifier' && callee.name === 'fetch') {
          context.report({ node, messageId: 'useFetchClient' });
        }
      },
    };
  },
};
