import type { SceneDocument, NodeSpec, MaterialSpec, ModelLibrary } from '../domain/schema.js';
export interface EditorInspection {
    bounds: {
        min: number[];
        max: number[];
    };
    meshes: {
        path: string;
        material: MaterialSpec;
    }[];
}
/** Tools receive snapshots and one transactional write port, never the renderer or live state. */
export interface EditorContext {
    readonly editable: boolean;
    document(): SceneDocument;
    selected(): NodeSpec | undefined;
    models(): ModelLibrary;
    inspect(): EditorInspection | undefined;
    edit(action: (draft: Pick<SceneDocument, 'nodes' | 'materials' | 'environment'>) => void): boolean;
    select(id: string): void;
    availableId(stem: string): string;
    notify(message: string): void;
    showJoints(visible: boolean): void;
    previewAnimation(node: string, clip: string, time: number): void;
}
export interface EditorTool {
    id: string;
    label: string;
    mount(container: HTMLElement, context: EditorContext, signal: AbortSignal): {
        refresh(): void;
        dispose?(): void;
    };
}
/** One registration point; each tool owns its DOM, events and teardown. */
export declare function mountEditorTools(container: HTMLElement, context: EditorContext, tools: EditorTool[]): {
    refresh: () => void;
    dispose: () => void;
};
