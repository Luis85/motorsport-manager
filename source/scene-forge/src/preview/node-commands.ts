// Scene edit commands on the authored node list: add a library model, duplicate the
// selected subtree, ground the selection and remove it. Each mutation runs inside the
// viewer's transactional `change` port, so undo history and rollback stay with the
// viewer's edit state; this module owns only what the commands change.
import * as THREE from 'three';
import type { SceneDocument } from '../domain/schema.js';
import type { LibraryItem } from './contracts.js';
import { clean, transformData } from './transforms.js';
import { availableNodeId, descendantIds, subtreeCopyIds } from './scene-tree.js';
import type { Toast } from './toast.js';

interface NodeCommandContext {
  source: SceneDocument;
  templates: Map<string, THREE.Object3D>;
  library: ReadonlyMap<string, LibraryItem>;
  remapTemplate(object: THREE.Object3D, id: string): THREE.Object3D;
  objectFor(id: string): THREE.Object3D | undefined;
  change(action: () => void): boolean;
  selectedId(): string | undefined;
  setSelectedId(id: string | undefined): void;
  setMode(mode: string): void;
  toast: Toast;
}
export function createNodeCommands({
  source,
  templates,
  library,
  remapTemplate,
  objectFor,
  change,
  selectedId,
  setSelectedId,
  setMode,
  toast,
}: NodeCommandContext) {
  const availableId = (stem: string) =>
    availableNodeId(stem, (id) => templates.has(id) || source.nodes.some((n) => n.id === id));
  function addModel(id: string) {
    const item = library.get(id);
    if (!item) throw new Error(`Unknown model ${id}`);
    const newId = availableId(id);
    const changed = change(() => {
      source.nodes.push({
        type: 'model',
        id: newId,
        name: item.name,
        model: id,
        parameters: {},
        materialOverrides: {},
        tags: [],
        visible: true,
        transform: { position: [0, -item.stats.bounds.min[1], 0] },
      });
      setSelectedId(newId);
    });
    if (!changed) return '';
    setMode('translate');
    toast(`Added ${item.name}. Move it with the handles or position fields.`);
    return newId;
  }
  function duplicate() {
    const root = selectedId();
    if (!root) return;
    const ids = descendantIds(source.nodes, root);
    const newId = availableId(root);
    const map = subtreeCopyIds(source.nodes, ids, root, newId);
    if (!map) {
      toast(
        'Could not create unique subtree IDs. Duplicate this group through the CLI with a shorter ID.',
        true,
      );
      return;
    }
    const changed = change(() => {
      const copies = source.nodes
        .filter((n) => ids.has(n.id))
        .map((n) => {
          const copy = structuredClone(n);
          copy.id = map.get(n.id)!;
          if (copy.parent && map.has(copy.parent)) copy.parent = map.get(copy.parent);
          const template = templates.get(n.id);
          if (template) templates.set(copy.id, remapTemplate(template.clone(true), copy.id));
          return copy;
        });
      const copiedRoot = copies.find((n) => n.id === newId)!;
      const transform = transformData(objectFor(root)!);
      transform.position[0] += 1;
      copiedRoot.transform = transform;
      source.nodes.push(...copies);
      setSelectedId(newId);
    });
    if (changed) toast('Duplicated selection.');
  }
  function ground() {
    const id = selectedId();
    if (!id) return;
    change(() => {
      const object = objectFor(id)!;
      const box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) throw new Error('This group has no geometry.');
      const position = object.getWorldPosition(new THREE.Vector3());
      position.y -= box.min.y;
      object.parent?.worldToLocal(position);
      const node = source.nodes.find((n) => n.id === id)!;
      node.transform = {
        ...node.transform,
        position: position.toArray().map(clean) as [number, number, number],
      };
    });
  }
  function remove() {
    const id = selectedId();
    if (!id) return;
    const ids = descendantIds(source.nodes, id);
    const changed = change(() => {
      source.nodes = source.nodes.filter((n) => !ids.has(n.id));
      setSelectedId(undefined);
    });
    if (changed) toast('Removed selection. Undo is available.');
  }
  return { availableId, addModel, duplicate, ground, remove };
}
