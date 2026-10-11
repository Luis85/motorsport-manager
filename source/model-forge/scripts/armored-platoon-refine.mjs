/** Guarded, replayable exterior refinement; never modifies a registered model in place. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { armoredDetailOperations } from './armored-platoon-details.mjs';
import { formatAuthoredJson } from './format-authored-json.mjs';

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? fallback : args[index + 1];
};
const models = option('models', 'source/model-forge/examples/armored-platoon');
const project = option('project', 'source/scene-forge/examples/armored-platoon');
const policy = 'source/model-forge/examples/armored-platoon/quality-policy.json';
const evidence = [];
function cli(tool, options) {
  const result = spawnSync(resolve(root, 'bin', tool), ['--compact', ...options], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const response = JSON.parse(result.stdout || result.stderr);
  evidence.push({ tool, args: options, response });
  if (result.status || !response.ok) throw new Error(JSON.stringify(response));
  return response.data;
}
function guard(before) {
  return ['--expected-revision', String(before.revision), '--expected-state', before.stateHash];
}
function json(path, value) {
  writeFileSync(resolve(root, path), JSON.stringify(value, null, 2) + '\n');
}
for (const [id, german] of [
  ['m4-sherman', false],
  ['panzer-iv', true],
]) {
  const doc = `${models}/${id}.model.json`;
  const batch = `${models}/${id}.refine.batch.json`;
  const bundle = `${models}/${id}.model-bundle.json`;
  json(batch, { operations: armoredDetailOperations(german) });
  const before = cli('model-forge', ['-d', doc, 'inspect', '--source']);
  const guards = guard(before);
  cli('model-forge', ['-d', doc, 'apply', '--file', batch, ...guards, '--dry-run']);
  cli('model-forge', ['-d', doc, 'apply', '--file', batch, ...guards]);
  cli('model-forge', ['-d', doc, 'validate']);
  cli('model-forge', ['-d', doc, 'audit', '--file', policy, '--strict']);
  cli('model-forge', [
    '-d',
    doc,
    'export',
    '--format',
    'model-bundle',
    '--out',
    bundle,
    '--overwrite',
  ]);
  const scene = cli('scene-forge', ['-p', project, 'inspect', '--source']);
  const sceneGuards = guard(scene);
  const imported = [
    '-p',
    project,
    'model',
    'import',
    '--file',
    bundle,
    '--replace',
    ...sceneGuards,
  ];
  cli('scene-forge', [...imported, '--dry-run']);
  cli('scene-forge', imported);
  cli('scene-forge', [
    '-p',
    project,
    'export',
    '--format',
    'three',
    '--model',
    id,
    '--out',
    `${project}/exports/${id}.three.json`,
  ]);
  // Semantic tags and authoritative transforms remain owned by the original recipe.
  const source = JSON.parse(readFileSync(resolve(root, doc), 'utf8'));
  if (!source.nodes.some((node) => node.tags?.includes('articulation:turret')))
    throw new Error(`Missing retained turret articulation: ${id}`);
}
json(
  `${models}/refinement.workflow.json`,
  evidence.map(({ tool, args, response }) => ({
    tool,
    args,
    result: {
      revision: response.data.revision,
      stateHash: response.data.stateHash,
      proposedRevision: response.data.proposedRevision,
      proposedStateHash: response.data.proposedStateHash,
      valid: response.data.valid,
      passed: response.data.passed,
      metrics: response.data.metrics,
      summary: response.data.summary,
      stats: response.data.stats,
      changes: response.data.changes,
      dryRun: response.data.dryRun,
      path: response.data.path,
    },
  })),
);
await formatAuthoredJson(resolve(root, models));
await formatAuthoredJson(resolve(root, project));
console.log(
  'Refined both tank studies through guarded native Model Forge and Scene Forge transactions.',
);
