import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { parse, SceneSchema, type SceneDocument } from '../src/domain/schema.js';
import type { LibraryItem } from '../src/preview/contracts.js';
import { descendantIds, availableNodeId, subtreeCopyIds } from '../src/preview/scene-tree.js';
import { createNodeCommands } from '../src/preview/node-commands.js';
import { nodeIdForObject, visibleInScene } from '../src/preview/picking.js';
import { visibleMeshStats } from '../src/preview/edit-status.js';
import { reviewPlanFor } from '../src/preview/review-plan.js';

const scene = (): SceneDocument =>
  parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'main',
    name: 'Main',
    nodes: [
      { id: 'arm', type: 'group', transform: { position: [0, 3, 0] } },
      { id: 'hand', type: 'group', parent: 'arm' },
      { id: 'finger', type: 'group', parent: 'hand' },
      { id: 'lamp', type: 'group' },
    ],
  });
/** Realize the authored hierarchy as named Three.js objects, as the viewer rebuild does. */
function realize(source: SceneDocument) {
  const content = new THREE.Group();
  const objects = new Map(
    source.nodes.map((node) => {
      const object = new THREE.Group();
      object.name = `${source.id}/${node.id}`;
      // Fixture positions are plain numbers; parametric scalars are not used here.
      object.position.fromArray((node.transform?.position ?? [0, 0, 0]) as number[]);
      return [node.id, object];
    }),
  );
  for (const node of source.nodes)
    (node.parent ? objects.get(node.parent)! : content).add(objects.get(node.id)!);
  content.updateMatrixWorld(true);
  return { content, objects };
}
function commandsFor(source: SceneDocument, accept = true) {
  const { content, objects } = realize(source);
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  objects.get('finger')!.add(box);
  let selected: string | undefined;
  const modes: string[] = [],
    messages: string[] = [];
  const templates = new Map<string, THREE.Object3D>([['arm', new THREE.Group()]]);
  const library = new Map([
    [
      'crate',
      { id: 'crate', name: 'Crate', stats: { bounds: { min: [0, -0.5, 0] } } } as LibraryItem,
    ],
  ]);
  const commands = createNodeCommands({
    source,
    templates,
    library,
    remapTemplate: (object, id) => Object.assign(object, { name: id }),
    objectFor: (id) => content.getObjectByName(`${source.id}/${id}`),
    change: (action) => {
      if (accept) action();
      return accept;
    },
    selectedId: () => selected,
    setSelectedId: (id) => (selected = id),
    setMode: (mode) => modes.push(mode),
    toast: (message) => messages.push(message),
  });
  return { commands, templates, modes, messages, select: (id?: string) => (selected = id) };
}

test('scene tree helpers find subtrees, free IDs and collision-free copy IDs', () => {
  const nodes = scene().nodes;
  assert.deepEqual([...descendantIds(nodes, 'arm')].sort(), ['arm', 'finger', 'hand']);
  assert.deepEqual([...descendantIds(nodes, 'lamp')], ['lamp']);
  const taken = new Set(['arm', 'arm_2']);
  assert.equal(
    availableNodeId('arm', (id) => taken.has(id)),
    'arm_3',
  );
  assert.equal(
    availableNodeId('x'.repeat(60), () => false),
    'x'.repeat(50),
  );
  const copies = subtreeCopyIds(nodes, descendantIds(nodes, 'arm'), 'arm', 'arm_2');
  assert.deepEqual(Object.fromEntries(copies!), {
    arm: 'arm_2',
    hand: 'arm_2--hand',
    finger: 'arm_2--finger',
  });
  assert.equal(subtreeCopyIds(nodes, new Set(['arm', 'hand']), 'arm', 'lamp'), undefined);
});

