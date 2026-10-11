/** Portable native material finishes. Byte parity with Model Forge is a versioned contract. */
namespace LWAssetFinishContract {
 export interface Finish {version:1;kind:'painted-metal'|'bare-metal'|'rubber';seed:number;scale:number;wear:number;palette?:string[];}
 export interface Pixels {width:number;height:number;color:Uint8Array;normal:Uint8Array;orm:Uint8Array;}
 export interface Api {readonly algorithmVersion:'forge-finish-v1';key(finish:Finish):string;validate(value:unknown):Finish;generate(finish:Finish):Pixels;}
}
(function(input:unknown){
 const root=input as {LWAssetFinish?:LWAssetFinishContract.Api};
type FinishSpec=LWAssetFinishContract.Finish;

/** Immutable v1 recipe. Generic runtimes must retain byte parity before accepting this version. */
const finishAlgorithm = 'forge-finish-v1';
const SIZE = 128;
function noise(x: number, y: number, seed: number): number {
  let n = Math.imul(x ^ seed, 374761393) ^ Math.imul(y + seed, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
/** Periodic value noise keeps the tile boundary continuous at every octave. */
function field(x: number, y: number, cells: number, seed: number): number {
  const px = (x / SIZE) * cells,
    py = (y / SIZE) * cells;
  const ix = Math.floor(px),
    iy = Math.floor(py);
  const tx = px - ix,
    ty = py - iy;
  const sx = tx * tx * (3 - 2 * tx),
    sy = ty * ty * (3 - 2 * ty);
  const sample = (dx: number, dy: number) => noise((ix + dx) % cells, (iy + dy) % cells, seed);
  return (
    (sample(0, 0) * (1 - sx) + sample(1, 0) * sx) * (1 - sy) +
    (sample(0, 1) * (1 - sx) + sample(1, 1) * sx) * sy
  );
}
/** Inspect data properties before reading them, including direct renderer overrides. */
function validate(value:unknown):FinishSpec {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid bounded material finish');
  const fields=Object.getOwnPropertyDescriptors(value),allowed=['version','kind','seed','scale','wear','palette'];
  if(Object.keys(fields).some(key=>!allowed.includes(key)||!('value' in fields[key]!))||
    allowed.slice(0,5).some(key=>!Object.hasOwn(fields,key)))throw Error('Invalid bounded material finish');
  const finish=Object.fromEntries(allowed.slice(0,5).map(key=>[key,fields[key]!.value])) as unknown as FinishSpec;
  const palette=fields.palette?.value as unknown;
  if(palette!==undefined){
    if(!Array.isArray(palette)||palette.length<1||palette.length>4)throw Error('Invalid bounded material finish');
    const entries=Object.getOwnPropertyDescriptors(palette),colors:string[]=[];
    if(Object.keys(entries).length!==palette.length+1)throw Error('Invalid bounded material finish');
    for(let i=0;i<palette.length;i++){
      const entry=entries[String(i)];
      if(!entry||!('value' in entry)||typeof entry.value!=='string')throw Error('Invalid bounded material finish');
      colors.push(entry.value);
    }
    finish.palette=colors;
  }
  if (
    finish.version !== 1 ||
    (typeof finish.kind !== 'string' || !['painted-metal', 'bare-metal', 'rubber'].includes(finish.kind)) ||
    !Number.isInteger(finish.seed) ||
    finish.seed < 0 ||
    finish.seed > 65535 ||
    !Number.isFinite(finish.scale) ||
    finish.scale < 1 ||
    finish.scale > 16 ||
    !Number.isFinite(finish.wear) ||
    finish.wear < 0 ||
    finish.wear > 1 ||
    (finish.palette !== undefined &&
      (!Array.isArray(finish.palette) ||
        finish.palette.length < 1 ||
        finish.palette.length > 4 ||
        finish.palette.some((color) => typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color))))
  )
    throw Error('Invalid bounded material finish');
  return finish;
}
/** Color is sRGB; normals and roughness(G)/metalness(B) are linear data, with opaque alpha. */
function generateFinish(input: FinishSpec): {
  width: number;
  height: number;
  color: Uint8Array;
  normal: Uint8Array;
  orm: Uint8Array;
} {
  const finish=validate(input);
  const color = new Uint8Array(SIZE * SIZE * 4),
    normal = new Uint8Array(color.length);
  const orm = new Uint8Array(color.length),
    heights = new Float64Array(SIZE * SIZE);
  const palette = (finish.palette ?? ['#ffffff']).map((color) =>
    [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)),
  );
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const grain = noise(x, y, finish.seed),
        index = y * SIZE + x,
        offset = index * 4;
      const patches =
        field(x, y, 4, finish.seed + 11) * 0.7 + field(x, y, 8, finish.seed + 17) * 0.3;
      const chips = field(x, y, 16, finish.seed + 31);
      const worn = finish.wear * (chips > 0.69 ? (chips - 0.69) / 0.31 : 0);
      const scratch =
        noise(x, Math.floor(y / 8), finish.seed + 47) > 0.987
          ? finish.wear * (0.35 + 0.65 * grain)
          : 0;
      const exposed = Math.min(1, worn * 5 + scratch);
      const swatch = palette[Math.min(palette.length - 1, Math.floor(patches * palette.length))]!;
      const metal =
        finish.kind === 'bare-metal' ? 1 : finish.kind === 'painted-metal' ? exposed : 0;
      const shade = finish.kind === 'rubber' ? 0.91 + 0.07 * grain : 0.94 + 0.06 * grain;
      const roughness =
        finish.kind === 'rubber'
          ? 0.88 + 0.12 * grain
          : finish.kind === 'bare-metal'
            ? 0.42 + 0.22 * grain + 0.18 * finish.wear
            : 0.78 + 0.16 * grain - 0.35 * exposed;
      for (let channel = 0; channel < 3; channel++) {
        const painted = swatch[channel]! * shade;
        color[offset + channel] = Math.round(
          finish.kind === 'painted-metal'
            ? painted * (1 - exposed) + (112 + 30 * grain) * exposed
            : painted,
        );
      }
      color[offset + 3] = 255;
      orm.set([255, Math.round(roughness * 255), Math.round(metal * 255), 255], offset);
      heights[index] = (grain - 0.5) * (finish.kind === 'rubber' ? 0.1 : 0.04) - exposed * 0.15;
    }
  const height = (x: number, y: number) =>
    heights[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)]!;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const dx = height(x - 1, y) - height(x + 1, y),
        dy = height(x, y - 1) - height(x, y + 1);
      const length = Math.hypot(dx, dy, 1);
      normal.set(
        [
          Math.round(((dx / length) * 0.5 + 0.5) * 255),
          Math.round(((dy / length) * 0.5 + 0.5) * 255),
          Math.round(((1 / length) * 0.5 + 0.5) * 255),
          255,
        ],
        (y * SIZE + x) * 4,
      );
    }
  return { width: SIZE, height: SIZE, color, normal, orm };
}

 function key(input:FinishSpec):string{const finish=validate(input);return JSON.stringify([finish.version,finish.kind,finish.seed,finish.scale,finish.wear,finish.palette??['#ffffff']]);}
 const api=Object.freeze({algorithmVersion:finishAlgorithm,key,validate,generate:generateFinish});root.LWAssetFinish=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
