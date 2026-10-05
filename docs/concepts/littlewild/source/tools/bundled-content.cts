/** Assemble authoring catalogs into unchanged portable/runtime document formats. */
import fs from 'node:fs';
import path from 'node:path';
import {definitions, read, record, type Definition, type RecordValue} from './definition-source.cjs';

// Order is compatibility data. New folders append deterministically without another registration.
const tables: Readonly<Record<string, readonly [string, 'map' | 'list']>> = {
 '/libraries/base/components/items': ['item', 'list'],
 '/libraries/base/components/buildings': ['building', 'list'],
 '/libraries/base/components/recipes': ['recipe', 'list'],
 '/libraries/adventure/weights': ['weight', 'map'],
 '/libraries/adventure/equipment': ['equipment', 'list'],
 '/libraries/world/nodes': ['node', 'list'],
 '/libraries/world/buildings': ['physicalBuilding', 'list'],
 '/libraries/growth/requirements/buildings': ['buildingRequirements', 'map'],
 '/libraries/growth/requirements/items': ['itemRequirements', 'map'],
 '/libraries/growth/requirements/recipes': ['recipeRequirements', 'map'],
 '/libraries/growth/homes': ['home', 'map'],
 '/creatures/definitions': ['creatureTuning', 'list']
};
/** Numeric/Boolean tuners are a generated view of creature defaults, never another authoring source. */
function numeric(value: unknown): unknown {
 if (typeof value === 'number' || typeof value === 'boolean') return value;
 if (!record(value)) return undefined;
 const entries = Object.entries(value).flatMap(([key, child]) => {
  const result = numeric(child); return result === undefined ? [] : [[key, result]];
 });
 return entries.length ? Object.fromEntries(entries) : undefined;
}
function facetValue(definition: Definition, facet: string): unknown {
 if (facet !== 'creatureTuning') return definition[facet];
 const creature = definition.creature;
 if (!creature) return undefined;
 return {id: creature.id, ...Object.fromEntries(['movement', 'physiology', 'rng', 'state'].map(key => [key, numeric(creature[key])]))};
}
export function balancingDocument(source: string): RecordValue {
 const packages = definitions(source), visited = new Set<string>();
 function expand(value: unknown, location: string): unknown {
  const table = tables[location];
  if (table) {
   const [facet, shape] = table;
   if (!record(value) || Object.keys(value).length !== 3 || value.$catalog !== facet || value.shape !== shape ||
       !Array.isArray(value.order) || value.order.some(id => typeof id !== 'string') || new Set(value.order).size !== value.order.length)
    throw Error('Expected canonical catalog selector: ' + location);
   const requested = value.order as string[];
   visited.add(location);
   const available = new Map(packages.flatMap(definition => {
    const entry = facetValue(definition, facet); return entry === undefined ? [] : [[definition.id, entry] as const];
   }));
   for (const id of requested) if (!available.has(id)) throw Error('Missing definition facet: ' + facet + '/' + String(id));
   const order = [...requested, ...[...available.keys()].filter(id => !requested.includes(id)).sort()];
   const entries = order.map(id => [id, available.get(id)] as const);
   return shape === 'list' ? entries.map(([, entry]) => entry) : Object.fromEntries(entries);
  }
  if (Array.isArray(value)) return value.map((entry, index) => expand(entry, location + '/' + index));
  if (record(value)) {
   if (Object.hasOwn(value, '$catalog')) throw Error('Catalog selector outside its owned table: ' + location);
   return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, expand(entry, location + '/' + key)]));
  }
  return value;
 }
 const result = expand(read(path.join(source, 'content/balancing.json')), '');
 if (!record(result) || visited.size !== Object.keys(tables).length) throw Error('Missing canonical catalog tables.');
 return result;
}
export function defaultScenario(source: string, balance: RecordValue): RecordValue {
 const template = read(path.join(source, 'content/littlewild.pack.json'));
 if (!record(template) || ['libraries', 'simulation', 'scenes', 'worlds'].some(key => Object.hasOwn(template, key)))
  throw Error('Default scenario must inherit canonical defaults.');
 return {...template, libraries: balance.libraries, simulation: balance.simulation, scenes: balance.startingScenes, worlds: [balance.world]};
}
export function writeContent(source: string, generated: string): void {
 // Source mirrors would silently create a second editable authority.
 const mirrors = ['default-library', 'adventure-library', 'world-library', 'growth-library', 'building-interiors'];
 for (const name of mirrors) if (fs.existsSync(path.join(source, 'content', name + '.json'))) throw Error('Duplicate content source: ' + name);
 const balance = balancingDocument(source), libraries = balance.libraries;
 if (!record(libraries)) throw Error('Missing canonical libraries.');
 const output: RecordValue = {
  'balancing': balance, 'default-library': libraries.base, 'adventure-library': libraries.adventure,
  'world-library': libraries.world, 'growth-library': libraries.growth, 'building-interiors': balance.interiors,
  'littlewild.pack': defaultScenario(source, balance)
 };
 for (const [name, document] of Object.entries(output)) fs.writeFileSync(path.join(generated, 'content', name + '.json'), JSON.stringify(document, null, 2) + '\n');
}
