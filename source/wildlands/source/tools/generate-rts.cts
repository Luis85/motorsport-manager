/// <reference path="../rts-contracts.d.ts" />
/**
 * `wildlands generate rts-mission`: one playable mission from the archetypes, items, resources and
 * terrain an RTS catalog already has. Layout values (map size, terrain fractions, starting roster
 * size, deposit and encounter counts) come from the named preset; gameplay values (unit and
 * building stats, costs, deposit amounts) are never invented: deposit amounts reuse the catalog's
 * existing missions and encounter budgets are measured in the catalog's own unit costs.
 *
 * The map is point-symmetric: terrain, bases, deposits, item drops and encounters of the second
 * half mirror the first, so the two bases start on equal terms. The result is a pure function of
 * the catalog and the effective recipe.
 */
import {createRandom, type Random} from './generate-random.cjs';
import {GenerateError, TileField, carveCorridor, clearArea, reachable, terrainClasses, terrainField, terrainPatches, type FieldPreset, type TerrainClasses} from './generate-rts-terrain.cjs';

export interface RtsPreset {
 readonly description: string;
 readonly width: number;
 readonly height: number;
 readonly field: FieldPreset;
 /** Connect the bases with a road (fast terrain) even when they are already connected. */
 readonly road: boolean;
 /** Starting roster of each base: workers and guards (the faction's preferred AI unit). */
 readonly workers: number;
 readonly guards: number;
 /** Per half of the map: extra resource deposits beyond one home deposit per resource, item drops and Poisson spacing in tiles. */
 readonly deposits: number;
 readonly items: number;
 readonly spacing: number;
}
/** Presets are layout data, reported by `generate discover`. */
export const RTS_PRESETS: Readonly<Record<string, RtsPreset>> = Object.freeze({
 skirmish: {description: 'Open grassland with scattered woods, ridges and ponds; bases in opposite corners.', width: 40, height: 32, road: false, workers: 3, guards: 2, deposits: 3, items: 1, spacing: 5,
  field: {period: 10, octaves: 3, water: 0.08, cover: 0.68, blocked: 0.9, falloff: 'none', river: null}},
 island: {description: 'One island in open water; the bases share its shores.', width: 48, height: 40, road: false, workers: 3, guards: 2, deposits: 3, items: 2, spacing: 5,
  field: {period: 12, octaves: 4, water: 0.4, cover: 0.74, blocked: 0.93, falloff: 'island', river: null}},
 frontier: {description: 'Dense woodland and ridges crossed by a road between the bases.', width: 48, height: 36, road: true, workers: 3, guards: 2, deposits: 4, items: 2, spacing: 6,
  field: {period: 8, octaves: 4, water: 0.05, cover: 0.5, blocked: 0.86, falloff: 'none', river: null}},
 river: {description: 'A winding river splits the map; fords are the only land crossings.', width: 48, height: 36, road: false, workers: 3, guards: 2, deposits: 3, items: 1, spacing: 5,
  field: {period: 10, octaves: 3, water: 0, cover: 0.72, blocked: 0.94, falloff: 'none', river: {halfWidth: 1.5, amplitude: 3, fords: 2}}}
});
export const RTS_LIMITS = Object.freeze({width: [16, 128] as const, height: [16, 128] as const, difficulty: [1, 5] as const, encounterGroupsPerHalf: 6, groupSize: 9});

/** The effective, replayable recipe of one rts-mission generation (`--recipe` shape). */
export interface RtsRecipe {
 schemaVersion: 1; generator: 'rts-mission'; mission: string; seed: number; preset: string; width: number; height: number; difficulty: number;
 name?: string; playerFaction?: string; opponentFaction?: string; neutralFaction?: string;
}
export interface RtsGeneration {mission: LWRTSData.Mission; summary: Record<string, unknown>;}

type Point = {x: number; y: number};
const value = (cost: LWRTSData.Cost): number => Math.max(1, Object.values(cost).reduce((sum, amount) => sum + amount, 0));
const median = (values: number[]): number | null => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor((sorted.length - 1) / 2)]!; };
const title = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

