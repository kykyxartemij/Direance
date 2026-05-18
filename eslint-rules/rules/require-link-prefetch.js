/**
 * Rule: require-link-prefetch
 *
 * Enforces smart prefetch strategy: either use <Link prefetch> for always-prefetch,
 * or <FSLink> for smart prefetch on hover/focus.
 *
 * Two modes:
 * 1. <Link prefetch> — always prefetch when route enters viewport (use for key routes)
 * 2. <FSLink> — smart prefetch on hover/focus via Foresight (use in lists, tables)
 *
 * Why: Next.js 15 defaults to hover-only prefetch. For single links, <Link prefetch>
 * ensures instant navigation. For repeated links in lists (ArtDataTable, dropdowns),
 * <FSLink> reduces bandwidth by prefetching only routes user shows interest in.
 *
 * ✅ Good — single important link (key route):
 *   <Link href={HREF.mappings} prefetch>…</Link>
 *
 * ✅ Good — repeated link in a list (bandwidth-conscious):
 *   <FSLink href={HREF.mappingById(id)}>…</FSLink>
 *
 * ⚠️ Bad — Link inside ArtDataTable (repeated, high count):
 *   <ArtDataTable>
 *     <Link href={HREF.mappingById(id)}>…</Link>  ← use FSLink instead
 *   </ArtDataTable>
 *
 * ❌ Bad:
 *   <Link href="/mappings">…</Link>
 *   <FSLink href="/static-url" prefetch> (FSLink has built-in prefetch, no need for prop)
 */

module.exports = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description:
        'Enforce smart prefetch strategy: use <Link prefetch> for always-prefetch, ' +
        'or <FSLink> for hover-only smart prefetch in lists and tables.',
    },
    messages: {
      missingPrefetch:
        'Use <Link prefetch> for always-prefetch, or <FSLink> for smart prefetch on hover. ' +
        'Next.js 15 defaults to hover-only — on quick clicks, users see a delay before skeleton.',
      fsLinkWithPrefetch:
        'FSLink has built-in smart prefetch via Foresight — remove the `prefetch` prop.',
      linkInListContext:
        'Use <FSLink> instead of <Link> for repeated links in lists/tables. ' +
        'Smart prefetch reduces bandwidth and avoids prefetching routes user never visits.',
    },
    schema: [],
  },

  create(context) {
    // Track which local names are imported from 'next/link' and '@/components/FSLink'
    const linkImportNames = new Set();
    const fsLinkImportNames = new Set();

    // List/table components where Link should be FSLink
    const LIST_CONTEXTS = new Set(['ArtDataTable', 'ArtData', 'ArtListbox']);

    // Helper to check if node is inside a list context (direct JSX nesting)
    function isInsideListContext(node) {
      let parent = node.parent;
      while (parent) {
        if (
          parent.type === 'JSXElement' &&
          parent.openingElement?.name?.type === 'JSXIdentifier'
        ) {
          const parentName = parent.openingElement.name.name;
          if (LIST_CONTEXTS.has(parentName)) {
            return true;
          }
        }
        parent = parent.parent;
      }
      return false;
    }

    // Helper to check if node is inside a render callback (render, renderCell, renderRow, etc.)
    function isInsideRenderCallback(node) {
      let parent = node.parent;
      while (parent) {
        // Stop at JSXElement — don't cross out of the render function result
        if (parent.type === 'JSXElement') return false;

        // Check if this is a function expression with a property name matching render patterns
        if (
          (parent.type === 'ArrowFunctionExpression' ||
            parent.type === 'FunctionExpression') &&
          parent.parent?.type === 'Property'
        ) {
          const propName = parent.parent.key?.name || parent.parent.key?.value;
          if (propName && /^render|^renderCell|^renderRow|^renderContent/.test(propName)) {
            return true;
          }
        }

        parent = parent.parent;
      }
      return false;
    }

    return {
      // Collect import declarations
      ImportDeclaration(node) {
        if (node.source.value === 'next/link') {
          for (const specifier of node.specifiers) {
            if (
              specifier.type === 'ImportDefaultSpecifier' ||
              specifier.type === 'ImportNamespaceSpecifier'
            ) {
              linkImportNames.add(specifier.local.name);
            }
          }
        }
        if (node.source.value === '@/components/FSLink') {
          for (const specifier of node.specifiers) {
            if (specifier.type === 'ImportNamespaceSpecifier') {
              fsLinkImportNames.add(specifier.local.name);
            } else if (specifier.type === 'ImportSpecifier' && specifier.imported.name === 'FSLink') {
              fsLinkImportNames.add(specifier.local.name);
            }
          }
        }
      },

      JSXOpeningElement(node) {
        const name =
          node.name.type === 'JSXIdentifier' ? node.name.name : null;
        if (!name) return;

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
          const firstQuasi = hrefValue.expression.quasis[0];
          isInternal = firstQuasi?.value?.raw?.startsWith('/') ?? false;
        }

        if (!isInternal) return;

        // FSLink — check for redundant prefetch prop
        if (fsLinkImportNames.has(name)) {
          const hasPrefetch = node.attributes.some(
            (a) =>
              a.type === 'JSXAttribute' &&
              a.name.type === 'JSXIdentifier' &&
              a.name.name === 'prefetch',
          );
          if (hasPrefetch) {
            context.report({
              node,
              messageId: 'fsLinkWithPrefetch',
            });
          }
          return; // FSLink doesn't need prefetch prop — smart prefetch is built-in
        }

        // Link — check context and prefetch
        if (!linkImportNames.has(name)) return;

        // Warn if Link is inside a list context (direct JSX) or render callback
        if (isInsideListContext(node) || isInsideRenderCallback(node)) {
          context.report({
            node,
            messageId: 'linkInListContext',
          });
          return;
        }

        // Require prefetch prop for standalone Links
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
              const firstAttr = node.attributes[0];
              if (firstAttr) {
                return fixer.insertTextBefore(firstAttr, 'prefetch ');
              }
              return fixer.insertTextBefore(node, 'prefetch ');
            },
          });
        }
      },
    };
  },
};
