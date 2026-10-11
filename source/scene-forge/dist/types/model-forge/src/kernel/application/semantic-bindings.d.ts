import { type Object3D } from 'three';
/** A detached, engine-neutral map of authored articulation, attachment and volume roles. */
export interface SemanticBinding {
    kind: 'articulation' | 'socket' | 'volume';
    role: string;
    path: string;
    parent: string;
    localMatrix: number[];
    worldMatrix: number[];
    bounds?: {
        min: number[];
        max: number[];
    };
}
export interface SemanticBindings {
    format: 'forge-semantic-bindings';
    version: 1;
    coordinates: {
        unit: 'metre';
        up: '+Y';
        forward: '+Z';
        matrix: 'column-major';
    };
    bindings: SemanticBinding[];
}
/**
 * Tags use `socket:muzzle`, `articulation:turret`, or `volume:engine`.
 * Scope one independently instantiated assembly at a time; role identity is unique
 * within each kind. This reads compiled geometry, including hidden volume meshes,
 * never writes a recipe, and deliberately does not infer gameplay characteristics.
 */
export declare function semanticBindings(root: Object3D, required?: readonly string[]): SemanticBindings;
