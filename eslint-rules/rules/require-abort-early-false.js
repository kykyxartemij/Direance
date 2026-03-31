/**
 * Rule: require-abort-early-false
 *
 * Every Yup .validate() call must pass { abortEarly: false } as the second argument.
 *
 * By default Yup stops at the first error (abortEarly: true). With abortEarly: false
 * all validation errors are collected and returned together — users see every problem
 * at once instead of fixing one field at a time.
 *
 * ✅ Good:
 *   await MyValidator.validate(body, { abortEarly: false });
 *
 * ❌ Bad:
 *   await MyValidator.validate(body);
 *   await MyValidator.validate(body, {});
 *   await MyValidator.validate(body, { abortEarly: true });
 */

/** Returns true if the node is an ObjectExpression containing abortEarly: false */
function hasAbortEarlyFalse(node) {
  if (!node || node.type !== 'ObjectExpression') return false;
  return node.properties.some(
    (prop) =>
      prop.type === 'Property' &&
      prop.key.type === 'Identifier' &&
      prop.key.name === 'abortEarly' &&
      prop.value.type === 'Literal' &&
      prop.value.value === false,
  );
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Yup .validate() calls must pass { abortEarly: false } so all errors are returned at once.',
    },
    messages: {
      missingAbortEarlyFalse:
        '.validate() is missing { abortEarly: false }. ' +
        'Without it Yup stops at the first error — users see only one problem at a time.',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.property.type !== 'Identifier' ||
          node.callee.property.name !== 'validate'
        )
          return;

        const options = node.arguments[1];
        if (!hasAbortEarlyFalse(options)) {
          context.report({ node, messageId: 'missingAbortEarlyFalse' });
        }
      },
    };
  },
};
