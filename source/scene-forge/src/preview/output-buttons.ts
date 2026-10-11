import { gltfScene, rigClips, errorMessage, type SceneDocument } from '../kernel-render.js';
import type * as THREE from 'three';
import type { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { button } from './dom.js';
import { download } from './project-controls.js';
export function setupOutputButtons({
  source,
  content,
  helpers,
  gizmo,
  renderer,
  draw,
  toast,
}: {
  source: SceneDocument;
  content(): THREE.Group;
  helpers: THREE.Group;
  gizmo(): TransformControls;
  renderer: THREE.WebGLRenderer;
  draw(): void;
  toast(message: string, error?: boolean): void;
}) {
  button('glb').addEventListener('click', async () => {
    button('glb').disabled = true;
    const old = button('glb').textContent;
    button('glb').textContent = 'Exporting…';
    try {
      content().updateWorldMatrix(true, true);
      const portable = gltfScene(content());
      const data = await new GLTFExporter().parseAsync(portable, {
        animations: rigClips(portable),
        binary: true,
        onlyVisible: true,
      });
      download(new Blob([data as ArrayBuffer], { type: 'model/gltf-binary' }), `${source.id}.glb`);
      toast('Exported the current scene, including local edits.');
    } catch (error) {
      toast(`Export failed: ${errorMessage(error)}`, true);
    } finally {
      button('glb').disabled = false;
      button('glb').textContent = old;
    }
  });
  button('png').addEventListener('click', () => {
    helpers.visible = false;
    const helper = gizmo().getHelper(),
      visible = helper.visible;
    helper.visible = false;
    draw();
    renderer.domElement.toBlob((blob) => {
      if (blob) download(blob, `${source.id}.png`);
      helpers.visible = true;
      helper.visible = visible;
      draw();
    }, 'image/png');
  });
}
