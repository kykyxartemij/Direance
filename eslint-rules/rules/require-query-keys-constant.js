/**
 * Rule: require-query-keys-constant
 *
 * The `queryKey` option in React Query hooks must use queryKeys.* constants —
 * not raw inline arrays. Raw arrays scatter key definitions across the codebase,
 * making targeted cache invalidation hard to track down.
 *
 * Mirrors the server-side `require-cache-keys-constant` rule for the FE layer.
 *
 * ✅ Good:
 *   useQuery({ queryKey: queryKeys.video.byId(id), queryFn: ... })
 *   useInfiniteQuery({ queryKey: queryKeys.video.paged(page, pageSize), ... })
 *
 * ❌ Bad:
 *   useQuery({ queryKey: ['video', id], queryFn: ... })      // use queryKeys instead
 *   useInfiniteQuery({ queryKey: ['video', 'list'], ... })   // use queryKeys instead
 */

const QUERY_HOOKS = new Set([
  'useQuery',
  'useInfiniteQuery',
  'useSuspenseQuery',
  'useSuspenseInfiniteQuery',
]);

/** Returns true if the node is a queryKeys.something.something() call */
function isQueryKeysCall(node) {
  if (node.type !== 'CallExpression') return false;
  let callee = node.callee;
  while (callee.type === 'MemberExpression') {
    callee = callee.object;
  }
  return callee.type === 'Identifier' && callee.name === 'queryKeys';
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require the queryKey option in React Query hooks to use queryKeys.* constants, not raw arrays. ' +
        'This keeps all query keys in one place and makes cache invalidation traceable.',
    },
    messages: {
      useQueryKeysConstant:
        'Use a queryKeys.* constant instead of a raw array. ' +
        'This keeps all query keys in src/lib/queryKeys.ts and makes invalidation traceable. ' +
        'Add a new key there if one does not exist yet.',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        // Must be one of the tracked React Query hooks
        const callee = node.callee;
        if (callee.type !== 'Identifier' || !QUERY_HOOKS.has(callee.name)) return;

        // First argument must be an options object
        const optionsArg = node.arguments[0];
        if (!optionsArg || optionsArg.type !== 'ObjectExpression') return;

        // Find the queryKey property
        const queryKeyProp = optionsArg.properties.find(
          (p) =>
            p.type === 'Property' &&
            p.key.type === 'Identifier' &&
            p.key.name === 'queryKey',
        );
        if (!queryKeyProp) return;

        const value = queryKeyProp.value;

        // Raw array is always wrong
        if (value.type === 'ArrayExpression') {
          context.report({ node: value, messageId: 'useQueryKeysConstant' });
          return;
        }

        // Must be a queryKeys.* call (not a plain variable or other expression)
        if (!isQueryKeysCall(value)) {
          context.report({ node: value, messageId: 'useQueryKeysConstant' });
        }
      },
    };
  },
};
