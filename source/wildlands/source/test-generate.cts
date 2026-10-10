/// <reference path="./rts-contracts.d.ts" />
/* `wildlands generate`: keyed randomness, RTS mission and adventure quest generators, discovery and the
 * guarded write (dry run, expected digest, new-file output, canonical files, staged engine validation). */
// The headless RTS run uses engine modules: install the composite showcase before any of them loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020';
import {gameDirectory} from './tools/game-folder.cjs';
import {createRandom, cyrb128, SEED_MAX} from './tools/generate-random.cjs';
import {RTS_PRESETS, generateMission, type RtsRecipe} from './tools/generate-rts.cjs';
import {adventureReference, generateQuests} from './tools/generate-adventure.cjs';
for (const name of ['ecs', 'rts-catalog', 'rts-stats', 'rts-navigation', 'rts-systems', 'rts-production', 'rts-economy', 'rts-checkpoint', 'rts-session']) require('./' + name + '.js');

type Plain = Record<string, unknown>;
type Result = Plain & {ok: boolean; code?: string; errors?: string[]};
const results: {name: string; passed: boolean; error?: string}[] = [];
function test(name: string, work: () => void): void {
 try { work(); results.push({name, passed: true}); }
 catch (error) { results.push({name, passed: false, error: error instanceof Error ? error.stack ?? error.message : String(error)}); console.error('FAIL', name, error); }
}
const cli = path.join(__dirname, 'tools', 'wildlands-cli.cjs');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'wildlands-generate-test-'));
const sha = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');
const read = (file: string): Plain => JSON.parse(fs.readFileSync(file, 'utf8')) as Plain;
/** Run the CLI; stdout is one JSON object. */
function run(args: string[], status = 0): Result {
 const child = spawnSync(process.execPath, [cli, ...args], {encoding: 'utf8', timeout: 120000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024});
 assert.equal(child.stderr, '', args.join(' '));
 const out = JSON.parse(child.stdout) as Result;
 assert.equal(child.status, status, args.join(' ') + '\n' + child.stdout.slice(0, 2000));
 assert.equal(out.protocolVersion, 1); assert.equal(out.ok, status === 0);
 return out;
}
let copies = 0;
/** A disposable copy of a shipped game folder (the folder name is the game id). */
function copy(id: string): string {
 const directory = path.join(scratch, 'copy-' + copies++, id);
 fs.cpSync(gameDirectory(id), directory, {recursive: true});
 return directory;
}
/** Every file of a folder with its bytes digest, to prove what a command did or did not touch. */
function snapshot(directory: string): Map<string, string> {
 const files = new Map<string, string>();
 const visit = (relative: string): void => {
  for (const entry of fs.readdirSync(path.join(directory, relative), {withFileTypes: true})) {
   const child = path.join(relative, entry.name);
   if (entry.isDirectory()) visit(child); else files.set(child, sha(fs.readFileSync(path.join(directory, child))));
  }
 };
 visit('');
 return files;
}
const digestOf = (directory: string): string => run(['inspect-game', '--game', directory]).digest as string;
const rtsCatalog = (): LWRTSData.Catalog => (require('./rts-catalog.js') as LWRTSData.CatalogApi).validate(read(path.join(gameDirectory('rts-frontier'), 'content/rts.json')));
const recipe = (preset: string, seed: number, extra: Partial<RtsRecipe> = {}): RtsRecipe => ({schemaVersion: 1, generator: 'rts-mission', mission: 'generated', seed, preset,
 width: RTS_PRESETS[preset]!.width, height: RTS_PRESETS[preset]!.height, difficulty: 3, ...extra});

