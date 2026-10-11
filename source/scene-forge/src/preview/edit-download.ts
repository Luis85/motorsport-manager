// Local edit hand-off: Save edits downloads the guarded edit batch for `forge3d apply`,
// the module remembers which source state was last downloaded (also by the portable
// recipe download), and leaving the page warns while newer edits are not saved out.
import type { SceneDocument } from '../domain/schema.js';
import { button } from './dom.js';
import { download } from './project-controls.js';
import type { Toast } from './toast.js';

export function setupEditDownload({
  source,
  edits,
  toast,
}: {
  source: SceneDocument;
  edits(): { operations: unknown[] };
  toast: Toast;
}) {
  let lastDownloaded = '';
  const markDownloaded = () => {
    lastDownloaded = JSON.stringify(source);
  };
  button('save-edits').addEventListener('click', () => {
    const batch = edits();
    if (!batch.operations.length) return;
    download(
      new Blob([JSON.stringify(batch, null, 2) + '\n'], { type: 'application/json' }),
      `${source.id}.edits.json`,
    );
    markDownloaded();
    toast(
      `Edits downloaded. Apply to the project with:\nforge3d apply --file ${source.id}.edits.json`,
    );
  });
  window.addEventListener('beforeunload', (event) => {
    if (edits().operations.length && lastDownloaded !== JSON.stringify(source)) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  return { markDownloaded };
}
