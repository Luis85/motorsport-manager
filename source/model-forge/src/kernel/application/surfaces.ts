import * as THREE from 'three';
import type { SurfaceSpec, FinishSpec } from '../domain/schema.js';
import { fail } from '../domain/errors.js';
import { canonical } from '../domain/canonical.js';
import { uuid } from '../domain/identity.js';
import { generateSurface, resolveSurfaceAlgorithm } from './surface-pattern.js';
import { generateFinish, finishAlgorithm } from './finish-pattern.js';

export const maxSurfaceRecipes = 256;
/** One compilation/view owns a bounded map pool shared across material colors. */
export function createSurfacePool() {
  const recipes = new Map<
    string,
    {
      color: THREE.DataTexture;
      normal: THREE.DataTexture;
      orm?: THREE.DataTexture;
    }
  >();
  function texture(data: Uint8Array, name: string, scale: number) {
    const map = new THREE.DataTexture(data, 128, 128, THREE.RGBAFormat);
    map.name = name;
    map.uuid = uuid(name);
    Object.defineProperty(map.source, 'uuid', { value: uuid(`${name}/source`) });
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(scale, scale);
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    map.needsUpdate = true;
    return map;
  }
  function apply(material: THREE.MeshStandardMaterial, surface: SurfaceSpec) {
    const { version, ...legacy } = surface;
    const surfaceAlgorithm = resolveSurfaceAlgorithm(surface);
    const key = `${surfaceAlgorithm}/${canonical(version === 1 ? legacy : surface)}`;
    let maps = recipes.get(key);
    if (!maps) {
      if (recipes.size >= maxSurfaceRecipes)
        fail(
          'SCENE_BUDGET',
          `Scene exceeds ${maxSurfaceRecipes} distinct surface recipes. Reuse kind/seed/scale/strength across material colors.`,
        );
      const pixels = generateSurface(surface);
      maps = {
        color: texture(pixels.color, `${key}/color`, surface.scale),
        normal: texture(pixels.normal, `${key}/normal`, surface.scale),
      };
      maps.color.colorSpace = THREE.SRGBColorSpace;
      recipes.set(key, maps);
    }
    material.map = maps.color;
    material.normalMap = maps.normal;
    material.userData = {
      ...material.userData,
      surface: structuredClone(surface),
      surfaceAlgorithm,
    };
  }
  function applyFinish(material: THREE.MeshStandardMaterial, finish: FinishSpec) {
    const key = `${finishAlgorithm}/${canonical(finish)}`;
    let maps = recipes.get(key);
    if (!maps) {
      if (recipes.size >= maxSurfaceRecipes)
        fail(
          'SCENE_BUDGET',
          `Scene exceeds ${maxSurfaceRecipes} distinct surface recipes. Reuse surface and finish recipes across material colors.`,
        );
      const pixels = generateFinish(finish);
      maps = {
        color: texture(pixels.color, `${key}/color`, finish.scale),
        normal: texture(pixels.normal, `${key}/normal`, finish.scale),
        orm: texture(pixels.orm, `${key}/orm`, finish.scale),
      };
      maps.color.colorSpace = THREE.SRGBColorSpace;
      recipes.set(key, maps);
    }
    material.map = maps.color;
    material.normalMap = maps.normal;
    material.roughnessMap = material.metalnessMap = maps.orm!;
    material.userData = { ...material.userData, finish: structuredClone(finish), finishAlgorithm };
  }
  function dispose() {
    for (const maps of recipes.values()) {
      maps.color.dispose();
      maps.normal.dispose();
      maps.orm?.dispose();
    }
    recipes.clear();
  }
  return { apply, applyFinish, dispose };
}

/** Standalone material callers own an isolated pool; scene compilers supply a shared owner. */
export function applySurface(
  material: THREE.MeshStandardMaterial,
  surface: SurfaceSpec,
  owner?: ReturnType<typeof createSurfacePool>,
) {
  const pool = owner ?? createSurfacePool();
  pool.apply(material, surface);
  if (!owner) material.addEventListener('dispose', pool.dispose);
}

/** As with surfaces, a supplied scene pool owns resources independently of material disposal. */
export function applyFinish(
  material: THREE.MeshStandardMaterial,
  finish: FinishSpec,
  owner?: ReturnType<typeof createSurfacePool>,
) {
  const pool = owner ?? createSurfacePool();
  pool.applyFinish(material, finish);
  if (!owner) material.addEventListener('dispose', pool.dispose);
}

/** Explicit portable tangent basis, including unused UV pole vertices and degenerate UV islands. */
export function ensureSurfaceTangents(geometry: THREE.BufferGeometry) {
  if (geometry.getAttribute('tangent')) return;
  if (!geometry.index)
    geometry.setIndex(Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i));
  geometry.computeTangents();
  const tangents = geometry.getAttribute('tangent'),
    normals = geometry.getAttribute('normal');
  const normal = new THREE.Vector3(),
    tangent = new THREE.Vector3();
  for (let i = 0; i < tangents.count; i++) {
    tangent.fromBufferAttribute(tangents, i);
    if (
      !Number.isFinite(tangent.lengthSq()) ||
      tangent.lengthSq() < 1e-12 ||
      Math.abs(tangents.getW(i)) !== 1
    ) {
      normal.fromBufferAttribute(normals, i).normalize();
      tangent
        .set(Math.abs(normal.y) > 0.9 ? 1 : 0, Math.abs(normal.y) > 0.9 ? 0 : 1, 0)
        .cross(normal)
        .normalize();
      tangents.setXYZW(i, tangent.x, tangent.y, tangent.z, 1);
    }
  }
}
