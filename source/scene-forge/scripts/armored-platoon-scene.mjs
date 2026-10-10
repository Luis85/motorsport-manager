/** Compile a bounded armored mission's exact terrain, colliders and spawns into Scene Forge. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { formatAuthoredJson } from '../../model-forge/scripts/format-authored-json.mjs';
const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? fallback : args[index + 1];
};
const catalogPath = option('catalog', 'docs/concepts/armored-platoon/content/catalog.json');
const project = option('project', 'source/scene-forge/examples/armored-platoon');
const missionId = option('mission', 'crossroads');
const scene = option('scene', 'main');
const batchPath = option('batch-out', `${project}/${missionId}.compiled.batch.json`);
const catalog = JSON.parse(readFileSync(resolve(root, catalogPath), 'utf8'));
const mission = catalog.missions.find((entry) => entry.id === missionId);
if (!mission) throw new Error(`Unknown mission: ${missionId}`);
const terrain = mission.terrain;
if (
  ![terrain.width, terrain.depth].every((n) => Number.isInteger(n) && n >= 2 && n <= 256) ||
  !Number.isFinite(terrain.cellSize) ||
  terrain.cellSize <= 0 ||
  terrain.heights.length !== terrain.width * terrain.depth ||
  !terrain.heights.every(Number.isFinite)
)
  throw new Error('Invalid bounded terrain grid.');
const sizeX = (terrain.width - 1) * terrain.cellSize;
const sizeZ = (terrain.depth - 1) * terrain.cellSize;
const diagnostics = [];
const ids = new Set();
function identify(id) {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(id) || ids.has(id))
    throw new Error(`Invalid or duplicate authored ID: ${id}`);
  ids.add(id);
}
function position(value, label) {
  if (!value || ![value.x, value.y, value.z].every(Number.isFinite))
    throw new Error(`${label}: non-finite position.`);
  if (value.x < 0 || value.z < 0 || value.x > sizeX || value.z > sizeZ)
    throw new Error(`${label}: outside terrain.`);
}
for (const spawn of mission.spawns) {
  identify(spawn.id);
  position(spawn.position, spawn.id);
  const vehicle = catalog.vehicles.find((value) => value.id === spawn.vehicle);
  if (!vehicle) throw new Error(`${spawn.id}: missing vehicle.`);
  for (const obstacle of mission.obstacles) {
    const p = spawn.position,
      q = obstacle.position,
      s = obstacle.size;
    if (
      Math.abs(p.x - q.x) < s.x / 2 + vehicle.width / 2 &&
      Math.abs(p.z - q.z) < s.z / 2 + vehicle.length / 2
    )
      throw new Error(`${spawn.id}: starts inside obstacle ${obstacle.id}.`);
  }
}
for (const obstacle of mission.obstacles) {
  identify(obstacle.id);
  position(obstacle.position, obstacle.id);
}
for (const goal of mission.objectives) {
  position(goal.position, goal.id);
  if (
    goal.kind === 'eliminate' &&
    !mission.spawns.some((s) => s.faction === goal.target || s.id === goal.target)
  )
    throw new Error(`${goal.id}: elimination target never spawns.`);
  if (goal.kind === 'reach') {
    const blocked = mission.obstacles.filter(
      (o) =>
        Math.hypot(o.position.x - goal.position.x, o.position.z - goal.position.z) < goal.radius,
    );
    if (blocked.length)
      diagnostics.push({
        kind: 'review-objective-access',
        objective: goal.id,
        obstacles: blocked.map((o) => o.id),
      });
  }
}
const operations = [];
for (const [id, color] of [
  ['terrain', '#6a7350'],
  ['masonry', '#a4957f'],
  ['stone', '#8b887b'],
  ['wood', '#665440'],
])
  operations.push({ op: 'putMaterial', id, material: { color, roughness: 0.95 } });
const positions = [],
  indices = [];
for (let z = 0; z < terrain.depth; z++)
  for (let x = 0; x < terrain.width; x++)
    positions.push([
      x * terrain.cellSize,
      terrain.heights[z * terrain.width + x],
      z * terrain.cellSize,
    ]);
for (let z = 0; z < terrain.depth - 1; z++)
  for (let x = 0; x < terrain.width - 1; x++) {
    const a = z * terrain.width + x;
    indices.push(a, a + terrain.width, a + 1, a + 1, a + terrain.width, a + terrain.width + 1);
  }
operations.push({
  op: 'putGeometry',
  id: 'ground',
  geometry: { type: 'mesh', positions, indices },
});
operations.push({
  op: 'putNode',
  node: {
    id: 'ground',
    type: 'mesh',
    geometry: 'ground',
    material: 'terrain',
    tags: [`mission:${mission.id}`],
  },
});
for (const obstacle of mission.obstacles) {
  const p = obstacle.position,
    s = obstacle.size;
  operations.push({
    op: 'putGeometry',
    id: obstacle.id,
    geometry: { type: 'box', size: [s.x, s.y, s.z] },
  });
  operations.push({
    op: 'putNode',
    node: {
      id: obstacle.id,
      type: 'mesh',
      geometry: obstacle.id,
      material: obstacle.material,
      transform: { position: [p.x, p.y, p.z] },
      tags: [`obstacle:${obstacle.material}`],
    },
  });
}
for (const spawn of mission.spawns) {
  const p = spawn.position,
    vehicle = catalog.vehicles.find((v) => v.id === spawn.vehicle);
  operations.push({
    op: 'putNode',
    node: {
      id: spawn.id,
      type: 'model',
      model: spawn.vehicle,
      transform: {
        position: [p.x, p.y - vehicle.groundClearance, p.z],
        rotation: [0, (spawn.yaw * 180) / Math.PI, 0],
      },
      tags: [`spawn:${spawn.faction}`],
    },
  });
}
writeFileSync(resolve(root, batchPath), JSON.stringify({ operations }, null, 2) + '\n');
function cli(options) {
  const result = spawnSync(
    resolve(root, 'bin/scene-forge'),
    ['--compact', '-p', project, '--scene', scene, ...options],
    { cwd: root, encoding: 'utf8' },
  );
  const response = JSON.parse(result.stdout || result.stderr);
  if (result.status || !response.ok) throw new Error(JSON.stringify(response));
  return response.data;
}
const before = cli(['inspect']);
const guards = [
  '--expected-revision',
  String(before.revision),
  '--expected-state',
  before.stateHash,
];
const dryRun = cli(['apply', '--file', batchPath, ...guards, '--dry-run']);
const result = args.includes('--apply') ? cli(['apply', '--file', batchPath, ...guards]) : null;
writeFileSync(
  resolve(root, `${batchPath}.diagnostics.json`),
  JSON.stringify(
    {
      mission: mission.id,
      catalogPath,
      coordinates: 'metres, +Y up, +Z forward; Forge Euler degrees',
      terrainSamples: terrain.heights.length,
      diagnostics,
      dryRun,
      result,
      limitations: [
        'Visual objective-access review required; diagnostics do not prove reachability.',
        'Run against a fresh scene when changing mission; this upserts and does not delete unrelated nodes.',
      ],
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    mission: mission.id,
    diagnostics,
    applied: Boolean(result),
    proposedRevision: dryRun.proposedRevision,
  }),
);

await formatAuthoredJson(resolve(root, project));