test('Keyed generate randomness matches process-random first draws and keeps streams independent and bounded', () => {
 const processRandom = require('./process-random.js') as {unit(seed: number, key: string): number};
 const vectors: [number, string, number[]][] = [[1, 'a', [904323323, 691859019, 3148618032]], [0, 'rts-mission|skirmish', [6480864, 2957456747, 645656868]],
  [SEED_MAX, 'adventure-quests', [1270591966, 1759429751, 409400174]], [25025, 'x', [1334795603, 4177433822, 1418769552]]];
 for (const [seed, stream, expected] of vectors) {
  const random = createRandom(seed, stream);
  assert.deepEqual([random.next(), random.next(), random.next()].map(value => value * 4294967296), expected, stream);
  assert.equal(createRandom(seed, stream).next(), processRandom.unit(seed, stream), 'first draw equals LWProcessRandom.unit');
 }
 assert.deepEqual(cyrb128('1|a'), cyrb128('1|a')); assert.notDeepEqual(cyrb128('1|a'), cyrb128('1|b'));
 const parent = createRandom(9, 'root'), child = parent.fork('child');
 assert.equal(child.stream, 'root/child'); assert.equal(child.next(), createRandom(9, 'root/child').next());
 assert.equal(parent.next(), createRandom(9, 'root').next(), 'forking never advances the parent');
 const random = createRandom(3, 'bounds');
 for (let index = 0; index < 4000; index++) {
  const unit = random.next(), whole = random.int(-2, 3), ranged = random.range(5, 6);
  assert(unit >= 0 && unit < 1 && Number.isInteger(whole) && whole >= -2 && whole <= 3 && ranged >= 5 && ranged < 6);
 }
 for (const seed of [-1, 1.5, SEED_MAX + 1, Number.NaN]) assert.throws(() => createRandom(seed, 's'), RangeError);
 assert.throws(() => createRandom(1, 's').pick([]), RangeError);
});

test('Generate discovery is structured and its recipe schemas accept effective recipes and reject unknown fields', () => {
 const found = run(['generate', 'discover']), help = run(['generate', '--help']), bare = run(['generate']);
 assert.deepEqual(help, found); assert.deepEqual(bare, found);
 assert.equal(found.format, 'wildlands-generate'); assert.equal(found.handbook, 'docs/reference/wildlands-cli.md#generate');
 const generators = found.generators as Plain[];
 assert.deepEqual(generators.map(entry => entry.id), ['rts-mission', 'adventure-quests']);
 assert.deepEqual(Object.keys(generators[0]!.presets as Plain), ['skirmish', 'island', 'frontier', 'river']);
 assert.deepEqual((generators[0]!.parameters as Record<string, Plain>).difficulty!.minimum, 1);
 assert.deepEqual((generators[1]!.parameters as Record<string, Plain>).tier!.maximum, 3);
 assert((found.errors as unknown as Plain[]).some(error => error.code === 'stale-digest' && error.exit === 1));
 const ajv = new Ajv2020({strict: false}), rts = ajv.compile(generators[0]!.recipeSchema as object), quests = ajv.compile(generators[1]!.recipeSchema as object);
 assert(rts(recipe('island', 5)), JSON.stringify(rts.errors)); assert(!rts({...recipe('island', 5), extra: 1})); assert(!rts({...recipe('island', 5), difficulty: 6}));
 assert(quests({schemaVersion: 1, generator: 'adventure-quests', seed: 2, count: 3, tier: 2, biome: 'Ruins'})); assert(!quests({schemaVersion: 1, generator: 'adventure-quests', seed: 2}));
 assert.match(String(run(['--help']).usage), /generate rts-mission --game DIR --mission ID/);
});

