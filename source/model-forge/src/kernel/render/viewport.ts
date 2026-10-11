import * as THREE from 'three';
import type { SceneDocument } from '../domain/schema.js';
export function boundsOf(object: THREE.Object3D) {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  object.traverseVisible((child) => {
    if (child instanceof THREE.Mesh) {
      if (child instanceof THREE.SkinnedMesh) {
        child.computeBoundingBox();
        if (child.boundingBox) box.union(child.boundingBox.clone().applyMatrix4(child.matrixWorld));
        return;
      }
      child.geometry.computeBoundingBox();
      if (child.geometry.boundingBox)
        box.union(child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld));
    }
  });
  return box;
}
function metrics(object: THREE.Object3D) {
  let box = boundsOf(object);
  if (box.isEmpty())
    box = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
  return {
    box,
    center: box.getCenter(new THREE.Vector3()),
    size: box.getSize(new THREE.Vector3()),
    span: Math.max(...box.getSize(new THREE.Vector3()).toArray(), 0.5),
  };
}

export function createViewport(scene: THREE.Scene, source: SceneDocument, stage: HTMLElement) {
  let env = source.environment;
  scene.background = new THREE.Color(env.background);
  const ambient = new THREE.HemisphereLight('#dceaff', '#757066', env.ambient);
  scene.add(ambient);
  const key = new THREE.DirectionalLight('#fff0d9', env.keyIntensity);
  key.position.fromArray(env.keyPosition);
  scene.add(key);
  scene.add(key.target);
  const fill = new THREE.DirectionalLight('#b5cbff', 1);
  fill.position.set(-6, 3, -5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#ffe4b5', 2.3);
  scene.add(rim, rim.target);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShadowMaterial({ color: '#493b2d', opacity: 0.22 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.normalBias = 0.02;
  key.shadow.bias = -0.0001;
  stage.prepend(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    'aria-label',
    '3D scene. Drag to orbit. Q selects; W, E, R move, rotate and scale. F frames the selection.',
  );
  let grid: THREE.GridHelper | undefined;
  function environment() {
    env = source.environment;
    scene.background = new THREE.Color(env.background);
    const portrait = env.presentation === 'portrait';
    ambient.color.set(portrait ? '#fff5de' : '#dceaff');
    ambient.groundColor.set(portrait ? '#a5977c' : '#757066');
    key.color.set(portrait ? '#fff0d4' : '#fff0d9');
    fill.color.set(portrait ? '#dbe7df' : '#b5cbff');
    fill.intensity = portrait ? 1.5 : 1;
    rim.visible = portrait;
    floor.visible = portrait;
    ambient.intensity = env.ambient;
    key.intensity = env.keyIntensity;
    renderer.toneMapping =
      env.toneMapping === 'linear'
        ? THREE.LinearToneMapping
        : env.toneMapping === 'neutral'
          ? THREE.NeutralToneMapping
          : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = env.exposure ?? 1;
  }
  function lighting(content: THREE.Object3D, gridVisible: boolean) {
    environment();
    const { span, center, box } = metrics(content);
    if (grid) {
      scene.remove(grid);
      grid.geometry.dispose();
      (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => m.dispose());
    }
    const portrait = env.presentation === 'portrait';
    grid = new THREE.GridHelper(
      Math.ceil(span * 2),
      24,
      portrait ? '#a69a82' : '#596270',
      portrait ? '#c8bfad' : '#333d49',
    );
    grid.position.set(center.x, Math.min(0, box.min.y) - 0.004, center.z);
    grid.visible = gridVisible;
    scene.add(grid);
    floor.position.set(center.x, box.min.y - span * 0.001, center.z);
    floor.scale.setScalar(span * 5);
    rim.target.position.copy(center);
    rim.position.copy(center).add(new THREE.Vector3(-0.5, 0.8, -1).multiplyScalar(span * 2));
    if (env.presentation === 'portrait')
      fill.position.copy(center).add(new THREE.Vector3(-1, 0.6, 1).multiplyScalar(span * 2));
    else fill.position.set(-6, 3, -5);
    key.target.position.copy(center);
    key.position
      .copy(center)
      .add(new THREE.Vector3(...env.keyPosition).normalize().multiplyScalar(span * 1.8));
    key.shadow.camera.left = -span;
    key.shadow.camera.right = span;
    key.shadow.camera.top = span;
    key.shadow.camera.bottom = -span;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = span * 6;
    key.shadow.camera.updateProjectionMatrix();
    return grid;
  }
  return { renderer, lighting };
}
