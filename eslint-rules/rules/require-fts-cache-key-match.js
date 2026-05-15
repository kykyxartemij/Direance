/**
 * Rule: require-fts-cache-key-match
 *
 * Enforces that the `collectionCacheKey` (4th) argument passed to withFts()
 * matches a top-level key in CACHE_KEYS, AND that key's `invalidate()` function
 * returns an array whose first element equals the same string.
 *
 * Why: withFts uses collectionCacheKey to tag its server cache. CACHE_KEYS.X.invalidate()
 * is the only way to invalidate that tag. If the two drift apart, mutations silently
 * stop busting the FTS cache.
 *
 * ✅ Good:
 *   withFts(base, base.exportSetting, '"ExportSetting"', 'exportSetting', 'name')
 *   // CACHE_KEYS.exportSetting.invalidate() === ['exportSetting', ...] ✓
 *
 * ❌ Bad:
 *   withFts(base, base.exportSetting, '"ExportSetting"', 'exportsetting', 'name')
 *   // No CACHE_KEYS.exportsetting — typo, mutations won't invalidate FTS cache
 */

const fs = require('fs');
const path = require('path');

/**
 * Lazily parses cacheKeys.ts and returns a map: { topLevelKey: firstInvalidateElement }.
 * Cached per ESLint run to avoid re-reading on every withFts call.
 */
let cacheKeysMapCache = null;
let cacheKeysMtime = 0;

function loadCacheKeysMap(context) {
  // Find cacheKeys.ts relative to the linted file
  const cwd = context.getCwd ? context.getCwd() : process.cwd();
  const cacheKeysPath = path.join(cwd, 'src', 'lib', 'cacheKeys.ts');

  let stat;
  try {
    stat = fs.statSync(cacheKeysPath);
  } catch {
    return null; // file missing — skip the rule rather than crash
  }

  if (cacheKeysMapCache && stat.mtimeMs === cacheKeysMtime) {
    return cacheKeysMapCache;
  }

  const src = fs.readFileSync(cacheKeysPath, 'utf8');
  const map = parseCacheKeys(src);
  cacheKeysMapCache = map;
  cacheKeysMtime = stat.mtimeMs;
  return map;
}

/**
 * Regex-parses CACHE_KEYS = { topKey: { invalidate: (...) => [<first>, ...] } }.
 * Returns { topKey: firstElement } for every top-level group that defines invalidate.
 *
 * Not a full TS parser — relies on the file's existing flat structure. If the file
 * adopts a different shape, this returns a partial map and unmatched groups simply
 * won't enforce the rule (no false positives).
 */
function parseCacheKeys(src) {
  const result = {};
  // Match: <key>: { ... invalidate: (...) => [ '<first>' ... ] ... }
  // Non-greedy block match, anchored on top-level keys.
  const groupRe = /(\w+)\s*:\s*\{[\s\S]*?invalidate\s*:\s*\([^)]*\)\s*=>\s*\[\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = groupRe.exec(src)) !== null) {
    const [, topKey, firstElement] = m;
    if (!(topKey in result)) result[topKey] = firstElement;
  }
  return result;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require withFts(collectionCacheKey) to match a CACHE_KEYS group whose invalidate() returns the same string as its first element.',
    },
    messages: {
      notInCacheKeys:
        '"{{key}}" is not a top-level key in CACHE_KEYS. ' +
        'withFts uses it as a cache tag, but CACHE_KEYS.{{key}}.invalidate() does not exist — ' +
        'mutations will not bust the FTS cache. Add a CACHE_KEYS.{{key}} group or fix the literal.',
      mismatch:
        'withFts collectionCacheKey "{{key}}" does not match CACHE_KEYS.{{key}}.invalidate()[0] = "{{actual}}". ' +
        'These must be identical or invalidation tags will drift.',
      nonLiteral:
        'withFts collectionCacheKey must be a string literal so it can be statically verified against CACHE_KEYS.',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'Identifier' || callee.name !== 'withFts') return;

        const keyArg = node.arguments[3];
        if (!keyArg) return; // missing arg — TS catches it

        if (keyArg.type !== 'Literal' || typeof keyArg.value !== 'string') {
          context.report({ node: keyArg, messageId: 'nonLiteral' });
          return;
        }

        const key = keyArg.value;
        const map = loadCacheKeysMap(context);
        if (!map) return; // cacheKeys.ts missing — silently skip

        if (!(key in map)) {
          context.report({ node: keyArg, messageId: 'notInCacheKeys', data: { key } });
          return;
        }

        if (map[key] !== key) {
          context.report({
            node: keyArg,
            messageId: 'mismatch',
            data: { key, actual: map[key] },
          });
        }
      },
    };
  },
};
