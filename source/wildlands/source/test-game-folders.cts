/// <reference path="./content-provider-contracts.d.ts" />
/* Game folders: the data-only `docs/concepts/<id>/` source of a game. Manifest grammar, closed
 * inventory, byte digest, the profile of every bundled game captured before its data moved, the
 * artifact data globals, template (RTS/pet) folders and full validation with the engine's runtime validators. */
// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020';
import {BUNDLED_GAMES, compileGame, dataGlobals, digest, gameDirectory, gamesRoot, LIMITS, loadGame, profile, validateGame} from './tools/game-folder.cjs';
import {manifestErrors, type GameManifest} from './tools/game-manifest.cjs';
import {DATA_GLOBALS} from './tools/artifact-profiles.cjs';

type Plain = Record<string, unknown>;
const results: {name: string; passed: boolean; error?: string}[] = [];
function test(name: string, work: () => void): void {
 try {work(); results.push({name, passed: true});}
 catch (error) {results.push({name, passed: false, error: error instanceof Error ? error.stack ?? error.message : String(error)}); console.error('FAIL', name, error);}
}
const source = path.resolve(__dirname, '../source'), littlewild = gameDirectory('littlewild');
const read = (file: string): unknown => JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const manifest = read(path.join(littlewild, 'game.json')) as GameManifest & Plain;
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
/** Sorted-key JSON digest: deep equality independent of key order (the fixture's encoding). */
const canonical = (value: unknown): string => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
 : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical((value as Plain)[key])).join(',') + '}' : JSON.stringify(value);
const sha = (value: unknown): string => createHash('sha256').update(canonical(value)).digest('hex');
/** A disposable copy of a game folder named `id` under a fresh games root. */
function copy(work: (directory: string, root: string) => void, from = littlewild, id = 'littlewild'): void {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wildlands-games-')), directory = path.join(root, id);
 try {fs.cpSync(from, directory, {recursive: true}); work(directory, root);}
 finally {fs.rmSync(root, {recursive: true, force: true});}
}
type Fixture = {id: string; profile: string; sections: Record<string, string>; scenarios?: {order: string[]; defaultId: string; canonicalId?: string; packs: Record<string, string>}};
/** Pre-move digest fixture of a game (`fixtures/<id>-profile.sha256.json`). */
const fixture = (id: string): Fixture => read(path.join(__dirname, 'fixtures', id + '-profile.sha256.json')) as Fixture;
/** The profile id and every captured section digest equal the fixture. */
function sections(value: LWContentProvider.Profile, expected: Fixture): void {
 const plain = value as LWContentProvider.Profile & Plain;
 assert.equal(plain.id, expected.id);
 for (const [section, digest] of Object.entries(expected.sections)) {
  const [name, nested] = section.split('.'); assert.equal(sha(nested ? (plain[name!] as Plain)[nested] : plain[name!]), digest, section);
 }
}

