import * as THREE from 'three';
import { type SceneDocument, type ModelLibrary } from '../kernel-render.js';
import type { EditorContext } from './tool-host.js';
export declare function editorContext(options: {
    source: SceneDocument;
    models: ModelLibrary;
    editable: boolean;
    selectedId(): string | undefined;
    objectFor(id: string): THREE.Object3D | undefined;
    change(action: () => void): boolean;
    select(id: string): void;
    availableId(stem: string): string;
    notify(message: string): void;
    showJoints(visible: boolean): void;
    previewAnimation(node: string, clip: string, time: number): void;
}): EditorContext;
