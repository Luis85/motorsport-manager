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
    const physical = ['sheen', 'sheenRoughness', 'sheenColor', 'clearcoat', 'clearcoatRoughness'].some(key => key in extra);
    const Material = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const material = new Material({color, roughness: .98, flatShading: true, ...extra});
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


export {createStage} from './viewport-stage.ts';