test('Game manifest schema and structural validator agree and stay closed and bounded', () => {
 const schema = read(path.join(source, 'schemas/game.schema.json')) as Plain, validate = new Ajv2020({strict: true, allErrors: true}).compile(schema);
 const both = (value: unknown): [boolean, boolean] => [validate(value), manifestErrors(value).length === 0];
 assert.deepEqual(both(manifest), [true, true], JSON.stringify([validate.errors, manifestErrors(manifest)]));
 for (const id of BUNDLED_GAMES) {const value = read(path.join(gameDirectory(id), 'game.json')); assert.deepEqual(both(value), [true, true], id + ': ' + JSON.stringify([validate.errors, manifestErrors(value)]));}
 const mutate = (change: (value: Plain & {content: Plain; targets: Plain & {html: Plain}; presentation: Plain}) => void): Plain => {const value = clone(manifest) as Plain & {content: Plain; targets: Plain & {html: Plain}; presentation: Plain}; change(value); return value;};
 const rejected: [string, Plain][] = [
  ['unknown top-level field', mutate(value => {value.script = 'alert(1)';})], ['newer schema version', mutate(value => {value.schemaVersion = 2;})],
  ['other format', mutate(value => {value.format = 'living-worlds-pack';})], ['unknown template', mutate(value => {value.template = 'arcade';})],
  ['newer engine api', mutate(value => {value.engine = {api: 2};})], ['uppercase id', mutate(value => {value.id = 'Littlewild';})],
  ['unknown content field', mutate(value => {value.content.entry = 'content/main.js';})], ['code path', mutate(value => {value.content.balancing = 'content/balancing.js';})],
  ['parent traversal', mutate(value => {value.content.balancing = '../shared/balancing.json';})], ['absolute path', mutate(value => {value.content.assets = '/etc';})],
  ['pack without .pack.json', mutate(value => {value.content.packs = ['content/littlewild.json'];})], ['repeated pack', mutate(value => {value.content.packs = ['content/littlewild.pack.json', 'content/littlewild.pack.json'];})],
  ['empty pack list', mutate(value => {value.content.packs = [];})], ['unknown feature', mutate(value => {value.features = ['editors'];})],
  ['oversized budget', mutate(value => {value.targets.html.budgetBytes = 64 * 1024 * 1024 + 1;})], ['fractional budget', mutate(value => {value.targets.html.budgetBytes = 1.5;})],
  ['output outside demos', mutate(value => {value.targets.html.output = 'littlewild.html';})], ['bad accent', mutate(value => {value.presentation.accent = 'green';})],
  ['long title', mutate(value => {value.presentation.title = 'x'.repeat(121);})], ['missing storage', mutate(value => {delete value.storage;})],
  ['rts with godot target', mutate(value => {value.template = 'rts'; value.content = {catalog: 'content/rts.json'}; delete value.features;})],
  ['rts with colony content', mutate(value => {value.template = 'rts'; delete value.features; delete (value.targets as Plain).godot;})],
  ['pet feature', mutate(value => {value.template = 'pet'; value.content = {catalog: 'content/pet.json'}; delete (value.targets as Plain).godot;})]
 ];
 for (const [name, value] of rejected) assert.deepEqual(both(value), [false, false], name);
 // Value comparisons the schema cannot express are the structural validator's alone.
 for (const [name, value] of [['foreign namespace', mutate(value => {value.storage = {namespace: 'wildlands.office'};})],
  ['output of another game', mutate(value => {value.targets.html.output = 'demos/office.html';})]] as const) {
  assert.equal(validate(value), true, name); assert.notDeepEqual(manifestErrors(value), [], name);
 }
});

test('Manifest semantics bind id, folder name, storage namespace and demo output', () => {
 assert.deepEqual(manifestErrors(manifest), []);
 const office = {...clone(manifest), id: 'office', storage: {namespace: 'littlewild'}, targets: {html: {output: 'demos/office.html', budgetBytes: 1}}};
 assert.match(manifestErrors(office).join('\n'), /namespace: must be wildlands\.office$/m);
 assert.deepEqual(manifestErrors({...office, storage: {namespace: 'wildlands.office'}}), []);
 assert.deepEqual(manifestErrors({...clone(manifest), storage: {namespace: 'wildlands.littlewild'}}), []);
 assert.match(manifestErrors({...clone(manifest), schemaVersion: 2}).join('\n'), /newer manifests need a newer engine/);
 copy((_directory, root) => {
  const renamed = path.join(root, 'grove'); fs.renameSync(path.join(root, 'littlewild'), renamed);
  assert.throws(() => loadGame(renamed), /Game id littlewild must equal its folder name grove/);
 });
 // Only the declared canonical pack inherits balancing; without one every pack is used verbatim.
 copy(directory => {
  const ember = path.join(gameDirectory('emberworks'), 'content/emberworks.pack.json');
  fs.copyFileSync(ember, path.join(directory, 'content/emberworks.pack.json'));
  const {canonicalId: _canonical, ...content} = clone(manifest.content) as Plain;
  fs.writeFileSync(path.join(directory, 'game.json'), JSON.stringify({...clone(manifest), content: {...content, packs: ['content/littlewild.pack.json', 'content/emberworks.pack.json'], defaultId: 'emberworks'}}));
  const scenarios = compileGame(directory).profile.scenarios!;
  assert.deepEqual(scenarios, {packs: [read(path.join(directory, 'content/littlewild.pack.json')), read(ember)], defaultId: 'emberworks'});
  fs.writeFileSync(path.join(directory, 'game.json'), JSON.stringify({...clone(manifest), content: {...content, packs: ['content/littlewild.pack.json', 'content/emberworks.pack.json'], defaultId: 'office'}}));
  assert.throws(() => compileGame(directory), /Scenario catalog names an unknown pack: office/);
 });
 copy(directory => {
  fs.writeFileSync(path.join(directory, 'game.json'), JSON.stringify({...clone(manifest), features: ['storytelling-player', 'storytelling-player']}));
  assert.throws(() => loadGame(directory), /features: must not repeat entries/);
 });
});

