const path = require('path');

/**
 * Rule: require-art-page
 *
 * Enforces that every Next.js page.tsx renders <ArtPage> as its root.
 *
 * Why: ArtPage now owns what page.tsx/layout.tsx/loading.tsx used to split across three
 * files — chrome (title/actions), the Suspense boundary useSuspenseQuery hooks need, and
 * the loading/error gate. A page.tsx without it has no Suspense boundary at all, so any
 * useSuspenseQuery hook used by its content throws with nothing to catch it.
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
        'page.tsx must wrap its content in <ArtPage title="...">...</ArtPage> — this now ' +
        'owns chrome, the Suspense boundary, and the loading/error gate that ' +
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
