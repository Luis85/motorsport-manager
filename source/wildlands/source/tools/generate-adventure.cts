/**
 * `wildlands generate adventure-quests`: new adventure quests with loot tables for a colony game's
 * adventure library. Every reference is an existing one: biomes, skills, provision items, loot
 * items (resources, equipment and the chest) all come from the library's own quests and catalogs.
 * Every number (duration, energy, coins, research, provisions, check modifiers, loot quantities and
 * chances) is drawn inside the envelope the library's existing quests of the same tier span, so the
 * generator recombines authored balance instead of inventing it. Text comes from fixed phrase lists.
 */
import {createRandom, type Random} from './generate-random.cjs';
import {GenerateError} from './generate-rts-terrain.cjs';

type Plain = Record<string, unknown>;
interface Step {name: string; skill: string; modifier: number;}
interface Loot {item: string; min: number; max: number; chance: number;}
export interface Quest {id: string; name: string; biome: string; tier: number; duration: number; energy: number; cost: Record<string, number>; steps: Step[]; loot: Loot[]; coins: number; research: number; description: string;}
export const ADVENTURE_LIMITS = Object.freeze({count: [1, 24] as const, tier: [1, 3] as const, quests: 100});
/** The effective, replayable recipe of one adventure-quests generation (`--recipe` shape). */
export interface AdventureRecipe {schemaVersion: 1; generator: 'adventure-quests'; seed: number; count: number; tier?: number; biome?: string;}

const ADJECTIVES = ['Quiet', 'Hidden', 'Windswept', 'Forgotten', 'Misty', 'Golden', 'Lantern-lit', 'Far', 'Mossy', 'Sunlit', 'Old', 'Winding'];
const PHRASES = ['Prepare for the {biome} trip', 'Find the way in', 'Read the signs along the way', 'Work through the main task', 'Handle the unexpected',
 'Ask around for help', 'Double-check the details', 'Gather what you came for', 'Keep going when it gets hard', 'Bring the results home'];

const list = (value: unknown): Plain[] => Array.isArray(value) ? value.filter((entry): entry is Plain => !!entry && typeof entry === 'object' && !Array.isArray(entry)) : [];
const numbers = (values: unknown[]): number[] => values.filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry));
const envelope = (values: number[]): [number, number] => values.length ? [Math.min(...values), Math.max(...values)] : [0, 0];
const round2 = (value: number): number => Math.round(value * 100) / 100;
/** A whole number inside the observed envelope. */
const within = (random: Random, [low, high]: [number, number]): number => random.int(Math.ceil(low), Math.floor(high));

/** Catalog ids of a library section that is either an inline list/map or a `$catalog` expansion. */
function ids(section: unknown, shape: 'list' | 'map'): string[] {
 if (section && typeof section === 'object' && !Array.isArray(section) && Array.isArray((section as Plain).order) && typeof (section as Plain).$catalog === 'string')
  return ((section as Plain).order as unknown[]).filter((id): id is string => typeof id === 'string');
 if (shape === 'list') return list(section).map(entry => entry.id).filter((id): id is string => typeof id === 'string');
 return section && typeof section === 'object' ? Object.keys(section) : [];
}

/** What the library already contains: quests, biomes, tiers, skills and the item ids loot may name. */
export function adventureReference(library: Plain): {quests: Quest[]; biomes: string[]; tiers: number[]; skills: string[]; resources: string[]; equipment: string[]; chest: string | null} {
 const quests = list(library.quests) as unknown as Quest[];
 if (!quests.length) throw new GenerateError('unsupported-catalog', 'The adventure library has no quests to take biomes, tiers and balance envelopes from.');
 const unique = <T,>(values: T[]): T[] => [...new Set(values)];
 const chest = library.chest && typeof library.chest === 'object' && typeof (library.chest as Plain).id === 'string' ? (library.chest as Plain).id as string : null;
 return {quests, biomes: unique(quests.map(quest => quest.biome)), tiers: unique(quests.map(quest => quest.tier)).sort((a, b) => a - b),
  skills: unique(quests.flatMap(quest => list(quest.steps).map(step => step.skill)).filter((skill): skill is string => typeof skill === 'string')),
  resources: ids(library.weights, 'map'), equipment: ids(library.equipment, 'list'), chest};
}

type Reference = ReturnType<typeof adventureReference>;
type Kind = 'resource' | 'equipment' | 'chest';
const kindOf = (reference: Reference, item: string): Kind => item === reference.chest ? 'chest' : reference.equipment.includes(item) ? 'equipment' : 'resource';

/** One loot row per slot of a reference quest: same kind of item, numbers inside the tier envelope of that kind. */
function lootTable(random: Random, reference: Reference, peers: Quest[], template: Quest): Loot[] {
 const rows = peers.flatMap(quest => list(quest.loot) as unknown as Loot[]), used = new Set<string>(), table: Loot[] = [];
 const seenResources = [...new Set(reference.quests.flatMap(quest => (list(quest.loot) as unknown as Loot[]).map(row => row.item)))].filter(item => kindOf(reference, item) === 'resource' && reference.resources.includes(item));
 for (const slot of list(template.loot) as unknown as Loot[]) {
  const kind = kindOf(reference, slot.item), same = rows.filter(row => kindOf(reference, row.item) === kind);
  const pool = (kind === 'chest' ? [reference.chest!] : kind === 'equipment' ? reference.equipment : seenResources).filter(item => !used.has(item));
  if (!pool.length) continue;
  const item = random.pick(pool), min = within(random, envelope(numbers(same.map(row => row.min))));
  const max = Math.max(min, within(random, envelope(numbers(same.map(row => row.max)))));
  const [low, high] = envelope(numbers(same.map(row => row.chance)));
  used.add(item); table.push({item, min: Math.max(1, min), max: Math.max(1, max), chance: round2(random.range(low, high))});
 }
 return table.sort((a, b) => b.chance - a.chance || (a.item < b.item ? -1 : 1));
}