test('Closed inventory rejects code, unreferenced files, links, executable modes and oversized trees', () => {
 const rejects = (change: (directory: string) => void, pattern: RegExp): void => copy(directory => {change(directory); assert.throws(() => loadGame(directory), pattern);});
 for (const name of ['assets/items/wood/behavior.js', 'content/boot.ts', 'index.html', 'assets/style.css', 'content/mod.wasm', 'tools/run.sh', 'content/icon.svg'])
  rejects(directory => {fs.mkdirSync(path.dirname(path.join(directory, name)), {recursive: true}); fs.writeFileSync(path.join(directory, name), 'x');}, /code or markup/);
 rejects(directory => fs.writeFileSync(path.join(directory, 'content/notes.json'), '{}'), /not referenced by game\.json: content\/notes\.json/);
 rejects(directory => fs.writeFileSync(path.join(directory, 'assets/items/wood/extra.json'), '{}'), /not referenced by game\.json: assets\/items\/wood\/extra\.json/);
 rejects(directory => fs.writeFileSync(path.join(directory, '.hidden'), 'x'), /unsupported name: \.hidden/);
 rejects(directory => fs.symlinkSync(path.join(directory, 'game.json'), path.join(directory, 'content/link.json')), /symbolic link: content\/link\.json/);
 rejects(directory => fs.symlinkSync(os.tmpdir(), path.join(directory, 'external'), 'dir'), /symbolic link: external/);
 rejects(directory => {const file = path.join(directory, 'PROVENANCE.md'); fs.writeFileSync(file, '# Provenance\n'); fs.chmodSync(file, 0o755);}, /executable: PROVENANCE\.md/);
 rejects(directory => fs.rmSync(path.join(directory, 'content/skill-tree.json')), /names a missing file: content\/skill-tree\.json/);
 rejects(directory => fs.writeFileSync(path.join(directory, 'content/adventure-example.json'), Buffer.alloc(LIMITS.fileBytes + 1, 32)), /exceeds 8388608 bytes/);
 rejects(directory => fs.writeFileSync(path.join(directory, 'README.md'), Buffer.from([0xff, 0xfe, 0x23])), /not UTF-8 text: README\.md/);
 rejects(directory => fs.writeFileSync(path.join(directory, 'game.json'), '{"format":'), /not valid JSON: game\.json/);
 rejects(directory => {let nested = directory; for (let level = 0; level <= LIMITS.depth; level += 1) nested = path.join(nested, 'd' + level); fs.mkdirSync(nested, {recursive: true});}, /nested deeper than 8 levels/);
 // Documentation and license files are welcome anywhere and join the inventory (README.md files stay out of the digest).
 copy(directory => {
  const before = loadGame(directory).files.length;
  for (const name of ['PROVENANCE.md', 'LICENSE', 'LICENSE-CC-BY-4.0.txt', 'assets/items/README.md']) fs.writeFileSync(path.join(directory, name), '# Note\n');
  assert.equal(loadGame(directory).files.length, before + 4);
 });
});

