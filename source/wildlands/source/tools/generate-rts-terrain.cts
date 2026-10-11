/// <reference path="../rts-contracts.d.ts" />
/// <reference path="../rts-mission-editor-data.ts" />
/**
 * Terrain half of `wildlands generate rts-mission`: a point-symmetric tile field (value-noise
 * octaves ranked into catalog terrain classes), symmetric carving and the projection of the tile
 * field into canonical terrain patches through the mission editor's own normalisation
 * (`LWRTSMissionEditorData.paint`). Only terrain records that already exist in the catalog are used.
 */
import type {Random} from './generate-random.cjs';

/** Terrain roles a preset asks for, mapped onto existing catalog terrain records. */
export type TerrainRole = 'open' | 'cover' | 'water' | 'blocked' | 'fast';
export type TerrainClasses = Readonly<Record<TerrainRole, string | null>> & {readonly open: string};
export interface FieldPreset {
 /** Base noise period in tiles and number of octaves (each halves the period). */
 readonly period: number;
 readonly octaves: number;
 /** Fractions of the map (lowest ranked values) that become water, and the rank thresholds of cover and blocked terrain. */
 readonly water: number;
 readonly cover: number;
 readonly blocked: number;
 readonly falloff: 'none' | 'island';
 /** A sinuous water band across the map with this half width in tiles and point-symmetric fords. */
 readonly river: null | {readonly halfWidth: number; readonly amplitude: number; readonly fords: number};
}

export class GenerateError extends Error {
 constructor(readonly code: string, message: string, readonly exit: 1 | 2 = 1) { super(message); }
}

/** Pick existing catalog terrain for each role; the open role prefers the reference mission's default terrain. */
export function terrainClasses(catalog: LWRTSData.Catalog): TerrainClasses {
 const land = (terrain: LWRTSData.Terrain): boolean => terrain.passable.includes('land');
 const reference = catalog.terrain.find(terrain => terrain.id === catalog.missions[0]?.defaultTerrain);
 const open = reference && land(reference) ? reference : catalog.terrain.find(terrain => land(terrain) && terrain.cover === 0 && terrain.speedFactor <= 1) ?? catalog.terrain.find(land);
 if (!open) throw new GenerateError('unsupported-catalog', 'The RTS catalog has no terrain that land units can cross; a playable mission needs one.');
 const others = catalog.terrain.filter(terrain => terrain.id !== open.id);
 return {
  open: open.id,
  cover: others.find(terrain => land(terrain) && terrain.cover > 0)?.id ?? null,
  water: others.find(terrain => terrain.passable.includes('water') && !land(terrain))?.id ?? null,
  blocked: others.find(terrain => !land(terrain) && !terrain.passable.includes('water'))?.id ?? null,
  fast: others.find(terrain => land(terrain) && terrain.speedFactor > 1)?.id ?? null
 };
}

/** Width x height grid of terrain ids, row-major; every write also writes the point mirror. */
export class TileField {
 readonly tiles: string[];
 constructor(readonly width: number, readonly height: number, fill: string) { this.tiles = Array<string>(width * height).fill(fill); }
 get(x: number, y: number): string { return this.tiles[y * this.width + x]!; }
 inside(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.width && y < this.height; }
 /** Set a cell and its point mirror (W-1-x, H-1-y), keeping the field symmetric. */
 set(x: number, y: number, terrain: string): void {
  if (!this.inside(x, y)) return;
  this.tiles[y * this.width + x] = terrain;
  this.tiles[(this.height - 1 - y) * this.width + (this.width - 1 - x)] = terrain;
 }
}

/** Smooth value noise: one lattice of keyed values per octave, bilinear with smoothstep weights. */
function valueNoise(width: number, height: number, preset: FieldPreset, random: Random): Float64Array {
 const out = new Float64Array(width * height);
 let total = 0;
 for (let octave = 0; octave < preset.octaves; octave++) {
  const period = Math.max(2, preset.period / 2 ** octave), amplitude = 0.5 ** octave, stream = random.fork('noise/' + octave);
  const columns = Math.ceil(width / period) + 2, rows = Math.ceil(height / period) + 2;
  const lattice = Array.from({length: columns * rows}, () => stream.next());
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
   const gx = x / period, gy = y / period, ix = Math.floor(gx), iy = Math.floor(gy), tx = smooth(gx - ix), ty = smooth(gy - iy);
   const at = (cx: number, cy: number): number => lattice[cy * columns + cx]!;
   const top = at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx, bottom = at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx;
   out[y * width + x] = out[y * width + x]! + amplitude * (top * (1 - ty) + bottom * ty);
  }
  total += amplitude;
 }
 for (let index = 0; index < out.length; index++) out[index] = out[index]! / total;
 return out;
}

/** Centre line of the river preset; odd about the map centre so the band is point-symmetric. */
function riverCentre(x: number, width: number, height: number, amplitude: number): number {
 return (height - 1) / 2 + amplitude * Math.sin(2 * Math.PI * (x - (width - 1) / 2) / Math.max(8, width / 1.5));
}

/**
 * Classify the field by rank over mirror pairs: the lowest `water` fraction becomes water, ranks
 * from `cover` cover terrain and from `blocked` impassable ridges. Ranking pairs (not cells) keeps
 * both cells of a pair in one class, so the map is exactly point-symmetric.
 */
