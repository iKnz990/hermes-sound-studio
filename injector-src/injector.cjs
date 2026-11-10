/* TypeScript AST-only JSX/TSX edit planner. No file writes or eval. */
'use strict';
const fs = require('fs');
const ts = require('typescript');
const EVENTS = [
  ['onPointerEnter', 'onHover', 'button,input,select,textarea'],
  ['onFocus', 'onFocus', 'button,input,select,textarea'],
  ['onClick', 'onCommit', 'button'],
  ['onChange', 'onToggle', 'input,select'],
];
function scan({ source, filePath, importPath, requireClient }) {
  if (typeof source !== 'string' || typeof filePath !== 'string' || !/\.(tsx|jsx)$/.test(filePath)) throw Error('JSX/TSX only');
  if (typeof importPath !== 'string' || !/^(?:\.\/|(?:\.\.\/)+)[A-Za-z0-9_./-]{1,150}$/.test(importPath) || importPath.replace(/^(?:\.\/|(?:\.\.\/)+)/, '').split('/').includes('..') || importPath.endsWith('/')) throw Error('unsafe relative import path');
  const syntax = filePath.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.JSX;
  const ast = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, syntax);
  if (ast.parseDiagnostics.length) return { edits: [], skipped: ['syntax_error'] };
  let hasClient = false;
  for (const statement of ast.statements) {
    if (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)) {
      if (statement.expression.text === 'use client') hasClient = true;
    } else break;
  }
  if ((requireClient || /(^|[\\/])app[\\/]/.test(filePath)) && !hasClient) return { edits: [], skipped: ['server_component'] };
  const importLine = `import { sonic as hermesSonic } from ${JSON.stringify(importPath)};`;
  // Accept only the real matching import, and refuse any competing lexical binding.
  const imports = [];
  let conflictingBinding = false;
  function checkBindings(node) {
    if (ts.isImportSpecifier(node) && node.name.text === 'hermesSonic') {
      const declaration = node.parent.parent.parent;
      if (node.propertyName?.text === 'sonic' && !node.isTypeOnly && !declaration.importClause?.isTypeOnly && declaration.moduleSpecifier?.text === importPath) imports.push(node);
      else conflictingBinding = true;
    } else if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node) || ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isFunctionExpression(node) || ts.isClassExpression(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node) || ts.isImportClause(node) || ts.isImportEqualsDeclaration(node) || ts.isTypeParameterDeclaration(node)) && node.name && ts.isIdentifier(node.name) && node.name.text === 'hermesSonic') {
      conflictingBinding = true;
    }
    ts.forEachChild(node, checkBindings);
  }
  checkBindings(ast);
  if (conflictingBinding || imports.length > 1 || (source.includes('hermesSonic') && imports.length !== 1)) return { edits: [], skipped: ['identifier_conflict'] };
  const hasImport = imports.length === 1;
  const edits = [], skipped = [];
  function walk(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(ast);
      if (['button', 'input', 'select', 'textarea'].includes(tag)) {
        const attrs = node.attributes.properties;
        const optout = attrs.some(a => ts.isJsxAttribute(a) && (a.name.text === 'data-sonic-ignore' || (a.name.text === 'data-sonic-ui' && (a.initializer?.getText(ast) === '"off"' || a.initializer?.getText(ast) === "'off'" || a.initializer?.getText(ast) === '{false}'))));
        if (optout) { skipped.push('opt_out'); }
        else if (attrs.some(a => ts.isJsxSpreadAttribute(a))) { skipped.push('spread_attribute'); }
        else {
          const additions = [];
          for (const [attrName, event, tags] of EVENTS) {
            if (!tags.split(',').includes(tag)) continue;
            const old = attrs.find(a => ts.isJsxAttribute(a) && a.name.text === attrName);
            if (!old) {
              additions.push(` ${attrName}={() => hermesSonic.${event}()}`);
              continue;
            }
            if (!old.initializer || !ts.isJsxExpression(old.initializer) || !old.initializer.expression) { skipped.push('ambiguous_handler'); continue; }
            const expr = old.initializer.expression;
            if (expr.getText(ast).includes('hermesSonic.')) continue;
            if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
              if (ts.isBlock(expr.body)) edits.push({start: expr.body.getStart(ast) + 1, end: expr.body.getStart(ast) + 1, text: ` hermesSonic.${event}();`});
              else edits.push({start: expr.body.getStart(ast), end: expr.body.getEnd(), text: `{ hermesSonic.${event}(); return (${expr.body.getText(ast)}); }`});
            } else if (ts.isIdentifier(expr) || ts.isPropertyAccessExpression(expr)) {
              // Capture the original callback at render, preserving optionality and return.
              edits.push({start: expr.getStart(ast), end: expr.getEnd(), text: `hermesSonic.wrap(${expr.getText(ast)}, '${event}')`});
            } else skipped.push('ambiguous_handler');
          }
          if (additions.length) {
            const end = node.getEnd();
            let i = end - 1;
            if (source.slice(end - 2, end) === '/>') i = end - 2;
            edits.push({start: i, end: i, text: additions.join('')});
          }
        }
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(ast);
  if (edits.length && !hasImport) {
    let position = 0;
    for (const statement of ast.statements) {
      if (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)) position = statement.getEnd();
      else break;
    }
    edits.push({start: position, end: position, text: `${position ? '\n' : ''}${importLine}\n`});
  }
  if (edits.length) {
    let candidate = source;
    for (const edit of edits.sort((a, b) => b.start - a.start || b.end - a.end)) {
      candidate = candidate.slice(0, edit.start) + edit.text + candidate.slice(edit.end);
    }
    const parsed = ts.createSourceFile(filePath, candidate, ts.ScriptTarget.Latest, true, syntax);
    if (parsed.parseDiagnostics.length) return { edits: [], skipped: [...skipped, 'transformed_syntax_error'] };
  }
  return {edits, skipped};
}
try {
  const input = fs.readFileSync(0, 'utf8');
  if (input.length > 600000) throw Error('input too large');
  const result = scan(JSON.parse(input));
  process.stdout.write(JSON.stringify(result));
} catch (e) {
  process.stderr.write(String(e.message || e).slice(0, 250));
  process.exitCode = 2;
}