test('Folder digest is byte-based, path-ordered and independent of where the folder lives', () => {
 const first = loadGame(littlewild), again = loadGame(littlewild);
 assert.match(first.digest, /^[0-9a-f]{64}$/); assert.equal(again.digest, first.digest);
 assert.deepEqual(first.files.map(file => file.path), first.files.map(file => file.path).sort((a, b) => a < b ? -1 : a > b ? 1 : 0));
 assert.equal(digest([...first.files].reverse()), first.digest);
 for (const file of first.files) assert.equal(file.sha256, createHash('sha256').update(fs.readFileSync(path.join(littlewild, file.path))).digest('hex'));
 copy(directory => {
  assert.equal(loadGame(directory).digest, first.digest, 'Same bytes elsewhere keep the digest');
  const file = path.join(directory, 'game.json'), value = read(file) as Plain;
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n\n'); const spaced = loadGame(directory).digest; assert.notEqual(spaced, first.digest, 'Whitespace is part of the bytes');
  const {format, ...rest} = value; fs.writeFileSync(file, JSON.stringify({...rest, format}, null, 2) + '\n'); assert.notEqual(loadGame(directory).digest, first.digest, 'Key order is part of the bytes');
  assert.deepEqual(compileGame(directory).profile, compileGame(littlewild).profile, 'Formatting never changes the compiled profile');
 });
});

test('README edits leave the folder digest unchanged while PROVENANCE and LICENSE edits change it', () => {
 // README.md is documentation, not game input: it stays in the closed inventory and its limits but not in the digest,
 // so a README edit never makes a demo stale. PROVENANCE.md and LICENSE* are licence-relevant and stay in the digest.
 const pet = gameDirectory('pocket-pet'), original = loadGame(pet);
 assert(original.files.some(file => file.path === 'README.md') && original.files.some(file => file.path === 'PROVENANCE.md'));
 assert.equal(digest(original.files.filter(file => file.path !== 'README.md')), original.digest, 'The digest never covers README.md');
 copy(directory => {
  const readme = path.join(directory, 'README.md'), files = loadGame(directory).files.length;
  fs.appendFileSync(readme, '\nEdited documentation.\n'); fs.writeFileSync(path.join(directory, 'content/README.md'), '# Nested note\n');
  const edited = loadGame(directory);
  assert.equal(edited.digest, original.digest, 'Editing or adding README.md keeps the digest');
  assert.equal(edited.files.length, files + 1, 'README.md files stay in the closed inventory');
  assert.notEqual(edited.files.find(file => file.path === 'README.md')!.sha256, original.files.find(file => file.path === 'README.md')!.sha256);
  assert.deepEqual(compileGame(directory).profile, compileGame(pet).profile);
  assert.deepEqual(validateGame(directory), {ok: true, id: 'pocket-pet', digest: original.digest, errors: []});
  fs.writeFileSync(readme, Buffer.alloc(LIMITS.fileBytes + 1, 32));
  assert.throws(() => loadGame(directory), /exceeds 8388608 bytes/, 'README.md still counts toward the size limits');
  fs.writeFileSync(readme, '# Pocket Pet\n');
  fs.appendFileSync(path.join(directory, 'PROVENANCE.md'), '\nAdditional credit.\n');
  const provenance = loadGame(directory).digest;
  assert.notEqual(provenance, original.digest, 'Editing PROVENANCE.md changes the digest');
  fs.writeFileSync(path.join(directory, 'LICENSE'), 'CC-BY-4.0\n');
  assert.notEqual(loadGame(directory).digest, provenance, 'Adding a LICENSE file changes the digest');
 }, pet, 'pocket-pet');
});

