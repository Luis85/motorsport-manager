import type { Data } from './compiler.js';
import { plushMeshes } from './plush-meshes.js';

function rounded(node: Data, mesh = 'studio-soft'): void {
  node.primitive = 'mesh';
  node.mesh = mesh;
}
function piece(id: string, position: number[], scale: number[], material: string, mesh = 'studio-soft'): Data {
  return { primitive: 'mesh', id, position, scale, material, mesh };
}
function sculptEye(node: Data): void {
  const side = node.id === 'eye-left' ? -1 : 1;
  node.position = [side * .106, .022, .204];
  node.rotation = [0, side * .18, side * -.055];
  node.children = [
    piece(`${node.id}-white`, [0, 0, 0], [.064, .076, .035], 'eyeRim'),
    piece(`${node.id}-pupil`, [0, -.007, .023], [.050, .060, .021], 'pupil'),
    piece(`${node.id}-depth`, [0, .003, .039], [.033, .048, .010], 'eyeDepth'),
    piece(`${node.id}-glint`, [-.017, .027, .045], [.015, .020, .006], 'eyeWhite'),
    piece(`${node.id}-spark`, [.019, -.032, .044], [.005, .006, .003], 'eyeWhite'),
  ];
}
function sculptFace(node: Data): void {
  if (node.id === 'head-shell') {
    rounded(node, 'studio-cheek');
    node.scale = [.286, .249, .237];
  }
  if (node.id === 'muzzle-left' || node.id === 'muzzle-right') {
    const side = node.id === 'muzzle-left' ? -1 : 1;
    node.position = [side * .066, -.083, .192];
    node.scale = [.112, .078, .070];
  }
  if (node.id === 'cheek-left' || node.id === 'cheek-right') {
    const side = node.id === 'cheek-left' ? -1 : 1;
    node.position = [side * .198, -.057, .166];
    node.scale = [.041, .024, .014];
    node.rotation = [0, side * .5, side * .13];
    node.materialProps = { roughness: 1, sheen: .5, sheenRoughness: 1 };
  }
  if (node.id === 'brow-left' || node.id === 'brow-right') {
    const side = node.id === 'brow-left' ? -1 : 1;
    rounded(node, 'studio-brow');
    node.position = [side * .109, .119, .194];
    node.scale = [.046, .030, .012];
    node.rotation = [0, side * .15, 0];
    node.material = 'fur';
  }
  if (node.id === 'nose') {
    node.position = [0, -.069, .268];
    node.scale = [.031, .021, .019];
    node.materialProps = { roughness: .25, clearcoat: .6, clearcoatRoughness: .2 };
  }
  if (node.id === 'mouth') {
    node.position = [0, -.109, .274];
    node.children = [
      piece('mouth-left', [0, 0, 0], [.047, .055, .010], 'mouthDark', 'studio-smile'),
      piece('mouth-right', [0, -.024, .009], [.024, .008, .003], 'inner'),
      piece('muzzle-chin', [0, -.036, -.034], [.050, .020, .016], 'light'),
    ];
  }
  if (node.id === 'eye-left' || node.id === 'eye-right') sculptEye(node);
}
/** A few soft silhouette wisps; no hair cards, transparency sorting or texture dependency. */
function tufts(head: Data): void {
  const crown = [-.063, -.018, .025, .066];
  for (let index = 0; index < crown.length; index++) {
    const x = crown[index];
    const tuft = piece(`crown-wisp-${index}`, [x, .222 - Math.abs(x) * .14, -.012], [.026, .034 + index % 3 * .004, .024], 'fur');
    tuft.rotation = [0, 0, -.5 - index * .08];
    head.children.push(tuft);
  }
  for (const side of [-1, 1])
    for (let index = 0; index < 3; index++) {
      const tuft = piece(`cheek-wisp-${side < 0 ? 'left' : 'right'}-${index}`, [side * (.253 - index * .009), -.042 - index * .034, .022], [.022, .046, .027], 'fur');
      tuft.rotation = [0, 0, side * -1.0];
      head.children.push(tuft);
    }
}
function sculptNodes(nodes: Data[], variant: string): void {
  for (const node of nodes) {
    if (node.primitive === 'soft' || node.primitive === 'ball') rounded(node);
    if (node.id === 'torso') rounded(node, 'studio-pear');
    if (/^arm-(left|right)-paw$/.test(node.id)) node.material = 'fur';
    if (node.id === 'bib') {
      rounded(node, 'studio-pear');
      node.position = [0, .307, .128];
      node.scale = [.151, .201, .079];
    }
    if (node.id?.startsWith('ear-') && /-(outer|inner)$/.test(node.id)) {
      if (variant === 'world-pointed') {
        rounded(node, 'studio-ear');
        node.scale[1] *= .74;
        node.scale[0] *= 1.35;
      } else if (variant === 'world-round') {
        node.scale[0] *= 1.16;
        node.scale[1] *= 1.03;
      }
      if (node.id.endsWith('-inner')) {
        node.position[2] = variant === 'world-round' ? .071 : variant === 'world-pointed' ? .062 : .065;
        node.scale[0] *= 1.08;
        node.materialProps = { roughness: .95, sheen: .6, sheenRoughness: .9 };
      }
    }
    sculptFace(node);
    if (node.id === 'head') tufts(node);
    if (node.children) sculptNodes(node.children, variant);
  }
}
/** The same authored geometry/materials travel into engine assets and Scene Forge exports. */
export function sculptPlushModel(visual: Data): void {
  visual.meshes = plushMeshes();
  for (const role of ['fur', 'light']) visual.materials[role] = {
    color: visual.materials[role], roughness: .9, metalness: 0, flatShading: false,
    sheen: .75, sheenRoughness: .9, sheenColor: '#fff0d8',
  };
  visual.materials.inner = { color: visual.materials.inner, roughness: .9, flatShading: false };
  visual.materials.pupil = { color: visual.materials.pupil, roughness: .16, flatShading: false, clearcoat: 1, clearcoatRoughness: .08 };
  visual.materials.eyeRim = { color: '#32251e', roughness: .24, flatShading: false };
  visual.materials.eyeDepth = { color: '#100e0b', roughness: .1, flatShading: false, clearcoat: 1, clearcoatRoughness: .05 };
  visual.materials.eyeWhite = { color: '#fff9ed', roughness: .18, flatShading: false, emissive: '#fff9ed', emissiveIntensity: .18 };
  visual.materials.mouthDark = { color: '#60392f', roughness: .8, flatShading: false };
  for (const [name, model] of Object.entries(visual.models)) sculptNodes((model as Data).nodes, name);
}
