/**
 * Rule: require-api-try-catch
 *
 * Every exported async function in service/route files must wrap its body in
 * try { ... } catch (error) { return handleApiError(error, '...'); }
 *
 * Without this, unhandled exceptions reach Next.js's default error handler,
 * which leaks stack traces and returns inconsistent error shapes to clients.
 *
 * ✅ Good:
 *   export async function getVideos(request) {
 *     try {
 *       return NextResponse.json(data);
 *     } catch (error) {
 *       return handleApiError(error, 'GET videos');
 *     }
 *   }
 *
 * ❌ Bad:
 *   export async function getVideos(request) {  // no try/catch at all
 *     return NextResponse.json(await prisma.video.findMany());
 *   }
 *
 *   export async function getVideos(request) {
 *     try { ... } catch (error) { throw error; }  // catch doesn't call handleApiError
 *   }
 */

/**
 * Returns true when the function body is a single `return someService(args)` or
 * `return await someService(args)` — a pure delegate that relies on the callee's
 * own try/catch. No wrapping needed here.
 */
function isSingleCallDelegate(fn) {
  const stmts = fn.body?.body;
  if (!stmts || stmts.length !== 1) return false;
  const stmt = stmts[0];
  if (stmt.type !== 'ReturnStatement') return false;
  const arg = stmt.argument;
  return (
    arg?.type === 'CallExpression' ||
    (arg?.type === 'AwaitExpression' && arg.argument?.type === 'CallExpression')
  );
}

/** Returns the function node if the export is an exported async function, otherwise null. */
function getExportedAsyncFn(node) {
  if (node.type !== 'ExportNamedDeclaration' || !node.declaration) return null;

  // export async function foo() {}
  if (node.declaration.type === 'FunctionDeclaration' && node.declaration.async) {
    return node.declaration;
  }

  // export const foo = async () => {}  /  export const foo = async function() {}
  if (node.declaration.type === 'VariableDeclaration') {
    for (const decl of node.declaration.declarations) {
      if (
        decl.init &&
        (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression') &&
        decl.init.async
      ) {
        return decl.init;
      }
    }
  }

  return null;
}

/** Returns true if the node is a direct call to handleApiError(...) */
function isHandleApiErrorCall(node) {
  return (
    node != null &&
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'handleApiError'
  );
}

/** Returns true if the catch handler block contains a handleApiError call */
function catchCallsHandleApiError(handler) {
  if (!handler?.body?.body) return false;
  return handler.body.body.some((stmt) => {
    if (stmt.type === 'ReturnStatement') return isHandleApiErrorCall(stmt.argument);
    if (stmt.type === 'ExpressionStatement') return isHandleApiErrorCall(stmt.expression);
    return false;
  });
}

/** Derives a human-readable name from the export declaration for error messages */
function getFunctionName(node) {
  if (node.declaration?.type === 'FunctionDeclaration') return node.declaration.id?.name ?? '(anonymous)';
  if (node.declaration?.type === 'VariableDeclaration') {
    return node.declaration.declarations[0]?.id?.name ?? '(anonymous)';
  }
  return '(anonymous)';
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Exported async service/route functions must have try/catch with handleApiError() in the catch. ' +
        'Without it, unhandled exceptions leak stack traces and return inconsistent error shapes.',
    },
    messages: {
      missingTryCatch:
        'Exported async function "{{name}}" has no try/catch. ' +
        'Wrap the body: try { ... } catch (error) { return handleApiError(error, \'{{name}}\'); }',
      missingHandleApiError:
        '"{{name}}" has a catch block but does not call handleApiError(). ' +
        'Replace the catch body with: return handleApiError(error, \'{{name}}\');',
    },
    schema: [],
  },

  create(context) {
    return {
      ExportNamedDeclaration(node) {
        const fn = getExportedAsyncFn(node);
        if (!fn) return;

        const body = fn.body;
        // Skip empty or non-block bodies (e.g., arrow expression bodies)
        if (!body || body.type !== 'BlockStatement' || body.body.length === 0) return;

        // Skip pure delegates: `return serviceCall(args)` — the callee owns the try/catch
        if (isSingleCallDelegate(fn)) return;

        const name = getFunctionName(node);
        const tryStmt = body.body.find((s) => s.type === 'TryStatement');

        if (!tryStmt) {
          context.report({ node: fn, messageId: 'missingTryCatch', data: { name } });
          return;
        }

        if (!catchCallsHandleApiError(tryStmt.handler)) {
          context.report({
            node: tryStmt.handler ?? tryStmt,
            messageId: 'missingHandleApiError',
            data: { name },
          });
        }
      },
    };
  },
};
