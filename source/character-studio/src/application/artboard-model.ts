import { clone } from '../domain/catalog.js';
import type { Data } from './compiler.js';
import { silhouetteFibres } from './artboard-fibres.js';
import { artboardMeshes } from './artboard-meshes.js';
import { artboardPiece as piece, artboardRounded as rounded, sculptArtboardFace } from './artboard-face.js';

let geometryTemplate: Data | undefined;
function detachedGeometry(): Data {
  if (!geometryTemplate) {
    geometryTemplate = artboardMeshes();
    for (const kind of ['head', 'body', 'ear'] as const)
      geometryTemplate[`studio4-${kind}-fibres`] = silhouetteFibres(kind);
  }
  return clone(geometryTemplate);
}
function mix(a: string, b: string, amount: number): string {
  const rgb = [1, 3, 5].map(index => Math.round(parseInt(a.slice(index, index + 2), 16) * (1 - amount)
    + parseInt(b.slice(index, index + 2), 16) * amount));
  return '#' + rgb.map(value => value.toString(16).padStart(2, '0')).join('');
}
function tufts(head: Data): void {
  for (let index = 0; index < 4; index++) {
    const tuft = piece(`crown-wisp-${index}`, [-.037 + index * .022, .188, -.016], [.018, .024, .018], 'fur');
    tuft.rotation = [0, 0, -.6 + index * .12];
    head.children.push(tuft);
  }
}
function body(node: Data): void {
  // Revision 4 has a lower forehead; seat headwear below the crown rather than
  // retaining the revision 3 socket that only touched the topmost head vertex.
  if (node.id === 'headgear-socket') node.position = [node.position[0], .132, node.position[2]];
  if (node.id === 'shadow') {
    rounded(node);
    node.position = [0, .001, 0];
    node.scale = [.220, .001, .160];
    node.castShadow = false;
    node.receiveShadow = false;
  }
  if (node.id === 'torso') {
    rounded(node, 'studio4-body');
    node.position = [0, .340, -.014];
    node.scale = [.207, .210, .182];
  }
  if (node.id === 'bib') {
    rounded(node, 'studio4-body');
    node.position = [0, .334, .117];
    node.scale = [.146, .158, .065];
  }
  if (node.id === 'head') {
    node.position = [0, .650, .035];
    tufts(node);
    node.children.push(piece('head-fibres', [0, 0, 0], [1, 1, 1], 'fur', 'studio4-head-fibres'));
  }
  if (node.id === 'body') {
    node.children.push(piece('body-fibres', [0, .340, -.014], [1, 1, 1], 'fur', 'studio4-body-fibres'));
  }
  if (/^arm-(left|right)$/.test(node.id)) {
    const side = node.id === 'arm-left' ? -1 : 1;
    node.position = [side * .188, .421, .017];
    node.rotation = [-.26, side * -.06, side * -.22];
  }
  if (/^arm-(left|right)-upper$/.test(node.id)) {
    node.position = [0, -.045, .014];
    node.scale = [.061, .091, .066];
    node.rotation = [-.20, 0, 0];
  }
  if (/^arm-(left|right)-paw$/.test(node.id)) {
    node.position = [0, -.103, .046];
    node.scale = [.063, .058, .064];
    node.material = 'fur';
  }
  if (/^foot-(left|right)$/.test(node.id)) {
    const side = node.id === 'foot-left' ? -1 : 1;
    node.primitive = 'group';
    delete node.mesh;
    delete node.material;
    node.position = [side * .118, .083, .045];
    node.scale = [1, 1, 1];
    node.rotation = [0, 0, 0];
    node.children = [
      piece(`${node.id}-paw`, [0, -.031, .005], [.081, .052, .112], 'fur'),
      piece(`${node.id}-shin`, [-side * .010, .061, -.025], [.061, .094, .067], 'fur'),
    ];
  }
}
function ears(node: Data, variant: string): void {
  if (/^ear-(left|right)$/.test(node.id)) {
    const side = node.id === 'ear-left' ? -1 : 1;
    node.position = [side * .178, .186, -.011];
    node.rotation = [-.07, side * -.10, side * -.29];
  }
  if (!/^ear-(left|right)-(outer|inner)$/.test(node.id)) return;
  const inner = node.id.endsWith('-inner');
  if (variant === 'world-round') {
    rounded(node, inner ? 'studio-soft' : 'studio4-ear-round');
    node.position = [0, .035, inner ? .029 : 0];
    node.scale = inner ? [.048, .052, .011] : [.077, .084, .058];
    if (!inner) node.children = [piece(`${node.id}-fibres`, [0, 0, 0], [1, 1, 1], 'fur', 'studio4-ear-fibres')];
  } else {
    rounded(node, inner ? 'studio-soft' : 'studio4-ear-tapered');
    const pointed = variant === 'world-pointed';
    node.position = [0, pointed ? .060 : .129, inner ? .037 : 0];
    node.scale = pointed ? (inner ? [.046, .091, .009] : [.083, .145, .053])
      : (inner ? [.034, .163, .010] : [.059, .215, .053]);
  }
}
function sculpt(nodes: Data[], variant: string): void {
  for (const node of nodes) {
    if (node.primitive === 'soft' || node.primitive === 'ball') rounded(node);
    body(node);
    ears(node, variant);
    sculptArtboardFace(node);
    if (node.children) sculpt(node.children, variant);
  }
}
/** Revision 4 keeps sculpt, coat, sockets and expression in the portable asset itself. */
export function sculptArtboardModel(visual: Data): void {
  visual.meshes = detachedGeometry();
  const coat = visual.materials.fur as string, cream = visual.materials.light as string;
  const eye = visual.materials.pupil as string;
  const fur = {roughness: .91, metalness: 0, flatShading: false, sheen: .8,
    sheenRoughness: .9, sheenColor: '#ffe8cc',
    surface: {kind: 'fur', version: 2, seed: 17, scale: 5, strength: .55}};
  visual.materials.fur = {color: coat, ...fur};
  visual.materials.light = {color: cream, ...fur};
  visual.materials.inner = {color: mix(visual.materials.inner, '#edb4a6', .28), ...fur};
  visual.materials.pupil = {color: eye, roughness: .20, flatShading: false, clearcoat: .8, clearcoatRoughness: .14};
  visual.materials.eyeDepth = {color: mix(eye, '#150d0b', .72), roughness: .18, flatShading: false, clearcoat: .8, clearcoatRoughness: .12};
  visual.materials.eyeWhite = {color: '#fff1d8', roughness: .48, flatShading: false};
  visual.materials.eyeRim = {color: mix(coat, '#342015', .65), roughness: .8, flatShading: false};
  visual.materials.catchlight = {color: '#fff9ee', roughness: 1, emissive: '#fff9ee', emissiveIntensity: .12};
  visual.materials.nose = {color: '#624032', roughness: .45, flatShading: false, clearcoat: .15, clearcoatRoughness: .4};
  visual.materials.brow = {color: mix(coat, '#744f31', .36), ...fur};
  visual.materials.mouthDark = {color: '#583027', roughness: .86, flatShading: false};
  visual.materials.tongue = {color: '#d28a77', roughness: .76, flatShading: false};
  for (const base of ['fur', 'light']) for (let ring = 0; ring < 4; ring++)
    visual.materials[`blush-${base}-${ring}`] = {
      color: mix(base === 'fur' ? coat : cream, '#e3a094', .10 + ring * .055), ...fur,
    };
  for (const [name, model] of Object.entries(visual.models)) {
    sculpt((model as Data).nodes, name);
    const attachPaint = (nodes: Data[]): void => {
      for (const node of nodes) {
        if (node.id === 'cheek-left') node.children = Object.keys(visual.meshes)
          .filter(id => id.startsWith('studio4-blush-'))
          .map(id => piece(id, [0, 0, 0], [1, 1, 1], id.replace('studio4-', ''), id));
        if (node.children) attachPaint(node.children);
      }
    };
    attachPaint((model as Data).nodes);
  }
}
