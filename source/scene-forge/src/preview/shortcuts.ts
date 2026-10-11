// Global editor keyboard shortcuts, ignored while typing in a form control:
// Ctrl/Cmd+Z undo (with Shift redo), Escape clears the selection and closes the source
// panel, F frames the selection (Shift+F everything), Q/W/E/R choose the transform
// mode and Delete/Backspace on the canvas removes the selection.
import { hideSourcePanel } from './source-panel.js';

const modeKeys: Record<string, string> = { q: 'select', w: 'translate', e: 'rotate', r: 'scale' };
export function setupShortcuts({
  editable,
  canvas,
  travel,
  clearSelection,
  frame,
  setMode,
  remove,
}: {
  editable: boolean;
  canvas: HTMLCanvasElement;
  travel(direction: 'undo' | 'redo'): void;
  clearSelection(): void;
  frame(selectionOnly: boolean): void;
  setMode(mode: string): void;
  remove(): void;
}) {
  document.addEventListener('keydown', (event) => {
    if ((event.target as HTMLElement).matches('input,textarea,select')) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      travel(event.shiftKey ? 'redo' : 'undo');
      return;
    }
    if (event.key === 'Escape') {
      clearSelection();
      hideSourcePanel();
      return;
    }
    if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      frame(!event.shiftKey);
    }
    if (editable && ['q', 'w', 'e', 'r'].includes(event.key.toLowerCase()))
      setMode(modeKeys[event.key.toLowerCase()]);
    if (
      editable &&
      (event.key === 'Delete' || event.key === 'Backspace') &&
      event.target === canvas
    ) {
      event.preventDefault();
      remove();
    }
  });
}
