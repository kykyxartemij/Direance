const fs = require('fs');
const path = require('path');

/**
 * Rule: require-loading-page
 *
 * Enforces that every Next.js page.tsx has a sibling loading.tsx.
 *
 * Why: Next.js App Router uses loading.tsx as the Suspense boundary skeleton.
 * Without it, navigating to a page shows a blank screen until data loads.
 * With it, the skeleton appears instantly (especially combined with `prefetch`
 * on <Link>, which pre-fetches the loading shell into the router cache).
 *
 * ✅ Good:
 *   app/video/[id]/page.tsx   ← has sibling loading.tsx
 *   app/video/[id]/loading.tsx
 *
 * ❌ Bad:
 *   app/settings/page.tsx     ← no loading.tsx alongside it
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require a loading.tsx sibling for every Next.js page.tsx. ' +
        'Without it, navigation shows a blank screen until data loads.',
    },
    messages: {
      missingLoading:
        'Missing loading.tsx in the same directory. ' +
        'Add a skeleton loading.tsx so navigation shows a skeleton instead of a blank screen.',
    },
    schema: [],
  },

  create(context) {
    return {
      Program(node) {
        const filename = context.filename ?? context.getFilename();

        // Only applies to page.tsx / page.ts files
        const basename = path.basename(filename);
        if (basename !== 'page.tsx' && basename !== 'page.ts') return;

        const dir = path.dirname(filename);
        const hasLoading =
          fs.existsSync(path.join(dir, 'loading.tsx')) ||
          fs.existsSync(path.join(dir, 'loading.ts'));

        if (!hasLoading) {
          context.report({ node, messageId: 'missingLoading' });
        }
      },
    };
  },
};
