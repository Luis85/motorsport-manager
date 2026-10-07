/** Build-only discovery. Each folder owns one definition; runtime catalogs remain separate values. */
import fs from 'node:fs';
import path from 'node:path';

export type RecordValue = Record<string, unknown>;
export interface Definition extends RecordValue {
 format: 'littlewild-definition';
 schemaVersion: 1;
 family: 'items' | 'buildings' | 'creatures' | 'pets';
 id: string;
 visual?: RecordValue;
 creature?: RecordValue;
}
export const facets: Readonly<Record<Definition['family'], readonly string[]>> = Object.freeze({
 items: ['item', 'weight', 'equipment', 'recipe', 'node', 'itemRequirements', 'recipeRequirements'],
 buildings: ['building', 'physicalBuilding', 'buildingRequirements', 'home'],
 creatures: ['creature'],
 // Pet presentation packages; gameplay rules live in the validated pet game catalog.
 pets: []
});
export const read = (file: string): unknown => JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
export const record = (value: unknown): value is RecordValue =>
 !!value && typeof value === 'object' && !Array.isArray(value);
const folders = (directory: string): string[] => fs.readdirSync(directory, {withFileTypes: true})
 .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();

/**
 * Discover the definitions of one asset directory (a game folder's `assets/`). `interactions`
 * holds a catalog document rather than definition folders.
 */
export function definitions(directory: string): Definition[] {
 const result: Definition[] = [];
 for (const family of folders(directory)) {
  if (family === 'interactions') continue;
  if (!Object.hasOwn(facets, family)) throw Error('Unknown asset family: ' + family);
  const knownFamily = family as Definition['family'];
  for (const id of folders(path.join(directory, family))) {
   const folder = path.join(directory, family, id), file = path.join(folder, 'definition.json');
   for (const legacy of ['asset.json', 'creature.json'])
    if (fs.existsSync(path.join(folder, legacy))) throw Error('Duplicate definition source: ' + family + '/' + id + '/' + legacy);
   if (!fs.existsSync(file)) throw Error('Asset folder is missing definition.json: ' + family + '/' + id);
   const value = read(file);
   if (!record(value) || value.format !== 'littlewild-definition' || value.schemaVersion !== 1 ||
       value.family !== family || value.id !== id || !/^[a-z0-9][a-z0-9_-]{0,60}$/.test(id))
    throw Error('Definition identity/path mismatch: ' + family + '/' + id);
   const allowed: string[] = ['format', 'schemaVersion', 'family', 'id', 'visual', ...facets[knownFamily]];
   if (Object.keys(value).some(key => !allowed.includes(key))) throw Error('Unknown definition facet: ' + family + '/' + id);
   if (!Object.keys(value).some(key => key === 'visual' || facets[knownFamily].includes(key)))
    throw Error('Empty definition: ' + family + '/' + id);
   for (const key of ['visual', ...facets[knownFamily]]) {
    if (!Object.hasOwn(value, key)) continue;
    const facet = value[key];
    if (key === 'weight') {
     if (typeof facet !== 'number' || !Number.isFinite(facet) || facet < 0) throw Error('Invalid item weight: ' + id);
    } else if (!record(facet)) throw Error('Invalid definition facet: ' + id + '/' + key);
   }
   for (const key of ['item', 'equipment', 'building', 'physicalBuilding', 'creature']) {
    const facet = value[key];
    if (record(facet) && facet.id !== id) throw Error('Definition facet identity mismatch: ' + id + '/' + key);
   }
   if (record(value.recipe) && (value.recipe.id !== id || value.recipe.output !== id)) throw Error('Recipe output identity mismatch: ' + id);
   if (record(value.visual)) {
    const category = {items: 'item', buildings: 'building', creatures: 'actor', pets: 'pet'}[knownFamily];
    if (value.visual.format !== 'littlewild-3d-asset' || value.visual.schemaVersion !== 1 || value.visual.id !== id || value.visual.category !== category)
     throw Error('Asset identity/path mismatch: ' + family + '/' + id);
   }
   if (knownFamily === 'creatures' && (!record(value.creature) || value.creature.format !== 'littlewild-creature' || value.creature.schemaVersion !== 1))
    throw Error('Creature folder is missing a valid creature facet: ' + id);
   result.push(value as Definition);
  }
 }
 return result;
}
