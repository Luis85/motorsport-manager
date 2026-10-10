// Enforces the boundaries of the model recipe kernel (src/kernel), the one-model editor
// layers around it (domain -> application -> infra -> commands; browser-only preview) and
// the size budgets: 400 code lines per source file, 450 per test file. Scene Forge imports the same kernel source through its bridges,
// so the kernel must stay self-contained and limited to the shared dependency set that
// Scene Forge resolves from its own node_modules (scripts/kernel-deps.mjs, kernel-resolve.mjs).
import ts from 'typescript';
import { readdir, readFile } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import path from 'node:path';

const files = (await readdir('src', { recursive: true }))
  .filter((file) => file.endsWith('.ts'))
  .map((file) => `src/${file.split(path.sep).join('/')}`)
  .sort();
const errors = [];
const graph = new Map();
const bareImports = new Map();
const builtins = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));
const kernel = 'src/kernel/';
const entries = new Set(['src/kernel/index.ts', 'src/kernel/render/index.ts']);
/** Bare packages kernel files may import; Scene Forge maps exactly these to one copy. */
const sharedPackages = [
  /^three$/,
  /^three\/addons\/.+\.js$/,
  /^three-bvh-csg\/src\/index\.js$/,
  /^zod$/,
  /^gltf-validator$/,
  /^playwright$/,
];
const layers = {
  domain: new Set(['domain']),
  application: new Set(['domain', 'application']),
  io: new Set(['domain', 'application', 'io']),
  render: new Set(['domain', 'application', 'render']),
};
/** Editor layers outside the kernel and the project-internal targets each may import. */
const editorLayers = {
  domain: new Set(['domain']),
  application: new Set(['domain', 'application']),
  infra: new Set(['domain', 'application', 'infra', 'version.ts']),
  commands: new Set(['domain', 'application', 'infra', 'commands', 'version.ts']),
  preview: new Set(['preview']),
};
/** Bare packages each editor layer may import at runtime. */
const editorPackages = {
  domain: [/^zod$/],
  application: [/^zod$/, /^three$/],
  infra: [/^zod$/],
  commands: [/^zod$/, /^commander$/, /^three$/],
  preview: [/^three$/, /^three\/addons\/.+\.js$/],
};
const codeLines = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('//')).length;