export function terrainField(width: number, height: number, preset: FieldPreset, classes: TerrainClasses, random: Random): TileField {
 const noise = valueNoise(width, height, preset, random), field = new TileField(width, height, classes.open);
 const pairs: {index: number; value: number}[] = [];
 const cx = (width - 1) / 2, cy = (height - 1) / 2, reach = Math.hypot(cx, cy) || 1;
 for (let index = 0; index < width * height; index++) {
  const x = index % width, y = Math.floor(index / width), mirror = (height - 1 - y) * width + (width - 1 - x);
  if (mirror < index) continue;
  let value = (noise[index]! + noise[mirror]!) / 2;
  if (preset.falloff === 'island') value = value * 0.45 + (1 - Math.hypot(x - cx, y - cy) / reach) * 0.55;
  pairs.push({index, value});
 }
 pairs.sort((a, b) => a.value - b.value || a.index - b.index);
 pairs.forEach((pair, rank) => {
  const fraction = rank / pairs.length, x = pair.index % width, y = Math.floor(pair.index / width);
  const role: TerrainRole = fraction < preset.water ? 'water' : fraction >= preset.blocked ? 'blocked' : fraction >= preset.cover ? 'cover' : 'open';
  field.set(x, y, classes[role] ?? classes.open);
 });
 if (preset.river && classes.water) {
  const {halfWidth, amplitude, fords} = preset.river;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
   if (Math.abs(y - riverCentre(x, width, height, amplitude)) <= halfWidth) field.set(x, y, classes.water);
  }
  // Fords: point-symmetric pairs of open (or road) crossings in the left half; their mirrors cross the right half.
  for (let ford = 0; ford < fords; ford++) {
   const fx = Math.round((ford + 1) * (width - 1) / (2 * fords + 1));
   for (let y = 0; y < height; y++) for (let x = fx - 1; x <= fx + 1; x++) {
    if (field.inside(x, y) && field.get(x, y) === classes.water && Math.abs(y - riverCentre(x, width, height, amplitude)) <= halfWidth + 1) field.set(x, y, classes.fast ?? classes.open);
   }
  }
 }
 return field;
}

/** Clear a square of the given half size around a centre (and its mirror) to open terrain. */
export function clearArea(field: TileField, centreX: number, centreY: number, half: number, terrain: string): void {
 for (let y = Math.floor(centreY - half); y <= Math.ceil(centreY + half); y++) for (let x = Math.floor(centreX - half); x <= Math.ceil(centreX + half); x++) field.set(x, y, terrain);
}

/** Carve a two-tile corridor from a cell to its point mirror (both halves at once). */
export function carveCorridor(field: TileField, fromX: number, fromY: number, terrain: string): number {
 const toX = field.width - 1 - fromX, toY = field.height - 1 - fromY, steps = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
 let carved = 0;
 for (let step = 0; step <= Math.ceil(steps / 2); step++) {
  const x = Math.round(fromX + (toX - fromX) * step / (steps || 1)), y = Math.round(fromY + (toY - fromY) * step / (steps || 1));
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]] as const) if (field.inside(x + dx, y + dy) && field.get(x + dx, y + dy) !== terrain) { field.set(x + dx, y + dy, terrain); carved++; }
 }
 return carved;
}

/** Cells reachable from a start cell over terrain that `passable` admits (4-neighbour flood fill). */
export function reachable(field: TileField, startX: number, startY: number, passable: (terrain: string) => boolean): Uint8Array {
 const seen = new Uint8Array(field.width * field.height), queue = [startY * field.width + startX];
 if (!passable(field.get(startX, startY))) return seen;
 seen[queue[0]!] = 1;
 for (let head = 0; head < queue.length; head++) {
  const index = queue[head]!, x = index % field.width, y = Math.floor(index / field.width);
  for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
   if (!field.inside(nx, ny)) continue;
   const next = ny * field.width + nx;
   if (!seen[next] && passable(field.get(nx, ny))) { seen[next] = 1; queue.push(next); }
  }
 }
 return seen;
}

/**
 * Canonical terrain patches of a tile field: row runs of non-default terrain, normalised by the
 * mission editor's paint projection (vertical merging of equal runs, 4096 patch limit).
 */
export function terrainPatches(field: TileField, defaultTerrain: string): LWRTSData.TerrainPatch[] {
 const runs: LWRTSData.TerrainPatch[] = [];
 for (let y = 0; y < field.height; y++) {
  for (let x = 0; x < field.width;) {
   const terrain = field.get(x, y), start = x;
   while (x < field.width && field.get(x, y) === terrain) x++;
   if (terrain !== defaultTerrain) runs.push({terrain, x: start, y, width: x - start, height: 1});
  }
 }
 if (!runs.length) return [];
 const editor = require('../rts-mission-editor-data.js') as LWRTSMissionEditorData.Api;
 const draft = {width: field.width, height: field.height, defaultTerrain, terrain: runs.slice(0, -1)} as unknown as LWRTSData.Mission;
 try { return editor.paint(draft, runs[runs.length - 1]!); }
 catch (error) { throw new GenerateError('generate-budget', (error instanceof Error ? error.message : String(error)) + ' Choose a smaller map or a calmer preset.'); }
}
