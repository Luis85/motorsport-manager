import type { Object3D } from 'three';
import type { SceneStats, ModelDocument, SceneDocument, ModelLibrary } from '../kernel-render.js';
/** The preview transports compiled objects; it never runs the modeling compiler in-browser. */
export interface LibraryItem {
    id: string;
    name: string;
    category?: string;
    description?: string;
    parameters: ModelDocument['parameters'];
    stats: SceneStats;
    object: ReturnType<Object3D['toJSON']>;
}
export interface PreviewScene {
    version: string;
    document: SceneDocument;
    scene: ReturnType<Object3D['toJSON']>;
    stats: SceneStats;
    stateHash?: string;
    editable: boolean;
}
export interface PreviewPayload extends PreviewScene {
    library: LibraryItem[];
    models: ModelLibrary;
    project?: {
        scenes: PreviewScene[];
    };
}
