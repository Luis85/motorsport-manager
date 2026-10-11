import type { SceneDocument, NodeSpec, MaterialSpec, ModelLibrary } from '../kernel-render.js';

export interface EditorInspection {
  bounds: { min: number[]; max: number[] };
  meshes: { path: string; material: MaterialSpec }[];
}
/** Tools receive snapshots and one transactional write port, never the renderer or live state. */
export interface EditorContext {
  readonly editable: boolean;
  document(): SceneDocument;
  selected(): NodeSpec | undefined;
  models(): ModelLibrary;
  inspect(): EditorInspection | undefined;
  edit(
    action: (draft: Pick<SceneDocument, 'nodes' | 'materials' | 'environment'>) => void,
  ): boolean;
  select(id: string): void;
  availableId(stem: string): string;
  notify(message: string): void;
  showJoints(visible: boolean): void;
  previewAnimation(node: string, clip: string, time: number): void;
}
export interface EditorTool {
  id: string;
  label: string;
  mount(
    container: HTMLElement,
    context: EditorContext,
    signal: AbortSignal,
  ): { refresh(): void; dispose?(): void };
}
/** One registration point; each tool owns its DOM, events and teardown. */
export function mountEditorTools(
  container: HTMLElement,
  context: EditorContext,
  tools: EditorTool[],
) {
  if (new Set(tools.map((tool) => tool.id)).size !== tools.length)
    throw new Error('Duplicate editor tool ID.');
  const controller = new AbortController();
  const instances: { section: HTMLElement; instance: ReturnType<EditorTool['mount']> }[] = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    for (const { section, instance } of instances) {
      try {
        instance.dispose?.();
      } finally {
        section.remove();
      }
    }
  };
  try {
    for (const tool of tools) {
      const section = document.createElement('details');
      section.className = 'editor-tool';
      section.dataset.tool = tool.id;
      const title = document.createElement('summary');
      title.textContent = tool.label;
      const body = document.createElement('div');
      body.className = 'tool-body';
      section.append(title, body);
      container.append(section);
      try {
        instances.push({ section, instance: tool.mount(body, context, controller.signal) });
      } catch (error) {
        section.remove();
        throw error;
      }
    }
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    refresh: () => {
      if (!disposed) instances.forEach(({ instance }) => instance.refresh());
    },
    dispose,
  };
}
