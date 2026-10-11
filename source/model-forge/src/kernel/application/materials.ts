import * as THREE from 'three';
import type { MaterialSpec } from '../domain/schema.js';
import { applyFinish, applySurface, type createSurfacePool } from './surfaces.js';
import { fail } from '../domain/errors.js';
/** Both supported shading modes have a glTF representation; no executable shader code is accepted. */
export function createMaterial(
  m: MaterialSpec,
  surfaces?: ReturnType<typeof createSurfacePool>,
): THREE.MeshStandardMaterial | THREE.MeshBasicMaterial {
  if (m.depthWrite === false && m.opacity >= 1)
    fail(
      'MATERIAL_DEPTH_WRITE',
      'Disabling depth writes requires opacity below 1 for portable alpha blending.',
    );
  const common = {
    color: m.color,
    opacity: m.opacity,
    transparent: m.opacity < 1,
    depthWrite: m.depthWrite ?? true,
    side: m.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    // Only set when requested, so materials without the field build exactly as before.
    ...(m.vertexColors ? { vertexColors: true } : {}),
  };
  if (m.surface && m.finish)
    fail('INVALID_MATERIAL', 'Choose surface or finish detail for one material, not both.');
  if (m.shading === 'unlit' && (m.surface || m.finish))
    fail(
      'INVALID_MATERIAL',
      'Surface detail requires standard PBR shading; remove surface/finish or use standard shading.',
    );
  if (m.shading === 'unlit') return new THREE.MeshBasicMaterial(common);
  const standard = {
    ...common,
    metalness: m.metalness,
    roughness: m.roughness,
    emissive: m.emissive ?? '#000000',
    emissiveIntensity: m.emissiveIntensity ?? 1,
    flatShading: m.flatShading,
  };
  const physical = Object.fromEntries(
    ['sheen', 'sheenColor', 'sheenRoughness', 'clearcoat', 'clearcoatRoughness']
      .filter((key) => m[key as keyof MaterialSpec] !== undefined)
      .map((key) => [key, m[key as keyof MaterialSpec]]),
  );
  const result = Object.keys(physical).length
    ? new THREE.MeshPhysicalMaterial({ ...standard, ...physical })
    : new THREE.MeshStandardMaterial(standard);
  try {
    if (m.surface) applySurface(result, m.surface, surfaces);
    if (m.finish) applyFinish(result, m.finish, surfaces);
  } catch (error) {
    result.dispose();
    throw error;
  }
  return result;
}
