/**
 * Rule: no-dialog-trigger-onclick
 *
 * Two checks for ArtDialog / ArtConfirmDialog:
 *
 * 1. TRIGGER — The first JSX child (the trigger that opens the dialog) must NOT
 *    have onClick. ArtDialog wraps it with its own click handler at render time;
 *    any existing onClick is silently discarded.
 *
 * 2. BUTTONS — Each item in the `buttons={[...]}` prop array SHOULD have onClick.
 *    A button without onClick just closes the dialog (closesDialog defaults to true),
 *    which is almost always unintentional for action buttons. Use cancelButton for
 *    a plain close action instead.
 *
 * ✅ Good (trigger):
 *   <ArtDialog title="Delete">
 *     <ArtButton variant="ghost">Open</ArtButton>
 *   </ArtDialog>
 *
 * ❌ Bad (trigger — onClick is overwritten):
 *   <ArtDialog title="Delete">
 *     <ArtButton onClick={openSomething}>Open</ArtButton>
 *   </ArtDialog>
 *
 * ✅ Good (buttons):
 *   <ArtDialog title="Apply" buttons={[{ label: 'Apply', onClick: () => save() }]}>
 *     <ArtButton>Open</ArtButton>
 *   </ArtDialog>
 *
 * ❌ Bad (buttons — button does nothing except close the dialog):
 *   <ArtDialog title="Apply" buttons={[{ label: 'Apply', color: 'primary' }]}>
 *     <ArtButton>Open</ArtButton>
 *   </ArtDialog>
 */

const DIALOG_COMPONENTS = new Set(['ArtDialog', 'ArtConfirmDialog']);

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'ArtDialog trigger must not have onClick (it is overwritten by ArtDialog). ' +
        'ArtDialog buttons array items should have onClick — without it the button just closes the dialog.',
    },
    messages: {
      triggerHasOnClick:
        'Remove onClick from the <{{name}}> trigger. ' +
        'ArtDialog replaces this onClick with its open handler at runtime — yours will be discarded.',
      buttonMissingOnClick:
        'This button object in the `buttons` prop has no onClick. ' +
        'Without onClick the button only closes the dialog (same as cancelButton). ' +
        'Add onClick: () => { ... } or use cancelButton={true} for a plain close action.',
    },
    schema: [],
  },

  create(context) {
    return {
      JSXElement(node) {
        const opening = node.openingElement;
        const componentName =
          opening.name.type === 'JSXIdentifier' ? opening.name.name : null;
        if (!componentName || !DIALOG_COMPONENTS.has(componentName)) return;

        // ==== Check 1: trigger child must not have onClick ====

        const triggerChild = node.children.find((c) => c.type === 'JSXElement');
        if (triggerChild) {
          const onClickAttr = triggerChild.openingElement.attributes.find(
            (attr) =>
              attr.type === 'JSXAttribute' &&
              attr.name.type === 'JSXIdentifier' &&
              attr.name.name === 'onClick',
          );
          if (onClickAttr) {
            const triggerName =
              triggerChild.openingElement.name.type === 'JSXIdentifier'
                ? triggerChild.openingElement.name.name
                : 'element';
            context.report({
              node: onClickAttr,
              messageId: 'triggerHasOnClick',
              data: { name: triggerName },
            });
          }
        }

        // ==== Check 2: buttons prop items must have onClick ====
        // Only applies to inline array literals — can't analyse variables statically.

        const buttonsAttr = opening.attributes.find(
          (attr) =>
            attr.type === 'JSXAttribute' &&
            attr.name.type === 'JSXIdentifier' &&
            attr.name.name === 'buttons',
        );

        if (!buttonsAttr) return;

        const expr = buttonsAttr.value?.type === 'JSXExpressionContainer'
          ? buttonsAttr.value.expression
          : null;

        if (!expr || expr.type !== 'ArrayExpression') return;

        for (const elem of expr.elements) {
          if (!elem || elem.type !== 'ObjectExpression') continue;

          const hasOnClick = elem.properties.some(
            (p) =>
              p.type === 'Property' &&
              p.key.type === 'Identifier' &&
              p.key.name === 'onClick',
          );

          if (!hasOnClick) {
            context.report({ node: elem, messageId: 'buttonMissingOnClick' });
          }
        }
      },
    };
  },
};
