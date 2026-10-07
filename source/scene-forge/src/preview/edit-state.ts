import type { NodeSpec, SceneDocument, Operation } from '../domain/schema.js';

export interface EditState {
  nodes: NodeSpec[];
  materials?: SceneDocument['materials'];
  environment?: SceneDocument['environment'];
  selectedId?: string;
}
export const editFingerprint = ({ selectedId: _selected, ...state }: EditState) =>
  JSON.stringify(state);
export function createEditHistory(limit = 50) {
  const undo: EditState[] = [],
    redo: EditState[] = [];
  return {
    get canUndo() {
      return undo.length > 0;
    },
    get canRedo() {
      return redo.length > 0;
    },
    commit(before: EditState, after: EditState) {
      if (editFingerprint(before) === editFingerprint(after)) return;
      undo.push(structuredClone(before));
      if (undo.length > limit) undo.shift();
      redo.length = 0;
    },
    travel(direction: 'undo' | 'redo', current: EditState, apply: (state: EditState) => void) {
      const from = direction === 'undo' ? undo : redo,
        to = direction === 'undo' ? redo : undo;
      const entry = from.at(-1);
      if (!entry) return;
      const saved = structuredClone(current);
      try {
        apply(structuredClone(entry));
      } catch (error) {
        apply(saved);
        throw error;
      }
      from.pop();
      to.push(saved);
    },
  };
}
export type EditHistory = ReturnType<typeof createEditHistory>;

/** Commit history only after a successful rebuild; failure restores nodes and selection. */
export function transactEdit(
  history: EditHistory,
  read: () => EditState,
  restore: (state: EditState) => void,
  action: () => void,
  rebuild: () => void,
) {
  const before = structuredClone(read());
  try {
    action();
    if (!validTransforms(read().nodes))
      throw new Error('Use finite values between -1,000,000 and 1,000,000; scale cannot be zero.');
    rebuild();
    history.commit(before, read());
  } catch (error) {
    restore(before);
    rebuild();
    throw error;
  }
}
export function validTransforms(nodes: NodeSpec[]) {
  return nodes.every((n) =>
    Object.entries(n.transform ?? {}).every(([key, values]) =>
      values.every(
        (value) =>
          typeof value !== 'number' ||
          (Number.isFinite(value) &&
            Math.abs(value) <= 1e6 &&
            (key !== 'scale' || Math.abs(value) >= 0.000001)),
      ),
    ),
  );
}
export function sceneEdits(initial: SceneDocument, source: SceneDocument, stateHash?: string) {
  const operations: Operation[] = [];
  const present = new Set(source.nodes.map((n) => n.id));
  const before = new Map(initial.nodes.map((n) => [n.id, n]));
  for (const node of initial.nodes)
    if (!present.has(node.id) && (!node.parent || present.has(node.parent)))
      operations.push({ op: 'removeNode', id: node.id, cascade: true });
  for (const node of source.nodes)
    if (JSON.stringify(node) !== JSON.stringify(before.get(node.id)))
      operations.push({ op: 'putNode', node: structuredClone(node) });
  for (const [id, material] of Object.entries(source.materials))
    if (JSON.stringify(material) !== JSON.stringify(initial.materials[id]))
      operations.push({ op: 'putMaterial', id, material: structuredClone(material) });
  for (const id of Object.keys(initial.materials))
    if (!Object.hasOwn(source.materials, id)) operations.push({ op: 'removeMaterial', id });
  if (JSON.stringify(source.environment) !== JSON.stringify(initial.environment))
    operations.push({ op: 'setEnvironment', environment: structuredClone(source.environment) });
  return {
    scene: source.id,
    expectedRevision: initial.revision,
    ...(stateHash ? { expectedState: stateHash } : {}),
    operations,
  };
}
