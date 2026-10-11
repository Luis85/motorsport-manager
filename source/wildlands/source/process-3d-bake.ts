/// <reference path="./process-three.d.ts" />
/**
 * Geometry baking for the Process Studio 3D view (LWProcess3DBake). Owns the unit primitives the view draws (box, ground, cone,
 * roof, cylinder, ring, ball), the merge of many fixed pieces into one indexed, vertex-coloured geometry (so static furniture costs
 * one draw call per material class instead of one per piece), the shadow-caster rule and the piece fingerprint that checks use to
 * tell room models apart. Presentation only and stateless: it allocates geometry for the caller, never adds to or reads a scene,
 * and the caller owns and disposes what it returns.
 */
declare namespace LWProcess3DBake {
 /** A primitive placed in its container's coordinates; `turn` is an XYZ Euler rotation in radians. */
 interface Piece {kind: string; x: number; y: number; z: number; sx: number; sy: number; sz: number; color: string; turn?: LWThree.Turn}
 /** `ranges[i]` is the [first index, index count] slice of the merged geometry that holds `groups[i]`. */
 interface Baked {geometry: LWThree.BufferGeometry; ranges: [number, number][]}
 interface Api {
  /** A new unit primitive of `kind` (unknown kinds are a ball), as the 3D view has always drawn its pieces. */
  shape(T: LWThree.Module, kind: string): LWThree.BufferGeometry;
  /** Merge `groups` of pieces, in order, into one geometry with a `color` attribute; `base` returns the shared unit primitive. */
  bake(T: LWThree.Module, base: (kind: string) => LWThree.BufferGeometry, groups: readonly (readonly Piece[])[]): Baked;
  /**
   * Shadow rule: a piece casts a shadow when it is large (at least 0.8 units across) and stands clear of the floor (its top more
   * than 0.1 above the ground; `lift` is its container's height above the ground). Floors, floor panels, rails and small props only
   * receive shadows.
   */
  caster(piece: Piece, lift?: number): boolean;
  /** A stable fingerprint of pieces (transform rounded to 0.01 and colour), independent of their order. */
  fingerprint(pieces: readonly Piece[]): number;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcess3DBake?: LWProcess3DBake.Api};
 function shape(T: LWThree.Module, kind: string): LWThree.BufferGeometry {
  if (kind === 'box') return new T.BoxGeometry(1, 1, 1);
  if (kind === 'ground') return new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  if (kind === 'cone' || kind === 'roof') return new T.ConeGeometry(1, 1, kind === 'roof' ? 4 : 8);
  if (kind === 'cylinder') return new T.CylinderGeometry(1, 1, 1, 12);
  if (kind === 'ring') return new T.TorusGeometry(1, .07, 6, 20);
  return new T.SphereGeometry(1, 12, 8);
 }
 /** Extents of a piece along x, y and z (ignoring its turn): unit boxes span 1, round primitives have radius 1. */
 function extent(p: LWProcess3DBake.Piece): [number, number, number] {
  if (p.kind === 'box') return [p.sx, p.sy, p.sz];
  if (p.kind === 'ground') return [p.sx, 0, p.sz];
  if (p.kind === 'ring') return [2.14 * p.sx, 2.14 * p.sy, .14 * p.sz];
  if (p.kind === 'ball') return [2 * p.sx, 2 * p.sy, 2 * p.sz];
  return [2 * p.sx, p.sy, 2 * p.sz];
 }
 function caster(p: LWProcess3DBake.Piece, lift = 0): boolean {
  const [w, h, d] = extent(p);
  return lift + p.y + h / 2 > .1 && Math.max(w, h, d) >= .8;
 }
 function fingerprint(pieces: readonly LWProcess3DBake.Piece[]): number {
  const r = (n: number) => Math.round(n * 100);
  const rows = pieces.map(p => [p.kind, r(p.x), r(p.y), r(p.z), r(p.sx), r(p.sy), r(p.sz), p.color, ...(p.turn ?? []).map(r)].join(','));
  let hash = 0;
  for (const ch of rows.sort().join(';')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
 }
 function bake(T: LWThree.Module, base: (kind: string) => LWThree.BufferGeometry,
  groups: readonly (readonly LWProcess3DBake.Piece[])[]): LWProcess3DBake.Baked {
  let vertices = 0, indices = 0;
  for (const group of groups) for (const p of group) {
   const g = base(p.kind), count = g.getAttribute('position').count;
   vertices += count; indices += g.index ? g.index.count : count;
  }
  const position = new Float32Array(vertices * 3), normal = new Float32Array(vertices * 3), color = new Float32Array(vertices * 3);
  const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
  const matrix = new T.Matrix4(), normals = new T.Matrix3(), euler = new T.Euler(), turn = new T.Quaternion();
  const at = new T.Vector3(), size = new T.Vector3(), v = new T.Vector3(), tint = new T.Color();
  const ranges: [number, number][] = [];
  let vi = 0, ii = 0;
  for (const group of groups) {
   const first = ii;
   for (const p of group) {
    const g = base(p.kind), from = g.getAttribute('position'), normalFrom = g.getAttribute('normal'), source = g.index?.array;
    const [ax, ay, az] = p.turn ?? [0, 0, 0];
    matrix.compose(at.set(p.x, p.y, p.z), turn.setFromEuler(euler.set(ax, ay, az)), size.set(p.sx, p.sy, p.sz));
    normals.getNormalMatrix(matrix); tint.set(p.color);
    for (let i = 0; i < from.count; i++) {
     const o = (vi + i) * 3;
     v.fromArray(from.array, i * 3).applyMatrix4(matrix);
     position.set([v.x, v.y, v.z], o);
     v.fromArray(normalFrom.array, i * 3).applyNormalMatrix(normals);
     normal.set([v.x, v.y, v.z], o);
     color.set([tint.r, tint.g, tint.b], o);
    }
    const count = source ? source.length : from.count;
    for (let k = 0; k < count; k++) index[ii + k] = (source ? source[k]! : k) + vi;
    vi += from.count; ii += count;
   }
   ranges.push([first, ii - first]);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(position, 3)).setAttribute('normal', new T.BufferAttribute(normal, 3));
  geometry.setAttribute('color', new T.BufferAttribute(color, 3)).setIndex(new T.BufferAttribute(index, 1));
  geometry.computeBoundingSphere();
  return {geometry, ranges};
 }
 root.LWProcess3DBake = Object.freeze({shape, bake, caster, fingerprint});
})(globalThis);
