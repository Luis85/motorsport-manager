import * as THREE from 'three';
import {compileVisual} from '../application/compiler.ts';
import type {Character} from '../domain/character.ts';
import {createRenderKit} from './viewport-kit.ts';

/** Reuse the live renderer; cache bounded PNG strings, never model GPU resources. */
export function createPortraits(renderer: THREE.WebGLRenderer, environment: THREE.Texture, restore: () => void) {
  const cache = new Map<string, string>();
  return (character: Character): string => {
    const key = JSON.stringify([character.appearance, character.outfits]);
    const cached = cache.get(key);
    if (cached) { cache.delete(key); cache.set(key, cached); return cached; }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eee9d9');
    scene.environment = environment; scene.environmentIntensity = .65;
    const resources = createRenderKit();
    const visual = compileVisual(character);
    const appearance = Object.values(visual.behaviors.appearances)[0] as {model: string; materials: Record<string, unknown>; scale: number[]};
    const engine = (globalThis as unknown as {LWAssetRenderer: {
      createFromDefinition(kit: unknown, parent: THREE.Object3D, asset: unknown, model: string, options: unknown): {root: THREE.Group; handles: Map<string, THREE.Object3D>};
    }}).LWAssetRenderer;
    const size = renderer.getSize(new THREE.Vector2());
    try {
      const figure = engine.createFromDefinition(resources.kit, scene, visual, appearance.model,
        {materials: appearance.materials, scale: appearance.scale});
      for (const role of ['care', 'carry']) {
        const id = (visual.rig as Record<string, unknown>)[role];
        if (typeof id === 'string') { const node = figure.handles.get(id); if (node) node.visible = false; }
      }
      const box = new THREE.Box3().setFromObject(figure.root), height = Math.max(.5, box.max.y);
      const half = height * .47;
      const camera = new THREE.OrthographicCamera(-half, half, half, -half, .01, 20);
      camera.position.set(.25, height * .72, 4); camera.lookAt(0, height * .64, 0);
      scene.add(new THREE.HemisphereLight('#fff7ed', '#c3b4a4', 1.25));
      const light = new THREE.DirectionalLight('#ffeacc', 2.3); light.position.set(-3, 5, 5); scene.add(light);
      const rim = new THREE.DirectionalLight('#ffe1a3', 1.25); rim.position.set(2, 3, -3); scene.add(rim);
      renderer.setSize(144, 144, false); renderer.render(scene, camera);
      const png = renderer.domElement.toDataURL('image/png');
      cache.set(key, png);
      if (cache.size > 24) cache.delete(cache.keys().next().value!);
      return png;
    } finally {
      resources.dispose(scene); renderer.setSize(size.x, size.y, false); restore();
    }
  };
}