for (const file of files) {
  const text = await readFile(file, 'utf8');
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const inKernel = file.startsWith(kernel);
  const layer = inKernel ? file.slice(kernel.length).split('/')[0] : undefined;
  const editorLayer = inKernel ? undefined : file.slice('src/'.length).split('/')[0];
  const editor = editorLayers[editorLayer] ? editorLayer : undefined;
  const pure = inKernel
    ? layer === 'domain' || layer === 'application' || layer === 'render'
    : editor === 'domain' || editor === 'application' || editor === 'preview';
  const dependencies = [];
  const report = (message) => errors.push(`${file}: ${message}`);
  // Procedural output must be a pure function of its seed: no ambient randomness or clock.
  const deterministic = inKernel || file.startsWith('src/application/generators/');
  bareImports.set(file, []);
  if (codeLines(text) > 400) report('module exceeds 400 code lines; separate responsibilities');
  function dependency(specifier, typeOnly = false) {
    if (!specifier) return;
    const builtin = specifier.startsWith('node:') || builtins.has(specifier);
    if (pure && builtin)
      report(`environment dependency ${specifier} is forbidden in ${layer ?? editor}`);
    if (!specifier.startsWith('.')) {
      if (!builtin && !typeOnly) bareImports.get(file).push(specifier);
      if (inKernel && !builtin && !sharedPackages.some((pattern) => pattern.test(specifier)))
        report(`kernel may import only shared packages, not ${specifier}`);
      if (editor && !builtin && !typeOnly && !editorPackages[editor].some((p) => p.test(specifier)))
        report(`${editor} may not import package ${specifier}`);
      return;
    }
    const target = path.posix
      .normalize(path.posix.join(path.posix.dirname(file), specifier))
      .replace(/\.js$/, '.ts');
    if (inKernel && !target.startsWith(kernel))
      report(`kernel imports nothing outside src/kernel: ${target}`);
    if (!inKernel && target.startsWith(kernel) && !entries.has(target))
      report(`import the kernel through src/kernel/index.ts or render/index.ts, not ${target}`);
    if (
      editor === 'preview' &&
      target.startsWith(kernel) &&
      target !== 'src/kernel/render/index.ts'
    )
      report('preview is browser-only and imports the kernel only through render/index.ts');
    if (editor && editor !== 'preview' && target === 'src/kernel/render/index.ts')
      report('Node layers import the kernel through src/kernel/index.ts');
    if (editor && !target.startsWith(kernel)) {
      const targetLayer = target.slice('src/'.length).split('/')[0];
      const typePreview = typeOnly && targetLayer === 'preview';
      if (!editorLayers[editor].has(targetLayer) && !typePreview)
        report(`invalid ${editor} dependency on ${target}`);
    }
    if (inKernel && target.startsWith(kernel) && layers[layer]) {
      const targetLayer = target.slice(kernel.length).split('/')[0];
      const allowed = layers[layer].has(targetLayer) || (typeOnly && targetLayer === 'render');
      if (!allowed) report(`invalid ${layer} dependency on ${target}`);
    }
    if (!typeOnly) dependencies.push(target);
  }
  function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) report('explicit any bypasses the typed boundary');
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = ts.isImportDeclaration(node) ? node.importClause : undefined;
      const typeOnly =
        !!(clause?.isTypeOnly || (ts.isExportDeclaration(node) && node.isTypeOnly)) ||
        !!(
          clause?.namedBindings &&
          ts.isNamedImports(clause.namedBindings) &&
          !clause.name &&
          clause.namedBindings.elements.length &&
          clause.namedBindings.elements.every((e) => e.isTypeOnly)
        );
      dependency(node.moduleSpecifier.text, typeOnly);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0])
    )
      dependency(node.arguments[0].text);
    if (
      (layer === 'domain' ||
        layer === 'application' ||
        editor === 'domain' ||
        editor === 'application') &&
      ts.isIdentifier(node) &&
      ['process', 'window', 'localStorage', 'fetch'].includes(node.text)
    )
      report(`ambient environment access ${node.text} is forbidden in a pure layer`);
    if (deterministic) {
      const parent = node.parent;
      const member = (object, name) =>
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === object &&
        node.name.text === name;
      if (member('Math', 'random') || member('crypto', 'getRandomValues'))
        report(`${node.getText()} is nondeterministic; use the keyed createRandom(seed, stream)`);
      if (
        ts.isIdentifier(node) &&
        node.text === 'Date' &&
        !(parent && ts.isPropertyAccessExpression(parent) && parent.name === node) &&
        !(parent && ts.isPropertyAssignment(parent) && parent.name === node)
      )
        report(
          'Date reads the wall clock; take times as explicit input (or performance.now for durations)',
        );
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  graph.set(file, dependencies);
}

const visited = new Set(),
  active = new Set();
function walk(file, stack = []) {
  if (active.has(file)) {
    errors.push(`Runtime import cycle: ${[...stack, file].join(' -> ')}`);
    return;
  }
  if (visited.has(file)) return;
  active.add(file);
  for (const dependency of graph.get(file) ?? []) walk(dependency, [...stack, file]);
  active.delete(file);
  visited.add(file);
}
for (const file of files) walk(file);

// The browser entry must not reach the schema runtime, the compiler or Node built-ins.
const browserEntry = 'src/kernel/render/index.ts';
const reachable = new Set();
const pending = [browserEntry];
while (pending.length) {
  const file = pending.pop();
  if (reachable.has(file) || !graph.has(file)) continue;
  reachable.add(file);
  pending.push(...graph.get(file));
}
for (const file of reachable) {
  if (bareImports.get(file).some((specifier) => specifier === 'zod' || specifier === 'playwright'))
    errors.push(`${browserEntry} reaches ${file}, which loads the schema runtime or Playwright`);
  if (/\/(compiler|resources|schema(-[a-z]+)?|parse|validate)\.ts$/.test(file))
    errors.push(`${browserEntry} reaches ${file}; the browser consumes compiled scenes`);
}

// Test files have a 450 code-line budget; the package version matches src/version.ts.
for (const file of (await readdir('tests', { recursive: true })).filter((f) => f.endsWith('.ts'))) {
  const text = await readFile(path.join('tests', file), 'utf8');
  if (codeLines(text) > 450) errors.push(`tests/${file}: test exceeds 450 code lines`);
}
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
if (!(await readFile('src/version.ts', 'utf8')).includes(`'${version}'`))
  errors.push(`src/version.ts does not declare package version ${version}`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Architecture passed: ${files.length} modules; self-contained kernel with shared packages only, ` +
      `browser-safe render entry (${reachable.size} modules), deterministic kernel and generators ` +
      `(no Math.random or Date), layered editor ` +
      `(domain -> application -> infra -> commands, browser-only preview), size budgets, ` +
      `no runtime cycles or explicit any.`,
  );
