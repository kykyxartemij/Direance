/**
 * Rule: require-link-prefetch
 *
 * Enforces that every <Link> from 'next/link' with an internal href has an
 * explicit `prefetch` prop.
 *
 * Why: Next.js 15 changed the default to partial prefetch (hover-only).
 * Without explicit `prefetch`, clicking a link that was never hovered causes
 * a visible delay before the page skeleton appears — the browser waits for
 * the server to return the route shell before rendering anything.
 *
 * With `prefetch` (= true), Next.js prefetches the route shell when the link
 * enters the viewport, so the skeleton appears instantly on click.
 *
 * ✅ Good:
 *   <Link href="/video/123" prefetch>…</Link>
 *   <Link href="/video/123" prefetch={true}>…</Link>
 *
 * ❌ Bad:
 *   <Link href="/video/123">…</Link>
 */

module.exports = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description:
        'Require explicit `prefetch` on next/link <Link> components with internal hrefs. ' +
        'Next.js 15 defaults to hover-only prefetch, which causes a visible delay on quick clicks.',
    },
    messages: {
      missingPrefetch:
        'Add `prefetch` to this <Link>. ' +
        'Next.js 15 only prefetches on hover by default — without this, ' +
        'clicking before hovering shows a blank gap before the skeleton appears.',
    },
    schema: [],
  },

  create(context) {
    // Track which local names are imported from 'next/link'
    const linkImportNames = new Set();

    return {
      // Collect import declarations: import Link from 'next/link'
      ImportDeclaration(node) {
        if (node.source.value !== 'next/link') return;
        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportDefaultSpecifier' ||
            specifier.type === 'ImportNamespaceSpecifier'
          ) {
            linkImportNames.add(specifier.local.name);
          }
        }
      },

      JSXOpeningElement(node) {
        // Must be a <Link> imported from next/link
        const name =
          node.name.type === 'JSXIdentifier' ? node.name.name : null;
        if (!name || !linkImportNames.has(name)) return;

        // Check href — only enforce on internal routes (starts with /)
        const hrefAttr = node.attributes.find(
          (a) =>
            a.type === 'JSXAttribute' &&
            a.name.type === 'JSXIdentifier' &&
            a.name.name === 'href',
        );
        if (!hrefAttr) return;

        const hrefValue = hrefAttr.value;
        let isInternal = false;

        if (hrefValue?.type === 'Literal' && typeof hrefValue.value === 'string') {
          isInternal = hrefValue.value.startsWith('/');
        } else if (
          hrefValue?.type === 'JSXExpressionContainer' &&
          hrefValue.expression?.type === 'TemplateLiteral'
        ) {
          // Template literal like `/video/${id}` — treat as internal
          const firstQuasi = hrefValue.expression.quasis[0];
          isInternal = firstQuasi?.value?.raw?.startsWith('/') ?? false;
        }

        if (!isInternal) return;

        // Check for prefetch prop (boolean shorthand or explicit value)
        const hasPrefetch = node.attributes.some(
          (a) =>
            a.type === 'JSXAttribute' &&
            a.name.type === 'JSXIdentifier' &&
            a.name.name === 'prefetch',
        );

        if (!hasPrefetch) {
          context.report({
            node,
            messageId: 'missingPrefetch',
            fix(fixer) {
              // Insert `prefetch ` before the first existing attribute, or before the closing >
              const firstAttr = node.attributes[0];
              if (firstAttr) {
                return fixer.insertTextBefore(firstAttr, 'prefetch ');
              }
              // No attributes — insert before />
              return fixer.insertTextBefore(node, 'prefetch ');
            },
          });
        }
      },
    };
  },
};