test('Littlewild folder profile equals the profile bundled before the move', () => {
 const captured = fixture('littlewild') as Fixture & {scenarios: NonNullable<Fixture['scenarios']>};
 const folder = profile(littlewild) as LWContentProvider.Profile & Plain, creatures = folder.creatures as Plain, scenarios = folder.scenarios!;
 sections(folder, captured);
 assert.deepEqual(Object.keys(folder).sort(), ['assets', 'balancing', 'creatures', 'format', 'id', 'librarySchema', 'scenarios', 'storage', 'version']);
 assert.deepEqual(Object.keys(creatures).sort(), ['configuration', 'definitions', 'editorFields']);
 // The folder owns only its own pack; Emberworks and Office have their own folders.
 assert.deepEqual(scenarios.packs.map(pack => (pack as Plain).id), ['littlewild']); assert.equal(sha(scenarios.packs[0]), captured.scenarios.packs.littlewild);
 assert.equal(scenarios.defaultId, captured.scenarios.defaultId); assert.equal(scenarios.canonicalId, captured.scenarios.canonicalId);
 // The transitional installer (folder output compiled by the build plus the Emberworks and Office folders' packs) is exactly the captured profile.
 const installer = (require('./content-installers/littlewild-game.cjs') as {littlewildProfile(): LWContentProvider.Profile}).littlewildProfile();
 assert.equal(sha(installer), captured.profile);
 assert.deepEqual(installer.scenarios!.packs.map(pack => (pack as Plain).id), captured.scenarios.order);
 for (const pack of installer.scenarios!.packs) assert.equal(sha(pack), captured.scenarios.packs[(pack as Plain).id as string]);
 const {scenarios: _installed, ...installedSections} = clone(installer), {scenarios: _folder, ...folderSections} = clone(folder);
 assert.deepEqual(installedSections, folderSections);
});

test('Artifact data globals are the folder profile plus engine-owned schemas and adopt as the same profile', () => {
 const game = compileGame(littlewild), data = dataGlobals(littlewild), known = new Map(DATA_GLOBALS);
 const expected = DATA_GLOBALS.filter(([name, group]) => group === 'colony-content' || group === 'asset-catalog' || name === 'LWGameProfile').map(([name]) => name);
 assert.deepEqual([...data.keys()].sort(), [...expected].sort());
 for (const name of data.keys()) assert(known.has(name), name);
 assert.deepEqual(data.get('LWGameProfile'), {storage: {namespace: 'littlewild'}});
 assert.deepEqual(data.get('LWDefaultBalancing'), game.profile.balancing); assert.deepEqual(data.get('LWContentSchema'), game.profile.librarySchema);
 assert.deepEqual(data.get('LWScenarioPacks'), game.profile.scenarios!.packs); assert.deepEqual(data.get('LWAssetDefinitions'), game.profile.assets);
 for (const [name, file] of [['LWScenarioSchema', 'scenario'], ['LWWorldSchema', 'world'], ['LWSimulationSchema', 'simulation'], ['LWGrowthSchema', 'growth'], ['LWAdventureSchema', 'adventure']] as const)
  assert.deepEqual(data.get(name), read(path.join(source, 'content', file + '.schema.json')), name);
 // A browser realm declaring exactly these globals adopts the folder profile through the content provider.
 const context = vm.createContext({});
 for (const [name, value] of data) context[name] = vm.runInContext('(' + JSON.stringify(value) + ')', context);
 vm.runInContext(fs.readFileSync(path.join(__dirname, 'content-provider.js'), 'utf8'), context, {filename: 'content-provider.js'});
 assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(LWContentProvider.get())', context) as string), clone(game.profile));
 // The build compiled .generated from the folder: the compiled documents equal the folder projection.
 for (const name of ['balancing', 'library.schema', 'littlewild.pack', 'default-library'])
  assert.deepEqual(read(path.join(__dirname, 'content', name + '.json')), clone(game.documents![name]), name);
 assert.deepEqual(read(path.join(__dirname, 'asset-definitions.json')), game.profile.assets);
});

