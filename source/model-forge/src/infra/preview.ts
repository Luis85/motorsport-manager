import {
  fail,
  ForgeError,
  compileScene,
  reviewRender,
  captureDependencies,
  playwrightEnvironment,
  type ReviewPlan,
  type SceneDocument,
  type ModelLibrary,
} from '../kernel/index.js';
import type { PagePayload } from '../preview/payload.js';
import { type EditorDocument, libraryOf, modelTarget } from '../application/document.js';
import { VERSION } from '../version.js';
import { readAsset } from './assets.js';
import type { LoadedDocument } from './store.js';

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const styles =
  'html,body{margin:0;height:100%;overflow:hidden;background:#171d25;color:#edf2f7;font:14px system-ui,sans-serif}' +
  '#stage{position:fixed;inset:0}#stage canvas{display:block;outline:none}' +
  '#title{position:fixed;left:12px;top:10px;margin:0;font-size:14px;font-weight:600;text-shadow:0 1px 2px #000}' +
  'body.capture #title{display:none}';

/** A self-contained, offline, render-only page for one compiled target scene. */
export async function renderPage(
  scene: SceneDocument,
  models: ModelLibrary,
  options: { stateHash?: string } = {},
) {
  const built = compileScene(scene, models, { bindRigs: false });
  let payload: PagePayload;
  try {
    payload = {
      version: VERSION,
      document: scene,
      scene: built.scene.toJSON(),
      stats: built.stats,
      stateHash: options.stateHash,
    };
  } finally {
    built.dispose();
  }
  const json = JSON.stringify(payload);
  if (Buffer.byteLength(json) > 64 * 1024 * 1024)
    fail('PREVIEW_BUDGET', 'Preview data exceeds 64 MiB. Reduce the model before previewing.');
  const script = await readAsset('preview.js');
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${escapeHtml(scene.name)} · Model Forge</title><style>${styles}</style></head>` +
    `<body><div id="stage"></div><h1 id="title">${escapeHtml(scene.name)}</h1>` +
    `<script>window.__MODEL_FORGE__=${json.replace(/</g, '\\u003c')};</script>` +
    `<script>${script.replace(/<\/script/gi, '<\\/script')}</script></body></html>`
  );
}

/** Read-only orbit preview of the document's model. */
export function previewDocument(loaded: LoadedDocument, parameters?: Record<string, number>) {
  return renderPage(modelTarget(loaded.document, parameters), libraryOf(loaded.document), {
    stateHash: loaded.stateHash,
  });
}

/** Where bin/model-forge and source runs resolve Playwright, and how to provide Chromium. */
export const playwrightSetup = [
  'From a repository checkout: cd source/model-forge && npm ci (bin/model-forge then finds source/model-forge/node_modules/playwright).',
  'Anywhere: npm install --global playwright, or set NODE_PATH to a node_modules directory that contains playwright.',
  'Then provide Chromium: npx playwright install chromium (Linux: --with-deps), or set FORGE_CHROMIUM_PATH.',
];
/** Replace the kernel's generic setup remedies with Model Forge's own. */
function withSetup(error: unknown): never {
  if (error instanceof ForgeError && error.code === 'PLAYWRIGHT_UNAVAILABLE')
    throw new ForgeError(error.code, error.message, {
      ...(error.details as object),
      remedies: playwrightSetup,
    });
  throw error;
}

/** Multi-view review through the kernel capture pipeline with Model Forge provenance. */
export function reviewDocument(
  loaded: LoadedDocument,
  output: string,
  plan: ReviewPlan,
  options: { parameters?: Record<string, number>; overwrite?: boolean; background?: string },
) {
  const document: EditorDocument = loaded.document;
  const target = modelTarget(document, options.parameters);
  if (options.background)
    target.environment = { ...target.environment, background: options.background };
  return reviewRender(
    target,
    libraryOf(document),
    output,
    plan,
    {
      tool: 'model-forge',
      version: VERSION,
      buildHtml: (scene, models, { stateHash }) => renderPage(scene, models, { stateHash }),
      capture: captureDependencies(playwrightEnvironment('source/model-forge')),
    },
    {
      overwrite: options.overwrite,
      sourceStateHash: loaded.stateHash,
      identity: { scene: document.model.id, revision: loaded.revision },
      target: {
        document: loaded.path,
        model: document.model.id,
        revision: loaded.revision,
        parameters: options.parameters ?? {},
      },
    },
  ).catch(withSetup);
}
