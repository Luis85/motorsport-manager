import * as THREE from 'three';
import type { MaterialSpec } from '../domain/schema.js';
import { fail } from '../domain/errors.js';
/** Both supported shading modes have a glTF representation; no executable shader code is accepted. */
export function createMaterial(
  m: MaterialSpec,
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
  };
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
  return Object.keys(physical).length
    ? new THREE.MeshPhysicalMaterial({ ...standard, ...physical })
    : new THREE.MeshStandardMaterial(standard);
}