test('Template folders compile RTS and Pocket Pet catalogs into their profiles and validate', () => {
 const templates = require('./content-installers/template-games.cjs') as {rtsProfile(): LWContentProvider.Profile; petProfile(): LWContentProvider.Profile};
 const rts = gameDirectory('rts-frontier'), pet = gameDirectory('pocket-pet');
 const rtsGame = compileGame(rts);
 assert.deepEqual(rtsGame.profile, {format: 'wildlands-content-profile', version: 1, id: 'rts-frontier', storage: {namespace: 'wildlands.rts-frontier'}, rts: read(path.join(rts, 'content/rts.json'))});
 assert.deepEqual([...rtsGame.data.keys()], ['LWGameProfile', 'LWRTSDefinitions']);
 // The runtime installers are the folder profiles the build compiled.
 assert.deepEqual(templates.rtsProfile(), clone(rtsGame.profile));
 const rtsResult = validateGame(rts); assert.equal(rtsResult.ok, true, rtsResult.errors.join('\n')); assert.equal(rtsResult.digest, rtsGame.digest);
 const petGame = compileGame(pet);
 assert.deepEqual(petGame.profile.pet!.definitions, read(path.join(pet, 'content/pet.json')));
 assert.deepEqual(petGame.profile.pet!.assets, read(path.join(__dirname, 'pet-asset-definitions.json')));
 assert.deepEqual([...petGame.data.keys()], ['LWGameProfile', 'LWPetDefinitions', 'LWPetAssetDefinitions']);
 assert.deepEqual(templates.petProfile(), clone(petGame.profile));
 const petResult = validateGame(pet); assert.equal(petResult.ok, true, petResult.errors.join('\n')); assert.equal(petResult.digest, petGame.digest);
 copy(directory => {
  fs.cpSync(path.join(littlewild, 'assets/items/wood'), path.join(directory, 'assets/items/wood'), {recursive: true});
  assert.throws(() => compileGame(directory), /only pets definitions/);
 }, pet, 'pocket-pet');
});

test('Full validation runs the engine validators in a fresh process and reports their rejection', () => {
 const valid = validateGame(littlewild);
 assert.deepEqual(valid, {ok: true, id: 'littlewild', digest: loadGame(littlewild).digest, errors: []});
 copy(directory => {
  const file = path.join(directory, 'content/balancing.json'), balance = read(file) as {simulation: {rules: {actor: {needs: {foodWork: number}}}}};
  balance.simulation.rules.actor.needs.foodWork = -1; fs.writeFileSync(file, JSON.stringify(balance));
  const result = validateGame(directory); assert.equal(result.ok, false); assert.equal(result.id, 'littlewild'); assert.match(result.errors.join('\n'), /Invalid needs rules/);
 });
 copy(directory => {
  const file = path.join(directory, 'content/skill-tree.json'), tree = read(file) as Plain; tree.xpPerPoint = -5; fs.writeFileSync(file, JSON.stringify(tree));
  assert.equal(validateGame(directory).ok, false);
 });
 copy(directory => {
  const file = path.join(directory, 'assets/interactions/catalog.json'), library = read(file) as Plain; library.version = 99; fs.writeFileSync(file, JSON.stringify(library));
  assert.deepEqual(validateGame(directory), {ok: false, id: null, digest: null, errors: ['The interaction catalog must equal the balancing interactions section (one authority).']});
 });
});

test('Builds locate game folders through WILDLANDS_GAMES_DIR and fail clearly without one', () => {
 assert.equal(path.basename(gamesRoot()), 'concepts'); assert.equal(path.dirname(littlewild), gamesRoot());
 const probe = (env: Record<string, string>): ReturnType<typeof spawnSync> => spawnSync(process.execPath, ['-e', "const G=require('./tools/game-folder.cjs');process.stdout.write(G.gameDirectory('littlewild'))"],
  {cwd: __dirname, encoding: 'utf8', timeout: 30000, env: {...process.env, ...env}});
 copy((directory, root) => {const run = probe({WILDLANDS_GAMES_DIR: root}); assert.equal(run.status, 0, String(run.stderr)); assert.equal(run.stdout, directory);});
 const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'wildlands-no-games-'));
 try {const run = probe({WILDLANDS_GAMES_DIR: empty}); assert.notEqual(run.status, 0); assert.match(String(run.stderr), /Game folder littlewild was not found at .*; set WILDLANDS_GAMES_DIR/);}
 finally {fs.rmSync(empty, {recursive: true, force: true});}
 assert.throws(() => gameDirectory('../littlewild'), /Invalid game id/);
});

