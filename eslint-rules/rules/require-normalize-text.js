/**
 * Rule: require-normalize-text
 *
 * Calls to searchParams.get() for text/search parameters must be wrapped in
 * normalizeText(). Raw strings from URL params are untrimmed, case-sensitive,
 * and unbounded in length — normalizeText() trims, lowercases, and caps at 100 chars.
 *
 * Only flags keys that are clearly free-text search parameters. Pagination
 * keys (page, pageSize) are excluded — those go through parsePaginationFromUrl.
 *
 * ✅ Good:
 *   const freeText = normalizeText(searchParams.get('freeText') ?? '');
 *   const q = normalizeText(searchParams.get('q') ?? '');
 *
 * ❌ Bad:
 *   const freeText = searchParams.get('freeText');          // not normalized
 *   const freeText = searchParams.get('freeText') ?? '';    // trimmed but not lowercased
 */

// Keys that represent user-supplied text search — must go through normalizeText.
// Add keys here if your endpoint exposes new text-search parameters.
const TEXT_PARAM_KEYS = new Set([
  'freeText',
  'search',
  'query',
  'q',
  'text',
  'name',
  'filter',
  'keyword',
  'title',
]);

/** Returns true if `node` is directly nested inside a normalizeText(...) call */
function isInsideNormalizeText(node) {
  // Walk up — stop at function/arrow boundaries so we don't cross scope
  let current = node.parent;
  while (current) {
    if (
      current.type === 'CallExpression' &&
      current.callee.type === 'Identifier' &&
      current.callee.name === 'normalizeText'
    ) {
      return true;
    }
    if (
      current.type === 'FunctionDeclaration' ||
      current.type === 'FunctionExpression' ||
      current.type === 'ArrowFunctionExpression'
    ) {
      break;
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
        'searchParams.get() for text search parameters must be wrapped in normalizeText(). ' +
        'Raw URL strings are untrimmed, case-sensitive, and unbounded.',
    },
    messages: {
      wrapInNormalizeText:
        'Wrap searchParams.get("{{key}}") in normalizeText(). ' +
        'Raw URL params are untrimmed, case-sensitive, and unbounded. ' +
        'Use: normalizeText(searchParams.get("{{key}}") ?? \'\')',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        // Must be a .get() call
        const callee = node.callee;
        if (callee.type !== 'MemberExpression') return;
        if (callee.property.type !== 'Identifier' || callee.property.name !== 'get') return;

        // Object must contain "searchParams" or end in "Params"
        const obj = callee.object;
        if (obj.type !== 'Identifier') return;
        if (!obj.name.toLowerCase().includes('params')) return;

        // First argument must be a string literal matching a text param key
        const keyArg = node.arguments[0];
        if (!keyArg || keyArg.type !== 'Literal' || typeof keyArg.value !== 'string') return;
        if (!TEXT_PARAM_KEYS.has(keyArg.value)) return;

        // Flag if not already wrapped in normalizeText()
        if (!isInsideNormalizeText(node)) {
          context.report({
            node,
            messageId: 'wrapInNormalizeText',
            data: { key: keyArg.value },
          });
        }
      },
    };
  },
};