test('Generated RTS missions of every preset are admitted, point-symmetric, land-connected and run headless', () => {
 const catalog = rtsCatalog(), api = require('./rts-catalog.js') as LWRTSData.CatalogApi;
 const tools = require('./rts-tools.js') as {run(input: unknown, catalog?: unknown): {ok: boolean; completedTicks: number; stopReason: string}};
 for (const preset of Object.keys(RTS_PRESETS)) for (const [seed, size] of [[1, null], [2, [16, 16]], [3, [37, 29]]] as const) {
  const generated = generateMission(catalog, recipe(preset, seed, size ? {width: size[0], height: size[1]} : {})), mission = generated.mission;
  const admitted = api.validate({...catalog, missions: [mission, ...catalog.missions]});
  assert.equal(admitted.missions[0]!.id, 'generated');
  const {width, height} = mission, tiles = Array<string>(width * height).fill(mission.defaultTerrain);
  for (const patch of mission.terrain) for (let y = patch.y; y < patch.y + patch.height; y++) for (let x = patch.x; x < patch.x + patch.width; x++) tiles[y * width + x] = patch.terrain;
  for (let index = 0; index < tiles.length; index++) assert.equal(tiles[index], tiles[tiles.length - 1 - index], preset + ' terrain is point-symmetric');
  const points = (list: readonly {x: number; y: number}[]): string[] => list.map(point => point.x + ',' + point.y).sort();
  assert.deepEqual(points(mission.deposits), points(mission.deposits.map(point => ({x: width - point.x, y: height - point.y}))), preset + ' deposits mirror');
  assert.deepEqual(points(mission.items), points(mission.items.map(point => ({x: width - point.x, y: height - point.y}))), preset + ' items mirror');
  const player = mission.spawns.filter(spawn => spawn.faction === mission.playerFaction), opponent = mission.spawns.filter(spawn => spawn.faction === (generated.summary.factions as Plain).opponent);
  assert.deepEqual(player.map(spawn => [spawn.archetype, spawn.count, width - spawn.x, height - spawn.y]), opponent.map(spawn => [spawn.archetype, spawn.count, spawn.x, spawn.y]), preset + ' bases mirror');
  assert(mission.objectives.length === 1 && mission.objectives[0]!.type === 'eliminate');
  assert.equal(generated.summary.connected, true);
  for (const spawn of mission.spawns) assert(catalog.units.some(unit => unit.id === spawn.archetype) || catalog.buildings.some(building => building.id === spawn.archetype));
  for (const drop of mission.items) assert(catalog.items.some(item => item.id === drop.item));
  for (const deposit of mission.deposits) assert(catalog.missions.some(existing => existing.deposits.some(reference => reference.resource === deposit.resource && reference.amount === deposit.amount)), 'deposit amounts reuse catalog missions');
  const encounters = generated.summary.encounters as {budgetPerHalf: number; spentPerHalf: number};
  assert(encounters.spentPerHalf <= encounters.budgetPerHalf);
  if (seed === 1) {
   const played = tools.run({missionId: 'generated', ticks: 300, commands: [], stopOnError: true}, {...catalog, missions: [mission]});
   assert.equal(played.ok, true); assert.equal(played.completedTicks, 300, preset + ' runs 300 headless ticks');
  }
 }
 const budget = (difficulty: number) => (generateMission(catalog, recipe('skirmish', 4, {difficulty})).summary.encounters as {budgetPerHalf: number}).budgetPerHalf;
 assert(budget(5) > budget(1));
});

test('rts-mission dry runs validate a staged copy, report both digests and write nothing', () => {
 const game = copy('rts-frontier'), before = snapshot(game), digest = digestOf(game);
 const staging = (): string[] => fs.readdirSync(os.tmpdir()).filter(name => name.startsWith('wildlands-generate-') && !name.startsWith('wildlands-generate-test-')).sort(), staged = staging();
 const result = run(['generate', 'rts-mission', '--game', game, '--mission', 'dunes', '--seed', '7', '--preset', 'river', '--dry-run']);
 assert.equal(result.dryRun, true); assert.equal(result.written, false); assert.equal(result.output, null);
 assert.equal(result.digest, digest); assert.notEqual(result.proposedDigest, digest); assert.equal(result.file, 'content/rts.json');
 assert.deepEqual(snapshot(game), before);
 assert.equal((result.generated as Plain).id, 'dunes'); assert.match(String((result.nextCommands as string[])[0]), new RegExp('--expected-digest ' + digest));
 assert.deepEqual(staging(), staged, 'the staged copy is removed');
});

test('rts-mission with --expected-digest replaces only the catalog; the folder validates and builds', () => {
 const game = copy('rts-frontier'), before = snapshot(game), digest = digestOf(game);
 const result = run(['generate', 'rts-mission', '--game', game, '--mission', 'dunes', '--seed', '7', '--expected-digest', digest]);
 assert.equal(result.written, true); assert.equal(result.output, path.join(game, 'content/rts.json'));
 const after = snapshot(game);
 for (const [file, hash] of before) if (file !== path.join('content', 'rts.json')) assert.equal(after.get(file), hash, file);
 assert.notEqual(after.get(path.join('content', 'rts.json')), before.get(path.join('content', 'rts.json')));
 assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort());
 assert.equal(digestOf(game), result.proposedDigest);
 const missions = (read(path.join(game, 'content/rts.json')).missions as Plain[]).map(mission => mission.id);
 assert.deepEqual(missions, ['frontier', 'dunes']);
 assert.equal(run(['validate-game', '--game', game]).ok, true);
 const html = path.join(scratch, 'generated-rts.html'), built = run(['build-game', '--game', game, '--output', html]);
 assert(fs.statSync(html).size === built.bytes && (built.bytes as number) <= (built.budgetBytes as number));
 // --first makes a regenerated mission the one the play build starts; other missions keep their order.
 const first = run(['generate', 'rts-mission', '--game', game, '--mission', 'dunes', '--seed', '8', '--replace', '--first', '--expected-digest', digestOf(game)]);
 assert.deepEqual(first.replaced, ['dunes']);
 assert.deepEqual((read(path.join(game, 'content/rts.json')).missions as Plain[]).map(mission => mission.id), ['dunes', 'frontier']);
});