test('node commands duplicate, ground, add and remove through the change port', () => {
  const source = scene();
  const { commands, templates, modes, messages, select } = commandsFor(source);
  select('arm');
  commands.duplicate();
  const copy = source.nodes.find((n) => n.id === 'arm_2')!;
  assert.deepEqual(copy.transform?.position, [1, 3, 0]);
  assert.equal(source.nodes.find((n) => n.id === 'arm_2--hand')?.parent, 'arm_2');
  assert.equal(source.nodes.find((n) => n.id === 'arm_2--finger')?.parent, 'arm_2--hand');
  assert.equal(templates.get('arm_2')?.name, 'arm_2');
  select('finger');
  commands.ground();
  // The unit box under `finger` sits at world Y 3, so its base rests on Y 0 at local Y -2.5.
  assert.deepEqual(source.nodes.find((n) => n.id === 'finger')?.transform?.position, [0, -2.5, 0]);
  assert.equal(commands.addModel('crate'), 'crate');
  assert.deepEqual(source.nodes.at(-1)?.transform?.position, [0, 0.5, 0]);
  assert.deepEqual(modes, ['translate']);
  assert.throws(() => commands.addModel('missing'), /Unknown model missing/);
  select('arm');
  commands.remove();
  assert.deepEqual(
    source.nodes.map((n) => n.id),
    ['lamp', 'arm_2', 'arm_2--hand', 'arm_2--finger', 'crate'],
  );
  assert.deepEqual(messages, [
    'Duplicated selection.',
    'Added Crate. Move it with the handles or position fields.',
    'Removed selection. Undo is available.',
  ]);
});

test('node commands leave the scene untouched when the change port rejects the edit', () => {
  const source = scene();
  const before = structuredClone(source.nodes);
  const { commands, modes, messages, select } = commandsFor(source, false);
  assert.equal(commands.addModel('crate'), '');
  select('arm');
  commands.duplicate();
  commands.remove();
  assert.deepEqual(source.nodes, before);
  assert.deepEqual([modes, messages], [[], []]);
});

test('picking resolves hits to the nearest authored node within visible content', () => {
  const source = scene();
  const { content, objects } = realize(source);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  objects.get('finger')!.add(mesh);
  assert.equal(nodeIdForObject(mesh, content, source), 'finger');
  assert.equal(nodeIdForObject(content, content, source), undefined);
  assert.equal(nodeIdForObject(undefined, content, source), undefined);
  assert.equal(visibleInScene(mesh), true);
  objects.get('arm')!.visible = false;
  assert.equal(visibleInScene(mesh), false);
});

test('status statistics count only visible meshes and their triangles', () => {
  const content = new THREE.Group();
  const indexed = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  const loose = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).toNonIndexed());
  const hidden = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  hidden.visible = false;
  content.add(indexed, loose, hidden);
  assert.deepEqual(visibleMeshStats(content), { meshes: 2, triangles: 24 });
});

test('review plans freeze the current camera at a bounded stage size', () => {
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(4, 3, 5);
  const display = { grid: false, wireframe: true, background: '#101010' };
  const wide = reviewPlanFor(
    { clientWidth: 4096, clientHeight: 1024 },
    camera,
    new THREE.Vector3(0, 1, 0),
    display,
  );
  assert.deepEqual([wide.width, wide.height, wide.grid, wide.wireframe], [2048, 512, false, true]);
  const fixed = wide.frames[0].camera.fixed;
  assert.deepEqual([fixed.projection, fixed.aspect, fixed.target], ['perspective', 4, [0, 1, 0]]);
  assert.equal(camera.aspect, 1, 'the live camera is not modified');
  const ortho = new THREE.OrthographicCamera(-2, 2, 1, -1, 0.1, 100);
  const small = reviewPlanFor(
    { clientWidth: 10, clientHeight: 10 },
    ortho,
    new THREE.Vector3(),
    display,
  );
  assert.deepEqual([small.width, small.height], [64, 64]);
  assert.equal(small.frames[0].camera.fixed.aspect, undefined);
  assert.equal(small.background, '#101010');
});
