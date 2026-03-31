/**
 * Local ESLint plugin for MePipe project conventions.
 *
 * Rules are in ./rules/ — each file is one rule.
 * To add a new rule:
 *   1. Create eslint-rules/rules/your-rule-name.js
 *   2. Add it to the `rules` object below
 *   3. Enable it in eslint.config.mjs under rules: { 'local/your-rule-name': 'warn' }
 */

const noUncachedPrisma         = require('./rules/no-uncached-prisma');
const requireCacheKeysConstant = require('./rules/require-cache-keys-constant');
const requireLinkPrefetch      = require('./rules/require-link-prefetch');
const requireLoadingPage       = require('./rules/require-loading-page');
const noDialogTriggerOnclick   = require('./rules/no-dialog-trigger-onclick');
const requireApiTryCatch       = require('./rules/require-api-try-catch');
const requireParseId           = require('./rules/require-parse-id');
const requireQueryKeysConstant = require('./rules/require-query-keys-constant');
const requireNormalizeText     = require('./rules/require-normalize-text');
const requireAbortEarlyFalse   = require('./rules/require-abort-early-false');

module.exports = {
  rules: {
    // ==== BE ====
    'no-uncached-prisma':          noUncachedPrisma,
    'require-cache-keys-constant': requireCacheKeysConstant,
    'require-api-try-catch':       requireApiTryCatch,
    'require-parse-id':            requireParseId,
    'require-normalize-text':      requireNormalizeText,
    'require-abort-early-false':   requireAbortEarlyFalse,

    // ==== FE ====
    'require-link-prefetch':       requireLinkPrefetch,
    'require-loading-page':        requireLoadingPage,
    'no-dialog-trigger-onclick':   noDialogTriggerOnclick,
    'require-query-keys-constant': requireQueryKeysConstant,
  },
};
