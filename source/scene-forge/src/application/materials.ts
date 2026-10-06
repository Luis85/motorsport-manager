import * as THREE from 'three';
import type { MaterialSpec } from '../domain/schema.js';
/** Both supported shading modes have a glTF representation; no executable shader code is accepted. */
export function createMaterial(
  m: MaterialSpec,
): THREE.MeshStandardMaterial | THREE.MeshBasicMaterial {
  const common = {
    color: m.color,
    opacity: m.opacity,
    transparent: m.opacity < 1,
    side: m.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  };
  return m.shading === 'unlit'
    ? new THREE.MeshBasicMaterial(common)
    : new THREE.MeshStandardMaterial({
        ...common,
        metalness: m.metalness,
        roughness: m.roughness,
        emissive: m.emissive ?? '#000000',
        emissiveIntensity: m.emissiveIntensity ?? 1,
        flatShading: m.flatShading,
      });
}
