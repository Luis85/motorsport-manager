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
// The model recipe kernel lives in ../model-forge/src/kernel. Scene Forge reaches it only
// through two bridges: src/kernel.ts (Node) and src/kernel-render.ts (browser-safe subset).
const bridges = {
  'src/kernel.ts': '../model-forge/src/kernel/index.ts',
  'src/kernel-render.ts': '../model-forge/src/kernel/render/index.ts',
};
const layers = {
  domain: new Set(['domain', 'kernel.ts']),
  infra: new Set(['domain', 'infra', 'preview', 'kernel.ts', 'version.ts']),
  commands: new Set(['domain', 'infra', 'commands', 'kernel.ts', 'version.ts']),
  preview: new Set(['preview', 'kernel-render.ts']),
};
for (const file of files) {
  const text = await readFile(file, 'utf8');
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const layer = file.split('/')[1];
  const inner = layer === 'domain';
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
    if (bridges[file] !== undefined) {
      if (target !== bridges[file]) report(`kernel bridge may re-export only ${bridges[file]}`);
      return;
    }
    if (!target.startsWith('src/'))
      return report(`${target} is outside Scene Forge; import the kernel through src/kernel.ts`);
    const targetLayer = target.split('/')[1];
    if (layers[layer] && !layers[layer].has(targetLayer)) report(`invalid dependency on ${target}`);
    if (
      layer === 'infra' &&
      targetLayer === 'preview' &&
      !typeOnly &&
      target !== 'src/preview/template.ts'
    )
      report('infrastructure may import preview types and HTML template, not browser runtime');
    // The render bridge is the browser-safe kernel subset; it never loads the compiler or Zod.
    if (browser && !typeOnly && targetLayer !== 'preview' && target !== 'src/kernel-render.ts')
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
// The kernel runs on this project's node_modules, so both projects must lock the same
// versions of its packages (model-forge tests/kernel-lockfiles.test.ts checks the same).
const kernelPackages = [
  'three',
  'three-bvh-csg',
  'three-mesh-bvh',
  'zod',
  'gltf-validator',
  'playwright',
  'playwright-core',
  '@types/three',
  'typescript',
];
const [sceneLock, modelLock] = await Promise.all(
  ['package-lock.json', '../model-forge/package-lock.json'].map(async (file) =>
    JSON.parse(await readFile(file, 'utf8')),
  ),
);
for (const name of kernelPackages) {
  const scene = sceneLock.packages[`node_modules/${name}`],
    model = modelLock.packages[`node_modules/${name}`];
  if (!scene?.version || scene.version !== model?.version || scene.integrity !== model?.integrity)
    errors.push(
      `Kernel package ${name} is locked as ${scene?.version} here but ${model?.version} in ../model-forge; align both package-lock.json files.`,
    );
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Architecture passed: ${files.length} modules, kernel only through its bridges, inward dependencies, no runtime cycles or explicit any, kernel packages locked like ../model-forge.`,
  );
