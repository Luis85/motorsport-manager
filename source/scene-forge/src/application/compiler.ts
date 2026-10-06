import { bindRig } from './rigging.js';
import { createLight } from './lights.js';
import * as THREE from 'three';
import {
  fail,
  type SceneDocument,
  type ModelDocument,
  type ModelLibrary,
  type NodeSpec,
} from '../domain/schema.js';
import {
  validateDocument,
  modelParameters,
  resolveData,
  type Resolved,
} from '../domain/validate.js';

import { createResourcePool } from './resources.js';
import { transform, uuid, triangles, radians } from './transforms.js';

export interface CompiledScene {
  scene: THREE.Scene;
  content: THREE.Group;
  stats: SceneStats;
  dispose(): void;
}
export interface SceneStats {
  nodes: number;
  meshes: number;
  triangles: number;
  materials: number;
  geometries: number;
  bounds: { min: number[]; max: number[]; size: number[] };
  warnings: string[];
}
export function compileScene(
  document: SceneDocument,
  models: ModelLibrary = {},
  options: { bindRigs?: boolean } = {},
): CompiledScene {
  validateDocument(document, models);
  const scene = new THREE.Scene();
  scene.name = document.name;
  scene.uuid = uuid(document.id);
  const content = new THREE.Group();
  content.name = document.id;
  content.uuid = uuid(`${document.id}/content`);
  scene.add(content);
  let meshCount = 0,
    triangleCount = 0,
    objectCount = 0,
    lightCount = 0,
    shadowCount = 0;
  const warnings = new Set<string>();
  const resources = createResourcePool(warnings);
  const rigs: ReturnType<typeof bindRig>[] = [];
  const pendingRigs: { object: THREE.Object3D; rig: import('../domain/schema.js').RigSpec }[] = [];
  const dispose = () => {
    rigs.forEach((rig) => rig.dispose());
    resources.dispose();
  };

  function buildScope(
    source: SceneDocument | ModelDocument,
    target: THREE.Group,
    path: string,
    parameters: Record<string, number>,
    overrides: Record<string, THREE.Material> = {},
    inheritedSlots: Record<string, string[]> = {},
  ) {
    const scope = resolveData(source, parameters);
    const slots = (id: string) => [`${path}/${id}`, ...(inheritedSlots[id] ?? [])];
    const { geometry, material } = resources.scopeResources(scope, path, overrides);
    const objects = new Map<string, THREE.Object3D>();
    const make = (node: Resolved<NodeSpec>, nodePath: string): THREE.Object3D => {
      if (++objectCount > 20000) fail('SCENE_BUDGET', 'Expanded scene exceeds 20,000 objects.');
      let object: THREE.Object3D;
      if (node.type === 'mesh') {
        const g = geometry(node.geometry);
        triangleCount += triangles(g);
        meshCount++;
        if (triangleCount > 2e6)
          fail('SCENE_BUDGET', 'Expanded scene exceeds 2,000,000 triangles.');
        object = new THREE.Mesh(g, material(node.material));
        object.castShadow = true;
        object.receiveShadow = true;
      } else if (node.type === 'light') {
        if (++lightCount > 32 || (node.castShadow && ++shadowCount > 4))
          fail(
            'LIGHT_BUDGET',
            'Scenes support at most 32 authored lights and 4 shadow-casting lights.',
          );
        object = createLight(node);
      } else {
        object = new THREE.Group();
        if (node.type === 'model') {
          const model = models[node.model];
          const replace = Object.fromEntries(
            Object.entries(node.materialOverrides).map(([from, to]) => [from, material(to)]),
          );
          buildScope(
            model,
            object as THREE.Group,
            nodePath,
            modelParameters(model, node.parameters as Record<string, number>),
            replace,
            Object.fromEntries(
              Object.entries(node.materialOverrides).map(([from, to]) => [from, slots(to)]),
            ),
          );
        }
      }
      object.name = nodePath;
      object.uuid = uuid(nodePath);
      object.visible = node.visible;
      object.userData = {
        forgeId: node.id,
        forgePath: nodePath,
        label: node.name ?? node.id,
        tags: node.tags,
        type: node.type,
        ...(node.type === 'mesh'
          ? {
              geometry: node.geometry,
              material: node.material,
              materialSlots: slots(node.material),
            }
          : {}),
      };
      if (node.type === 'model' && node.rig) {
        object.userData.rig = node.rig;
        if (pendingRigs.length >= 32)
          fail('RIG_BUDGET', 'A scene supports at most 32 rig instances.');
        pendingRigs.push({ object, rig: node.rig });
      }
      transform(object, node.transform);
      return object;
    };
    for (const node of scope.nodes) {
      const nodePath = `${path}/${node.id}`;
      let object: THREE.Object3D;
      if (node.pattern) {
        if (++objectCount > 20000) fail('SCENE_BUDGET', 'Expanded scene exceeds 20,000 objects.');
        object = new THREE.Group();
        object.name = nodePath;
        object.uuid = uuid(nodePath);
        object.visible = node.visible;
        object.userData = {
          forgeId: node.id,
          forgePath: nodePath,
          label: node.name ?? node.id,
          type: 'pattern',
          tags: node.tags,
        };
        transform(object, node.transform);
        const counts =
          node.pattern.type === 'grid'
            ? (node.pattern.counts as number[])
            : [
                node.pattern.type === 'path' ? node.pattern.points.length : node.pattern.count,
                1,
                1,
              ];
        const count = counts.reduce((a, b) => a * b, 1);
        for (let i = 0; i < count; i++) {
          const copy = make(
            { ...node, transform: undefined, pattern: undefined },
            `${nodePath}/${i}`,
          );
          if (node.pattern.type === 'linear')
            copy.position.fromArray(node.pattern.step as number[]).multiplyScalar(i);
          else if (node.pattern.type === 'grid') {
            const pattern = node.pattern;
            const indices = [
              i % counts[0],
              Math.floor(i / counts[0]) % counts[1],
              Math.floor(i / (counts[0] * counts[1])),
            ];
            copy.position.fromArray(
              indices.map(
                (v, axis) =>
                  (v - (pattern.centered ? (counts[axis] - 1) / 2 : 0)) *
                  (pattern.step[axis] as number),
              ),
            );
          } else if (node.pattern.type === 'path') {
            const points = node.pattern.points;
            copy.position.fromArray(points[i]);
            if (node.pattern.orient === 'yaw' && points.length > 1) {
              const a = points[i === points.length - 1 ? i - 1 : i];
              const b = points[i === points.length - 1 ? i : i + 1];
              copy.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2]);
            }
          } else {
            const angle = radians(
              (node.pattern.startAngle as number) + (i * (node.pattern.sweep as number)) / count,
            );
            copy.position.set(
              Math.cos(angle) * (node.pattern.radius as number),
              0,
              Math.sin(angle) * (node.pattern.radius as number),
            );
            if (node.pattern.orient) copy.rotation.y = -angle;
          }
          object.add(copy);
        }
      } else object = make(node, nodePath);
      objects.set(node.id, object);
    }
    for (const node of scope.nodes)
      (node.parent ? objects.get(node.parent)! : target).add(objects.get(node.id)!);
  }
  try {
    buildScope(document, content, document.id, document.parameters);
    scene.updateMatrixWorld(true);
    if (options.bindRigs !== false)
      for (const { object, rig } of pendingRigs) rigs.push(bindRig(object, rig));
    content.traverse((object) => {
      if (!object.matrixWorld.elements.every(Number.isFinite))
        fail(
          'TRANSFORM_RANGE',
          `World transform overflow at ${object.name}. Reduce nested scales or coordinates.`,
        );
    });
    const bounds = new THREE.Box3().setFromObject(content);
    if (
      !bounds.isEmpty() &&
      ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)
    )
      fail('TRANSFORM_RANGE', 'World bounds overflowed. Reduce nested scales or coordinates.');
    const empty = bounds.isEmpty();
    const stats: SceneStats = {
      nodes: objectCount,
      meshes: meshCount,
      triangles: triangleCount,
      materials: resources.materialCount,
      geometries: resources.geometryCount,
      bounds: {
        min: empty ? [0, 0, 0] : bounds.min.toArray(),
        max: empty ? [0, 0, 0] : bounds.max.toArray(),
        size: empty ? [0, 0, 0] : bounds.getSize(new THREE.Vector3()).toArray(),
      },
      warnings: [...warnings],
    };
    if (meshCount === 0)
      stats.warnings.push('Scene has no meshes. Add mesh or model nodes before exporting.');
    return { scene, content, stats, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
