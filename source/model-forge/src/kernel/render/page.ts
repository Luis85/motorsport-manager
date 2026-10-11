import type { CameraRequest, CameraSnapshot } from '../domain/schema.js';
import type { SceneStats } from '../application/compiler.js';

/**
 * Contract between headless capture and a render page. A page signals readiness through
 * `forgeReady` or `forgeError` and exposes this viewer surface for deterministic frames.
 * Product pages may expose more; capture and review use only these members.
 */
export interface RenderPageViewer {
  setGrid(visible: boolean): void;
  clearSelection(): void;
  render(): void;
  getCamera(): CameraSnapshot;
  configureCapture(request: CameraRequest, wireframe: boolean): void;
  stats: SceneStats;
}
export interface RenderPageWindow {
  forgeReady: boolean;
  forgeError?: string;
  forgeViewer: RenderPageViewer;
}
