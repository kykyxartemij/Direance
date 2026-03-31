/**
 * Rule: require-parse-id
 *
 * Route parameters must be extracted via parseIdFromRoute() — never accessed raw.
 * Raw access skips UUID validation: attacker-supplied strings go straight to
 * Prisma's where clause, which can cause unexpected DB behaviour or expose
 * internal errors to callers.
 *
 * ✅ Good:
 *   const id = parseIdFromRoute(await params);
 *
 * ❌ Bad:
 *   const id = (await params).id;      // bypasses UUID validation
 *   const id = params.id;              // bypasses UUID validation
 *   const { id } = await params;       // bypasses UUID validation
 *   const { id } = params;             // bypasses UUID validation
 *
 * Note on "obfuscating IDs":
 *   parseIdFromRoute today validates that the raw string is a UUID and throws a
 *   typed ValidationError if not. A future improvement would be to encrypt/sign
 *   route IDs (e.g. with NanoID or a symmetric cipher) so that raw DB UUIDs are
 *   never exposed in URLs. parseIdFromRoute would then be the decryption/decode
 *   boundary — making the lint rule the right place to enforce that boundary.
 */

/** Returns true if node is the Identifier `params` or `await params` */
function isParamsNode(node) {
  if (node.type === 'Identifier' && node.name === 'params') return true;
  if (node.type === 'AwaitExpression' && isParamsNode(node.argument)) return true;
  return false;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Route parameters must be extracted via parseIdFromRoute(), not accessed raw. ' +
        'Raw access skips UUID validation and passes unvalidated strings to the database.',
    },
    messages: {
      useParseId:
        'Access params through parseIdFromRoute(). ' +
        'Raw access bypasses UUID validation — use: const id = parseIdFromRoute(await params);',
    },
    schema: [],
  },

  create(context) {
    return {
      // Catches: (await params).id  and  params.id
      MemberExpression(node) {
        if (node.computed) return;
        if (node.property.type !== 'Identifier' || node.property.name !== 'id') return;
        if (!isParamsNode(node.object)) return;
        context.report({ node, messageId: 'useParseId' });
      },

      // Catches: const { id } = await params  and  const { id } = params
      VariableDeclarator(node) {
        if (node.id.type !== 'ObjectPattern') return;
        if (!isParamsNode(node.init)) return;

        const hasIdProp = node.id.properties.some(
          (p) =>
            p.type === 'Property' &&
            p.key.type === 'Identifier' &&
            p.key.name === 'id',
        );
        if (hasIdProp) {
          context.report({ node, messageId: 'useParseId' });
        }
      },
    };
  },
};
