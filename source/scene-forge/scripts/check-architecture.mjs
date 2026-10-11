import ts from 'typescript';
import { readdir, readFile } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import path from 'node:path';

const files = (await readdir('src', { recursive: true }))
  .filter((file) => file.endsWith('.ts'))
  .map((file) => `src/${file}`);
const errors = [];
const graph = new Map();
const builtins = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));
const layers = {
  domain: new Set(['domain']),
  application: new Set(['domain', 'application']),
  infra: new Set(['domain', 'application', 'infra', 'preview', 'version.ts']),
  commands: new Set(['domain', 'application', 'infra', 'commands', 'version.ts']),
  preview: new Set(['domain', 'application', 'preview']),
};
for (const file of files) {
  const text = await readFile(file, 'utf8');
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const layer = file.split('/')[1];
  const inner = layer === 'domain' || layer === 'application';
  const browser = layer === 'preview';
  const dependencies = [];
  const report = (message) => errors.push(`${file}: ${message}`);
  if (text.trimEnd().split('\n').length > 800)
    report('module exceeds 800 lines; separate responsibilities');
  function dependency(specifier, typeOnly = false) {
    if (!specifier) return;
    if ((inner || browser) && (specifier.startsWith('node:') || builtins.has(specifier)))
      report(`environment dependency ${specifier} is forbidden in ${layer}`);
    if (!specifier.startsWith('.')) return;
    const target = path.posix
      .normalize(path.posix.join(path.posix.dirname(file), specifier))
      .replace(/\.js$/, '.ts');
    const targetLayer = target.split('/')[1];
    if (layers[layer] && !layers[layer].has(targetLayer)) report(`invalid dependency on ${target}`);
    if (
      layer === 'infra' &&
      targetLayer === 'preview' &&
      !typeOnly &&
      target !== 'src/preview/template.ts'
    )
      report('infrastructure may import preview types and HTML template, not browser runtime');
    if (
      browser &&
      !typeOnly &&
      targetLayer !== 'preview' &&
      ![
        'src/application/camera.ts',
        'src/application/lights.ts',
        'src/application/rigging.ts',
        'src/application/gltf-scene.ts',
        'src/application/materials.ts',
        'src/application/surfaces.ts',
        'src/domain/scalar.ts',
        'src/domain/errors.ts',
        'src/domain/identity.ts',
      ].includes(target)
    )
      report(`browser must consume compiled scenes, not import ${target}`);
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
      inner &&
      ts.isIdentifier(node) &&
      ['process', 'window', 'localStorage', 'fetch'].includes(node.text)
    )
      report(`ambient environment access ${node.text} is forbidden in the core`);
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
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const version = (await readFile('src/version.ts', 'utf8')).match(/VERSION = '([^']+)'/)?.[1];
if (pkg.version !== version) errors.push('package.json and src/version.ts disagree');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Architecture passed: ${files.length} modules, inward core dependencies, no runtime cycles or explicit any.`,
  );