function factions(catalog: LWRTSData.Catalog, recipe: RtsRecipe): {player: LWRTSData.Faction; opponent: LWRTSData.Faction; neutral: LWRTSData.Faction} {
 const find = (id: string | undefined, label: string): LWRTSData.Faction | undefined => {
  if (id === undefined) return undefined;
  const found = catalog.factions.find(faction => faction.id === id);
  if (!found) throw new GenerateError('unknown-reference', `Unknown ${label} faction ${id}; choose one of ${catalog.factions.map(faction => faction.id).join(', ')}.`, 2);
  return found;
 };
 const reference = catalog.missions[0]?.playerFaction;
 const player = find(recipe.playerFaction, 'player') ?? catalog.factions.find(faction => faction.id === reference) ?? catalog.factions.find(faction => !faction.ai.enabled) ?? catalog.factions[0]!;
 const opponent = find(recipe.opponentFaction, 'opponent') ?? catalog.factions.find(faction => faction.id !== player.id && faction.ai.enabled) ?? catalog.factions.find(faction => faction.id !== player.id);
 if (!opponent) throw new GenerateError('unsupported-catalog', 'A generated mission needs two factions; the catalog has one.');
 if (opponent.id === player.id) throw new GenerateError('unknown-reference', 'The opponent faction must differ from the player faction.', 2);
 const neutral = find(recipe.neutralFaction, 'neutral') ?? catalog.factions.find(faction => faction.id !== player.id && faction.id !== opponent.id) ?? opponent;
 return {player, opponent, neutral};
}

/** Base archetypes of a faction: a headquarters (largest storage), a producer of its preferred unit, a worker and its guard unit. */
function roster(catalog: LWRTSData.Catalog, faction: LWRTSData.Faction): {hq: LWRTSData.Building | null; producer: LWRTSData.Building | null; worker: LWRTSData.Unit | null; guard: LWRTSData.Unit | null} {
 const buildings = faction.buildings.map(id => catalog.buildings.find(building => building.id === id)!).filter(building => building.footprint.width <= 4 && building.footprint.height <= 4);
 const units = faction.units.map(id => catalog.units.find(unit => unit.id === id)!).filter(unit => unit.movement === 'land');
 const hq = [...buildings].sort((a, b) => b.storage.length - a.storage.length || buildings.indexOf(a) - buildings.indexOf(b))[0] ?? null;
 const worker = units.find(unit => unit.role === 'worker' && (!hq || hq.produces.includes(unit.id))) ?? units.find(unit => unit.role === 'worker') ?? null;
 const guard = units.find(unit => unit.id === faction.ai.preferredUnit && unit.attack) ?? units.find(unit => unit.attack && unit.role !== 'worker') ?? null;
 const producer = guard ? buildings.find(building => building !== hq && building.produces.includes(guard.id)) ?? null : null;
 return {hq, producer, worker, guard};
}

/** Dart-throwing Poisson-disk sites in the first half of the map (cells before their mirror), each with its mirror. */
function poissonSites(field: TileField, random: Random, count: number, spacing: number, avoid: Point[], accept: (x: number, y: number) => boolean): Point[] {
 const sites: Point[] = [], mirror = (p: Point): Point => ({x: field.width - 1 - p.x, y: field.height - 1 - p.y});
 const taken = (): Point[] => [...avoid, ...sites, ...sites.map(mirror)];
 for (let attempt = 0; attempt < count * 60 && sites.length < count; attempt++) {
  const x = random.int(1, field.width - 2), y = random.int(1, field.height - 2);
  if (y * field.width + x >= (field.height - 1 - y) * field.width + (field.width - 1 - x)) continue;
  const site = {x, y};
  if (!accept(x, y) || Math.hypot(x - mirror(site).x, y - mirror(site).y) < spacing) continue;
  if (taken().some(other => Math.hypot(other.x - x, other.y - y) < spacing)) continue;
  sites.push(site);
 }
 return sites;
}

