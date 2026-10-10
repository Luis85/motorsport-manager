/**
 * `npm run architecture`: the structural rules of Process Studio.
 *
 * 1. Bridge: only src/kernel.cts imports or references Wildlands code (`../wildlands`).
 * 2. Layers: src/ uses Node built-ins, its own modules, its package.json and (src/kit.cts only) the bundle's virtual
 *    `process-studio-embedded`; it never imports scripts/, tests/ or a package. scripts/ may add esbuild and pako;
 *    tests/ may add esbuild (types).
 * 3. Closure: the bundled Wildlands files equal the explicit allowlist in scripts/bridge.cts.
 * 4. Budgets: at most 400 code lines per source file (src/, scripts/) and 450 per test file (blank lines and comments excluded).
 * 5. Determinism: no `Math.random` and no `Date` in Process Studio code (the bridged engine has its own seeded clock and random).
 * 6. Toolchain: every devDependency is an exact version equal to source/wildlands/package-lock.json and to this lockfile.
 */
import fs from 'node:fs';
import path from 'node:path';
import {codeLines, scan} from './source-scan.cjs';
import {analyse, PROJECT, REPOSITORY} from './bundle.cjs';
import {BRIDGE} from './bridge.cjs';

const LIMITS = {source: 400, tests: 450} as const;
const WILDLANDS = path.join(REPOSITORY, 'source/wildlands');
const SPECIFIER = /\b(?:from|import|require)\s*\(?\s*(['"])([^'"\n]+)\1/g;
const REFERENCE = /^\/\/\/\s*<reference\s+path=(['"])([^'"]+)\1/gm;

/** Every TypeScript file of the project, project-relative with forward slashes, sorted. */
export function projectFiles(): string[] {
 const files: string[] = [];
 const walk = (directory: string): void => {
  for (const entry of fs.readdirSync(path.join(PROJECT, directory), {withFileTypes: true})) {
   const relative = directory + '/' + entry.name;
   if (entry.isDirectory()) walk(relative);
   else if (/\.(?:cts|ts|mts)$/.test(entry.name)) files.push(relative);
  }
 };
 for (const directory of ['src', 'scripts', 'tests']) if (fs.existsSync(path.join(PROJECT, directory))) walk(directory);
 return files.sort();
}

function specifiers(text: string): string[] {
 const code = scan(text).code;
 return [...[...code.matchAll(SPECIFIER)].map(match => match[2]!), ...[...text.matchAll(REFERENCE)].map(match => match[2]!)];
}

export function importErrors(file: string, text: string): string[] {
 const errors: string[] = [], layer = file.split('/')[0]!;
 for (const specifier of specifiers(text)) {
  const relative = specifier.startsWith('.'), target = relative ? path.resolve(PROJECT, path.dirname(file), specifier) : '';
  if (relative && (target === WILDLANDS || target.startsWith(WILDLANDS + path.sep))) {
   if (file !== BRIDGE) errors.push(`${file}: imports ${specifier}; only ${BRIDGE} may reach Wildlands code.`);
   continue;
  }
  if (relative && !target.startsWith(PROJECT + path.sep)) { errors.push(`${file}: imports ${specifier} outside source/process-studio.`); continue; }
  const inside = relative ? path.relative(PROJECT, target).split(path.sep)[0]! : '';
  if (layer === 'src') {
   const allowed = specifier.startsWith('node:') || inside === 'src' || (relative && inside === 'package.json')
    || (specifier === 'process-studio-embedded' && file === 'src/kit.cts');
   if (!allowed) errors.push(`${file}: src/ may import only Node built-ins and src/ modules, not ${specifier}.`);
  } else if (layer === 'scripts' && !relative && !specifier.startsWith('node:') && !['esbuild', 'pako'].includes(specifier)) {
   errors.push(`${file}: scripts/ may import only Node built-ins, esbuild, pako and project modules, not ${specifier}.`);
  } else if (layer === 'tests' && !relative && !specifier.startsWith('node:') && specifier !== 'esbuild') {
   errors.push(`${file}: tests/ may import only Node built-ins, esbuild types and project modules, not ${specifier}.`);
  } else if (layer !== 'tests' && relative && inside === 'tests') {
   errors.push(`${file}: imports test code ${specifier}.`);
  } else if (layer === 'src' && relative && inside === 'scripts') {
   errors.push(`${file}: src/ imports build script ${specifier}.`);
  }
 }
 return errors;
}

export function ruleErrors(file: string, text: string): string[] {
 const errors: string[] = [], limit = file.startsWith('tests/') ? LIMITS.tests : LIMITS.source, lines = codeLines(text);
 if (lines > limit) errors.push(`${file}: ${lines} code lines, over the budget of ${limit}; extract a cohesive responsibility.`);
 const bare = scan(text).bare.split('\n');
 bare.forEach((line, index) => {
  if (/\bMath\s*\.\s*random\b/.test(line)) errors.push(`${file}:${index + 1}: Math.random is not allowed; outputs must be deterministic.`);
  if (/\bDate\b/.test(line)) errors.push(`${file}:${index + 1}: Date is not allowed; Process Studio reads no clock.`);
 });
 return errors;
}

/** Exact devDependency versions, equal to Wildlands' lockfile and to this project's lockfile. */
export function toolchainErrors(): string[] {
 const errors: string[] = [], read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
 const manifest = read(path.join(PROJECT, 'package.json')) as {dependencies?: object; devDependencies?: Record<string, string>};
 const own = read(path.join(PROJECT, 'package-lock.json')) as {packages: Record<string, {version?: string}>};
 const wildlands = read(path.join(WILDLANDS, 'package-lock.json')) as {packages: Record<string, {version?: string}>};
 if (manifest.dependencies && Object.keys(manifest.dependencies).length) {
  errors.push('package.json: Process Studio has no runtime dependencies; bundle them instead.');
 }
 for (const [name, version] of Object.entries(manifest.devDependencies ?? {})) {
  const locked = wildlands.packages['node_modules/' + name]?.version, installed = own.packages['node_modules/' + name]?.version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) errors.push(`package.json: devDependency ${name} must be an exact version, not ${version}.`);
  if (locked !== version) errors.push(`package.json: ${name} ${version} differs from source/wildlands/package-lock.json (${locked ?? 'absent'}).`);
  if (installed !== version) errors.push(`package-lock.json: ${name} is locked at ${installed ?? 'absent'}, not ${version}; run npm install.`);
 }
 return errors;
}

export async function architectureErrors(): Promise<string[]> {
 const errors: string[] = [];
 for (const file of projectFiles()) {
  const text = fs.readFileSync(path.join(PROJECT, file), 'utf8');
  errors.push(...importErrors(file, text), ...ruleErrors(file, text));
 }
 if (!fs.existsSync(path.join(PROJECT, BRIDGE))) errors.push(`The bridge ${BRIDGE} is missing.`);
 errors.push(...await analyse(), ...toolchainErrors());
 return errors;
}

if (require.main === module) {
 architectureErrors().then(errors => {
  if (errors.length) {
   process.stderr.write('Process Studio architecture check failed:\n' + errors.map(error => '- ' + error).join('\n') + '\n');
   process.exitCode = 1;
   return;
  }
  process.stdout.write(`Process Studio architecture check passed (${projectFiles().length} files).\n`);
 }).catch(error => {
  process.stderr.write('Process Studio architecture check failed: ' + (error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
 });
}