/** Documents (other than asset definitions) and definition families of each folder that moved in after Littlewild. */
const FOLDERS: readonly (readonly [id: string, name: string, documents: readonly string[], families: Readonly<Record<string, number | 'littlewild'>>])[] = [
 ['emberworks', 'Emberworks', ['README.md', 'assets/creatures/catalog.json', 'assets/creatures/editor-fields.json', 'assets/interactions/catalog.json', 'content/balancing.json', 'content/emberworks.pack.json', 'game.json'], {buildings: 'littlewild', creatures: 'littlewild', items: 'littlewild'}],
 ['office', 'Office', ['README.md', 'assets/creatures/catalog.json', 'assets/creatures/editor-fields.json', 'assets/interactions/catalog.json', 'content/balancing.json', 'content/office.pack.json', 'game.json'], {buildings: 'littlewild', creatures: 'littlewild', items: 'littlewild'}],
 ['rts-frontier', 'RTS Frontier', ['README.md', 'content/rts.json', 'game.json'], {}],
 ['pocket-pet', 'Pocket Pet', ['PROVENANCE.md', 'README.md', 'content/pet.json', 'game.json'], {pets: 18}]
];
const DEFINITION = /^assets\/([a-z]+)\/[^/]+\/definition\.json$/;
const families = (files: readonly {path: string}[]): Record<string, number> => {
 const counted: Record<string, number> = {};
 for (const file of files) {const family = DEFINITION.exec(file.path)?.[1]; if (family) counted[family] = (counted[family] ?? 0) + 1;}
 return counted;
};
for (const [id, name, documents, expected] of FOLDERS) test(`${name} folder validates, keeps a closed inventory and equals its pre-move profile`, () => {
 const directory = gameDirectory(id), game = compileGame(directory), captured = fixture(id), littlewildFamilies = families(loadGame(littlewild).files);
 // Closed inventory: exactly these documents plus asset definitions of the expected families. Emberworks
 // and Office materialize the Littlewild definition set they were authored against (decision D4).
 assert.deepEqual(game.files.map(file => file.path).filter(file => !DEFINITION.test(file)), [...documents].sort(compare));
 assert.deepEqual(families(game.files), Object.fromEntries(Object.entries(expected).map(([family, count]) => [family, count === 'littlewild' ? littlewildFamilies[family] : count])));
 copy(copied => {fs.writeFileSync(path.join(copied, 'content/extra.json'), '{}'); assert.throws(() => loadGame(copied), /not referenced by game\.json: content\/extra\.json/);}, directory, id);
 // Profile: every section and the whole profile equal the digests captured before the data moved.
 sections(game.profile, captured);
 assert.equal(sha(game.profile), captured.profile);
 assert.deepEqual(game.profile.storage, {namespace: 'wildlands.' + id});
 if (captured.scenarios) {
  const scenarios = game.profile.scenarios!;
  assert.deepEqual(scenarios.packs.map(pack => (pack as Plain).id), captured.scenarios.order);
  for (const pack of scenarios.packs) assert.equal(sha(pack), captured.scenarios.packs[(pack as Plain).id as string]);
  assert.equal(scenarios.defaultId, captured.scenarios.defaultId); assert.equal(Object.hasOwn(scenarios, 'canonicalId'), false);
 }
 // Full validation with the engine's runtime validators in a fresh process.
 assert.deepEqual(validateGame(directory), {ok: true, id, digest: game.digest, errors: []});
});

const report = {suite: 'game-folders', passed: results.filter(result => result.passed).length, total: results.length, results};
fs.writeFileSync(path.join(__dirname, 'game-folders-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${report.passed}/${report.total} game folder checks passed`);
if (report.passed !== report.total) process.exitCode = 1;
