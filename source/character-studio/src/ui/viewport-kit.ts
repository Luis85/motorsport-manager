import * as THREE from 'three';

/** The exact primitive tessellation used by the Wildlands world renderer. */
export function createRenderKit() {
  const geometries = new Map<string, THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  function geometry(kind: string): THREE.BufferGeometry {
    const previous = geometries.get(kind);
    if (previous) return previous;
    let value: THREE.BufferGeometry;
    switch (kind) {
      case 'box': value = new THREE.BoxGeometry(1, 1, 1); break;
      case 'ball': value = new THREE.IcosahedronGeometry(1, 0); break;
      case 'tiny': value = new THREE.SphereGeometry(1, 6, 4); break;
      case 'soft': value = new THREE.SphereGeometry(1, 10, 7); break;
      case 'cone': value = new THREE.ConeGeometry(1, 1, 7); break;
      case 'cylinder': value = new THREE.CylinderGeometry(1, 1, 1, 8); break;
      case 'ring': value = new THREE.TorusGeometry(1, .07, 4, 16); break;
      case 'roof': {
        const shape = new THREE.Shape();
        shape.moveTo(-.5, 0); shape.lineTo(.5, 0); shape.lineTo(0, .62); shape.closePath();
        value = new THREE.ExtrudeGeometry(shape, {depth: 1, bevelEnabled: false});
        value.translate(0, 0, -.5);
        break;
      }
      case 'ground':
        value = new THREE.BufferGeometry();
        value.setAttribute('position', new THREE.Float32BufferAttribute([-.5, 0, -.5, -.5, 0, .5, .5, 0, .5, .5, 0, -.5], 3));
        value.setIndex([0, 1, 2, 0, 2, 3]); value.computeVertexNormals();
        break;
      default: throw new Error(`Unsupported engine primitive: ${kind}`);
    }
    geometries.set(kind, value);
    return value;
  }
  function mat(color: string, extra: Record<string, unknown> = {}) {
    const material = new THREE.MeshStandardMaterial({color, roughness: .98, flatShading: true, ...extra});
    materials.add(material);
    return material;
  }
  const kit = {
    T: THREE,
    mat,
    group(parent: THREE.Object3D) {
      const group = new THREE.Group(); parent.add(group); return group;
    },
    piece(parent: THREE.Object3D, kind: string, x: number, y: number, z: number,
      sx: number, sy: number, sz: number, color: string, rotation = 0, extra = {}) {
      const mesh = new THREE.Mesh(geometry(kind), mat(color, extra));
      mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.rotation.y = rotation;
      mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    },
  };
  return {
    kit,
    dispose(root: THREE.Object3D) {
      // Baked mesh geometries are allocated by the engine renderer, outside our primitive cache.
      root.traverse(object => {
        if (object instanceof THREE.Mesh) geometries.set(object.geometry.uuid, object.geometry);
      });
      for (const value of new Set(geometries.values())) value.dispose();
      for (const value of materials) value.dispose();
      geometries.clear(); materials.clear();
    },
  };
}

/** Decorative context only: no world state, simulation clock or game content edits. */
export function createStage() {
  const resources = createRenderKit(), {kit} = resources;
  const root = new THREE.Group(), scenery = new THREE.Group();
  const floor = kit.piece(root, 'cylinder', 0, -.07, 0, 1.05, .10, 1.05, '#ded9c5');
  floor.castShadow = false;
  const inset = kit.piece(root, 'cylinder', 0, -.011, 0, 1.035, .014, 1.035, '#e9e5d5');
  inset.castShadow = false;
  root.add(scenery);
  for (const [x, z, height] of [[-1.1, -.75, 1.1], [.95, -.95, 1.35], [-.45, -1.35, .8]]) {
    kit.piece(scenery, 'cylinder', x, height * .28, z, .055, height * .56, .055, '#857b58');
    kit.piece(scenery, 'cone', x, height * .67, z, .35, height * .7, .35, '#809677');
    kit.piece(scenery, 'cone', x, height * .9, z, .26, height * .55, .26, '#a0ae86');
  }
  for (const [x, z, scale] of [[-.87, .1, .16], [.9, .22, .12], [.7, -.53, .18]]) {
    kit.piece(scenery, 'ball', x, scale * .45, z, scale, scale * .65, scale * .8, '#9b9f85');
  }
  scenery.visible = false;
  return {
    root,
    setWorld(world: boolean) {
      scenery.visible = world;
      floor.scale.set(world ? 1.6 : 1.05, .10, world ? 1.6 : 1.05);
      inset.scale.set(world ? 1.59 : 1.035, .014, world ? 1.59 : 1.035);
      inset.material.color.set(world ? '#b5bf96' : '#e9e5d5');
    },
    dispose() { resources.dispose(root); },
  };
}
