// Viewport display options: grid visibility and wireframe rendering of the scene
// content, with their toolbar pressed states. Display state only; it never changes
// the scene recipe or edit history.
import * as THREE from 'three';
import { button } from './dom.js';

export function createDisplayOptions({
  content,
  grid,
  draw,
}: {
  content(): THREE.Object3D;
  grid(): THREE.GridHelper;
  draw(): void;
}) {
  let wireframe = false,
    gridVisible = true;
  function setWireframe(enabled: boolean) {
    wireframe = enabled;
    content().traverse((o) => {
      if (o instanceof THREE.Mesh)
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(
          (m) => ((m as THREE.MeshStandardMaterial).wireframe = enabled),
        );
    });
    button('wireframe').setAttribute('aria-pressed', String(enabled));
    draw();
  }
  function setGrid(visible: boolean) {
    gridVisible = visible;
    grid().visible = visible;
    button('grid').setAttribute('aria-pressed', String(visible));
    draw();
  }
  button('grid').addEventListener('click', () => setGrid(!gridVisible));
  button('wireframe').addEventListener('click', () => setWireframe(!wireframe));
  return {
    setWireframe,
    setGrid,
    wireframe: () => wireframe,
    gridVisible: () => gridVisible,
  };
}
