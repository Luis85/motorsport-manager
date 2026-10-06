import { Box3, Vector3, Mesh } from 'three';
import { compileScene } from './compiler.js';
import {
  fail,
  type SceneDocument,
  type ModelLibrary,
  type NodeSelector,
} from '../domain/schema.js';

/** Filters intersect; an empty selector intentionally selects all authored nodes. */
export function selectNodes(scene: SceneDocument, selector: NodeSelector) {
  if (selector.ids) {
    const missing = selector.ids.filter((id) => !scene.nodes.some((n) => n.id === id));
    if (missing.length) fail('NOT_FOUND', 'Selected node IDs do not exist.', { missing });
  }
  return scene.nodes.filter(
    (n) =>
      (!selector.ids || selector.ids.includes(n.id)) &&
      (selector.tag === undefined || n.tags.includes(selector.tag)) &&
      (!selector.type || n.type === selector.type) &&
      (!selector.model || (n.type === 'model' && n.model === selector.model)) &&
      (selector.parent === undefined || (n.parent ?? null) === selector.parent),
  );
}

export function inspectNodes(
  scene: SceneDocument,
  models: ModelLibrary,
  selector: NodeSelector = {},
  detailed = false,
) {
  const nodes = selectNodes(scene, selector);
  if (!detailed)
    return nodes.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      parent: n.parent ?? null,
      visible: n.visible,
      tags: n.tags,
      ...(n.type === 'model' ? { model: n.model } : {}),
      transform: n.transform,
    }));
  const built = compileScene(scene, models);
  try {
    return nodes.map((node) => {
      const object = built.content.getObjectByName(`${scene.id}/${node.id}`)!;
      const box = new Box3().setFromObject(object);
      let meshes = 0,
        triangles = 0;
      object.traverse((child) => {
        if (child instanceof Mesh) {
          meshes++;
          triangles +=
            (child.geometry.index?.count ?? child.geometry.getAttribute('position').count) / 3;
        }
      });
      return {
        node,
        worldPosition: object.getWorldPosition(new Vector3()).toArray(),
        worldMatrix: object.matrixWorld.toArray(),
        bounds: box.isEmpty()
          ? null
          : {
              min: box.min.toArray(),
              max: box.max.toArray(),
              size: box.getSize(new Vector3()).toArray(),
            },
        meshes,
        triangles,
      };
    });
  } finally {
    built.dispose();
  }
}

export function sceneChanges(before: SceneDocument, after: SceneDocument) {
  const diff = (a: Record<string, unknown>, b: Record<string, unknown>) => ({
    added: Object.keys(b).filter((k) => !Object.hasOwn(a, k)),
    updated: Object.keys(b).filter(
      (k) => Object.hasOwn(a, k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]),
    ),
    removed: Object.keys(a).filter((k) => !Object.hasOwn(b, k)),
  });
  return {
    nodes: diff(
      Object.fromEntries(before.nodes.map((n) => [n.id, n])),
      Object.fromEntries(after.nodes.map((n) => [n.id, n])),
    ),
    geometries: diff(before.geometries, after.geometries),
    materials: diff(before.materials, after.materials),
    parameters: diff(before.parameters, after.parameters),
    settings: (['camera', 'environment', 'name'] as const).filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
    ),
  };
}
