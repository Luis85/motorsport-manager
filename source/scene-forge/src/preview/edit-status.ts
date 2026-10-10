// Editor status readouts: the scene header (identity, model count, build notes and
// read-only chrome), the local edit count and Save/Undo/Redo availability, the live
// recipe text, and statistics of the visible scene content (objects, meshes,
// triangles and overall bounds). Read-only with respect to the scene.
import * as THREE from 'three';
import type { SceneDocument } from '../domain/schema.js';
import { $, button } from './dom.js';

/** Meshes and triangles in the visible part of the hierarchy. */
export function visibleMeshStats(content: THREE.Object3D) {
  let meshes = 0,
    triangles = 0;
  content.traverseVisible((o) => {
    if (o instanceof THREE.Mesh) {
      meshes++;
      triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3;
    }
  });
  return { meshes, triangles };
}
export function renderEditStatus({
  source,
  content,
  editable,
  editCount: count,
  canUndo,
  canRedo,
  bounds,
}: {
  source: SceneDocument;
  content: THREE.Object3D;
  editable: boolean;
  editCount: number;
  canUndo: boolean;
  canRedo: boolean;
  bounds(): THREE.Box3;
}) {
  button('save-edits').disabled = !editable || count === 0;
  button('undo').disabled = !canUndo;
  button('redo').disabled = !canRedo;
  $('edit-state').textContent = count
    ? `${count} local edit${count === 1 ? '' : 's'}`
    : editable
      ? 'Saved scene'
      : 'Model preview';
  $('source').textContent = JSON.stringify(source, null, 2);
  const { meshes, triangles } = visibleMeshStats(content);
  $('stats').textContent =
    `${source.nodes.length} objects · ${meshes} meshes · ${triangles.toLocaleString()} triangles`;
  const box = bounds();
  $('bounds').textContent =
    (box.isEmpty() ? [0, 0, 0] : box.getSize(new THREE.Vector3()).toArray())
      .map((v) => v.toFixed(2))
      .join(' × ') + ' m';
  $('node-count').textContent = String(source.nodes.length);
}
/** One-time header for the loaded scene; a non-editable preview hides edit entry points. */
export function renderSceneHeader({
  source,
  modelCount,
  warnings,
  editable,
}: {
  source: SceneDocument;
  modelCount: number;
  warnings: readonly string[];
  editable: boolean;
}) {
  $('scene-name').textContent = source.name;
  $('scene-meta').textContent = `${source.id} · revision ${source.revision} · meters`;
  $('model-count').textContent = String(modelCount);
  if (warnings.length) {
    $('warning-panel').hidden = false;
    $('warning-summary').textContent = `${warnings.length} build notes`;
    $('warnings').textContent = warnings.join(' ');
  }
  if (!editable) {
    button('save-edits').hidden = true;
    $('edit-state').textContent = 'Model preview';
    button('models-tab').disabled = true;
    button('browse-models').hidden = true;
  }
}
