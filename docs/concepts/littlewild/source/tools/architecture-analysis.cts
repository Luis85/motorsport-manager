import ts from 'typescript';

export interface RuntimeAnalysis {
  dependencies: Array<string | null>;
  globals: Array<{ name: string; write: boolean }>;
  platform: string[];
  dynamicGlobals: number;
  composition: string[];
}

function unwrap(node: ts.Expression): ts.Expression {
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node)) {
    return unwrap(node.expression);
  }
  return node;
}
function literal(node: ts.Node | undefined): string | null {
  return node && (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) ? node.text : null;
}
function member(node: ts.Expression): { owner: ts.Expression; name: string | null } | null {
  const value = unwrap(node);
  if (ts.isPropertyAccessExpression(value)) return { owner: unwrap(value.expression), name: value.name.text };
  if (ts.isElementAccessExpression(value)) return { owner: unwrap(value.expression), name: literal(value.argumentExpression) };
  return null;
}
function isWrite(node: ts.Node): boolean {
  const parent = node.parent;
  if (ts.isBinaryExpression(parent) && parent.left === node) {
    return parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
  }
  return (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) &&
    (parent.operator === ts.SyntaxKind.PlusPlusToken || parent.operator === ts.SyntaxKind.MinusMinusToken);
}
function runtimeChildren(node: ts.Node, visit: (node: ts.Node) => void): void {
  if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isTypeNode(node)) return;
  ts.forEachChild(node, visit);
}

/** Analyze executable syntax instead of stripping comments with regexes. Alias tracking
 * covers the runtime's IIFE root/require conventions; unresolved dynamic edges fail closed. */
export function analyzeRuntime(file: string, text: string): RuntimeAnalysis {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const result: RuntimeAnalysis = { dependencies: [], globals: [], platform: [], dynamicGlobals: 0, composition: [] };
  const roots = new Set(['root', 'global', 'globalThis', 'self', 'window']);
  const loaders = new Set(['require']);
  const aliases = new Map<string, string>();
  const platformNames = new Set(['document', 'window', 'localStorage', 'sessionStorage', 'requestAnimationFrame',
    'setTimeout', 'setInterval', 'fetch', 'XMLHttpRequest']);
  const forbiddenMembers = new Set(['Date.now', 'performance.now', 'Math.random', 'crypto.randomUUID',
    'crypto.randomBytes', 'crypto.getRandomValues']);
  const compositionNames = new Set(['EngineComposition', 'register', 'constructThrough', 'installFactories']);

  function qualified(expression: ts.Expression): string | null {
    const value = unwrap(expression);
    if (ts.isIdentifier(value)) return aliases.get(value.text) ?? value.text;
    const access = member(value);
    if (!access?.name) return null;
    const owner = qualified(access.owner);
    return owner ? owner + '.' + access.name : null;
  }
  function rootExpression(expression: ts.Expression): boolean {
    const value = unwrap(expression);
    if (ts.isIdentifier(value)) return roots.has(value.text);
    if (ts.isConditionalExpression(value)) return rootExpression(value.whenTrue) || rootExpression(value.whenFalse);
    return false;
  }
  function inherit(name: ts.BindingName, initializer: ts.Expression): void {
    const value = unwrap(initializer);
    if (ts.isIdentifier(name)) {
      if (rootExpression(value)) roots.add(name.text);
      if (ts.isIdentifier(value) && loaders.has(value.text) || qualified(value) === 'module.require') loaders.add(name.text);
      const resolved = qualified(value);
      if (resolved && resolved !== name.text && !resolved.startsWith(name.text + '.')) aliases.set(name.text, resolved);
    } else if (ts.isObjectBindingPattern(name)) {
      for (const element of name.elements) {
        if (!ts.isIdentifier(element.name)) continue;
        const property = element.propertyName ? literal(element.propertyName) ??
          (ts.isIdentifier(element.propertyName) ? element.propertyName.text : null) : element.name.text;
        if (!property) continue;
        if (rootExpression(value)) {
          aliases.set(element.name.text, property);
          if (property === 'require') loaders.add(element.name.text);
        } else {
          const owner = qualified(value);
          if (owner) aliases.set(element.name.text, owner + '.' + property);
        }
      }
    }
  }
  let bindings = 0;
  const countBindings = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBinaryExpression(node)) bindings++;
    runtimeChildren(node, countBindings);
  };
  countBindings(ast);
  // Each pass resolves another binding link; self-referential paths are excluded above.
  for (let pass = 0; pass <= bindings; pass++) {
    const before = JSON.stringify([[...roots], [...loaders], [...aliases]]);
    const collect = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && node.initializer) inherit(node.name, node.initializer);
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left)) inherit(node.left, node.right);
      if (ts.isCallExpression(node)) {
        const callee = unwrap(node.expression);
        if (ts.isFunctionExpression(callee) || ts.isArrowFunction(callee)) {
          callee.parameters.forEach((parameter, index) => {
            const argument = node.arguments[index];
            if (argument) inherit(parameter.name, argument);
          });
        }
      }
      runtimeChildren(node, collect);
    };
    collect(ast);
    if (before === JSON.stringify([[...roots], [...loaders], [...aliases]])) break;
  }
  function forbidden(name: string | null): void {
    if (!name) return;
    const normalized = name.replace(/^(?:globalThis|global|root|self|window)\./, '');
    if (platformNames.has(normalized.split('.')[0]!) || forbiddenMembers.has(normalized)) result.platform.push(normalized);
    if (normalized.startsWith('crypto.random')) result.platform.push(normalized);
  }
  function reference(expression: ts.Expression): void {
    const value = unwrap(expression), access = member(value);
    if (access && rootExpression(access.owner)) {
      if (access.name === null) result.dynamicGlobals++;
      else if (/^LW[A-Za-z0-9_]*$/.test(access.name)) result.globals.push({ name: access.name, write: isWrite(value) });
    }
    forbidden(qualified(value));
  }
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) result.dependencies.push(literal(node.moduleSpecifier));
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      result.dependencies.push(literal(node.moduleReference.expression));
    }
    if (ts.isCallExpression(node)) {
      const callee = unwrap(node.expression);
      if (callee.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(callee) && loaders.has(callee.text)) {
        result.dependencies.push(literal(node.arguments[0]));
      }
      const access = member(callee);
      if (access?.name === 'require' && (qualified(access.owner) === 'module' || rootExpression(access.owner))) {
        result.dependencies.push(literal(node.arguments[0]));
      }
      if (access && ts.isIdentifier(access.owner) && loaders.has(access.owner.text)) result.dependencies.push(null);
      if (access?.name && compositionNames.has(access.name) && /(?:Composition|\bLW)\b/.test(qualified(access.owner) ?? '')) {
        result.composition.push(access.name);
      }
    }
    if (ts.isNewExpression(node) && qualified(node.expression) === 'Date') result.platform.push('new Date');
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      reference(node);
      const access = member(node);
      if (access?.name === 'EngineComposition') result.composition.push(access.name);
    }
    if (ts.isIdentifier(node)) {
      // Identifier keys/declarations do not read an ambient API.
      const parent = node.parent;
      const named = (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        (ts.isPropertyAssignment(parent) && parent.name === node) ||
        (ts.isVariableDeclaration(parent) && parent.name === node) ||
        (ts.isParameter(parent) && parent.name === node) ||
        (ts.isBindingElement(parent) && (parent.name === node || parent.propertyName === node));
      if (!named) forbidden(aliases.get(node.text) ?? node.text);
    }
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isObjectBindingPattern(node.name) && rootExpression(node.initializer)) {
      for (const element of node.name.elements) {
        const name = element.propertyName ? literal(element.propertyName) ??
          (ts.isIdentifier(element.propertyName) ? element.propertyName.text : null) :
          ts.isIdentifier(element.name) ? element.name.text : null;
        if (name && /^LW[A-Za-z0-9_]*$/.test(name)) result.globals.push({ name, write: false });
      }
    }
    runtimeChildren(node, visit);
  };
  visit(ast);
  return result;
}

