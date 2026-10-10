import * as THREE from 'three';
import type { SceneDocument } from '../domain/schema.js';
import type { LibraryItem } from './contracts.js';
import type { Toast } from './toast.js';
interface NodeCommandContext {
    source: SceneDocument;
    templates: Map<string, THREE.Object3D>;
    library: ReadonlyMap<string, LibraryItem>;
    remapTemplate(object: THREE.Object3D, id: string): THREE.Object3D;
    objectFor(id: string): THREE.Object3D | undefined;
    change(action: () => void): boolean;
    selectedId(): string | undefined;
    setSelectedId(id: string | undefined): void;
    setMode(mode: string): void;
    toast: Toast;
}
export declare function createNodeCommands({ source, templates, library, remapTemplate, objectFor, change, selectedId, setSelectedId, setMode, toast, }: NodeCommandContext): {
    availableId: (stem: string) => string;
    addModel: (id: string) => string;
    duplicate: () => void;
    ground: () => void;
    remove: () => void;
};
export {};
