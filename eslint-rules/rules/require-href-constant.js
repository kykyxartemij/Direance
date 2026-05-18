/**
 * Rule: require-href-constant
 *
 * Enforces that <Link> and <FSLink> use HREF constants instead of hardcoded route strings.
 *
 * Why: Hardcoded hrefs cause bugs when routes change. HREF constants in
 * src/lib/href.ts centralize route definitions and enable safe refactoring.
 *
 * ✅ Good:
 *   <Link href={HREF.mappings} prefetch>…</Link>
 *   <FSLink href={HREF.mappingById(id)}>…</FSLink>
 *   <Link href="https://example.com">external</Link>  ← external URLs OK
 *
 * ❌ Bad:
 *   <Link href="/mappings">…</Link>
 *   <FSLink href={`/mappings/${id}`}>…</FSLink>
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require <Link> and <FSLink> to use HREF constants instead of hardcoded route strings.',
    },
    messages: {
      useHrefConstant:
        'Use HREF.{{suggestion}} instead of hardcoded href. ' +
        'HREF constants are centralized in src/lib/href.ts for safe refactoring.',
      useHrefDynamic:
        'Use HREF.{{suggestion}}(id) or similar computed route instead of template literal. ' +
        'HREF constants support dynamic segments.',
    },
    schema: [],
  },

  create(context) {
    // Track imports
    const linkImportNames = new Set();
    const fsLinkImportNames = new Set();
    let hasHrefImport = false;

    return {
      ImportDeclaration(node) {
        // Track Link from next/link
        if (node.source.value === 'next/link') {
          for (const specifier of node.specifiers) {
            if (specifier.type === 'ImportDefaultSpecifier') {
              linkImportNames.add(specifier.local.name);
            }
          }
        }
        // Track FSLink from @/components/FSLink
        if (node.source.value === '@/components/FSLink') {
          for (const specifier of node.specifiers) {
            if (specifier.type === 'ImportSpecifier' && specifier.imported.name === 'FSLink') {
              fsLinkImportNames.add(specifier.local.name);
            }
          }
        }
        // Track HREF constant import
        if (node.source.value === '@/lib/href') {
          for (const specifier of node.specifiers) {
            if (specifier.type === 'ImportSpecifier' && specifier.imported.name === 'HREF') {
              hasHrefImport = true;
            }
          }
        }
      },

      JSXOpeningElement(node) {
        const name = node.name.type === 'JSXIdentifier' ? node.name.name : null;
        if (!name || (!linkImportNames.has(name) && !fsLinkImportNames.has(name))) {
          return;
        }

        // Find href attribute
        const hrefAttr = node.attributes.find(
          (a) =>
            a.type === 'JSXAttribute' &&
            a.name.type === 'JSXIdentifier' &&
            a.name.name === 'href',
        );
        if (!hrefAttr || !hrefAttr.value) return;

        const hrefValue = hrefAttr.value;
        let isHardcodedRoute = false;
        let isDynamicRoute = false;
        let routeGuess = '';

        // Case 1: Hardcoded string literal like href="/mappings"
        if (hrefValue.type === 'Literal' && typeof hrefValue.value === 'string') {
          const href = hrefValue.value;
          // Allow external URLs (http, https, mailto, etc.)
          if (href.match(/^(https?:|mailto:|tel:|[\w-]*:)/)) {
            return;
          }
          // Allow hash anchors
          if (href.startsWith('#')) {
            return;
          }
          // Internal route — flag it
          isHardcodedRoute = true;
          routeGuess = href.replace(/\/$/, '').slice(1); // strip leading / and trailing /
        }

        // Case 2: Template literal like href={`/mappings/${id}`}
        if (
          hrefValue.type === 'JSXExpressionContainer' &&
          hrefValue.expression?.type === 'TemplateLiteral'
        ) {
          const firstQuasi = hrefValue.expression.quasis[0];
          const startsWithSlash = firstQuasi?.value?.raw?.startsWith('/') ?? false;
          if (startsWithSlash) {
            isDynamicRoute = true;
            routeGuess = firstQuasi.value.raw.replace(/\/$/, '').slice(1);
          }
        }

        if (!isHardcodedRoute && !isDynamicRoute) return;

        // Suggest HREF constant based on route pattern
        let suggestion = 'mappings'; // default fallback
        if (routeGuess) {
          // Convert /export-settings to exportSettings, /mappings to mappings, etc.
          suggestion = routeGuess
            .split('-')
            .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
            .join('');
        }

        context.report({
          node: hrefAttr,
          messageId: isHardcodedRoute ? 'useHrefConstant' : 'useHrefDynamic',
          data: { suggestion },
        });
      },
    };
  },
};
