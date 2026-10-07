import * as THREE from 'three';
import type { SceneDocument, NodeSpec } from '../domain/schema.js';
import type { LibraryItem } from './contracts.js';
/** Rebuild only authored placement using compiled prototypes and their shared resources. */
export declare function createTemplates(source: SceneDocument, content: THREE.Group, items: LibraryItem[]): {
    templates: Map<string, THREE.Object3D<THREE.Object3DEventMap>>;
    library: Map<string, LibraryItem & {
        prototype: THREE.Object3D;
    }>;
    remapTemplate: (object: THREE.Object3D, id: string) => THREE.Object3D<THREE.Object3DEventMap>;
    instantiate: (node: NodeSpec) => THREE.Object3D<THREE.Object3DEventMap>;
};
