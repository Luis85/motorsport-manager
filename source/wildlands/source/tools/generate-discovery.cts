/**
 * `wildlands generate discover`: everything an agent needs before generating, as data: generators,
 * presets, bounded parameters, recipe JSON Schemas, publication modes, error codes and examples.
 * Built from the generators' own preset and limit tables so discovery cannot drift from them.
 */
import {DEFAULT_SEED, SEED_MAX} from './generate-random.cjs';
import {RTS_LIMITS, RTS_PRESETS} from './generate-rts.cjs';
import {ADVENTURE_LIMITS} from './generate-adventure.cjs';

const integer = (minimum: number, maximum: number, fallback: number | string, description: string) => ({type: 'integer', minimum, maximum, default: fallback, description});
const seed = integer(0, SEED_MAX, DEFAULT_SEED, 'Keyed PRNG seed (cyrb128("seed|stream") -> sfc32, forge keyed PRNG v1). The same game, recipe and seed produce identical bytes.');

function rtsParameters(): Record<string, unknown> {
 return {
  mission: {type: 'string', pattern: '^[a-z][a-z0-9_-]{0,63}$', required: true, flag: '--mission', description: 'Id of the generated mission; an existing id needs --replace.'},
  seed: {...seed, flag: '--seed'},
  preset: {type: 'string', enum: Object.keys(RTS_PRESETS), default: 'skirmish', flag: '--preset'},
  width: {...integer(RTS_LIMITS.width[0], RTS_LIMITS.width[1], 'preset width', 'Map width in tiles.'), flag: '--width'},
  height: {...integer(RTS_LIMITS.height[0], RTS_LIMITS.height[1], 'preset height', 'Map height in tiles.'), flag: '--height'},
  difficulty: {...integer(RTS_LIMITS.difficulty[0], RTS_LIMITS.difficulty[1], 2, 'Neutral encounter budget per map half, in multiples of the cost of the opponent faction\'s preferred AI unit.'), flag: '--difficulty'},
  name: {type: 'string', minLength: 1, maxLength: 80, default: '<Preset> (seed N)', flag: '--name'},
  playerFaction: {type: 'string', recipeOnly: true, default: 'the first mission\'s player faction', description: 'Catalog faction id.'},
  opponentFaction: {type: 'string', recipeOnly: true, default: 'the first other faction with AI enabled'},
  neutralFaction: {type: 'string', recipeOnly: true, default: 'the first remaining faction, else the opponent', description: 'Owner of the encounter groups.'}
 };
}
function adventureParameters(): Record<string, unknown> {
 return {
  count: {...integer(ADVENTURE_LIMITS.count[0], ADVENTURE_LIMITS.count[1], 'required', 'Number of quests to generate (the library holds at most 100).'), required: true, flag: '--count'},
  seed: {...seed, flag: '--seed'},
  tier: {...integer(ADVENTURE_LIMITS.tier[0], ADVENTURE_LIMITS.tier[1], 'each quest picks an existing tier', 'Quest tier; numbers stay inside the envelope of the library\'s quests of this tier.'), flag: '--tier'},
  biome: {type: 'string', minLength: 1, maxLength: 80, default: 'each quest picks an existing biome', flag: '--biome', description: 'One of the biomes the library\'s quests already use (exact spelling).'}
 };
}
/** JSON Schema of a `--recipe` file: the parameters plus schemaVersion and generator. */
function recipeSchema(generator: string, parameters: Record<string, unknown>, required: string[]): Record<string, unknown> {
 const properties = Object.fromEntries(Object.entries(parameters).map(([key, value]) => {
  const {flag: _flag, required: _required, recipeOnly: _recipeOnly, default: fallback, ...schema} = value as Record<string, unknown>;
  return [key, typeof fallback === 'number' || (typeof fallback === 'string' && key === 'preset') ? {...schema, default: fallback} : schema];
 }));
 return {$schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', additionalProperties: false, required: ['schemaVersion', 'generator', ...required],
  properties: {schemaVersion: {const: 1}, generator: {const: generator}, ...properties}};
}