/**
 * A display name no earlier quest of the batch uses: the drawn adjective when free, else the next
 * free adjective in list order, else the drawn one with a number. Deterministic and draw-free, so
 * every other value of the batch is unchanged.
 */
function distinctName(adjective: string, biome: string, used: Set<string>): string {
 const start = ADJECTIVES.indexOf(adjective);
 let name = '';
 for (let offset = 0; offset < ADJECTIVES.length && (!name || used.has(name)); offset++) name = `${ADJECTIVES[(start + offset) % ADJECTIVES.length]} ${biome} outing`;
 for (let number = 2; used.has(name); number++) name = `${adjective} ${biome} outing ${number}`;
 used.add(name);
 return name;
}

/** Generate `count` quests; ids are `gen-<seed>-<n>` so a replay with the same seed names the same quests. */
export function generateQuests(library: Plain, recipe: AdventureRecipe): {quests: Quest[]; summary: Record<string, unknown>} {
 const reference = adventureReference(library);
 if (recipe.biome !== undefined && !reference.biomes.includes(recipe.biome)) throw new GenerateError('unknown-reference', `Unknown biome ${recipe.biome}; choose one of ${reference.biomes.join(', ')}.`, 2);
 const tiers = reference.tiers.filter(tier => tier >= ADVENTURE_LIMITS.tier[0] && tier <= ADVENTURE_LIMITS.tier[1]);
 if (!tiers.length) throw new GenerateError('unsupported-catalog', 'The adventure library has no quests of tiers 1 to 3.');
 const random = createRandom(recipe.seed, 'adventure-quests'), quests: Quest[] = [], references: string[] = [], names = new Set<string>();
 const costKeys = [...new Set(reference.quests.flatMap(quest => Object.keys(quest.cost ?? {})))].filter(item => reference.resources.includes(item));
 for (let index = 0; index < recipe.count; index++) {
  // Unset tier or biome follow the library: a biome's own tiers, a tier's own biomes (falling back to all of them).
  const own = random.fork('quest/' + index), biomeTiers = tiers.filter(tier => reference.quests.some(quest => quest.tier === tier && quest.biome === recipe.biome));
  const tier = recipe.tier ?? own.pick(biomeTiers.length ? biomeTiers : tiers), sameTier = reference.quests.filter(quest => quest.tier === tier);
  const tierBiomes = [...new Set(sameTier.map(quest => quest.biome))], biome = recipe.biome ?? own.pick(tierBiomes.length ? tierBiomes : reference.biomes);
  const peers = sameTier.length ? sameTier : reference.quests;
  const template = own.pick(peers); references.push(template.id);
  const stat = (key: 'duration' | 'energy' | 'coins' | 'research'): number => within(own, envelope(numbers(peers.map(quest => quest[key]))));
  // Provisions: as many entries as a peer carries, each item and amount inside what the library's quests ask for.
  const cost: Record<string, number> = {}, provisions = within(own, envelope(peers.map(quest => Object.keys(quest.cost ?? {}).length)));
  const costPool = [...costKeys];
  for (let entry = 0; entry < provisions && costPool.length; entry++) {
   const item = costPool.splice(own.int(0, costPool.length - 1), 1)[0]!;
   cost[item] = Math.max(1, within(own, envelope(numbers(reference.quests.map(quest => (quest.cost ?? {})[item])))));
  }
  const sortedCost = Object.fromEntries(Object.keys(cost).sort().map(item => [item, cost[item]!]));
  const stepCount = within(own, envelope(peers.map(quest => list(quest.steps).length))), modifiers = envelope(numbers(peers.flatMap(quest => list(quest.steps).map(step => step.modifier))));
  const phrases = [...PHRASES], skills = [...reference.skills], steps: Step[] = [];
  for (let step = 0; step < Math.max(1, stepCount); step++) {
   const phrase = phrases.splice(own.int(0, phrases.length - 1), 1)[0]!, skill = skills.length ? skills.splice(own.int(0, skills.length - 1), 1)[0]! : own.pick(reference.skills);
   steps.push({name: phrase.replace('{biome}', biome.toLowerCase()), skill, modifier: within(own, modifiers)});
  }
  const loot = lootTable(own.fork('loot'), reference, peers, template);
  const adjective = own.pick(ADJECTIVES), skillNames = steps.map(step => step.skill);
  quests.push({id: 'gen-' + recipe.seed + '-' + (index + 1), name: distinctName(adjective, biome, names), biome, tier,
   duration: stat('duration'), energy: stat('energy'), cost: sortedCost, steps, loot, coins: stat('coins'), research: stat('research'),
   description: `Generated tier ${tier} outing (seed ${recipe.seed}). Checks: ${skillNames.join(', ')}. Its loot table recombines the finds of the library's tier ${tier} quests.`});
 }
 return {quests, summary: {count: quests.length, tiers: [...new Set(quests.map(quest => quest.tier))], biomes: [...new Set(quests.map(quest => quest.biome))],
  ids: quests.map(quest => quest.id), lootEntries: quests.reduce((sum, quest) => sum + quest.loot.length, 0), templates: references,
  reference: {quests: reference.quests.length, biomes: reference.biomes, skills: reference.skills, resources: reference.resources.length, equipment: reference.equipment.length}}};
}
