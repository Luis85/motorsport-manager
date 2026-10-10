import type { PreviewPayload } from './contracts.js';
import type { SceneDocument } from '../kernel-render.js';
export declare function selectPreview(payload: PreviewPayload, id: string | null): PreviewPayload;
export declare function download(blob: Blob, name: string): void;
export declare function setupProjectControls(payload: PreviewPayload, source: SceneDocument, saved: () => void): void;
