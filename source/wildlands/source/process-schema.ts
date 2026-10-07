/** The JSON Schema is also the runtime structural grammar; no generated validator drift. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessSchema?: Record<string, unknown>};
 const id = {type: 'string', pattern: '^[a-z][a-z0-9-]{0,63}$', maxLength: 64};
 const text = {type: 'string', minLength: 1, maxLength: 120};
 const integer = (maximum: number, minimum = 0) => ({type: 'integer', minimum, maximum});
 const object = (properties: Record<string, unknown>, required = Object.keys(properties), additionalProperties: unknown = false) =>
  ({type: 'object', properties, required, additionalProperties});
 const list = (items: unknown, maxItems: number, minItems = 0) => ({type: 'array', items, minItems, maxItems});
 const scalar = {type: ['string', 'number', 'boolean', 'null'], maxLength: 256, minimum: -1000000000, maximum: 1000000000};
 const fields = {...object({}, [], scalar), maxProperties: 32, propertyNames: {pattern: '^[a-z][a-zA-Z0-9_]{0,63}$'}};
 const scene = object({id, position: {...list({type: 'number', minimum: -10000, maximum: 10000}, 2, 2)},
  color: {type: 'string', pattern: '^#[0-9a-fA-F]{6}$'}, asset: {type: 'object'}}, ['id', 'position', 'color']);
 const step = object({id, name: text, kind: {enum: ['start', 'task', 'decision', 'fork', 'join', 'end']}, scene,
  description: {type: 'string', maxLength: 2000}, duration: integer(100000, 1), cost: integer(100000000),
  resources: {...object({}, [], integer(1000, 1)), maxProperties: 32, propertyNames: id}, set: fields, join: id}, ['id', 'name', 'kind', 'scene']);
 const condition = object({field: {type: 'string', pattern: '^[a-z][a-zA-Z0-9_]{0,63}$'}, op: {enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte']}, value: scalar});
 const flow = object({id, from: id, to: id, label: text, when: condition}, ['id', 'from', 'to']);
 const resource = object({id, name: text, capacity: integer(1000, 1), costPerMinute: integer(100000)});
 const arrival = object({at: integer(100000), count: integer(200, 1), interval: integer(100000), data: fields});
 const schema = {$schema: 'http://json-schema.org/draft-07/schema#', $id: 'wildlands-process.schema.json',
  ...object({$schema: {type: 'string', maxLength: 256}, format: {const: 'wildlands-process'}, schemaVersion: {const: 1},
   revision: integer(1000000000), id, name: text, description: {type: 'string', maxLength: 4000}, start: id,
   resources: list(resource, 32), steps: list(step, 128, 2), flows: list(flow, 256, 1), arrivals: list(arrival, 32, 1)},
   ['format', 'schemaVersion', 'revision', 'id', 'name', 'start', 'resources', 'steps', 'flows', 'arrivals'])};
 root.LWProcessSchema = schema;
 if (typeof module !== 'undefined' && module.exports) module.exports = schema;
})(globalThis);
