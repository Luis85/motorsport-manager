import type { PreviewPayload } from './contracts.js';
import type { SceneDocument } from '../kernel-render.js';
import { $, button } from './dom.js';
export function selectPreview(payload: PreviewPayload, id: string | null): PreviewPayload {
  if (!id) return payload;
  const selected = payload.project?.scenes.find((scene) => scene.document.id === id);
  if (!selected) throw new Error(`Scene ${id} is not embedded in this preview.`);
  return { ...payload, ...selected };
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function setupProjectControls(
  payload: PreviewPayload,
  source: SceneDocument,
  saved: () => void,
) {
  const chooser = $('scene-chooser') as HTMLSelectElement;
  chooser.hidden = !payload.project;
  payload.project?.scenes.forEach((scene) =>
    chooser.add(new Option(scene.document.name, scene.document.id)),
  );
  chooser.value = source.id;
  chooser.addEventListener('change', () => {
    const url = new URL(location.href);
    url.searchParams.set('scene', chooser.value);
    location.assign(url);
    chooser.value = source.id;
  });
  button('save-bundle').addEventListener('click', () => {
    const bundle = {
      schemaVersion: 1,
      kind: 'scene-bundle',
      scene: source,
      models: payload.models,
    };
    download(
      new Blob([JSON.stringify(bundle, null, 2) + '\n'], { type: 'application/json' }),
      `${source.id}.scene-bundle.json`,
    );
    saved();
  });
}
