import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** A deterministic presentation garden. It never creates or advances game entities. */
export function createStage() {
  const root = new THREE.Group(), woodland = new THREE.Group();
  root.add(woodland); woodland.visible = false;
  const geometry = {
    sphere: new THREE.SphereGeometry(1, 16, 12),
    stone: new THREE.DodecahedronGeometry(1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 16),
    cone: new THREE.ConeGeometry(1, 1, 12),
    box: new THREE.BoxGeometry(1, 1, 1),
  };
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const material = (color: string) => {
    let value = materials.get(color);
    if (!value) { value = new THREE.MeshStandardMaterial({color, roughness: .94}); materials.set(color, value); }
    return value;
  };
  function piece(parent: THREE.Object3D, kind: keyof typeof geometry, color: string,
    position: number[], scale: number[], rotation = 0) {
    const mesh = new THREE.Mesh(geometry[kind], material(color));
    mesh.position.set(...position as [number, number, number]);
    mesh.scale.set(...scale as [number, number, number]); mesh.rotation.y = rotation;
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  const ground = piece(root, 'cylinder', '#738057', [0, -.14, 0], [7, .24, 7]);
  ground.castShadow = false;
  // Slightly irregular pavers remain low enough for the authored model's feet.
  for (let row = -4; row <= 4; row++) {
    for (let col = -1; col <= 1; col++) {
      const wobble = Math.sin(row * 13 + col * 7);
      const stone = piece(root, 'stone', ['#afa185', '#c0b394', '#93947c'][(row + col + 6) % 3],
        [col * .43 + wobble * .035, -.035, row * .38], [.25, .06, .225], wobble * .3);
      stone.castShadow = false;
    }
  }
  function fern(x: number, z: number, size: number, seed: number, parent = root) {
    const base = new THREE.Group(); base.position.set(x, -.015, z); base.rotation.y = seed; parent.add(base);
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.399 + seed;
      const leaf = piece(base, 'sphere', i % 2 ? '#71884b' : '#87985a',
        [Math.sin(angle) * size * .31, size * .46, Math.cos(angle) * size * .31],
        [size * .12, size * .52, size * .055]);
      leaf.rotation.z = Math.cos(angle) * .72; leaf.rotation.x = Math.sin(angle) * .72;
    }
  }
  function flower(x: number, z: number, size: number, seed: number) {
    piece(root, 'cylinder', '#6d8246', [x, size * .5, z], [.009, size, .009]);
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * .4;
      piece(root, 'sphere', seed % 2 ? '#f8edd0' : '#e9ca79',
        [x + Math.sin(a) * .028, size + Math.cos(a) * .025, z], [.024, .026, .012]);
    }
    piece(root, 'sphere', '#b77d32', [x, size, z + .012], [.013, .013, .012]);
  }
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1, z = -2.2 + i * .17;
    const x = side * (.78 + (Math.sin(i * 9) + 1) * .33);
    fern(x, z, .16 + (i % 4) * .055, i);
    if (i % 3 === 0) flower(x + .1, z + .08, .17 + i % 4 * .025, i);
    if (i % 4 === 0) piece(root, 'stone', '#999d80', [x + side * .15, .055, z], [.21, .11, .17], i);
  }
  // Layered foliage gives the silhouette a quiet, warm woodland surround.
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI + i * Math.PI / 9;
    const x = Math.cos(angle) * 3.3, z = -1.8 - Math.sin(-angle) * 1.4;
    const height = 2.1 + (i % 3) * .35;
    piece(woodland, 'cylinder', '#8a7957', [x, height * .5, z], [.13, height, .13]);
    for (let j = 0; j < 3; j++) piece(woodland, 'sphere', ['#879569', '#a3ac7b', '#b5b78a'][j],
      [x + Math.sin(i + j) * .38, height + j * .14, z + Math.cos(i + j) * .3], [.77, .6, .66]);
    fern(x * .68, z * .65, .43, i, woodland);
  }
  // A distant canopy remains in studio mode, while world mode adds complete trees.
  for (let i = 0; i < 8; i++) {
    const x = (i - 3.5) * .8;
    piece(root, 'sphere', ['#748264', '#8d986f', '#a8ac7a'][i % 3],
      [x, 1.1 + (i % 3) * .5, -3.8 - (i % 2) * .4], [1.1, 1.25, .7]);
    if (i % 2) piece(root, 'cylinder', '#8a7957', [x, 1.15, -3.4], [.09, 2.5, .09]);
  }
  const lantern = new THREE.Group(); root.add(lantern); lantern.position.set(1.2, 0, -.6);
  piece(lantern, 'cylinder', '#77634a', [0, .04, 0], [.14, .08, .14]);
  piece(lantern, 'cylinder', '#c49b50', [0, .21, 0], [.082, .28, .082]);
  const glass = piece(lantern, 'cylinder', '#f7d796', [0, .21, 0], [.067, .22, .067]);
  glass.material = new THREE.MeshStandardMaterial({color: '#ffdf9b', emissive: '#e49a40', emissiveIntensity: .65, roughness: .35});
  const glassMaterial = glass.material;
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2;
    piece(lantern, 'cylinder', '#77634a', [Math.cos(angle) * .08, .21, Math.sin(angle) * .08], [.009, .3, .009]);
  }
  piece(lantern, 'cone', '#77634a', [0, .4, 0], [.15, .14, .15]);
  const glow = new THREE.PointLight('#ffd69b', .18, 1.8, 2); glow.position.set(1.2, .27, -.6); root.add(glow);
  // Batch static decoration by material to keep the garden affordable on laptops.
  const merged: THREE.BufferGeometry[] = [];
  function batch(parent: THREE.Group) {
    parent.updateMatrixWorld(true);
    const groups = new Map<THREE.Material, {geometries: THREE.BufferGeometry[]; meshes: THREE.Mesh[]}>();
    const collect = (node: THREE.Object3D) => {
      if (node === woodland && parent !== woodland) return;
      if (node instanceof THREE.Mesh) {
        const material = node.material as THREE.Material;
        const group = groups.get(material) || {geometries: [], meshes: []};
        const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
        geometry.applyMatrix4(node.matrixWorld);
        group.geometries.push(geometry); group.meshes.push(node); groups.set(material, group);
      }
      node.children.forEach(collect);
    };
    collect(parent);
    for (const [material, group] of groups) {
      const geometry = mergeGeometries(group.geometries);
      group.geometries.forEach(value => value.dispose());
      if (!geometry) continue;
      merged.push(geometry);
      group.meshes.forEach(mesh => mesh.removeFromParent());
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
    }
  }
  batch(root); batch(woodland);
  return {
    root,
    setWorld(world: boolean) { woodland.visible = world; },
    setLight(night: boolean) { glow.intensity = night ? .8 : .18; glassMaterial.emissiveIntensity = night ? 2 : .65; },
    dispose() {
      Object.values(geometry).forEach(value => value.dispose());
      merged.forEach(value => value.dispose());
      materials.forEach(value => value.dispose()); glassMaterial.dispose();
    },
  };
}
