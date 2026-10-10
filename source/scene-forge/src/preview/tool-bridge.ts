import * as THREE from 'three';
import { type SceneDocument, type ModelLibrary, boundsOf } from '../kernel-render.js';
import type { EditorContext, EditorInspection } from './tool-host.js';

export function editorContext(options: {
  source: SceneDocument;
  models: ModelLibrary;
  editable: boolean;
  selectedId(): string | undefined;
  objectFor(id: string): THREE.Object3D | undefined;
  change(action: () => void): boolean;
  select(id: string): void;
  availableId(stem: string): string;
  notify(message: string): void;
  showJoints(visible: boolean): void;
  previewAnimation(node: string, clip: string, time: number): void;
}): EditorContext {
  const { source } = options;
  return {
    editable: options.editable,
    document: () => structuredClone(source),
    selected: () => structuredClone(source.nodes.find((node) => node.id === options.selectedId())),
    models: () => structuredClone(options.models),
    edit: (action) => options.change(() => action(source)),
    select: options.select,
    availableId: options.availableId,
    notify: options.notify,
    previewAnimation: options.previewAnimation,
    showJoints: options.showJoints,
    inspect() {
      const id = options.selectedId(),
        object = id ? options.objectFor(id) : undefined;
      if (!object) return;
      const bounds = boundsOf(object);
      const meshes: EditorInspection['meshes'] = [];
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const m = (
          Array.isArray(child.material) ? child.material[0] : child.material
        ) as THREE.MeshStandardMaterial;
        meshes.push({
          path: child.name.slice(object.name.length + 1),
          material: {
            color: '#' + m.color.getHexString(),
            metalness: m.metalness ?? 0,
            roughness: m.roughness ?? 0.65,
            opacity: m.opacity,
            doubleSided: m.side === THREE.DoubleSide,
            flatShading: m.flatShading ?? false,
          },
        });
      });
      // Rest-joint coordinates are local to the selected model, not world coordinates.
      const inverse = object.matrixWorld.clone().invert();
      bounds.applyMatrix4(inverse);
      return { bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, meshes };
    },
  };
}
