import * as THREE from 'three';
import type { NodeSpec } from '../domain/schema.js';
export type LightNode = Extract<NodeSpec, { type: 'light' }>;
export function orientLight(light: THREE.DirectionalLight | THREE.SpotLight) {
  for (const child of [...light.children])
    if (child.name === 'forgeLightTarget') light.remove(child);
  const target = new THREE.Object3D();
  target.name = 'forgeLightTarget';
  target.position.set(0, 0, -1);
  light.add(target);
  light.target = target;
}
export function createLight(node: LightNode): THREE.Light {
  const light =
    node.light === 'directional'
      ? new THREE.DirectionalLight(node.color, node.intensity)
      : node.light === 'spot'
        ? new THREE.SpotLight(
            node.color,
            node.intensity,
            node.distance,
            THREE.MathUtils.degToRad(node.angle),
            node.penumbra,
            2,
          )
        : new THREE.PointLight(node.color, node.intensity, node.distance, 2);
  light.castShadow = node.castShadow;
  if (light instanceof THREE.SpotLight || light instanceof THREE.DirectionalLight)
    orientLight(light);
  return light;
}
