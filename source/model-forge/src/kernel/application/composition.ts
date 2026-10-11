import { Box3, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { compileScene } from './compiler.js';
import {
  fail,
  parse,
  Id,
  ModelSchema,
  type ModelDocument,
  type ModelLibrary,
  type SceneDocument,
  type TransformSpec,
  type Operation,
} from '../domain/schema.js';
import { resolveData } from '../domain/validate.js';

export function nodeById(scene: SceneDocument, id: string) {
  const node = scene.nodes.find((n) => n.id === id);
  if (!node) fail('NOT_FOUND', `Node ${id} does not exist.`);
  return node;
}
export function subtreeIds(scene: SceneDocument, id: string): Set<string> {
  nodeById(scene, id);
  const result = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of scene.nodes)
      if (n.parent && result.has(n.parent) && !result.has(n.id)) {
        result.add(n.id);
        changed = true;
      }
  }
  return result;
}
export function matrixTransform(matrix: Matrix4): TransformSpec {
  const position = new Vector3(),
    scale = new Vector3(),
    rotation = new Quaternion();
  matrix.decompose(position, rotation, scale);
  const rebuilt = new Matrix4().compose(position, rotation, scale);
  if (
    matrix.elements.some(
      (v, i) =>
        !Number.isFinite(v) || Math.abs(v - rebuilt.elements[i]) > 1e-7 * Math.max(1, Math.abs(v)),
    )
  )
    fail(
      'SHEAR_UNSUPPORTED',
      'This transform contains shear. Use uniform parent scale or reparent with --local.',
    );
  const euler = new Euler().setFromQuaternion(rotation, 'XYZ');
  return {
    position: position.toArray(),
    rotation: [euler.x, euler.y, euler.z].map((v) => (v * 180) / Math.PI) as [
      number,
      number,
      number,
    ],
    scale: scale.toArray(),
  };
}
function moveWorld(scene: SceneDocument, id: string, delta: Vector3, models: ModelLibrary) {
  const built = compileScene(scene, models);
  try {
    const object = built.content.getObjectByName(`${scene.id}/${id}`)!;
    const position = object.getWorldPosition(new Vector3()).add(delta);
    if (object.parent) object.parent.worldToLocal(position);
    const node = nodeById(scene, id);
    node.transform = { ...node.transform, position: position.toArray() };
  } finally {
    built.dispose();
  }
}
export function applySpatialOperation(scene: SceneDocument, op: Operation, models: ModelLibrary) {
  if (op.op === 'patchNode') {
    const node = nodeById(scene, op.id);
    const patch = structuredClone(op.patch);
    if ((patch.parameters || patch.materialOverrides || patch.rig) && node.type !== 'model')
      fail('INVALID_NODE_TYPE', 'Parameter and material overrides apply only to model instances.');
    const transform = patch.transform ? { ...node.transform, ...patch.transform } : node.transform;
    if (node.type === 'model') {
      if (patch.parameters) patch.parameters = { ...node.parameters, ...patch.parameters };
      if (patch.materialOverrides)
        patch.materialOverrides = { ...node.materialOverrides, ...patch.materialOverrides };
    }
    if (patch.rig === null) {
      if (node.type === 'model') delete node.rig;
      delete patch.rig;
    }
    if (patch.pattern === null) {
      delete node.pattern;
      delete patch.pattern;
    }
    Object.assign(node, patch);
    node.transform = transform;
    return;
  }
  if (op.op === 'duplicateNode') {
    const ids = subtreeIds(scene, op.id);
    const mapping = new Map(
      [...ids].map((id) => [id, id === op.id ? op.newId : `${op.newId}--${id}`]),
    );
    for (const id of mapping.values()) {
      parse(Id, id);
      if (scene.nodes.some((n) => n.id === id))
        fail('ALREADY_EXISTS', `Duplicate would overwrite node ${id}.`);
    }
    const copies = scene.nodes
      .filter((n) => ids.has(n.id))
      .map((n) => {
        const copy = structuredClone(n);
        copy.id = mapping.get(n.id)!;
        if (copy.parent && mapping.has(copy.parent)) copy.parent = mapping.get(copy.parent);
        return copy;
      });
    const root = copies.find((n) => n.id === op.newId)!;
    const position = resolveData(
      root.transform?.position ?? [0, 0, 0],
      scene.parameters,
    ) as number[];
    const offset = resolveData(op.offset, scene.parameters) as number[];
    root.transform = {
      ...root.transform,
      position: position.map((v, i) => v + offset[i]) as [number, number, number],
    };
    scene.nodes.push(...copies);
    return;
  }
  if (op.op === 'reparentNode') {
    const node = nodeById(scene, op.id);
    if (op.parent) {
      nodeById(scene, op.parent);
      if (subtreeIds(scene, op.id).has(op.parent))
        fail('CYCLE', 'Cannot parent a node to itself or a descendant.');
    }
    if (op.keepWorld) {
      const built = compileScene(scene, models);
      try {
        const matrix = built.content.getObjectByName(`${scene.id}/${op.id}`)!.matrixWorld.clone();
        const parent = op.parent
          ? built.content.getObjectByName(`${scene.id}/${op.parent}`)!
          : built.content;
        matrix.premultiply(parent.matrixWorld.clone().invert());
        node.transform = matrixTransform(matrix);
      } finally {
        built.dispose();
      }
    }
    if (op.parent) node.parent = op.parent;
    else delete node.parent;
    return;
  }
  if (op.op === 'groupNodes') {
    if (scene.nodes.some((n) => n.id === op.id))
      fail('ALREADY_EXISTS', `Node ${op.id} already exists.`);
    const selected = [...new Set(op.nodes)].map((id) => nodeById(scene, id));
    const parent = selected[0].parent;
    if (selected.some((n) => n.parent !== parent))
      fail('DIFFERENT_PARENTS', 'Group nodes must share the same parent. Reparent them first.');
    scene.nodes.push({ id: op.id, type: 'group', name: op.name, parent, visible: true, tags: [] });
    selected.forEach((n) => (n.parent = op.id));
    return;
  }
  if (op.op === 'groundNode' || op.op === 'placeNode') {
    nodeById(scene, op.id);
    if (op.op === 'placeNode') {
      nodeById(scene, op.target);
      if (subtreeIds(scene, op.id).has(op.target) || subtreeIds(scene, op.target).has(op.id))
        fail(
          'DEPENDENT_NODES',
          'Placement target must be outside the moving subtree and its ancestors.',
        );
    }
    const built = compileScene(scene, models);
    let delta = new Vector3();
    try {
      const box = new Box3().setFromObject(built.content.getObjectByName(`${scene.id}/${op.id}`)!);
      if (box.isEmpty()) fail('EMPTY_GEOMETRY', 'Cannot position an empty group by bounds.');
      if (op.op === 'groundNode') delta.y = op.y - box.min.y;
      else {
        const target = new Box3().setFromObject(
          built.content.getObjectByName(`${scene.id}/${op.target}`)!,
        );
        if (target.isEmpty()) fail('EMPTY_GEOMETRY', 'Placement target has no geometry.');
        if (op.center)
          delta.subVectors(target.getCenter(new Vector3()), box.getCenter(new Vector3()));
        const axis = (
          { right: 'x', left: 'x', front: 'z', back: 'z', above: 'y', below: 'y' } as const
        )[op.side];
        delta[axis] = ['right', 'front', 'above'].includes(op.side)
          ? target.max[axis] + op.gap - box.min[axis]
          : target.min[axis] - op.gap - box.max[axis];
      }
    } finally {
      built.dispose();
    }
    moveWorld(scene, op.id, delta, models);
    return;
  }
  fail('UNKNOWN_OPERATION', `Unsupported spatial operation ${op.op}.`);
}

