import {
  reviewRender,
  type ReviewOptions,
  type ReviewPlan,
  type SceneDocument,
  type ModelLibrary,
} from '../kernel.js';
import { createPreview } from './preview.js';
import { VERSION } from '../version.js';

/** Scene Forge review: the kernel capture pipeline over the render-only offline viewer. */
export function reviewScene(
  scene: SceneDocument,
  models: ModelLibrary,
  output: string,
  input: ReviewPlan,
  options: ReviewOptions = {},
) {
  return reviewRender(
    scene,
    models,
    output,
    input,
    {
      tool: 'scene-forge',
      version: VERSION,
      buildHtml: (document, library, { stateHash }) =>
        createPreview(document, library, { editable: false, includeLibrary: false, stateHash }),
    },
    options,
  );
}
