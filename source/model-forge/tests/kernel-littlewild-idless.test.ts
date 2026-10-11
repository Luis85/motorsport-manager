import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelSchema, LittlewildAssetSchema, parse } from '../src/kernel/domain/schema.js';
import { importedNodeIds, littlewildModels } from '../src/kernel/application/littlewild-import.js';
import { littlewildVisual } from '../src/kernel/io/littlewild.js';

type Plain = Record<string, any>;
/** Two id-less `soft` nodes (Forge IDs soft1 and soft3) with different engine-only fields. */
function fixture(extra: Plain = {}) {
  const visual: Plain = {
    format: 'littlewild-3d-asset',
    schemaVersion: 1,
    category: 'item',
    id: 'pebbles',
    name: 'Pebbles',
    metadata: {},
    materials: { stone: '#7d776f', moss: '#4f8a3a' },
    models: {
      world: {
        nodes: [
          { primitive: 'soft', material: 'stone', castShadow: false, position: [-1, 0, 0] },
          { primitive: 'soft', material: 'moss', receiveShadow: true, position: [1, 0, 0] },
          {
            primitive: 'group',
            children: [{ primitive: 'ball', material: 'stone', castShadow: false }],
          },
        ],
      },
    },
    ...extra,
  };
  const models = Object.fromEntries(
    Object.entries(littlewildModels(visual)).map(([id, model]) => [id, parse(ModelSchema, model)]),
  );
  const asset = parse(LittlewildAssetSchema, {
    id: 'pebbles',
    family: 'items',
    name: 'Pebbles',
    models: { world: { model: 'pebblesWorld' } },
  });
  return { visual, models, asset };
}
const without = (models: ReturnType<typeof fixture>['models'], id: string) => {
  const model = models.pebblesWorld;
  model.nodes = model.nodes.filter((node) => node.id !== id && node.parent !== id);
  return models;
};
const nodesOf = (result: { visual: Plain }) => result.visual.models.world.nodes as Plain[];

test('import and the lossless merge agree on the synthetic IDs of id-less nodes', () => {
  const { visual, models } = fixture();
  const ids = [...importedNodeIds(visual.models.world.nodes).values()];
  assert.deepEqual(
    models.pebblesWorld.nodes.map((node) => node.id),
    ids,
  );
  assert.deepEqual(ids, ['soft1', 'soft3', 'group5', 'ball7']);
});

test('removing an id-less node never moves its engine-only fields onto another node', () => {
  const { visual, models, asset } = fixture();
  const unchanged = littlewildVisual(asset, models, { visual });
  assert.deepEqual(unchanged.visual, visual, 'an unedited export keeps the definition');

  const first = fixture();
  const removedFirst = nodesOf(
    littlewildVisual(first.asset, without(first.models, 'soft1'), { visual: first.visual }),
  );
  assert.equal(removedFirst.length, 2);
  assert.equal(removedFirst[0].material, 'moss');
  assert.equal(removedFirst[0].castShadow, undefined, 'soft1 was removed with its castShadow');
  assert.equal(removedFirst[0].receiveShadow, true, 'soft3 keeps its own field');
  assert.deepEqual(removedFirst[0].position, [1, 0, 0]);
  assert.deepEqual(removedFirst[1], visual.models.world.nodes[2], 'the group is untouched');

  const second = fixture();
  const removedSecond = nodesOf(
    littlewildVisual(second.asset, without(second.models, 'soft3'), { visual: second.visual }),
  );
  assert.deepEqual(removedSecond[0], visual.models.world.nodes[0]);
  assert.equal(removedSecond[1].primitive, 'group');

  // A nested id-less node removed from a group leaves the group without its fields.
  const nested = fixture();
  const group = nodesOf(
    littlewildVisual(nested.asset, without(nested.models, 'ball7'), { visual: nested.visual }),
  )[2];
  assert.deepEqual(group.children ?? [], []);
});

test('kept source meshes no variant references are reported as a warning', () => {
  const mesh = { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] };
  const { visual, models, asset } = fixture({ meshes: { spare: mesh } });
  const result = littlewildVisual(asset, models, { visual });
  assert.deepEqual(result.visual.meshes, { spare: mesh }, 'bytes are unchanged');
  assert.deepEqual(result.warnings, [
    'Kept 1 source mesh that no variant references: spare. Delete them from the definition by hand if nothing else needs them.',
  ]);
  const clean = fixture();
  assert.deepEqual(
    littlewildVisual(clean.asset, clean.models, { visual: clean.visual }).warnings,
    [],
  );
});
