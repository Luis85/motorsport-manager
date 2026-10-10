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
  const ground = piece(root, 'box', '#d9c9ac', [0, -6, 0], [200, 12, 200]);
  ground.castShadow = false;
  // World-only worn stones keep the studio silhouette clear and the path organic.
  for (let row = -12; row <= 5; row++) {
    for (let col = -2; col <= 2; col++) {
      const wobble = Math.sin(row * 13 + col * 7);
      const stone = piece(woodland, 'stone', ['#a89c80', '#b9ac8e', '#c4b79a'][(row + col + 18) % 3],
        [col * .23 + (row % 2) * .045 + wobble * .012, -.015, row * .205],
        [.116 + wobble * .006, .022, .102 + wobble * .005], wobble * .24);
      stone.castShadow = false;
    }
  }
  function fern(x: number, z: number, size: number, seed: number, parent = root) {
    const base = new THREE.Group(); base.position.set(x, -.015, z); base.rotation.y = seed; parent.add(base);
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.399 + seed;
      const leaf = piece(base, 'sphere', i % 2 ? '#71884b' : '#87985a',
        [Math.sin(angle) * size * .31, size * .46, Math.cos(angle) * size * .31],
        [size * .105, size * .42, size * .04]);
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
  for (let i = 0; i < 22; i++) {
    const side = i % 2 ? 1 : -1, z = -2.8 + i * .19;
    const x = side * (.81 + (Math.sin(i * 9) + 1) * .28);
    fern(x, z, .12 + (i % 4) * .035, i);
    if (i % 3 === 0) flower(x + .1, z + .08, .17 + i % 4 * .025, i);
    if (i % 4 === 0) piece(root, 'stone', '#999d80', [x + side * .15, .055, z], [.15, .065, .12], i);
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
  // Small leaf clusters frame open air behind the face, never a wall of giant spheres.
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 5; i++) {
      const x = side * (1.3 + i * .3), z = -2.9 - i * .24;
      const height = 1.5 + (i % 3) * .34;
      piece(root, 'cylinder', '#8a7957', [x, height * .48, z], [.034, height, .034]);
      for (let j = 0; j < 4; j++) {
        const angle = i * 2.4 + j * 1.7;
        piece(root, 'sphere', ['#879569', '#a3ac7b', '#b5b78a'][j % 3],
          [x + Math.sin(angle) * .24, height + Math.cos(angle) * .25, z + Math.cos(angle) * .14],
          [.25 + (j % 2) * .09, .22, .16]);
      }
    }
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
      // The character supplies the readable contact shadow; distant decoration
      // must not project sharp canopy stripes or self-shadow the ground plane.
      mesh.castShadow = false; mesh.receiveShadow = true; parent.add(mesh);
    }
  }
  batch(root); batch(woodland);
  let world = false, night = false;
  function groundColor() {
    (ground.material as THREE.MeshStandardMaterial).color.set(night ? '#52605b' : world ? '#929778' : '#d9c9ac');
  }
  return {
    root,
    setWorld(value: boolean) { world = value; woodland.visible = world; groundColor(); },
    setLight(value: boolean) { night = value; groundColor(); glow.intensity = night ? .8 : .18; glassMaterial.emissiveIntensity = night ? 2 : .65; },
    dispose() {
      Object.values(geometry).forEach(value => value.dispose());
      merged.forEach(value => value.dispose());
      materials.forEach(value => value.dispose()); glassMaterial.dispose();
    },
  };
}