test('The same game, recipe and seed produce identical bytes; another seed produces different content', () => {
 const game = copy('rts-frontier'), a = path.join(scratch, 'a.json'), b = path.join(scratch, 'b.json'), c = path.join(scratch, 'c.json'), d = path.join(scratch, 'd.json');
 const first = run(['generate', 'rts-mission', '--game', game, '--mission', 'twin', '--seed', '42', '--preset', 'island', '--output', a]);
 const second = run(['generate', 'rts-mission', '--game', copy('rts-frontier'), '--mission', 'twin', '--seed', '42', '--preset', 'island', '--output', b]);
 assert.equal(first.output, a); assert.equal(first.written, false);
 assert(fs.readFileSync(a).equals(fs.readFileSync(b))); assert.equal(first.sha256, sha(fs.readFileSync(a))); assert.equal(first.recipeHash, second.recipeHash);
 const recipeFile = path.join(scratch, 'twin.recipe.json'); fs.writeFileSync(recipeFile, JSON.stringify(first.recipe));
 const replayed = run(['generate', 'rts-mission', '--game', game, '--recipe', recipeFile, '--output', c]);
 assert(fs.readFileSync(c).equals(fs.readFileSync(a))); assert.equal(replayed.recipeHash, first.recipeHash);
 run(['generate', 'rts-mission', '--game', game, '--mission', 'twin', '--seed', '43', '--preset', 'island', '--output', d]);
 assert.notEqual(sha(fs.readFileSync(d)), sha(fs.readFileSync(a)));
 const quests = (seed: string) => run(['generate', 'adventure-quests', '--game', gameDirectory('littlewild'), '--count', '3', '--seed', seed, '--dry-run']);
 const q1 = quests('5'), q2 = quests('5'), q3 = quests('6');
 assert.equal(q1.sha256, q2.sha256); assert.deepEqual(q1.generated, q2.generated); assert.notEqual(q1.sha256, q3.sha256);
});

test('Stale digests, duplicate ids and occupied or in-folder outputs are refused without writing', () => {
 const game = copy('rts-frontier'), before = snapshot(game), stale = '0'.repeat(64);
 assert.equal(run(['generate', 'rts-mission', '--game', game, '--mission', 'x', '--expected-digest', stale], 1).code, 'stale-digest');
 const digest = digestOf(game);
 assert.equal(run(['generate', 'rts-mission', '--game', game, '--mission', 'frontier', '--expected-digest', digest], 1).code, 'duplicate-id');
 const occupied = path.join(scratch, 'occupied.json'); fs.writeFileSync(occupied, '{}\n');
 assert.equal(run(['generate', 'rts-mission', '--game', game, '--mission', 'x', '--output', occupied], 2).code, 'output-refused');
 assert.equal(fs.readFileSync(occupied, 'utf8'), '{}\n');
 assert.equal(run(['generate', 'rts-mission', '--game', game, '--mission', 'x', '--output', path.join(game, 'content', 'new.json')], 2).code, 'output-refused');
 assert.equal(run(['generate', 'rts-mission', '--game', game, '--mission', 'x', '--output', path.join(scratch, 'note.txt')], 2).code, 'output-refused');
 assert.equal(run(['generate', 'adventure-quests', '--game', game, '--count', '1', '--dry-run'], 1).code, 'wrong-template');
 assert.equal(run(['generate', 'rts-mission', '--game', gameDirectory('littlewild'), '--mission', 'x', '--dry-run'], 1).code, 'wrong-template');
 assert.deepEqual(snapshot(game), before);
 const quests = copy('littlewild'), questDigest = digestOf(quests);
 run(['generate', 'adventure-quests', '--game', quests, '--count', '2', '--seed', '3', '--expected-digest', questDigest]);
 const again = run(['generate', 'adventure-quests', '--game', quests, '--count', '2', '--seed', '3', '--expected-digest', digestOf(quests)], 1);
 assert.equal(again.code, 'duplicate-id'); assert.match(String(again.errors), /gen-3-1, gen-3-2/);
 const replaced = run(['generate', 'adventure-quests', '--game', quests, '--count', '2', '--seed', '3', '--replace', '--expected-digest', digestOf(quests)]);
 assert.deepEqual(replaced.replaced, ['gen-3-1', 'gen-3-2']);
 assert.equal(run(['generate', 'adventure-quests', '--game', quests, '--count', '24', '--seed', '9', '--dry-run']).ok, true);
 for (const seed of ['10', '11', '12']) run(['generate', 'adventure-quests', '--game', quests, '--count', '24', '--seed', seed, '--expected-digest', digestOf(quests)]);
 assert.equal(run(['generate', 'adventure-quests', '--game', quests, '--count', '24', '--seed', '13', '--dry-run'], 1).code, 'generate-budget');
});

