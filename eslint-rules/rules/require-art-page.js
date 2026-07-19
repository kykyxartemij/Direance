const path = require('path');

/**
 * Rule: require-art-page
 *
 * Enforces that every Next.js page.tsx renders <ArtPage> as its root.
 *
 * Why: ArtPage owns what page.tsx/layout.tsx/loading.tsx used to split across three files —
 * chrome (title/actions), a Suspense boundary, and the error fallback. A page.tsx without it
 * has no boundary at all, so `useSearchParams` (which suspends during prerender) and any lazy
 * child throw with nothing to catch them, and the page loses its error fallback.
 *
 * ✅ Good:
 *   export default function Page() {
 *     return <ArtPage title="...">...</ArtPage>;
 *   }
 *
 * ❌ Bad:
 *   export default function Page() {
 *     return <SomeFeaturePage />;
 *   }
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require page.tsx to render <ArtPage> as its root — replaces the old ' +
        'layout.tsx/loading.tsx split.',
    },
    messages: {
      missingArtPage:
        'page.tsx must wrap its content in <ArtPage title="...">...</ArtPage> — this owns ' +
        'chrome, the Suspense boundary, and the error fallback that ' +
        'layout.tsx/loading.tsx used to provide.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename ?? context.getFilename();
    const basename = path.basename(filename);
    if (basename !== 'page.tsx' && basename !== 'page.ts') return {};

    let found = false;

    return {
      JSXOpeningElement(node) {
        if (node.name.type === 'JSXIdentifier' && node.name.name === 'ArtPage') {
          found = true;
        }
      },
      'Program:exit'(node) {
        if (!found) {
          context.report({ node, messageId: 'missingArtPage' });
        }
      },
    };
  },
};