export function resolveRuntimeDependency(file: string, request: string, runtimeFiles: ReadonlySet<string>): string | null {
  if (!request.startsWith('.')) return null;
  const segments = [...file.split('/').slice(0, -1), ...request.replace(/\\/g, '/').split('/')];
  const normalized: string[] = [];
  for (const segment of segments) {
    if (segment === '..') { if (!normalized.length) return null; normalized.pop(); }
    else if (segment && segment !== '.') normalized.push(segment);
  }
  const target = normalized.join('/');
  const candidates = /\.cjs$/.test(target) ? [target.replace(/\.cjs$/, '.cts')] :
    /\.(?:js|mjs)$/.test(target) ? [target.replace(/\.(?:js|mjs)$/, '.ts')] :
    /\.(?:ts|cts)$/.test(target) ? [target] : [target + '.ts', target + '.cts', target + '/index.ts'];
  return candidates.find(candidate => runtimeFiles.has(candidate)) ?? null;
}

/** Physical source lines occupied by executable or type syntax. Parser tokens exclude
 * comments/trivia, while multiline string/template content remains code on every line. */
export function physicalCodeLines(file: string, text: string): number {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const occupied = new Set<number>();
  const visit = (node: ts.Node): void => {
    if (node.kind >= ts.SyntaxKind.FirstToken && node.kind <= ts.SyntaxKind.LastToken && node.kind !== ts.SyntaxKind.EndOfFileToken) {
      const start = node.getStart(ast), end = node.getEnd();
      if (end <= start) return;
      const first = ast.getLineAndCharacterOfPosition(start).line;
      const last = ast.getLineAndCharacterOfPosition(end - 1).line;
      for (let line = first; line <= last; line++) occupied.add(line);
    } else for (const child of node.getChildren(ast)) visit(child);
  };
  visit(ast);
  return occupied.size;
}
