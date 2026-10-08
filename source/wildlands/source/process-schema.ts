/// <reference path="./process-contracts.d.ts" />
/** The JSON Schema is also the runtime structural grammar; no generated validator drift. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessSchema?: Record<string, unknown>; LWProcessLimits?: LWProcess.Limits};
 // Single source of the fixed run bounds; graph, systems and the runtime read this frozen value.
 const limits: LWProcess.Limits = Object.freeze({cases: 200, minutes: 100000, transitions: 2048, events: 128, receipts: 128, active: 500, retained: 200});
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
 const fieldName = {type: 'string', pattern: '^[a-z][a-zA-Z0-9_]{0,63}$'};
// Random variables are closed integer shapes; per-kind required fields and ranges are semantic graph checks.
 const dist = object({dist: {enum: ['uniform', 'triangular', 'exponential', 'normal', 'erlang']}, min: integer(limits.minutes, 1), mode: integer(limits.minutes, 1), max: integer(limits.minutes, 1), mean: integer(limits.minutes, 1), sd: integer(limits.minutes, 1), k: integer(32, 1)}, ['dist']);
 const draw = object({field: {type: 'string', pattern: '^[a-z][a-zA-Z0-9_]{0,63}$'}, kind: {enum: ['chance', 'choice', 'int']}, percent: integer(100), whenTrue: scalar, whenFalse: scalar,
  values: list(object({value: scalar, weight: integer(1000000)}), 12), min: integer(1000000000, -1000000000), max: integer(1000000000, -1000000000)}, ['field', 'kind']);
 const need = object({field: fieldName, op: {enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte']}, value: scalar, label: text}, ['field']);
 // Counter deltas: whole numbers within a million; emptiness and zero are semantic checks in the graph.
 const counters = {...object({}, [], integer(1000000, -1000000)), maxProperties: 8, propertyNames: fieldName};
 // Declared output interface of a working step; the graph checks the step really delivers each field.
 const output = object({field: fieldName, label: text}, ['field']);
 const backlog = object({capacity: integer(limits.cases, 1), order: {enum: ['fifo', 'lifo', 'priority']}, priority: fieldName, pull: integer(limits.cases, 1)}, ['capacity']);
 const step = object({id, name: text, kind: {enum: ['start', 'task', 'touchpoint', 'machine', 'system', 'timer', 'decision', 'fork', 'join', 'end']}, scene,
  description: {type: 'string', maxLength: 2000}, duration: integer(limits.minutes, 1), cost: integer(100000000),
  resources: {...object({}, [], integer(1000, 1)), maxProperties: 32, propertyNames: id}, set: fields, add: counters, until: integer(limits.minutes - 1, 1), join: id, needs: list(need, 16), backlog,
  technology: {type: 'string', minLength: 1, maxLength: 80}, outputs: list(output, 16), timing: dist, draws: list(draw, 8),
  // Fork mode, multi-instance items and boundary deadlines; which kinds may declare them and the exactly-one rules are semantic graph checks.
  mode: {enum: ['inclusive']}, instances: object({count: integer(50, 2), field: fieldName, mode: {enum: ['parallel', 'sequential']}}, ['mode']),
  deadline: object({after: integer(limits.minutes, 1), timing: dist, mode: {enum: ['interrupt', 'escalate']}, flow: id}, ['mode', 'flow']),
  // Journey annotations are display and analysis only; channel is a touchpoint-only graph rule, outcome an end-only graph rule.
  phase: {type: 'string', minLength: 1, maxLength: 40}, emotion: integer(3, -3), pain: {type: 'string', minLength: 1, maxLength: 240}, opportunity: {type: 'string', minLength: 1, maxLength: 240},
  channel: {enum: ['web', 'mobile', 'store', 'phone', 'chat', 'email', 'social', 'ads', 'delivery', 'document']}, outcome: {enum: ['goal', 'lost']}}, ['id', 'name', 'kind', 'scene']);
 // A condition is a field comparison, a `chance` route or an all/any/not combinator of conditions (a recursive definition);
 // exactly-one-form, depth and leaf limits are semantic graph checks.
 const conditionRef = {$ref: '#/definitions/condition'};
 const condition = object({field: fieldName, op: {enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte']}, value: scalar, valueField: fieldName, chance: integer(100), all: list(conditionRef, 8), any: list(conditionRef, 8), not: conditionRef}, []);
 const flow = object({id, from: id, to: id, label: text, when: conditionRef, on: {enum: ['deadline']}}, ['id', 'from', 'to']);
 const resource = object({id, name: text, capacity: integer(1000, 1), costPerMinute: integer(100000), kind: {enum: ['people', 'machine', 'system']}}, ['id', 'name', 'capacity', 'costPerMinute']);
 const arrival = object({at: integer(limits.minutes), count: integer(limits.cases, 1), until: integer(limits.minutes, 1), open: {const: true}, interval: integer(limits.minutes), gap: dist, draws: list(draw, 8), data: fields}, ['at', 'interval', 'data']);
 // SIPOC parties are descriptive only: suppliers and customers; inputs, process and outputs are derived by views.
 const party = (detail: string) => object({name: {type: 'string', minLength: 1, maxLength: 60}, [detail]: {type: 'string', minLength: 1, maxLength: 160}}, ['name']);
 const sipoc = object({suppliers: list(party('supplies'), 8), customers: list(party('receives'), 8)}, []);
 const schema = {$schema: 'http://json-schema.org/draft-07/schema#', $id: 'wildlands-process.schema.json', definitions: {condition},
  ...object({$schema: {type: 'string', maxLength: 256}, format: {const: 'wildlands-process'}, schemaVersion: {const: 1},
   revision: integer(1000000000), seed: integer(2147483647), id, name: text, description: {type: 'string', maxLength: 4000}, start: id,
   genre: {enum: ['process', 'customer-journey', 'user-journey']}, track: list(object({field: fieldName, label: {type: 'string', minLength: 1, maxLength: 40}}, ['field']), 6), sipoc,
   resources: list(resource, 32), steps: list(step, 128, 2), flows: list(flow, 256, 1), arrivals: list(arrival, 32, 1)},
   ['format', 'schemaVersion', 'revision', 'id', 'name', 'start', 'resources', 'steps', 'flows', 'arrivals'])};
 root.LWProcessLimits = limits; root.LWProcessSchema = schema;
 if (typeof module !== 'undefined' && module.exports) module.exports = schema;
})(globalThis);