export function discovery(): Record<string, unknown> {
 const rts = rtsParameters(), adventure = adventureParameters();
 return {
  format: 'wildlands-generate', schemaVersion: 1, handbook: 'docs/reference/wildlands-cli.md#generate',
  random: {algorithm: 'forge keyed PRNG v1: cyrb128("<seed>|<stream>") seeds sfc32; the 13th output is the first draw (equals LWProcessRandom.unit)', seed: {minimum: 0, maximum: SEED_MAX, default: DEFAULT_SEED}},
  modes: {
   '--dry-run': 'Generate, stage a temporary copy of the folder with the proposed file and run the engine validators; write nothing.',
   '--expected-digest HEX': 'Same, then replace only the one content file in place by atomic rename, if the folder digest (inspect-game .digest, or digest of a dry run) still equals HEX.',
   '--output NEW.json': 'Same, then write the whole proposed content file to a new path outside the game folder; the folder is not changed.'
  },
  generators: [
   {id: 'rts-mission', template: 'rts', file: 'game.json content.catalog (the RTS catalog)', parameters: rts, presets: RTS_PRESETS, limits: RTS_LIMITS,
    description: 'Add one playable, point-symmetric mission: ranked value-noise terrain mapped onto existing catalog terrain and normalised into patches like the mission editor, mirrored bases (headquarters, producer, workers, guards) of catalog factions, a home deposit per resource plus Poisson-disk deposits with amounts from the catalog\'s missions, neutral encounter groups of existing land combat units within the difficulty budget, item drops from catalog items and an eliminate objective. Bases are always connected by land.',
    recipeSchema: recipeSchema('rts-mission', rts, ['mission']),
    examples: ['wildlands generate rts-mission --game GAME --mission dunes --preset skirmish --seed 7 --dry-run',
     'wildlands generate rts-mission --game GAME --mission dunes --preset skirmish --seed 7 --expected-digest DIGEST',
     'wildlands generate rts-mission --game GAME --mission delta --preset river --width 64 --height 48 --difficulty 4 --output out/rts.json']},
   {id: 'adventure-quests', template: 'colony', file: 'the adventure library the game plays: content.balancing when a canonical pack inherits it, else the default pack', parameters: adventure, limits: ADVENTURE_LIMITS,
    description: 'Append quests with loot tables. Biomes, check skills, provisions and loot items are ones the library already uses; every number stays inside the envelope of the library\'s quests of the same tier. Quest ids are gen-<seed>-<n>; existing ids need --replace.',
    recipeSchema: recipeSchema('adventure-quests', adventure, ['count']),
    examples: ['wildlands generate adventure-quests --game GAME --count 3 --seed 11 --dry-run', 'wildlands generate adventure-quests --game GAME --count 2 --tier 2 --biome Ruins --seed 4 --expected-digest DIGEST']}
  ],
  options: {'--recipe FILE': 'JSON recipe (schema above, at most 64 KiB); flags override its fields. Every result returns the effective recipe and its recipeHash.', '--replace': 'Allow regenerating existing ids in place.', '--first': 'rts-mission only: make the generated mission the catalog\'s first, which the play build starts (otherwise it is appended or keeps its place).'},
  result: ['ok', 'protocolVersion', 'generator', 'game', 'file', 'seed', 'recipe', 'recipeHash', 'digest', 'proposedDigest', 'dryRun', 'written', 'output', 'bytes', 'sha256', 'replaced', 'summary', 'generated', 'nextCommands'],
  errors: [
   {code: 'generate-usage', exit: 2, meaning: 'Unknown or duplicate option, missing value, out-of-bounds number, invalid recipe or no single publication mode.'},
   {code: 'unknown-reference', exit: 2, meaning: 'A faction or biome the game does not define.'},
   {code: 'output-refused', exit: 2, meaning: '--output is not a new .json path outside the game folder.'},
   {code: 'invalid-game', exit: 1, meaning: 'The folder or its content file does not load; run validate-game.'},
   {code: 'wrong-template', exit: 1, meaning: 'The generator needs another game template.'},
   {code: 'stale-digest', exit: 1, meaning: 'The folder digest differs from --expected-digest; nothing was written.'},
   {code: 'non-canonical-file', exit: 1, meaning: 'The content file is not canonical two-space JSON; reformat it in its own change first.'},
   {code: 'duplicate-id', exit: 1, meaning: 'A generated id exists; pass --replace or choose another id or seed.'},
   {code: 'unsupported-catalog', exit: 1, meaning: 'The catalog lacks what the generator needs (land terrain, two factions, reference quests).'},
   {code: 'generate-budget', exit: 1, meaning: 'The result would exceed an engine limit (4096 terrain patches, 100 quests).'},
   {code: 'generation-failed', exit: 1, meaning: 'No playable layout for this seed; try another seed.'},
   {code: 'invalid-generated', exit: 1, meaning: 'The engine validators rejected the staged folder; nothing was written.'}
  ],
  workflow: ['inspect-game --game GAME (note digest)', 'generate ... --dry-run (review summary and generated)', 'generate ... --expected-digest DIGEST', 'validate-game --game GAME', 'build-game --game GAME --output OUT.html'],
  notes: ['Generators never add archetypes, items, terrain, skills or balance values; they reference what the game defines.', 'No ambient randomness or clocks: output is a pure function of game content, recipe and seed.', 'A generated mission or quest is automated content, not playtesting or balance validation.']
 };
}
