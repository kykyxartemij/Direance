/**
 * Rule: require-cache-keys-constant
 *
 * Enforces that the second argument to cached() is a CACHE_KEYS.* call,
 * not a raw inline array. Raw arrays scatter cache key definitions across
 * files and make invalidation hard to track.
 *
 * ✅ Good:
 *   cached(() => prisma.comment.findMany(...), CACHE_KEYS.comment.paged(id, page, pageSize))
 *
 * ❌ Bad:
 *   cached(() => prisma.comment.findMany(...), ['comment', id, String(page)])  // use CACHE_KEYS instead
 */

/** Returns true if the node is a CACHE_KEYS.something.something() call */
function isCacheKeysCall(node) {
  if (node.type !== 'CallExpression') return false;

  // Walk the callee chain: CACHE_KEYS.comment.paged(...)
  let callee = node.callee;
  while (callee.type === 'MemberExpression') {
    callee = callee.object;
  }

  // The root should be CACHE_KEYS
  return callee.type === 'Identifier' && callee.name === 'CACHE_KEYS';
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require the cache key argument in cached() to use CACHE_KEYS constants, not raw arrays.',
    },
    messages: {
      useCacheKeysConstant:
        'Use a CACHE_KEYS.* constant instead of a raw array. ' +
        'This keeps all cache keys in one place and makes invalidation traceable. ' +
        'Add a new key to src/lib/cacheKeys.ts if one does not exist yet.',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        // Only care about calls to cached(fn, key)
        const callee = node.callee;
        if (callee.type !== 'Identifier' || callee.name !== 'cached') return;

        const keyArg = node.arguments[1];
        if (!keyArg) return; // missing key is caught by TypeScript

        // The key must NOT be a raw array literal
        if (keyArg.type === 'ArrayExpression') {
          context.report({ node: keyArg, messageId: 'useCacheKeysConstant' });
          return;
        }

        // The key must be a CACHE_KEYS.* call (not some other variable/expression)
        if (!isCacheKeysCall(keyArg)) {
          context.report({ node: keyArg, messageId: 'useCacheKeysConstant' });
        }
      },
    };
  },
};