export function generateMission(catalog: LWRTSData.Catalog, recipe: RtsRecipe): RtsGeneration {
 const preset = RTS_PRESETS[recipe.preset];
 if (!preset) throw new GenerateError('unknown-preset', 'Unknown preset ' + recipe.preset + '.', 2);
 const random = createRandom(recipe.seed, 'rts-mission|' + recipe.preset), {width, height} = recipe;
 const sides = factions(catalog, recipe), classes: TerrainClasses = terrainClasses(catalog);
 const terrainById = new Map(catalog.terrain.map(terrain => [terrain.id, terrain]));
 const passes = (movement: LWRTSData.Movement) => (terrain: string): boolean => terrainById.get(terrain)!.passable.includes(movement);
 const field = terrainField(width, height, preset.field, classes, random.fork('terrain'));
 const home = roster(catalog, sides.player), away = roster(catalog, sides.opponent);
 const footprint = (building: LWRTSData.Building | null) => building ? building.footprint : {width: 1, height: 1};
 // Base anchor: the top-left cell of the headquarters footprint; the opponent base is its point mirror.
 const hqSize = {width: Math.max(footprint(home.hq).width, footprint(away.hq).width), height: Math.max(footprint(home.hq).height, footprint(away.hq).height)};
 const anchor = {x: Math.max(1, Math.round(width * 0.12)), y: Math.max(1, Math.round(height * 0.14))};
 const centre = {x: anchor.x + hqSize.width / 2, y: anchor.y + hqSize.height / 2};
 const baseHalf = Math.max(4, hqSize.width + 2);
 clearArea(field, centre.x, centre.y + 1, baseHalf, classes.open);
 const hqCell = {x: Math.floor(centre.x), y: Math.floor(centre.y)}, mirrorCell = {x: width - 1 - hqCell.x, y: height - 1 - hqCell.y};
 const land = passes('land');
 let carved = 0;
 if (preset.road && classes.fast) carved += carveCorridor(field, hqCell.x, hqCell.y, classes.fast);
 if (!reachable(field, hqCell.x, hqCell.y, land)[mirrorCell.y * width + mirrorCell.x]) carved += carveCorridor(field, hqCell.x, hqCell.y, classes.fast ?? classes.open);
 const connected = reachable(field, hqCell.x, hqCell.y, land);
 if (!connected[mirrorCell.y * width + mirrorCell.x]) throw new GenerateError('generation-failed', 'The generated bases are not connected by land; try another seed.');
 const spawns: LWRTSData.Spawn[] = [], buildingsPlaced: {x: number; y: number; width: number; height: number}[] = [];
 const mirrorUnit = (p: Point): Point => ({x: width - 1 - p.x, y: height - 1 - p.y}), occupied: Point[] = [];
 // Records place units, deposits and items at tile centres, so the point mirror (W - x, H - y) of a position is the centre of the mirrored tile.
 const centred = (p: Point): Point => ({x: p.x + 0.5, y: p.y + 0.5});
 const addBase = (faction: LWRTSData.Faction, base: ReturnType<typeof roster>, mirrored: boolean): void => {
  const at = (p: Point): Point => { const cell = mirrored ? mirrorUnit(p) : p; occupied.push(cell); return centred(cell); };
  if (base.hq) {
   const c = mirrored ? {x: width - centre.x, y: height - centre.y} : centre;
   spawns.push({archetype: base.hq.id, faction: faction.id, x: c.x, y: c.y, count: 1}); buildingsPlaced.push({...c, ...base.hq.footprint});
  }
  if (base.producer) {
   const size = base.producer.footprint, local = {x: anchor.x + size.width / 2, y: anchor.y + hqSize.height + 1 + size.height / 2};
   const c = mirrored ? {x: width - local.x, y: height - local.y} : local;
   if (local.y + size.height / 2 <= height / 2) {spawns.push({archetype: base.producer.id, faction: faction.id, x: c.x, y: c.y, count: 1}); buildingsPlaced.push({...c, ...size});}
  }
  const side = {x: anchor.x + hqSize.width + 1, y: anchor.y};
  if (base.worker && preset.workers > 0) spawns.push({archetype: base.worker.id, faction: faction.id, ...at(side), count: preset.workers});
  if (base.guard && preset.guards > 0) spawns.push({archetype: base.guard.id, faction: faction.id, ...at({x: side.x, y: side.y + 2}), count: preset.guards});
 };
 addBase(sides.player, home, false); addBase(sides.opponent, away, true);
 if (!spawns.some(spawn => spawn.faction === sides.player.id)) throw new GenerateError('unsupported-catalog', `Faction ${sides.player.id} has no land unit or building of at most 4x4 tiles to start a base with.`);
 const clearOfBuildings = (x: number, y: number): boolean => buildingsPlaced.every(b => Math.abs(b.x - x) >= b.width / 2 + 1 || Math.abs(b.y - y) >= b.height / 2 + 1);
 const usable = (x: number, y: number): boolean => field.inside(x, y) && connected[y * width + x] === 1 && clearOfBuildings(x + 0.5, y + 0.5) && !occupied.some(cell => cell.x === x && cell.y === y);
 /** A group of up to nine units spreads over the tile and its neighbours (spawn expansion), so the 3x3 block around it must be usable. */
 const roomy = (x: number, y: number): boolean => [-1, 0, 1].every(dy => [-1, 0, 1].every(dx => usable(x + dx, y + dy)));
 // Deposits: one home deposit per resource near each base, then Poisson sites; amounts reuse the catalog's existing missions.
 const amountOf = (resource: string): number => median(catalog.missions.flatMap(mission => mission.deposits.filter(deposit => deposit.resource === resource).map(deposit => deposit.amount)))
  ?? median(catalog.missions.flatMap(mission => mission.deposits.map(deposit => deposit.amount)))
  ?? Math.max(1, ...catalog.factions.map(faction => faction.startingResources[resource] ?? 0)) * 4;
 const homeRandom = random.fork('home-deposits'), deposits: LWRTSData.Deposit[] = [], depositSites: Point[] = [];
 const ring: Point[] = [];
 for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const distance = Math.max(Math.abs(x + 0.5 - centre.x), Math.abs(y + 0.5 - centre.y));
  if (distance >= 3.5 && distance <= 6.5 && y * width + x < (height - 1 - y) * width + (width - 1 - x) && usable(x, y)) ring.push({x, y});
 }
 for (const resource of catalog.resources) {
  const options = ring.filter(p => depositSites.every(other => Math.hypot(other.x - p.x, other.y - p.y) >= 2));
  if (!options.length) break;
  const site = homeRandom.pick(options); depositSites.push(site); deposits.push({resource: resource.id, ...site, amount: amountOf(resource.id)});
 }
 const avoidBases = [hqCell, mirrorCell];
 const extra = poissonSites(field, random.fork('deposits'), preset.deposits, preset.spacing, [...avoidBases, ...depositSites, ...depositSites.map(mirrorUnit)], (x, y) => usable(x, y) && Math.hypot(x - hqCell.x, y - hqCell.y) >= baseHalf + 2);
 const resourcePick = random.fork('deposit-resources');
 for (const site of extra) { const resource = resourcePick.pick(catalog.resources); depositSites.push(site); deposits.push({resource: resource.id, ...site, amount: amountOf(resource.id)}); }
 const placedDeposits = [...deposits, ...deposits.map(deposit => ({...deposit, ...mirrorUnit(deposit)}))].map(deposit => ({...deposit, ...centred(deposit)}));
 // Encounters: the neutral faction's land combat units, within a budget of `difficulty` times the opponent's preferred unit cost per half.
 const preferred = catalog.units.find(unit => unit.id === sides.opponent.ai.preferredUnit)!;
 const eligible = sides.neutral.units.map(id => catalog.units.find(unit => unit.id === id)!).filter(unit => unit.movement === 'land' && unit.attack && unit.role !== 'worker');
 const creatures = eligible.filter(unit => unit.role === 'creature'), pool = creatures.length ? creatures : eligible;
 const budget = recipe.difficulty * value(preferred.cost), encounterRandom = random.fork('encounters'), groups: LWRTSData.Spawn[] = [];
 const encounterSites = poissonSites(field, random.fork('encounter-sites'), RTS_LIMITS.encounterGroupsPerHalf, preset.spacing,
  [...avoidBases, ...depositSites, ...depositSites.map(mirrorUnit)], (x, y) => roomy(x, y) && Math.min(Math.hypot(x - hqCell.x, y - hqCell.y), Math.hypot(x - mirrorCell.x, y - mirrorCell.y)) >= Math.max(8, 0.3 * Math.min(width, height)));
 let spent = 0;
 for (const site of encounterSites) {
  const affordable = pool.filter(unit => value(unit.cost) <= budget - spent);
  if (!affordable.length) break;
  const unit = encounterRandom.pick(affordable), count = encounterRandom.int(1, Math.min(RTS_LIMITS.groupSize, Math.floor((budget - spent) / value(unit.cost))));
  spent += count * value(unit.cost); groups.push({archetype: unit.id, faction: sides.neutral.id, ...site, count});
 }
 spawns.push(...[...groups, ...groups.map(group => ({...group, ...mirrorUnit(group)}))].map(group => ({...group, ...centred(group)})));
 // Item drops from the catalog's own items, on Poisson sites with their mirrors.
 const items: LWRTSData.ItemDrop[] = [];
 if (catalog.items.length) {
  const itemRandom = random.fork('items');
  const sites = poissonSites(field, random.fork('item-sites'), preset.items, 3, [...avoidBases, ...depositSites, ...depositSites.map(mirrorUnit), ...groups], usable);
  for (const site of sites) { const item = itemRandom.pick(catalog.items); items.push({item: item.id, ...centred(site)}, {item: item.id, ...centred(mirrorUnit(site))}); }
 }
 const terrain = terrainPatches(field, classes.open), counts: Record<string, number> = {};
 for (const tile of field.tiles) counts[tile] = (counts[tile] ?? 0) + 1;
 const opponentName = sides.opponent.name;
 const mission: LWRTSData.Mission = {
  id: recipe.mission, name: recipe.name ?? `${title(recipe.preset)} (seed ${recipe.seed})`,
  description: `Generated ${recipe.preset} map: mirrored ${sides.player.name} and ${opponentName} bases, ${deposits.length * 2} resource deposits and ${groups.length * 2} ${sides.neutral.name} encounter groups (difficulty ${recipe.difficulty}, seed ${recipe.seed}).`,
  width, height, playerFaction: sides.player.id, defaultTerrain: classes.open, spawns, deposits: placedDeposits, terrain,
  objectives: [{id: 'defeat-' + sides.opponent.id, name: 'Defeat the ' + opponentName, description: `Destroy the ${opponentName} forces and structures.`, type: 'eliminate', target: sides.opponent.id, amount: 0}],
  fog: catalog.missions[0]?.fog ?? true, seed: createRandom(recipe.seed, 'rts-mission|runtime-seed').int(0, 999999), items
 };
 return {mission, summary: {preset: recipe.preset, width, height, difficulty: recipe.difficulty, symmetry: 'point', factions: {player: sides.player.id, opponent: sides.opponent.id, neutral: sides.neutral.id},
  terrainClasses: classes, tiles: counts, patches: terrain.length, carvedTiles: carved, connected: true, spawns: spawns.length, actors: spawns.reduce((sum, spawn) => sum + spawn.count, 0),
  deposits: deposits.length * 2, items: items.length, encounters: {groups: groups.length * 2, budgetPerHalf: budget, spentPerHalf: spent, unitCostReference: preferred.id}}};
}