/** Capture a local assembly with only its referenced geometry/material dependencies. */
export function captureModel(
  scene: SceneDocument,
  rootIds: string[],
  id: string,
  name = id,
): ModelDocument {
  parse(Id, id);
  const roots = [...new Set(rootIds)];
  if (!roots.length) fail('INPUT_REQUIRED', 'Choose at least one node to capture.');
  const rootNodes = roots.map((root) => nodeById(scene, root));
  const parent = rootNodes[0].parent;
  if (rootNodes.some((n) => n.parent !== parent))
    fail('DIFFERENT_PARENTS', 'Captured roots must share a parent. Group the assembly first.');
  const selected = new Set<string>();
  for (const root of roots) {
    if (roots.some((other) => other !== root && subtreeIds(scene, other).has(root)))
      fail('OVERLAPPING_SELECTION', 'Select a parent or its child, not both.');
    subtreeIds(scene, root).forEach((n) => selected.add(n));
  }
  const nodes = resolveData(
    structuredClone(scene.nodes.filter((n) => selected.has(n.id))),
    scene.parameters,
  );
  for (const node of nodes)
    if (roots.includes(node.id)) {
      delete node.parent;
      // One root defines the model pivot. Multiple roots retain their common local frame.
      if (roots.length === 1) node.transform = { ...node.transform, position: [0, 0, 0] };
    }
  const geometryIds = new Set<string>(),
    materialIds = new Set<string>();
  const collectGeometry = (gid: string) => {
    if (geometryIds.has(gid)) return;
    geometryIds.add(gid);
    const geometry = scene.geometries[gid];
    if (!geometry) fail('REFERENCE_MISSING', `Geometry ${gid} is missing.`);
    if (geometry.type === 'boolean') {
      collectGeometry(geometry.left);
      collectGeometry(geometry.right);
    }
  };
  for (const node of nodes) {
    if (node.type === 'mesh') {
      collectGeometry(node.geometry);
      materialIds.add(node.material);
    }
    if (node.type === 'model')
      Object.values(node.materialOverrides).forEach((mid) => materialIds.add(mid));
  }
  return parse(ModelSchema, {
    schemaVersion: 1,
    kind: 'model',
    id,
    name,
    parameters: {},
    nodes,
    geometries: resolveData(
      Object.fromEntries([...geometryIds].map((gid) => [gid, scene.geometries[gid]])),
      scene.parameters,
    ),
    materials: Object.fromEntries([...materialIds].map((mid) => [mid, scene.materials[mid]])),
  });
}
export function modelDependencies(library: ModelLibrary, id: string): ModelLibrary {
  const result: ModelLibrary = {};
  const visiting = new Set<string>();
  const visit = (mid: string) => {
    if (visiting.has(mid)) fail('CYCLE', `Model dependency cycle includes ${mid}.`);
    if (Object.hasOwn(result, mid)) return;
    const model = library[mid];
    if (!Object.hasOwn(library, mid)) fail('REFERENCE_MISSING', `Model ${mid} is missing.`);
    visiting.add(mid);
    model.nodes.forEach((n) => {
      if (n.type === 'model') visit(n.model);
    });
    visiting.delete(mid);
    result[mid] = structuredClone(model);
  };
  visit(id);
  return result;
}
