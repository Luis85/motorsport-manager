import {
  reviewRender,
  captureDependencies,
  playwrightEnvironment,
  ForgeError,
} from '../kernel/index.js';
import { lineupReview, type LineupItem } from '../application/lineup.js';
import { VERSION } from '../version.js';
import { playwrightSetup, renderPage } from './preview.js';
import { checkOutput } from './paths.js';

/** Review evidence for generated or variant documents: one frame per document. */
export async function reviewLineup(
  items: LineupItem[],
  out: string,
  options: { width?: number; height?: number; target: Record<string, unknown> },
) {
  const { scene, models, plan } = lineupReview(items, {
    width: options.width ?? 480,
    height: options.height ?? 360,
  });
  await checkOutput(out, { directory: true });
  try {
    return await reviewRender(
      scene,
      models,
      out,
      plan,
      {
        tool: 'model-forge',
        version: VERSION,
        buildHtml: (staged, library, { stateHash }) => renderPage(staged, library, { stateHash }),
        capture: captureDependencies(playwrightEnvironment('source/model-forge')),
      },
      {
        identity: { scene: scene.id, revision: 0 },
        target: { ...options.target, models: items.map((item) => item.document.model.id) },
      },
    );
  } catch (error) {
    if (error instanceof ForgeError && error.code === 'PLAYWRIGHT_UNAVAILABLE')
      throw new ForgeError(error.code, error.message, {
        ...(error.details as object),
        remedies: playwrightSetup,
      });
    throw error;
  }
}
