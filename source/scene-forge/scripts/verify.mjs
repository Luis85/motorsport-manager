import { execFileSync } from 'node:child_process';
import { readdir, writeFile, readFile } from 'node:fs/promises';

const checks = {};
function run(name, args) {
  const started = Date.now();
  try {
    const stdout = execFileSync(process.execPath, args, {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    const tests = stdout.match(/^# tests (\d+)$/m),
      passed = stdout.match(/^# pass (\d+)$/m),
      failed = stdout.match(/^# fail (\d+)$/m);
    checks[name] = {
      status: 'passed',
      durationMs: Date.now() - started,
      ...(tests
        ? { tests: Number(tests[1]), passed: Number(passed?.[1]), failed: Number(failed?.[1]) }
        : {}),
    };
    console.log(`${name}: passed${tests ? ` (${tests[1]} tests)` : ''}`);
  } catch (error) {
    process.stdout.write(error.stdout ?? '');
    process.stderr.write(error.stderr ?? '');
    throw error;
  }
}
const roots = (await readdir('.')).filter((f) => f.endsWith('.json') || f.endsWith('.md'));
const docs = (await readdir('docs')).filter((f) => f.endsWith('.md')).map((f) => `docs/${f}`);
run('formatting', [
  'node_modules/prettier/bin/prettier.cjs',
  '--check',
  'src',
  'tests',
  'scripts',
  ...roots,
  ...docs,
]);
run('architecture', ['scripts/check-architecture.mjs']);
run('typecheck', ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'tsconfig.check.json']);
run('build', ['scripts/build.mjs']);
for (const [name, folder] of [
  ['core', 'tests'],
  ['endToEnd', 'tests/e2e'],
]) {
  const files = (await readdir(folder))
    .filter((f) => f.endsWith('.test.ts'))
    .sort()
    .map((f) => `${folder}/${f}`);
  run(name, [
    '--import',
    'tsx',
    '--import',
    './scripts/kernel-deps.mjs',
    '--test',
    '--test-reporter=tap',
    ...files,
  ]);
}
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile(
  'docs/checks.json',
  JSON.stringify(
    {
      version,
      checkedAt: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      checks,
    },
    null,
    2,
  ) + '\n',
);
