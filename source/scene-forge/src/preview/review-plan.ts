// Review-plan hand-off from the live viewport: freezes the exact current camera into a
// one-frame `review` plan sized like the stage (at most 2048 px per side, at least 64)
// and offers it as a download or a clipboard copy, falling back to the source panel.
import type * as THREE from 'three';
import { cameraData } from '../application/camera.js';
import type { SceneDocument } from '../domain/schema.js';
import { button } from './dom.js';
import { download } from './project-controls.js';
import { showSourceText } from './source-panel.js';
import type { Toast } from './toast.js';

export interface ReviewDisplay {
  grid: boolean;
  wireframe: boolean;
  background: string;
}
export function reviewPlanFor(
  stage: { clientWidth: number; clientHeight: number },
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  target: THREE.Vector3,
  display: ReviewDisplay,
) {
  const ratio = Math.min(1, 2048 / stage.clientWidth, 2048 / stage.clientHeight);
  const width = Math.max(64, Math.round(stage.clientWidth * ratio));
  const height = Math.max(64, Math.round(stage.clientHeight * ratio));
  const fixed = cameraData(camera, target);
  if (fixed.projection === 'perspective') fixed.aspect = width / height;
  return {
    schemaVersion: 1,
    kind: 'review',
    width,
    height,
    grid: display.grid,
    wireframe: display.wireframe,
    contactSheet: false,
    background: display.background,
    frames: [{ id: 'saved-view', camera: { fixed } }],
  };
}
export function setupReviewButtons({
  source,
  plan,
  toast,
}: {
  source: SceneDocument;
  plan(): ReturnType<typeof reviewPlanFor>;
  toast: Toast;
}) {
  button('save-review').addEventListener('click', () => {
    download(
      new Blob([JSON.stringify(plan(), null, 2)], { type: 'application/json' }),
      `${source.id}.review.json`,
    );
    toast('View saved. Review the project with this plan after applying any scene edits.');
  });
  button('copy-camera').addEventListener('click', async () => {
    const data = JSON.stringify(plan(), null, 2);
    try {
      await navigator.clipboard.writeText(data);
      toast('Exact camera and review settings copied.');
    } catch {
      showSourceText('Review plan', data);
      toast('Copy the review plan from the source panel, or use Save review plan.');
    }
  });
}
