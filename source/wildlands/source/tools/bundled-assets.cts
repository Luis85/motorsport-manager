/** Runtime projections from the single authored definition in each asset folder. */
import {read, record, type RecordValue, type Definition} from './definition-source.cjs';
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

export function creatureConfig(catalogFile: string, packages: readonly Definition[]): RecordValue {
 const config = read(catalogFile);
 if (!record(config) || Object.keys(config).length !== 3 || config.format !== 'littlewild-creature-catalog' ||
     config.schemaVersion !== 1 || typeof config.defaultArchetype !== 'string' || !/^[a-z][a-z0-9_-]{0,60}$/.test(config.defaultArchetype))
  throw Error('Invalid creature catalog configuration.');
 if (!creatureDefinitions(packages).some(definition => definition.id === config.defaultArchetype))
  throw Error('Unknown default creature archetype: ' + config.defaultArchetype);
 return config;
}
export function creatureDefinitions(packages: readonly Definition[]): RecordValue[] {
 const result = packages.flatMap(definition => definition.creature ? [definition.creature] : []);
 if (!result.length) throw Error('At least one creature definition is required.');
 return result;
}
/** Pocket Pet presentation assets ship as their own bundle; colony scenarios and saves never embed them. */
export function petAssetDefinitions(packages: readonly Definition[]): RecordValue[] {
 return packages.filter(definition => definition.family === 'pets' && definition.visual).map(definition => definition.visual!)
  .sort((a, b) => compare(String(a.id), String(b.id)));
}
export function assetDefinitions(packages: readonly Definition[]): RecordValue[] {
 const result = packages.flatMap(definition => definition.visual && definition.family !== 'pets' ? [definition.visual] : []);
 const assets = new Map(result.filter(definition => definition.category === 'actor').map(definition => [definition.id, definition]));
 for (const {creature} of packages) {
  if (!creature) continue;
  const asset = assets.get(creature.visualAsset), behaviors = asset?.behaviors, appearances = record(behaviors) ? behaviors.appearances : undefined;
  if (!asset || !Array.isArray(creature.personalities) || creature.personalities.some(personality => typeof personality !== 'string' || !record(appearances) || !Object.hasOwn(appearances, personality)))
   throw Error('Creature visual asset/profile missing: ' + String(creature.id));
 }
 for (const definition of packages) {
  const models = definition.visual?.models;
  if (definition.building && (!record(models) || !models.world)) throw Error('Building world model missing: ' + definition.id);
  if (definition.item && (!record(models) || !(models.world || models.carry))) throw Error('Item world/carry model missing: ' + definition.id);
  if (definition.equipment && (!record(models) || !models.equipped)) throw Error('Equipment model missing: ' + definition.id);
 }
 return result.sort((a, b) => compare(String(a.category) + ':' + String(a.id), String(b.category) + ':' + String(b.id)));
}
