import * as THREE from 'three';
import type { SceneDocument } from '../domain/schema.js';
/** True when the object and every ancestor are visible. */
export declare function visibleInScene(object: THREE.Object3D): boolean;
/** The authored node owning an object: the closest ancestor named `<scene>/<node>`. */
export declare function nodeIdForObject(hitObject: THREE.Object3D | undefined, content: THREE.Object3D, source: SceneDocument): string | undefined;
export declare function setupPicking({ canvas, camera, content, source, dragging, select, }: {
    canvas: HTMLCanvasElement;
    camera(): THREE.Camera;
    content(): THREE.Object3D;
    source: SceneDocument;
    /** Whether the transform gizmo is (or just was) dragging. */
    dragging(): boolean;
    select(id?: string): void;
}): void;