test('Non-canonical content files are refused with a reformatting hint and left unchanged', () => {
 const game = copy('rts-frontier'), file = path.join(game, 'content/rts.json');
 fs.writeFileSync(file, JSON.stringify(read(file)));
 const bytes = fs.readFileSync(file), refused = run(['generate', 'rts-mission', '--game', game, '--mission', 'x', '--expected-digest', digestOf(game)], 1);
 assert.equal(refused.code, 'non-canonical-file'); assert.match(String(refused.errors), /JSON\.stringify\(value, null, 2\)/);
 assert(fs.readFileSync(file).equals(bytes));
 // ASCII-escaped two-space JSON (the colony balancing layout) is canonical and keeps its escapes.
 const quests = copy('littlewild'), balancing = path.join(quests, 'content/balancing.json'), original = fs.readFileSync(balancing, 'utf8');
 assert.match(original, /\\u00b7/);
 run(['generate', 'adventure-quests', '--game', quests, '--count', '1', '--seed', '2', '--expected-digest', digestOf(quests)]);
 const updated = fs.readFileSync(balancing, 'utf8');
 assert(/^[\x00-\x7f]*$/.test(updated)); assert(updated.length > original.length);
 let prefix = 0;
 while (original[prefix] === updated[prefix]) prefix++;
 assert(updated.endsWith(original.slice(prefix)), 'a generated edit only inserts the new quests');
});

test('Out-of-bounds numbers, unknown presets, factions and biomes and malformed recipes are usage errors', () => {
 const game = gameDirectory('rts-frontier'), base = ['generate', 'rts-mission', '--game', game, '--mission', 'x'];
 const usage = (args: string[], code = 'generate-usage') => assert.equal(run(args, 2).code, code, args.join(' '));
 for (const [flag, value] of [['--width', '15'], ['--width', '129'], ['--height', '8'], ['--difficulty', '0'], ['--difficulty', '6'], ['--seed', '4294967296'], ['--seed', '-1'], ['--seed', '1.5'], ['--preset', 'desert'], ['--name', ' ']])
  usage([...base, flag!, value!, '--dry-run']);
 usage([...base]); usage([...base, '--dry-run', '--output', path.join(scratch, 'z.json')]); usage([...base, '--expected-digest', 'abc']);
 usage([...base, '--dry-run', '--dry-run']); usage([...base, '--dry-run', '--bogus']); usage(['generate', 'rts-mission', '--mission', 'x', '--dry-run']);
 usage(['generate', 'rts-mission', '--game', game, '--mission', 'Bad Id', '--dry-run']); usage(['generate', 'unknown-thing']);
 usage(['generate', 'adventure-quests', '--game', gameDirectory('littlewild'), '--dry-run']);
 const adventure = ['generate', 'adventure-quests', '--game', gameDirectory('littlewild')];
 for (const extra of [['--count', '0'], ['--count', '25'], ['--count', '2', '--tier', '4'], ['--count', '2', '--tier', '0'], ['--count', '2', '--first']]) usage([...adventure, ...extra, '--dry-run']);
 usage(['generate', 'adventure-quests', '--game', gameDirectory('littlewild'), '--count', '1', '--biome', 'Moon', '--dry-run'], 'unknown-reference');
 const bad = (name: string, value: unknown): string => { const file = path.join(scratch, name); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value)); return file; };
 usage([...base, '--recipe', bad('broken.json', '{'), '--dry-run']);
 usage(['generate', 'rts-mission', '--game', game, '--recipe', bad('wrong.json', {schemaVersion: 1, generator: 'adventure-quests', mission: 'x'}), '--dry-run']);
 usage(['generate', 'rts-mission', '--game', game, '--recipe', bad('text-seed.json', {schemaVersion: 1, generator: 'rts-mission', mission: 'x', seed: '7'}), '--dry-run']);
 usage(['generate', 'rts-mission', '--game', game, '--recipe', bad('extra.json', {schemaVersion: 1, generator: 'rts-mission', mission: 'x', script: 'x'}), '--dry-run']);
 usage(['generate', 'rts-mission', '--game', game, '--recipe', bad('faction.json', {schemaVersion: 1, generator: 'rts-mission', mission: 'x', playerFaction: 'nobody'}), '--dry-run'], 'unknown-reference');
 const factions = run(['generate', 'rts-mission', '--game', game, '--recipe', bad('swap.json', {schemaVersion: 1, generator: 'rts-mission', mission: 'x', playerFaction: 'raiders', opponentFaction: 'alliance'}), '--dry-run']);
 assert.deepEqual((factions.summary as Plain).factions, {player: 'raiders', opponent: 'alliance', neutral: 'wildlife'});
 assert.match(String((factions.nextCommands as string[])[0]), /--recipe RECIPE\.json/);
});

