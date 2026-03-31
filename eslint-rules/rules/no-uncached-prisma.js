/**
 * Rule: no-uncached-prisma
 *
 * Enforces that all Prisma READ calls are wrapped in cached().
 * Write operations (create, update, delete, upsert) are intentionally excluded —
 * mutations must never be cached.
 *
 * ✅ Good:
 *   cached(() => prisma.comment.findMany({ where: { videoId: id } }), CACHE_KEYS.comment.paged(...))
 *   cached(() => prisma.video.count(), CACHE_KEYS.video.count())
 *
 * ❌ Bad:
 *   prisma.comment.findMany({ where: { videoId: id } })  // bypasses server cache
 *   prisma.video.count()                                  // every request hits the DB
 */

// Prisma read operations that should always be cached
const READ_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

/** Returns true if the CallExpression is a prisma read call (e.g. prisma.comment.findMany) */
function isPrismaReadCall(node) {
  const callee = node.callee;
  if (callee.type !== 'MemberExpression') return false;

  // The method name must be a read operation
  const methodName = callee.property?.name;
  if (!methodName || !READ_OPERATIONS.has(methodName)) return false;

  // Walk the member chain to find 'prisma' as the root identifier
  let obj = callee.object;
  while (obj.type === 'MemberExpression') {
    obj = obj.object;
  }
  return obj.type === 'Identifier' && obj.name === 'prisma';
}

/** Returns the method chain string, e.g. "comment.findMany" */
function getPrismaMethodChain(node) {
  const parts = [];
  let callee = node.callee;
  while (callee.type === 'MemberExpression') {
    if (callee.property?.name) parts.unshift(callee.property.name);
    callee = callee.object;
  }
  return parts.join('.');
}

/**
 * Returns true if the node is inside cached(() => <here>).
 * Walks up through the arrow function and checks if the parent call is named 'cached'.
 */
function isInsideCachedWrapper(node) {
  let current = node.parent;
  while (current) {
    if (
      current.type === 'ArrowFunctionExpression' &&
      current.parent?.type === 'CallExpression'
    ) {
      const parentCallee = current.parent.callee;
      if (parentCallee.type === 'Identifier' && parentCallee.name === 'cached') {
        return true;
      }
    }
    current = current.parent;
  }
  return false;
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require all Prisma read calls to be wrapped in cached() to use the server-side cache.',
      url: 'https://github.com/your-org/mepipe#server-side-caching',
    },
    messages: {
      wrapInCached:
        'Prisma read "{{ method }}" must be wrapped in cached(). ' +
        'Direct DB reads bypass the server cache and hit Neon on every request. ' +
        'Use: cached(() => prisma.{{ method }}(...), CACHE_KEYS.*)',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        if (!isPrismaReadCall(node)) return;
        if (isInsideCachedWrapper(node)) return;

        context.report({
          node,
          messageId: 'wrapInCached',
          data: { method: getPrismaMethodChain(node) },
        });
      },
    };
  },
};
