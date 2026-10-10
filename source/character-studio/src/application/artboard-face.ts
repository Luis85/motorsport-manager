import type { Data } from './compiler.js';

export function artboardPiece(id: string, position: number[], scale: number[], material: string, mesh = 'studio-soft'): Data {
  return { primitive: 'mesh', id, position, scale, material, mesh };
}
export function artboardRounded(node: Data, mesh = 'studio-soft'): void {
  node.primitive = 'mesh';
  node.mesh = mesh;
}
function eyes(node: Data): void {
  const side = node.id === 'eye-left' ? -1 : 1;
  node.position = [side * .090, .027, .155];
  node.rotation = [0, side * .25, side * -.10];
  node.children = [
    artboardPiece(`${node.id}-white`, [side * .008, -.010, .011], [.052, .054, .020], 'eyeWhite'),
    artboardPiece(`${node.id}-pupil`, [-side * .004, .007, .018], [.044, .051, .014], 'pupil'),
    artboardPiece(`${node.id}-depth`, [-side * .006, .013, .030], [.031, .037, .007], 'eyeDepth'),
    artboardPiece(`${node.id}-glint`, [-.015, .030, .035], [.0055, .008, .002], 'catchlight'),
    artboardPiece(`${node.id}-upper-lid`, [0, 0, .004], [.052, .058, .006], 'fur', 'studio4-eyelid'),
    artboardPiece(`${node.id}-lash`, [0, -.002, .010], [.051, .056, .003], 'eyeRim', 'studio4-eyelid'),
  ];
}
export function sculptArtboardFace(node: Data): void {
  if (node.id === 'head-shell') {
    artboardRounded(node, 'studio4-head');
    node.position = [0, 0, 0];
    node.scale = [1, 1, 1];
  }
  if (node.id === 'muzzle-left') {
    artboardRounded(node, 'studio4-face-coat');
    node.position = [0, 0, 0];
    node.scale = [1, 1, 1];
  }
  if (node.id === 'muzzle-right') {
    node.visible = false;
    node.scale = [.001, .001, .001];
  }
  if (node.id === 'cheek-left' || node.id === 'cheek-right') {
    const side = node.id === 'cheek-left' ? -1 : 1;
    node.primitive = 'group';
    delete node.mesh;
    delete node.material;
    node.position = [0, 0, 0];
    node.scale = [1, 1, 1];
    node.children = [];
  }
  if (node.id === 'brow-left' || node.id === 'brow-right') {
    const side = node.id === 'brow-left' ? -1 : 1;
    artboardRounded(node, 'studio4-brow');
    node.position = [side * .094, .106, .166];
    node.scale = [.037, .026, .009];
    node.rotation = [0, side * .24, side * -.09];
    node.material = 'brow';
  }
  if (node.id === 'nose') {
    artboardRounded(node, 'studio4-nose');
    node.position = [0, -.045, .222];
    node.scale = [.022, .015, .014];
  }
  if (node.id === 'mouth') {
    node.position = [0, -.079, .206];
    node.children = [
      artboardPiece('mouth-left', [0, 0, 0], [.030, .019, .006], 'mouthDark', 'studio4-smile'),
      artboardPiece('mouth-right', [0, -.011, .006], [.018, .007, .003], 'tongue'),
      artboardPiece('mouth-philtrum', [0, .023, .002], [.0025, .010, .003], 'mouthDark'),
      artboardPiece('muzzle-cushion-left', [-.026, .025, -.006], [.033, .016, .009], 'light'),
      artboardPiece('muzzle-cushion-right', [.026, .025, -.006], [.033, .016, .009], 'light'),
    ];
  }
  if (node.id === 'eye-left' || node.id === 'eye-right') eyes(node);
}