test('adventure-quests reference only existing biomes, skills and items inside the tier envelopes and publish where the game plays them', () => {
 const library = (read(path.join(gameDirectory('littlewild'), 'content/balancing.json')).libraries as Plain).adventure as Plain;
 const reference = adventureReference(library), items = new Set([...reference.resources, ...reference.equipment, reference.chest]);
 assert(reference.resources.length > 10 && reference.equipment.length > 5 && reference.chest === 'wooden_chest');
 for (const [tier, biome] of [[undefined, undefined], [2, undefined], [undefined, 'Brook'], [3, 'Ruins']] as const) {
  const {quests} = generateQuests(library, {schemaVersion: 1, generator: 'adventure-quests', seed: 17, count: 6, ...tier ? {tier} : {}, ...biome ? {biome} : {}});
  assert.equal(quests.length, 6);
  for (const quest of quests) {
   const peers = reference.quests.filter(existing => existing.tier === quest.tier), envelope = (values: number[], value: number) => value >= Math.min(...values) && value <= Math.max(...values);
   assert(reference.biomes.includes(quest.biome) && (!biome || quest.biome === biome) && (!tier || quest.tier === tier));
   for (const key of ['duration', 'energy', 'coins', 'research'] as const) assert(envelope(peers.map(existing => existing[key]), quest[key]), quest.id + ' ' + key);
   for (const step of quest.steps) assert(reference.skills.includes(step.skill) && envelope(peers.flatMap(existing => existing.steps.map(entry => entry.modifier)), step.modifier));
   for (const [item, amount] of Object.entries(quest.cost)) assert(reference.resources.includes(item) && amount >= 1);
   for (const row of quest.loot) assert(items.has(row.item) && row.min >= 1 && row.max >= row.min && row.chance >= 0 && row.chance <= 1, row.item);
   assert.equal(new Set(quest.loot.map(row => row.item)).size, quest.loot.length);
  }
 }
 const ember = copy('emberworks'), pack = path.join('content', 'emberworks.pack.json'), before = snapshot(ember);
 const result = run(['generate', 'adventure-quests', '--game', ember, '--count', '2', '--seed', '8', '--expected-digest', digestOf(ember)]);
 assert.equal(result.file, 'content/emberworks.pack.json');
 const after = snapshot(ember);
 for (const [file, hash] of before) if (file !== pack) assert.equal(after.get(file), hash, file);
 assert.notEqual(after.get(pack), before.get(pack));
 const quests = (((read(path.join(ember, pack)).libraries as Plain).adventure as Plain).quests as Plain[]).map(quest => quest.id);
 assert.deepEqual(quests.slice(-2), ['gen-8-1', 'gen-8-2']);
 assert.equal(run(['validate-game', '--game', ember]).ok, true);
 const html = path.join(scratch, 'emberworks.html');
 assert.equal(run(['build-game', '--game', ember, '--output', html]).ok, true);
 assert.equal(run(['generate', 'adventure-quests', '--game', copy('littlewild'), '--count', '1', '--dry-run']).file, 'content/balancing.json');
});

test('Generator sources never read ambient randomness or clocks', () => {
 for (const name of ['generate-random', 'generate-rts-terrain', 'generate-rts', 'generate-adventure', 'generate-write', 'generate-discovery', 'generate-cli']) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'source', 'tools', name + '.cts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  assert.doesNotMatch(source, /Math\.random|Date\.now|new Date|performance\.now|randomUUID|randomBytes|getRandomValues/, name);
 }
});

fs.rmSync(scratch, {recursive: true, force: true});
const report = {suite: 'generate', passed: results.filter(result => result.passed).length, total: results.length, results};
fs.writeFileSync(path.join(__dirname, 'generate-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${report.passed}/${report.total} generate checks passed`);
if (report.passed !== report.total) process.exitCode = 1;
