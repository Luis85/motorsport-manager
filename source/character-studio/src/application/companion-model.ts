import type { Data } from './compiler.js';
import { surface } from './plush-meshes.js';
import { cheekPatch } from './companion-cheeks.js';
import { withSphericalUvs } from './companion-uvs.js';

function piece(id: string, position: number[], scale: number[], material: string, mesh = 'studio-soft'): Data {
  return { primitive: 'mesh', id, position, scale, material, mesh };
}
function rounded(node: Data, mesh = 'studio-soft'): void {
  node.primitive = 'mesh';
  node.mesh = mesh;
}
/** Closed, shallow eye layers: the iris never hides the entire cream sclera. */
function eyes(node: Data): void {
  const side = node.id === 'eye-left' ? -1 : 1;
  node.position = [side * .105, .010, .207];
  node.rotation = [0, side * .30, side * -.10];
  node.children = [
    piece(`${node.id}-rim`, [0, .003, -.001], [.054, .059, .014], 'eyeRim', 'studio-almond'),
    piece(`${node.id}-white`, [0, -.002, .003], [.052, .057, .014], 'eyeWhite', 'studio-almond'),
    piece(`${node.id}-pupil`, [-side * .006, .001, .016], [.034, .045, .007], 'pupil'),
    piece(`${node.id}-depth`, [-side * .006, .005, .022], [.018, .026, .004], 'eyeDepth'),
    piece(`${node.id}-glint`, [-.014, .023, .026], [.007, .009, .002], 'catchlight'),
  ];
}
function face(node: Data): void {
  if (node.id === 'head-shell') {
    rounded(node, 'studio-cheek');
    node.scale = [.285, .236, .220];
  }
  if (node.id === 'muzzle-left' || node.id === 'muzzle-right') {
    // One facial coat patch remains embedded in the cheek surface.
    node.position = [0, -.085, .168];
    node.scale = [.160, .090, .049];
    if (node.id === 'muzzle-right') node.visible = false;
  }
  if (node.id === 'cheek-left' || node.id === 'cheek-right') {
    const side = node.id === 'cheek-left' ? -1 : 1;
    rounded(node, side === -1 ? 'studio-blush-left' : 'studio-blush-right');
    node.position = [0, 0, 0];
    node.scale = [1, 1, 1];
    node.rotation = [0, 0, 0];
    node.material = 'blush';
  }
  if (node.id === 'brow-left' || node.id === 'brow-right') {
    const side = node.id === 'brow-left' ? -1 : 1;
    rounded(node, 'studio-brow');
    node.position = [side * .106, .084, .184];
    node.scale = [.036, .022, .006];
    node.rotation = [0, side * .22, side * -.07];
    node.material = 'brow';
  }
  if (node.id === 'nose') {
    rounded(node, 'studio-nose');
    node.position = [0, -.061, .222];
    node.scale = [.023, .016, .015];
  }
  if (node.id === 'mouth') {
    node.position = [0, -.088, .215];
    node.children = [
      piece('mouth-left', [-.014, 0, 0], [.018, .012, .003], 'mouthDark', 'studio-smile'),
      piece('mouth-right', [.014, 0, 0], [.018, .012, .003], 'mouthDark', 'studio-smile'),
      piece('mouth-philtrum', [0, .012, .003], [.0025, .011, .002], 'mouthDark'),
    ];
  }
  if (node.id === 'eye-left' || node.id === 'eye-right') eyes(node);
}
function tufts(head: Data): void {
  for (let index = 0; index < 4; index++) {
    const x = -.041 + index * .025;
    const tuft = piece(`crown-wisp-${index}`, [x, .182 - Math.abs(x) * .17, -.002], [.019, .030 + index % 2 * .005, .019], 'fur');
    tuft.rotation = [0, 0, -.65 + index * .10];
    head.children.push(tuft);
  }
  for (const side of [-1, 1])
    for (let index = 0; index < 4; index++) {
      const tuft = piece(`cheek-wisp-${side < 0 ? 'left' : 'right'}-${index}`, [side * (.255 - index * .008), -.040 - index * .027, .008], [.019, .031, .024], 'fur', 'studio-tuft');
      tuft.rotation = [0, 0, side * -1.22];
      head.children.push(tuft);
    }
}
function body(node: Data): void {
  if (node.id === 'torso') {
    rounded(node, 'studio-pear');
    node.position = [0, .302, 0];
    node.scale = [.231, .253, .202];
  }
  if (node.id === 'bib') {
    rounded(node, 'studio-pear');
    node.position = [0, .293, .148];
    node.scale = [.166, .198, .070];
  }
  if (node.id === 'head') {
    node.position = [0, .639, .040];
    tufts(node);
  }
  if (/^arm-(left|right)$/.test(node.id)) {
    const side = node.id === 'arm-left' ? -1 : 1;
    node.position = [side * .212, .417, .020];
    node.rotation = [.12, 0, side * -.20];
  }
  if (/^arm-(left|right)-upper$/.test(node.id)) {
    node.position = [0, -.052, .014];
    node.scale = [.076, .105, .077];
  }
  if (/^arm-(left|right)-paw$/.test(node.id)) {
    node.position = [0, -.114, .048];
    node.scale = [.073, .065, .073];
    node.material = 'fur';
  }
  if (/^foot-(left|right)$/.test(node.id)) node.scale = [.096, .074, .129];
}
function ears(node: Data, variant: string): void {
  if (!node.id?.startsWith('ear-') || !/-(outer|inner)$/.test(node.id)) return;
  const inner = node.id.endsWith('-inner');
  if (variant === 'world-pointed') {
    rounded(node, 'studio-ear');
    node.scale = inner ? [.069, .118, .012] : [.104, .164, .063];
    node.position = [0, .060, inner ? .050 : 0];
  } else if (variant === 'world-round') {
    if (!inner) rounded(node, 'studio-ear-cup');
    node.scale = inner ? [.058, .064, .009] : [.094, .097, .068];
    node.position = [0, .043, inner ? .035 : 0];
  } else {
    rounded(node, 'studio-ear');
    node.scale = inner ? [.041, .171, .013] : [.062, .217, .057];
    node.position = [0, .121, inner ? .046 : 0];
  }
}
function sculpt(nodes: Data[], variant: string): void {
  for (const node of nodes) {
    if (node.primitive === 'soft' || node.primitive === 'ball') rounded(node);
    body(node);
    ears(node, variant);
    face(node);
    if (node.children) sculpt(node.children, variant);
  }
}
/** Revision 3 is an authored portable model, shared by Studio, Forge and the engine. */
export function sculptCompanionModel(visual: Data): void {
  visual.meshes = {
    'studio-blush-left': cheekPatch(-1),
    'studio-blush-right': cheekPatch(1),
    'studio-soft': surface(() => 1, 24, 16),
    'studio-cheek': surface(y => 1 - .13 * y, 32, 20, (x, y, z) => [x, y > 0 ? y * .81 : y, z]),
    'studio-pear': surface(y => 1 - .24 * y, 24, 16),
    'studio-ear': surface(y => .80 - .29 * y, 20, 14),
    'studio-ear-cup': surface(() => 1, 24, 16, (x, y, z) =>
      [x, y, z > 0 ? z - .65 * Math.max(0, 1 - (x * x + y * y) / .6) ** 2 : z]),
    'studio-almond': surface(() => 1, 24, 16, (x, y, z) => [x * (1 - .12 * y), y, z]),
    'studio-nose': surface(y => .72 + .35 * y, 16, 10),
    'studio-tuft': surface(y => .66 - .38 * y, 12, 8),
    'studio-smile': surface(() => 1, 16, 8, (x, y, z) => [x, .20 * y + .60 * x * x - .25, z]),
    'studio-brow': surface(() => 1, 16, 8, (x, y, z) => [x, .20 * y + .42 * (1 - x * x), z]),
  };
  // Explicit seam-aware UVs make every export independent of renderer fallback.
  for (const [name, mesh] of Object.entries(visual.meshes))
    visual.meshes[name] = withSphericalUvs(mesh as ReturnType<typeof surface>);
  for (const role of ['fur', 'light']) visual.materials[role] = {
    color: visual.materials[role], roughness: .96, metalness: 0, flatShading: false,
    sheen: .75, sheenRoughness: 1, sheenColor: '#fff0d8',
    surface: {kind: 'fur', seed: 17, scale: 3, strength: .35},
  };
  visual.materials.inner = { color: visual.materials.inner, roughness: 1, flatShading: false,
    surface: {kind: 'fur', seed: 17, scale: 3, strength: .22} };
  visual.materials.pupil = { color: visual.materials.pupil, roughness: .42, flatShading: false, clearcoat: .3, clearcoatRoughness: .3 };
  visual.materials.eyeRim = { color: '#654438', roughness: .9, flatShading: false };
  visual.materials.eyeDepth = { color: '#35251c', roughness: .45, flatShading: false };
  visual.materials.eyeWhite = { color: '#fff4db', roughness: .6, flatShading: false };
  visual.materials.catchlight = { color: '#fffaf1', roughness: 1, flatShading: false, emissive: '#fffaf1', emissiveIntensity: .18 };
  visual.materials.nose = { color: '#624032', roughness: .45, flatShading: false, clearcoat: .15, clearcoatRoughness: .4 };
  visual.materials.brow = { color: '#98714f', roughness: 1, flatShading: false };
  visual.materials.blush = { color: '#cda184', roughness: 1, flatShading: false,
    surface: {kind: 'fur', seed: 17, scale: 3, strength: .35} };
  visual.materials.mouthDark = { color: '#684434', roughness: 1, flatShading: false };
  for (const [name, model] of Object.entries(visual.models)) sculpt((model as Data).nodes, name);
}
