import * as THREE from 'three';
import type { SceneDocument } from '../domain/schema.js';
import type { LibraryItem } from './contracts.js';
interface PanelContext {
    source: SceneDocument;
    library: ReadonlyMap<string, LibraryItem>;
    editable: boolean;
    selectedId(): string | undefined;
    objectFor(id: string): THREE.Object3D | undefined;
    select(id: string): void;
    addModel(id: string): string;
}
export declare function createPanels({ source, library, editable, selectedId, objectFor, select, addModel, }: PanelContext): {
    updateInspector: () => void;
    renderTree: () => void;
    renderModels: () => void;
};
export {};
