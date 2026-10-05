/** Real filesystem authoring regressions and compatibility projections. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import {librarySchema} from './tools/bundled-library-schema.cjs';
import {definitions, type Definition} from './tools/definition-source.cjs';
import {balancingDocument, writeContent} from './tools/bundled-content.cjs';
import {assetDefinitions} from './tools/bundled-assets.cjs';
const source = path.resolve(__dirname, '../source');
const results: {name: string; passed: boolean; error?: string}[] = [];
function test(name: string, action: () => void): void {
 try {action(); results.push({name, passed: true});}
 catch (error) {results.push({name, passed: false, error: String(error)}); console.error(name, error);}
}
function fixture(action: (directory: string) => void): void {
 const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'littlewild-definition-'));
 try {
  fs.cpSync(path.join(source, 'assets'), path.join(directory, 'assets'), {recursive: true});
  fs.mkdirSync(path.join(directory, 'content'));
  for (const file of ['balancing.json', 'littlewild.pack.json', 'library.schema.json'])
   fs.copyFileSync(path.join(source, 'content', file), path.join(directory, 'content', file));
  action(directory);
 } finally {fs.rmSync(directory, {recursive: true, force: true});}
}
function edit(directory: string, relative: string, action: (definition: Definition) => void): void {
 const file = path.join(directory, 'assets', relative, 'definition.json');
 const definition = JSON.parse(fs.readFileSync(file, 'utf8')) as Definition;
 action(definition); fs.writeFileSync(file, JSON.stringify(definition));
}
test('The strict authoring schema accepts every shipped package and rejects unknown facets', () => {
 const schema = JSON.parse(fs.readFileSync(path.join(source, 'assets/definition.schema.json'), 'utf8')) as object;
 const validate = new Ajv2020({strict: true, allErrors: true}).compile(schema);
 for (const definition of definitions(source)) {
  assert(validate(definition), JSON.stringify(validate.errors));
  assert.equal(validate({...definition, typo: {}}), false);
 }
});
test('Generated portable libraries are exact projections of the canonical authoring catalog', () => {
 const balance = balancingDocument(source), generated = JSON.parse(fs.readFileSync(path.join(__dirname, 'content/balancing.json'), 'utf8')) as unknown;
 assert.deepEqual(balance, generated);
 for (const [name, key] of [['default', 'base'], ['adventure', 'adventure'], ['world', 'world'], ['growth', 'growth']]) {
  const libraries = balance.libraries as Record<string, unknown>;
  assert.deepEqual(libraries[key!], JSON.parse(fs.readFileSync(path.join(__dirname, 'content', name + '-library.json'), 'utf8')));
 }
});
test('Changing one item definition updates price, weight, recipe and visual projections', () => fixture(directory => {
 edit(directory, 'items/planks', definition => {
  (definition.item as {price: number}).price = 19; definition.weight = 444;
  (definition.recipe as {cost: {wood: number}}).cost.wood = 7; definition.visual!.name = 'Authored plank';
 });
 const balance = balancingDocument(directory) as {libraries: {base: {components: {items: {id: string; price: number}[]; recipes: {id: string; cost: {wood: number}}[]}}; adventure: {weights: Record<string, number>}}};
 assert.equal(balance.libraries.base.components.items.find(item => item.id === 'planks')!.price, 19);
 assert.equal(balance.libraries.base.components.recipes.find(recipe => recipe.id === 'planks')!.cost.wood, 7);
 assert.equal(balance.libraries.adventure.weights.planks, 444);
 assert.equal(assetDefinitions(directory).find(asset => asset.id === 'planks')!.name, 'Authored plank');
}));
test('A new item folder appends to every authored facet without catalog registration', () => fixture(directory => {
 const original = definitions(directory).find(definition => definition.id === 'planks')!, next = JSON.parse(JSON.stringify(original)) as Definition;
 next.id = 'boards'; next.visual!.id = 'boards';
 for (const key of ['item', 'recipe']) (next[key] as {id: string}).id = next.id;
 (next.recipe as {output: string}).output = next.id;
 const folder = path.join(directory, 'assets/items/boards'); fs.mkdirSync(folder);
 fs.writeFileSync(path.join(folder, 'definition.json'), JSON.stringify(next));
 const balance = balancingDocument(directory) as {libraries: {base: {components: {items: {id: string}[]; recipes: {id: string}[]}}; adventure: {weights: Record<string, number>}}};
 assert.equal(balance.libraries.base.components.items.at(-1)!.id, 'boards');
 assert.equal(balance.libraries.base.components.recipes.at(-1)!.id, 'boards');
 assert.equal(balance.libraries.adventure.weights.boards, next.weight);
 assert(assetDefinitions(directory).some(asset => asset.id === 'boards'));
 const template = JSON.parse(fs.readFileSync(path.join(source, 'content/library.schema.json'), 'utf8')) as object;
 const schema = librarySchema(template, balance), validate = new Ajv2020({strict: false, allErrors: true}).compile(schema);
 assert(validate(balance.libraries.base), JSON.stringify(validate.errors));
 const invalid = JSON.parse(JSON.stringify(balance.libraries.base)) as typeof balance.libraries.base;
 invalid.components.items.at(-1)!.id = 'undeclared-item'; assert.equal(validate(invalid), false);

}));
test('Derived identity schemas preserve compiled bounds and presentation vocabulary', () => {
 const template = JSON.parse(fs.readFileSync(path.join(source, 'content/library.schema.json'), 'utf8')) as object;
 assert.deepEqual(librarySchema(template, balancingDocument(source)), template);
});
test('Creature numeric balancing is derived from its one gameplay facet', () => fixture(directory => {
 edit(directory, 'creatures/sproutling', definition => (definition.creature!.movement as {baseSpeed: number}).baseSpeed = 2.3);
 const balance = balancingDocument(directory) as {creatures: {definitions: {movement: {baseSpeed: number}}[]}};
 assert.equal(balance.creatures.definitions[0]!.movement.baseSpeed, 2.3);
}));
test('Legacy asset and creature manifests cannot become a second editable authority', () => fixture(directory => {
 for (const legacy of ['asset.json', 'creature.json']) {
  const file = path.join(directory, 'assets/creatures/sproutling', legacy); fs.writeFileSync(file, '{}');
  assert.throws(() => definitions(directory), /Duplicate definition source/); fs.unlinkSync(file);
 }
}));
test('Catalog order rejects missing facets and duplicate IDs instead of silently dropping data', () => fixture(directory => {
 const file = path.join(directory, 'content/balancing.json'), original = fs.readFileSync(file, 'utf8');
 for (const order of [['missing'], ['wood', 'wood']]) {
  const balance = JSON.parse(original) as {libraries: {base: {components: {items: {order: string[]}}}}};
  balance.libraries.base.components.items.order = order; fs.writeFileSync(file, JSON.stringify(balance));
  assert.throws(() => balancingDocument(directory), /Missing definition facet|canonical catalog selector/);
 }
}));
test('Inline gameplay tables are rejected as competing definitions', () => fixture(directory => {
 const file = path.join(directory, 'content/balancing.json'), balance = JSON.parse(fs.readFileSync(file, 'utf8')) as {libraries: {base: {components: {items: unknown}}}};
 balance.libraries.base.components.items = [{id: 'wood', price: 99}]; fs.writeFileSync(file, JSON.stringify(balance));
 assert.throws(() => balancingDocument(directory), /canonical catalog selector/);
}));
test('Wrong family, facet identity, typo, missing file and empty definitions fail discovery', () => fixture(directory => {
 const file = path.join(directory, 'assets/items/wood/definition.json'), original = fs.readFileSync(file, 'utf8');
 const mutations: ((definition: Definition) => void)[] = [
  definition => {definition.family = 'buildings';}, definition => {definition.item = {id: 'different'};},
  definition => {definition.typo = {};}, definition => {for (const key of Object.keys(definition)) if (!['format', 'schemaVersion', 'family', 'id'].includes(key)) delete definition[key];}
 ];
 for (const mutation of mutations) {const definition = JSON.parse(original) as Definition; mutation(definition); fs.writeFileSync(file, JSON.stringify(definition)); assert.throws(() => definitions(directory));}
 fs.unlinkSync(file); assert.throws(() => definitions(directory), /missing definition.json/);
}));
test('A gameplay definition without its required visual model fails before build publication', () => fixture(directory => {
 edit(directory, 'items/wood', definition => {delete definition.visual;});
 assert.throws(() => assetDefinitions(directory), /Item world\/carry model missing/);
}));
test('Compatibility exports reject source mirrors and default scenario overrides', () => fixture(directory => {
 const generated = path.join(directory, 'generated'); fs.mkdirSync(path.join(generated, 'content'), {recursive: true});
 const mirror = path.join(directory, 'content/default-library.json'); fs.writeFileSync(mirror, '{}');
 assert.throws(() => writeContent(directory, generated), /Duplicate content source/); fs.unlinkSync(mirror);
 const file = path.join(directory, 'content/littlewild.pack.json'), pack = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
 pack.libraries = {}; fs.writeFileSync(file, JSON.stringify(pack)); assert.throws(() => writeContent(directory, generated), /inherit canonical defaults/);
 assert.deepEqual(fs.readdirSync(path.join(generated, 'content')), []);
}));
const report = {passed: results.filter(result => result.passed).length, total: results.length, results};
fs.writeFileSync(path.join(__dirname, 'definition-source-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.passed + '/' + report.total); if (report.passed !== report.total) process.exitCode = 1;
