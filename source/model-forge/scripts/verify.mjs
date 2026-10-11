// Complete local gate for Model Forge. Runs every check in order and stops at the first
// failure. End-to-end review tests need Chromium (FORGE_CHROMIUM_PATH or Playwright's).
//
//   node scripts/verify.mjs
import { execFileSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';

const results = [];
function run(name, args) {
  const started = Date.now();
  let stdout = '';
  try {
    stdout = execFileSync(process.execPath, args, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });
  } catch (error) {
    process.stdout.write(error.stdout ?? '');
    process.stderr.write(error.stderr ?? '');
    console.error(`${name}: FAILED`);
    process.exit(1);
  }
  const counted = stdout.match(/^# tests (\d+)$/m);
  results.push({
    name,
    durationMs: Date.now() - started,
    ...(counted ? { tests: Number(counted[1]) } : {}),
  });
  console.log(`${name}: passed${counted ? ` (${counted[1]} tests)` : ''}`);
}
const tests = async (folder) =>
  (await readdir(folder))
    .filter((file) => file.endsWith('.test.ts'))
    .sort()
    .map((file) => `${folder}/${file}`);

run('formatting', [
  'node_modules/prettier/bin/prettier.cjs',
  '--check',
  'src',
  'tests',
  'scripts',
  'examples',
  'package.json',
  'README.md',
  'AGENTS.md',
]);
run('architecture', ['scripts/check-architecture.mjs']);
run('typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']);
run('unit', ['--import', 'tsx', '--test', '--test-reporter=tap', ...(await tests('tests'))]);
run('standalone', ['scripts/standalone.mjs', '--check']);
run('preview', ['scripts/build.mjs', '--preview']);
run('endToEnd', [
  '--import',
  'tsx',
  '--test',
  '--test-reporter=tap',
  ...(await tests('tests/e2e')),
]);
console.log(JSON.stringify({ ok: true, checks: results }));
