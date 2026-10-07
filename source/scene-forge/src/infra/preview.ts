import { stateHash } from './state-hash.js';
import type { PreviewPayload, LibraryItem, PreviewScene } from '../preview/contracts.js';
import { VERSION } from '../version.js';
import { withCaptureSession } from './capture.js';
import { atomicWrite } from './files.js';
import { readAsset } from './assets.js';
import path from 'node:path';
import { compileScene } from '../application/compiler.js';
import {
  fail,
  parse,
  SceneSchema,
  CameraRequestSchema,
  type CameraRequest,
  type SceneDocument,
  type ModelLibrary,
} from '../domain/schema.js';
import { previewTemplate } from '../preview/template.js';

export interface PreviewOptions {
  stateHash?: string;
  editable?: boolean;
  includeLibrary?: boolean;
}
function compileLibrary(models: ModelLibrary): LibraryItem[] {
  return Object.values(models).map((model) => {
    const doc = parse(SceneSchema, {
      schemaVersion: 1,
      kind: 'scene',
      id: 'catalog',
      name: model.name,
      nodes: [{ type: 'model', id: 'root', model: model.id }],
    });
    const compiled = compileScene(doc, models, { bindRigs: false });
    try {
      return {
        id: model.id,
        name: model.name,
        category: model.category,
        description: model.description,
        parameters: model.parameters,
        stats: compiled.stats,
        object: compiled.content.children[0].toJSON(),
      };
    } finally {
      compiled.dispose();
    }
  });
}
function compilePreview(
  document: SceneDocument,
  models: ModelLibrary,
  options: PreviewOptions,
): PreviewScene {
  const built = compileScene(document, models, { bindRigs: false });
  try {
    return {
      version: VERSION,
      document,
      scene: built.scene.toJSON(),
      stats: built.stats,
      stateHash: options.stateHash,
      editable: options.editable !== false,
    };
  } finally {
    built.dispose();
  }
}
async function renderPreview(data: PreviewPayload) {
  const [script, css] = await Promise.all([readAsset('viewer.js'), readAsset('viewer.css')]);
  const json = JSON.stringify(data);
  if (Buffer.byteLength(json) > 64 * 1024 * 1024)
    fail('PREVIEW_BUDGET', 'Preview scene data exceeds 64 MiB. Preview a smaller scene or model.');
  return previewTemplate(data.document.name, css, script, json.replace(/</g, '\\u003c'), VERSION);
}
export async function createPreview(
  document: SceneDocument,
  models: ModelLibrary,
  options: PreviewOptions = {},
) {
  const library =
    options.includeLibrary !== false && options.editable !== false ? compileLibrary(models) : [];
  return renderPreview({ ...compilePreview(document, models, options), models, library });
}
/** Build one offline workshop; compiled library prototypes are shared by all embedded scenes. */
export async function createProjectPreview(
  documents: SceneDocument[],
  models: ModelLibrary,
  activeScene?: string,
) {
  if (!documents.length || documents.length > 24)
    fail(
      'PREVIEW_BUDGET',
      'A project preview requires 1–24 scenes. Use a single-scene preview for larger projects.',
    );
  if (new Set(documents.map((scene) => scene.id)).size !== documents.length)
    fail('DUPLICATE_ID', 'Project preview scene IDs must be unique.');
  const scenes = documents.map((scene) =>
    compilePreview(scene, models, { stateHash: stateHash(scene, models) }),
  );
  const selected = activeScene
    ? scenes.find((scene) => scene.document.id === activeScene)
    : scenes[0];
  if (!selected) fail('NOT_FOUND', `Scene ${activeScene} is not in this project.`);
  return renderPreview({
    ...selected,
    models,
    library: compileLibrary(models),
    project: { scenes },
  });
}

export async function screenshot(
  html: string,
  output: string,
  options: {
    width: number;
    height: number;
    view: string;
    grid: boolean;
    ui: boolean;
    camera?: Partial<CameraRequest>;
    wireframe?: boolean;
  },
) {
  const request = parse(CameraRequestSchema, { view: options.view, ...options.camera });
  return withCaptureSession(html, options, async ({ capture }) => {
    const { bytes, camera } = await capture(request, options.grid, !!options.wireframe);
    await atomicWrite(path.resolve(output), bytes);
    return {
      path: path.resolve(output),
      width: options.width,
      height: options.height,
      view: options.view,
      camera,
    };
  });
}
