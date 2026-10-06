/** Compile supported content identities from authored facets; keep executable grammar unchanged. */
import {record, type RecordValue} from './definition-source.cjs';

export function librarySchema(template: unknown, balance: RecordValue): RecordValue {
 if (!record(template) || !record(template.$defs) || !record(template.properties)) throw Error('Missing library schema template.');
 const schema = JSON.parse(JSON.stringify(template)) as RecordValue;
 const defs = schema.$defs as RecordValue, rootProperties = schema.properties as RecordValue;
 const libraries = balance.libraries;
 if (!record(libraries) || !record(libraries.base) || !record(libraries.base.components)) throw Error('Missing base library components.');
 const components = libraries.base.components;
 function field(category: string, key: string): RecordValue {
  const definition = defs[category];
  if (!record(definition) || !record(definition.properties) || !record(definition.properties[key])) throw Error('Missing schema field: ' + category + '/' + key);
  return definition.properties[key];
 }
 function identities(category: string): string[] {
  const entries = components[category];
  if (!Array.isArray(entries) || entries.some(entry => !record(entry) || typeof entry.id !== 'string')) throw Error('Invalid content identities: ' + category);
  return entries.map(entry => (entry as {id: string}).id);
 }
 const extras = new Map<string, string[]>();
 for (const category of ['items', 'recipes', 'buildings']) {
  const ids = identities(category), identity = field(category, 'id'), previous = identity.enum;
  if (!Array.isArray(previous)) throw Error('Missing baseline identity vocabulary: ' + category);
  extras.set(category, ids.filter(id => !previous.includes(id)));
  identity.enum = ids;
  const componentSchema = rootProperties.components;
  if (!record(componentSchema) || !record(componentSchema.properties) || !record(componentSchema.properties[category])) throw Error('Missing component array grammar: ' + category);
  const list = componentSchema.properties[category];
  if (typeof list.maxItems !== 'number') throw Error('Missing component array bound: ' + category);
  list.maxItems = Math.max(list.maxItems, ids.length);
  // Added data identities are optional in retained scenario overrides. Native IDs remain mandatory.
  if (extras.get(category)!.length) list.allOf = previous.map(id => ({
   contains: {type: 'object', properties: {id: {const: id}}, required: ['id']}, minContains: 1
  }));
 }
 // Only ID/reference vocabulary expands. Icons, conditions, algorithms and numeric bounds stay compiled.
 const extend = (target: unknown, category: string): void => {
  if (!record(target) || !Array.isArray(target.enum)) throw Error('Missing schema reference vocabulary: ' + category);
  target.enum = [...target.enum, ...extras.get(category)!.filter(id => !(target.enum as unknown[]).includes(id))];
 };
 extend(field('recipes', 'output'), 'items');
 for (const category of ['recipes', 'buildings', 'drills', 'deliveries']) {
  const cost = field(category, 'cost'); extend(cost.propertyNames, 'items');
 }
 for (const category of ['recipes', 'drills']) extend(field(category, 'station'), 'buildings');
 extend(field('paths', 'buildings').items, 'buildings');
 const checks = field('chapters', 'checks').items;
 if (!record(checks) || !record(checks.properties) || !record(checks.properties.condition) || !Array.isArray(checks.properties.condition.oneOf)) throw Error('Missing chapter condition grammar.');
 for (const condition of checks.properties.condition.oneOf) {
  if (!record(condition) || !record(condition.properties) || !record(condition.properties.type)) throw Error('Invalid chapter condition grammar.');
  if (condition.properties.type.const === 'building') extend(condition.properties.key, 'buildings');
 }
 return schema;
}
