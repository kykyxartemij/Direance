/**
 * Rule: no-router-push-navigation
 *
 * Warns when an onClick handler contains only a router.push() call.
 * Pure navigation belongs in a <Link prefetch> — not a click handler.
 *
 * Why: router.push() skips prefetch entirely. <Link prefetch> pre-downloads
 * the route shell on viewport entry, so the skeleton appears instantly on click.
 * onClick handlers also disable right-click → Open in new tab, cmd+click, etc.
 *
 * ✅ Good:
 *   <Link href="/mappings/123" prefetch><ArtButton>Edit</ArtButton></Link>
 *   <Link href="/mappings/new" prefetch>New</Link>
 *
 * ❌ Bad:
 *   <ArtButton onClick={() => router.push('/mappings/123')}>Edit</ArtButton>
 *   onClick={() => router.push(`/mappings/${id}`)}
 *
 * ✅ OK (side effects alongside push — keep as-is):
 *   onClick={() => { removeReport(id); router.push('/upload'); }}
 *   onClick={() => { await save(); router.push('/list'); }}
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow router.push() as the sole statement in an onClick handler. ' +
        'Use <Link prefetch> instead for pure navigation.',
    },
    messages: {
      preferLink:
        'Replace onClick with <Link prefetch href="...">. ' +
        'router.push() skips prefetch — Link pre-downloads the route shell on viewport entry.',
    },
    schema: [],
  },

  create(context) {
    // Track which local names are the useRouter() result
    // We can't easily track the return value, so we check MemberExpression shape instead.

    function isRouterPushCall(node) {
      return (
        node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        node.callee.property.type === 'Identifier' &&
        node.callee.property.name === 'push' &&
        node.callee.object.type === 'Identifier'
      );
    }

    function isSoleRouterPush(fn) {
      const body = fn.body;
      // Expression body: () => router.push(...)
      if (body.type !== 'BlockStatement') {
        return isRouterPushCall(body);
      }
      // Block body with one statement: () => { router.push(...) }
      if (body.body.length === 1) {
        const stmt = body.body[0];
        return (
          stmt.type === 'ExpressionStatement' &&
          isRouterPushCall(stmt.expression)
        );
      }
      return false;
    }

    return {
      JSXAttribute(node) {
        if (
          node.name.type !== 'JSXIdentifier' ||
          node.name.name !== 'onClick'
        ) return;

        const container = node.value;
        if (!container || container.type !== 'JSXExpressionContainer') return;

        const fn = container.expression;
        if (
          fn.type !== 'ArrowFunctionExpression' &&
          fn.type !== 'FunctionExpression'
        ) return;

        if (isSoleRouterPush(fn)) {
          context.report({ node, messageId: 'preferLink' });
        }
      },
    };
  },
};
