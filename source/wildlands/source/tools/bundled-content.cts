/** Assemble authoring catalogs into unchanged portable/runtime document formats. */
import fs from 'node:fs';
import {librarySchema} from './bundled-library-schema.cjs';
import path from 'node:path';
import {read, record, type Definition, type RecordValue} from './definition-source.cjs';

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
/** Expand the authored balancing document's catalog selectors over the discovered definitions. */
export function balancingDocument(balancingFile: string, packages: readonly Definition[]): RecordValue {
 const visited = new Set<string>();
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
 const result = expand(read(balancingFile), '');
 if (!record(result) || visited.size !== Object.keys(tables).length) throw Error('Missing canonical catalog tables.');
 return result;
}
/** The canonical pack inherits libraries, simulation, starting scenes and the default world from balancing. */
export function defaultScenario(templateFile: string, balance: RecordValue): RecordValue {
 const template = read(templateFile);
 if (!record(template) || ['libraries', 'simulation', 'scenes', 'worlds'].some(key => Object.hasOwn(template, key)))
  throw Error('Default scenario must inherit canonical defaults.');
 return {...template, libraries: balance.libraries, simulation: balance.simulation, scenes: balance.startingScenes, worlds: [balance.world]};
}
/** Authored inputs of the compiled colony content documents. */
export interface ContentSources {
 /** Authored balancing document with catalog selectors. */
 readonly balancing: string;
 /** The canonical template pack that inherits the balancing defaults; absent when every pack is complete. */
 readonly templatePack?: string;
 /** Engine-owned library schema template: a file, or the already loaded document. */
 readonly librarySchema: string | {readonly document: unknown};
 /** Directories that must not hold standalone library mirrors (engine content and the game's content). */
 readonly contentDirectories: readonly string[];
 readonly packages: readonly Definition[];
}
/** The generated `.generated/content` documents, keyed by name without `.json`. */
export function contentDocuments(sources: ContentSources): RecordValue {
 // Source mirrors would silently create a second editable authority.
 const mirrors = ['default-library', 'adventure-library', 'world-library', 'growth-library', 'building-interiors'];
 for (const directory of sources.contentDirectories) for (const name of mirrors)
  if (fs.existsSync(path.join(directory, name + '.json'))) throw Error('Duplicate content source: ' + name);
 const balance = balancingDocument(sources.balancing, sources.packages), libraries = balance.libraries;
 if (!record(libraries)) throw Error('Missing canonical libraries.');
 const template = sources.templatePack === undefined ? null : path.basename(sources.templatePack, '.json');
 return {
  'library.schema': librarySchema(typeof sources.librarySchema === 'string' ? read(sources.librarySchema) : sources.librarySchema.document, balance),
  'balancing': balance, 'default-library': libraries.base, 'adventure-library': libraries.adventure,
  'world-library': libraries.world, 'growth-library': libraries.growth, 'building-interiors': balance.interiors,
  ...template === null ? {} : {[template]: defaultScenario(sources.templatePack!, balance)}
 };
}
export function writeContent(generated: string, documents: RecordValue): void {
 for (const [name, document] of Object.entries(documents)) fs.writeFileSync(path.join(generated, 'content', name + '.json'), JSON.stringify(document, null, 2) + '\n');
}
