import { rememberMeshSource } from './mesh-source.js';
import { createSurfacePool } from './surfaces.js';
import { createMaterial } from './materials.js';
import { sphereUVs } from './surface-pattern.js';
import { organicGeometry } from './organic.js';
import { tubeGeometry } from './tube.js';
import { heightfieldGeometry } from './heightfield.js';
import * as THREE from 'three';
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg/src/index.js';
import {
  fail,
  type SceneDocument,
  type ModelDocument,
  type MaterialSpec,
} from '../domain/schema.js';
import type { Resolved } from '../domain/validate.js';
import { canonical as keyFor } from '../domain/canonical.js';
import { transform, triangles, uuid } from './transforms.js';

/** Owns every GPU resource allocated during one compilation, including failed builds. */
export function createResourcePool(warnings: Set<string>) {
  const surfaces = createSurfacePool();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const geometryPool = new Map<string, THREE.BufferGeometry>();
  const materialPool = new Map<string, THREE.Material>();
  function scopeResources(
    scope: Resolved<SceneDocument | ModelDocument>,
    path: string,
    overrides: Record<string, THREE.Material> = {},
  ) {
    const geometryCache = new Map<string, THREE.BufferGeometry>();
    const materialCache = new Map<string, THREE.Material>();
    function material(id: string): THREE.Material {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      if (materialCache.has(id)) return materialCache.get(id)!;
      const m: MaterialSpec = scope.materials[id];
      const key = keyFor({
        ...m,
        emissive: m.emissive ?? '#000000',
        emissiveIntensity: m.emissiveIntensity ?? 1,
      });
      if (materialPool.has(key)) {
        materialCache.set(id, materialPool.get(key)!);
        return materialPool.get(key)!;
      }
      const result = createMaterial(m, surfaces);
      result.name = `${path}/${id}`;
      Object.defineProperty(result, 'uuid', { value: uuid(`material/${key}`), writable: true });
      materialPool.set(key, result);
      materialCache.set(id, result);
      materials.add(result);
      return result;
    }
    function geometry(id: string): THREE.BufferGeometry {
      if (geometryCache.has(id)) return geometryCache.get(id)!;
      // Parameters have been resolved and semantically validated before geometry construction.
      const g = scope.geometries[id];
      // Boolean keys include resolved operand identities, never just scope-local IDs.
      const key = keyFor(
        g.type === 'boolean'
          ? { ...g, left: geometry(g.left).uuid, right: geometry(g.right).uuid }
          : g,
      );
      if (geometryPool.has(key)) {
        geometryCache.set(id, geometryPool.get(key)!);
        return geometryPool.get(key)!;
      }
      let result: THREE.BufferGeometry;
      switch (g.type) {
        case 'box':
          result = new THREE.BoxGeometry(...(g.size as [number, number, number]));
          break;
        case 'organic':
          result = organicGeometry(g);
          break;
        case 'sphere':
          result = new THREE.SphereGeometry(
            g.radius,
            g.segments ?? 32,
            Math.max(8, (g.segments ?? 32) / 2),
          );
          break;
        case 'cylinder':
          result = new THREE.CylinderGeometry(
            g.radiusTop,
            g.radiusBottom,
            g.height,
            g.segments ?? 32,
            1,
            g.openEnded ?? false,
          );
          break;
        case 'cone':
          result = new THREE.ConeGeometry(g.radius, g.height, g.segments ?? 32);
          break;
        case 'torus':
          result = new THREE.TorusGeometry(g.radius, g.tube, 12, g.segments ?? 48);
          break;
        case 'capsule':
          result = new THREE.CapsuleGeometry(g.radius, g.length, 8, g.segments ?? 24);
          break;
        case 'tube':
          result = tubeGeometry(g);
          break;
        case 'heightfield':
          result = heightfieldGeometry(g);
          break;
        case 'plane':
          result = new THREE.PlaneGeometry(...(g.size as [number, number]));
          break;
        case 'lathe':
          result = new THREE.LatheGeometry(
            g.points.map((p: number[]) => new THREE.Vector2(p[0], p[1])),
            g.segments ?? 32,
          );
          break;
        case 'extrude': {
          const shape = new THREE.Shape(
            g.points.map((p: number[]) => new THREE.Vector2(p[0], p[1])),
          );
          shape.holes = (g.holes ?? []).map(
            (points: number[][]) =>
              new THREE.Path(points.map((p) => new THREE.Vector2(p[0], p[1]))),
          );
          result = new THREE.ExtrudeGeometry(shape, {
            depth: g.depth,
            steps: 1,
            bevelEnabled: (g.bevel ?? 0) > 0,
            bevelSize: g.bevel ?? 0,
            bevelThickness: g.bevel ?? 0,
            bevelSegments: g.bevelSegments ?? 3,
          });
          break;
        }
        case 'mesh': {
          result = new THREE.BufferGeometry();
          result.setAttribute('position', new THREE.Float32BufferAttribute(g.positions.flat(), 3));
          result.setIndex(g.indices);
          if (g.normals)
            result.setAttribute('normal', new THREE.Float32BufferAttribute(g.normals.flat(), 3));
          else result.computeVertexNormals();
          if (g.uvs) result.setAttribute('uv', new THREE.Float32BufferAttribute(g.uvs.flat(), 2));
          else
            warnings.add(
              'Custom mesh uses local spherical UV fallback; author seam-aware uvs for precise surface placement.',
            );
          break;
        }
        case 'boolean': {
          const leftGeometry = geometry(g.left),
            rightGeometry = geometry(g.right);
          if (triangles(leftGeometry) + triangles(rightGeometry) > 100000)
            fail('CSG_BUDGET', `Boolean ${id} exceeds the 100,000 input triangle limit.`);
          const left = new Brush(leftGeometry),
            right = new Brush(rightGeometry);
          try {
            transform(left, g.leftTransform);
            transform(right, g.rightTransform);
            const evaluator = new Evaluator();
            evaluator.useGroups = false;
            evaluator.attributes = ['position', 'normal'];
            // Supply and own the evaluator target, including when evaluation throws.
            const target = new Brush();
            const targetMaterial = target.material as THREE.Material;
            geometries.add(target.geometry);
            try {
              const brush = evaluator.evaluate(
                left,
                right,
                { union: ADDITION, subtract: SUBTRACTION, intersect: INTERSECTION }[g.operation],
                target,
              );
              result = brush.geometry;
              geometries.add(result);
              result.applyMatrix4(brush.matrix);
              result.computeVertexNormals();
            } finally {
              targetMaterial.dispose();
            }
          } finally {
            (left.material as THREE.Material).dispose();
            (right.material as THREE.Material).dispose();
          }
          warnings.add(
            'Boolean operations require closed, manifold inputs; coplanar or degenerate intersections can produce artifacts. Inspect the result before use.',
          );
          break;
        }
        default:
          return fail('UNKNOWN_GEOMETRY', `Unsupported geometry type.`);
      }
      if (!result.getAttribute('uv')) {
        const positions = Array.from(result.getAttribute('position').array);
        result.setAttribute('uv', new THREE.Float32BufferAttribute(sphereUVs(positions), 2));
      }
      geometries.add(result);
      result.name = `${path}/${id}`;
      result.uuid = uuid(`geometry/${key}`);
      // Lathe/capsule constructors emit redundant pole triangles.
      // Remove zero or near-collinear generated faces using the audit tolerance; authored
      // custom/boolean topology remains intact for the quality audit to diagnose.
      if ((g.type === 'lathe' || g.type === 'capsule') && result.index) {
        const positions = result.getAttribute('position');
        const kept: number[] = [];
        const a = new THREE.Vector3(),
          b = new THREE.Vector3(),
          c = new THREE.Vector3();
        for (let i = 0; i < result.index.count; i += 3) {
          const ids = [0, 1, 2].map((j) => result.index!.getX(i + j));
          a.fromBufferAttribute(positions, ids[0]);
          b.fromBufferAttribute(positions, ids[1]);
          c.fromBufferAttribute(positions, ids[2]);
          const edge = Math.max(
            a.distanceToSquared(b),
            a.distanceToSquared(c),
            b.distanceToSquared(c),
          );
          if (b.sub(a).cross(c.sub(a)).lengthSq() > edge * edge * 1e-24) kept.push(...ids);
        }
        if (!kept.length)
          fail('EMPTY_GEOMETRY', `Geometry ${id} generated no nondegenerate faces.`);
        result.setIndex(kept);
      }
      // Flatten material groups: each authored mesh deliberately has one material.
      result.clearGroups();
      const normals = result.getAttribute('normal');
      if (normals) {
        const normal = new THREE.Vector3();
        for (let i = 0; i < normals.count; i++) {
          normal.fromBufferAttribute(normals, i);
          if (normal.lengthSq() < 1e-12) normal.set(0, 1, 0);
          else normal.normalize();
          normals.setXYZ(i, normal.x, normal.y, normal.z);
        }
      }
      const position = result.getAttribute('position');
      if (!position || !position.count)
        fail('EMPTY_GEOMETRY', `Geometry ${id} generated no vertices.`);
      for (let i = 0; i < position.array.length; i++)
        if (!Number.isFinite(position.array[i]))
          fail('INVALID_GEOMETRY', `Geometry ${id} generated non-finite coordinates.`);
      // Transport actual buffers. Constructor JSON would regenerate geometry and
      // silently discard cap indices, pole cleanup and other compiled changes.
      const baked = new THREE.BufferGeometry().copy(result);
      baked.uuid = result.uuid;
      geometries.delete(result);
      result.dispose();
      result = baked;
      if (g.type === 'mesh') rememberMeshSource(result, g);
      geometries.add(result);
      geometryCache.set(id, result);
      geometryPool.set(key, result);
      return result;
    }

    return { geometry, material };
  }
  return {
    scopeResources,
    get geometryCount() {
      return geometryPool.size;
    },
    get materialCount() {
      return materials.size;
    },
    dispose() {
      surfaces.dispose();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      geometries.clear();
      materials.clear();
      geometryPool.clear();
      materialPool.clear();
    },
  };
}
