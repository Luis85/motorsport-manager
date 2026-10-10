import type { SceneDocument, SceneStats } from '../kernel/render/index.js';

/** Data the Node side embeds as `window.__MODEL_FORGE__` for the render-only page. */
export interface PagePayload {
  version: string;
  /** The render target scene: one instance of the document's model. */
  document: SceneDocument;
  /** Compiled `THREE.Scene.toJSON()` output. */
  scene: unknown;
  stats: SceneStats;
  stateHash?: string;
}
