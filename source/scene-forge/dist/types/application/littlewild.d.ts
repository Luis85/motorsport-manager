import * as THREE from 'three';
import type { SurfaceSpec } from '../domain/schema.js';
/**
 * Converts one compiled Scene Forge model into the declarative Littlewild primitive grammar.
 * Boxes stay native primitives; every other mesh is baked into bounded indexed triangles.
 * The result is pure data: no callbacks, URLs or renderer state cross the boundary.
 */
export interface LittlewildMaterial {
    color: string;
    roughness: number;
    metalness: number;
    flatShading: boolean;
    surface?: SurfaceSpec;
    sheen?: number;
    sheenColor?: string;
    sheenRoughness?: number;
    clearcoat?: number;
    clearcoatRoughness?: number;
    emissive?: string;
    emissiveIntensity?: number;
    opacity?: number;
    transparent?: boolean;
    depthWrite?: boolean;
    doubleSided?: boolean;
}
export interface LittlewildMesh {
    positions: number[];
    uvs?: number[];
    normals?: number[];
    indices?: number[];
}
export interface LittlewildNode {
    primitive: string;
    id: string;
    position?: number[];
    rotation?: number[];
    scale?: number[];
    material?: string;
    mesh?: string;
    visible?: boolean;
    children?: LittlewildNode[];
}
export interface LittlewildModel {
    nodes: LittlewildNode[];
    materials: Record<string, LittlewildMaterial>;
    meshes: Record<string, LittlewildMesh>;
    rig: Record<string, string | string[]>;
    warnings: string[];
    stats: {
        nodes: number;
        meshes: number;
        primitives: number;
        vertices: number;
        triangles: number;
    };
}
/** Littlewild limits mirrored here so agents get an actionable error before the engine rejects it. */
export declare const littlewildLimits: {
    meshVertices: number;
    meshTriangles: number;
    definitionVertices: number;
};
/** Presentation roles the Littlewild pet renderer understands. Tag a node `rig:<role>` to bind it. */
export declare const littlewildPetRoles: readonly ["body", "head", "eyes", "ears", "tail", "arms", "feet", "mouth", "cheeks", "sprout", "shell", "hat", "face", "neck", "back"];
/** Mirrors the Littlewild engine kit in world-3d.ts; imported `lw-<primitive>` geometries use it. */
export declare function primitiveGeometry(kind: string): THREE.BufferGeometry;
/** Littlewild IDs are lowercase kebab-case; Scene Forge IDs are commonly camelCase. */
export declare function littlewildId(value: string): string;
export declare function littlewildModel(root: THREE.Object3D, options: {
    rig: boolean;
}): LittlewildModel;
