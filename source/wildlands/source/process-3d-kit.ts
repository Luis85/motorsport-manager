/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-three.d.ts" />
/**
 * The piece kit of one Process Studio 3D scene (LWProcess3DKit). Owns the scene's unit primitives and materials, the moving
 * pieces (`piece`: one mesh each, animated, toggled or re-coloured at run time), the fixed pieces (`fixed`: recorded, then merged
 * by `seal` into one vertex-coloured mesh per container and material class), the lit text signs and the shared mood faces, and
 * frees all of it in `dispose`. Presentation only: it never reads a session or a snapshot.
 *  - Station groups (`station`, one per step) are merged scene-wide: every room's fixed furniture shares one mesh per material
 *    class, and `show(stepId)` narrows each mesh to the selected room's slice of its index buffer (the whole scene for null).
 *  - Fixed pieces in any other container (a room's working or idle variant, an actor part, the focus frame) merge into one mesh
 *    per class inside that container, so the container's own visibility and transform still apply.
 *  - Shadows follow `LWProcess3DBake.caster`: large pieces above the floor cast, floors and small props only receive.
 *  - Checks read `userData.pieces` and `userData.shape` (piece count and fingerprint) from merged meshes and station groups.
 */
declare namespace LWProcess3DKit {
 interface Kit extends LWProcessRooms.Kit {
  /** A step's room group at its scene position; fixed pieces added to it are merged scene-wide. */
  station(stepId: string, x: number, z: number): LWThree.Group;
  /** A unit primitive shared by every mesh of this scene (not to be disposed by the caller). */
  shape(kind: string): LWThree.BufferGeometry;
  /** Merge the fixed pieces recorded so far into one geometry per container and material class; call once, after building. */
  seal(): void;
  /** Draw every room's merged furniture (null) or only the selected step's. */
  show(stepId: string | null): void;
  /** Mood face sprites, which the renderer scales with the room names. */
  readonly moods: readonly LWThree.Sprite[];
  /** Free every geometry, material, texture and canvas of the scene. */
  dispose(): void;
 }
 interface Api {create(T: LWThree.Module, scene: LWThree.Scene): Kit;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcess3DBake: LWProcess3DBake.Api; LWProcessRooms: LWProcessRooms.Api; LWProcess3DKit?: LWProcess3DKit.Api};
 type Piece = LWProcess3DBake.Piece;
 type Options = LWThree.MaterialOptions;
 /** A recorded fixed piece; `at` is the station offset that places it in the scene (zero inside other containers). */
 interface Entry {piece: Piece; key: string; at: readonly [number, number, number]}
 function create(T: LWThree.Module, scene: LWThree.Scene): LWProcess3DKit.Kit {
  const bake = root.LWProcess3DBake, shapes = new Map<string, LWThree.BufferGeometry>(), materials = new Map<string, LWThree.Material>();
  const textures: LWThree.Texture[] = [], canvases: HTMLCanvasElement[] = [], moods: LWThree.Sprite[] = [];
  const stations = new Map<string, LWThree.Group>(), stationOf = new Map<LWThree.Object3D, string>();
  const local = new Map<LWThree.Object3D, Entry[]>(), global = new Map<string, Entry[]>();
  const slices: {mesh: LWThree.Mesh; ranges: Map<string, [number, number]>}[] = [];
  let sealed = false;
  function shape(kind: string): LWThree.BufferGeometry {
   let g = shapes.get(kind);
   if (!g) {
    g = bake.shape(T, kind);
    shapes.set(kind, g);
   }
   return g;
  }
  function mat(color: string, extra: Options = {}): LWThree.Material {
   const key = color + JSON.stringify(extra);
   let m = materials.get(key);
   if (!m) {
    m = new T.MeshStandardMaterial({color, roughness: .8, ...extra});
    materials.set(key, m);
   }
   return m;
  }
  /** The white, vertex-coloured material of one merged class (its options are the JSON after the caster flag). */
  function classMaterial(key: string): LWThree.Material {
   return mat('#ffffff', {...JSON.parse(key.slice(2)) as Options, vertexColors: true});
  }
  function group(parent: LWThree.Object3D): LWThree.Group {
   const g = new T.Group();
   parent.add(g);
   return g;
  }
  /** Height of a container's origin above the ground, for the shadow rule. */
  function lift(parent: LWThree.Object3D): number {
   let y = 0;
   for (let o: LWThree.Object3D | null = parent; o && o !== scene; o = o.parent) y += o.position.y;
   return y;
  }
  function station(stepId: string, x: number, z: number): LWThree.Group {
   const g = group(scene);
   g.position.set(x, 0, z);
   g.userData.stepId = stepId;
   stations.set(stepId, g);
   stationOf.set(g, stepId);
   global.set(stepId, []);
   return g;
  }
  function piece(parent: LWThree.Object3D, kind: string, x: number, y: number, z: number, sx: number, sy: number, sz: number,
   color: string, _rotation = 0, extra: Options = {}): LWThree.Mesh {
   const mesh = new T.Mesh(shape(kind), mat(color, extra));
   mesh.position.set(x, y, z);
   mesh.scale.set(sx, sy, sz);
   mesh.castShadow = bake.caster({kind, x, y, z, sx, sy, sz, color}, lift(parent));
   mesh.receiveShadow = true;
   parent.add(mesh);
   return mesh;
  }
  function fixed(parent: LWThree.Object3D, kind: string, x: number, y: number, z: number, sx: number, sy: number, sz: number,
   color: string, extra: Options = {}, turn?: LWThree.Turn): void {
   if (sealed) throw Error('Fixed pieces are added before the 3D scene is sealed.');
   const piece: Piece = turn ? {kind, x, y, z, sx, sy, sz, color, turn} : {kind, x, y, z, sx, sy, sz, color};
   const key = (bake.caster(piece, lift(parent)) ? '1|' : '0|') + JSON.stringify(extra), stepId = stationOf.get(parent);
   if (stepId !== undefined) {
    const p = parent.position;
    global.get(stepId)!.push({piece, key, at: [p.x, p.y, p.z]});
   } else {
    let list = local.get(parent);
    if (!list) {
     list = [];
     local.set(parent, list);
    }
    list.push({piece, key, at: [0, 0, 0]});
   }
  }
  const byKey = (entries: readonly Entry[]) => {
   const out = new Map<string, Entry[]>();
   for (const e of entries) {
    const list = out.get(e.key);
    if (list) list.push(e); else out.set(e.key, [e]);
   }
   return out;
  };
  const placed = (e: Entry): Piece => ({...e.piece, x: e.piece.x + e.at[0], y: e.piece.y + e.at[1], z: e.piece.z + e.at[2]});
  function merged(geometry: LWThree.BufferGeometry, key: string): LWThree.Mesh {
   const mesh = new T.Mesh(geometry, classMaterial(key));
   mesh.castShadow = key.startsWith('1');
   mesh.receiveShadow = true;
   return mesh;
  }
  function seal(): void {
   if (sealed) return;
   sealed = true;
   for (const [container, entries] of local) for (const [key, list] of byKey(entries)) {
    const mesh = merged(bake.bake(T, shape, [list.map(e => e.piece)]).geometry, key);
    mesh.userData.pieces = list.length;
    mesh.userData.shape = bake.fingerprint(list.map(e => e.piece));
    container.add(mesh);
   }
   const ids = [...global.keys()], keys = new Set([...global.values()].flatMap(list => list.map(e => e.key)));
   for (const key of keys) {
    const groups = ids.map(id => global.get(id)!.filter(e => e.key === key).map(placed));
    const baked = bake.bake(T, shape, groups), mesh = merged(baked.geometry, key), ranges = new Map<string, [number, number]>();
    ids.forEach((id, i) => ranges.set(id, baked.ranges[i]!));
    mesh.userData.merged = 'stations';
    scene.add(mesh);
    slices.push({mesh, ranges});
   }
   for (const [id, g] of stations) {
    const pieces = global.get(id)!.map(e => e.piece);
    g.userData.pieces = pieces.length;
    g.userData.shape = bake.fingerprint(pieces);
   }
   local.clear();
   global.clear();
  }
  function show(stepId: string | null): void {
   for (const {mesh, ranges} of slices) {
    const [start, count] = stepId === null ? [0, Infinity] : ranges.get(stepId) ?? [0, 0];
    mesh.visible = count > 0;
    mesh.geometry.setDrawRange(start, count);
   }
  }
  function canvas(width: number, height: number): HTMLCanvasElement {
   const c = document.createElement('canvas');
   c.width = width;
   c.height = height;
   canvases.push(c);
   return c;
  }
  function texture(c: HTMLCanvasElement): LWThree.Texture {
   const t = new T.CanvasTexture(c);
   textures.push(t);
   return t;
  }
  /** Lit front-facing text plate for automated rooms and touchpoints; the displayed text is also kept in `userData.signText`. */
  function sign(parent: LWThree.Object3D, text: string, x: number, y: number, z: number, width: number, height: number,
   accent: string): LWThree.Mesh {
   const c = canvas(512, Math.max(64, Math.round(512 * height / width))), ctx = c.getContext('2d')!;
   ctx.fillStyle = '#10161f';
   ctx.fillRect(0, 0, c.width, c.height);
   ctx.strokeStyle = accent;
   ctx.lineWidth = 10;
   ctx.strokeRect(5, 5, c.width - 10, c.height - 10);
   let size = Math.round(c.height * .5);
   ctx.font = `700 ${size}px system-ui`;
   while (size > 14 && ctx.measureText(text).width > c.width - 44) {
    size -= 2;
    ctx.font = `700 ${size}px system-ui`;
   }
   ctx.fillStyle = '#f4f7fb';
   ctx.textAlign = 'center';
   ctx.textBaseline = 'middle';
   ctx.fillText(text, c.width / 2, c.height / 2 + 2, c.width - 44);
   const plate = new T.MeshBasicMaterial({map: texture(c), toneMapped: false});
   materials.set('sign-' + materials.size, plate);
   const mesh = new T.Mesh(new T.PlaneGeometry(width, height), plate);
   mesh.position.set(x, y, z + .08);
   mesh.userData.signText = text;
   parent.add(mesh);
   fixed(parent, 'box', x, y, z, width + .12, height + .12, .1, '#0a0e14');
   return mesh;
  }
  /** Floating mood face for an authored `emotion`: one shared canvas texture per level, from the room module's seven-level table. */
  const moodMaterials = new Map<number, LWThree.SpriteMaterial>();
  function moodMaterial(level: number): LWThree.SpriteMaterial {
   const known = moodMaterials.get(level);
   if (known) return known;
   const table = root.LWProcessRooms.moods, mood = table.find(m => m.level === level) ?? table[3]!;
   const c = canvas(128, 128), ctx = c.getContext('2d')!;
   ctx.scale(1.28, 1.28);
   ctx.fillStyle = mood.color;
   ctx.strokeStyle = '#13181f';
   ctx.lineCap = 'round';
   ctx.lineWidth = 5;
   ctx.beginPath();
   ctx.arc(50, 50, 46, 0, Math.PI * 2);
   ctx.fill();
   ctx.stroke();
   ctx.fillStyle = '#13181f';
   for (const x of [35, 65]) {
    ctx.beginPath();
    ctx.arc(x, 40, 5.5, 0, Math.PI * 2);
    ctx.fill();
   }
   ctx.lineWidth = 5;
   if (mood.brow) ctx.stroke(new Path2D(mood.brow));
   const mouth = new Path2D(mood.mouth);
   if (mood.open) ctx.fill(mouth);
   ctx.stroke(mouth);
   const m = new T.SpriteMaterial({map: texture(c), transparent: true, depthTest: false, depthWrite: false, toneMapped: false});
   materials.set('mood-' + level, m);
   moodMaterials.set(level, m);
   return m;
  }
  function mood(parent: LWThree.Object3D, level: number): LWThree.Sprite {
   const table = root.LWProcessRooms.moods, face = table.find(m => m.level === level) ?? table[3]!;
   const sprite = new T.Sprite(moodMaterial(level));
   sprite.renderOrder = 21;
   sprite.center.set(.5, 0);
   sprite.scale.set(2.2, 2.2, 1);
   sprite.position.set(0, 6.4, -2.2);
   sprite.userData.mood = {level, label: face.label};
   parent.add(sprite);
   moods.push(sprite);
   return sprite;
  }
  function dispose(): void {
   const geometries = new Set<LWThree.BufferGeometry>(shapes.values()), all = new Set<LWThree.Material>(materials.values());
   scene.traverse(o => {
    const mesh = o as Partial<LWThree.Mesh>;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) all.add(mesh.material);
   });
   geometries.forEach(g => g.dispose());
   all.forEach(m => m.dispose());
   textures.forEach(t => t.dispose());
   // Zero-sized canvases release their pixel memory at once rather than at the next collection.
   for (const c of canvases) {
    c.width = 0;
    c.height = 0;
   }
   textures.length = 0;
   canvases.length = 0;
  }
  return {T, mat, group, piece, fixed, sign, mood, station, shape, seal, show, moods, dispose};
 }
 root.LWProcess3DKit = Object.freeze({create});
})(globalThis);
