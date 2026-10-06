import * as THREE from 'three';
import type { NodeSpec } from '../domain/schema.js';
export type LightNode = Extract<NodeSpec, {
    type: 'light';
}>;
export declare function orientLight(light: THREE.DirectionalLight | THREE.SpotLight): void;
export declare function createLight(node: LightNode): THREE.Light;
