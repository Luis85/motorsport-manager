/* A bounded validator for the keywords in our bundled schema, not arbitrary schemas.
 * No external refs, source code or URLs are loaded from content. */
(function (inputRoot: unknown) {
  'use strict';

  type JsonSchemaType = 'array' | 'object' | 'integer' | 'null' | 'string' | 'number' | 'boolean';
  interface JsonSchema {
    $ref?: string;
    const?: unknown;
    enum?: unknown[];
    type?: JsonSchemaType;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
    items?: JsonSchema;
    minProperties?: number;
    maxProperties?: number;
    required?: string[];
    propertyNames?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    additionalProperties?: boolean | JsonSchema;
    allOf?: JsonSchema[];
    not?: JsonSchema;
    if?: JsonSchema;
    then?: JsonSchema;
    else?: JsonSchema;
    anyOf?: JsonSchema[];
    oneOf?: JsonSchema[];
    [key: string]: unknown;
  }
  type ScenarioShapeValidator = (value: unknown, schema: JsonSchema) => string[];
  interface LittlewildRoot { LWScenarioShape?: ScenarioShapeValidator; }
  const root = inputRoot as LittlewildRoot;

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

  const stable = (value: unknown): string => {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (isRecord(value)) {
      return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
    }
    return JSON.stringify(value) ?? 'undefined';
  };

  function resolveRef(schema: JsonSchema, ref: string): JsonSchema {
    if (!ref.startsWith('#/')) throw Error('Only local schema references are supported.');
    let current: unknown = schema;
    for (const part of ref.slice(2).split('/')) {
      if (!isRecord(current)) throw Error('Invalid local schema reference.');
      current = current[part.replace(/~1/g, '/').replace(/~0/g, '~')];
    }
    if (!isRecord(current)) throw Error('Invalid local schema reference.');
    return current as JsonSchema;
  }

  function validate(value: unknown, schema: JsonSchema): string[] {
    const errors: string[] = [];
    function visit(v: unknown, s: JsonSchema, path: string, out: string[] = errors): void {
      if (out.length >= 80) return;
      const fail = (message: string): void => { out.push((path || '/') + ': ' + message); };
      if (s.$ref) {
        visit(v, resolveRef(schema, s.$ref), path, out);
        return;
      }
      if ('const' in s && stable(v) !== stable(s.const)) fail('unexpected constant');
      if (s.enum && !s.enum.some(item => stable(item) === stable(v))) fail('choose a supported value');
      if (s.type) {
        const valid = s.type === 'array' ? Array.isArray(v) : s.type === 'object' ? isRecord(v) :
          s.type === 'integer' ? Number.isInteger(v) : s.type === 'null' ? v === null : typeof v === s.type;
        if (!valid) { fail('expected ' + s.type); return; }
      }
      if (typeof v === 'number' && (!Number.isFinite(v) || v < (s.minimum ?? -Infinity) || v > (s.maximum ?? Infinity)))
        fail('outside supported bounds');
      if (typeof v === 'string' && (v.length < (s.minLength ?? 0) || v.length > (s.maxLength ?? Infinity) ||
        (s.pattern !== undefined && !new RegExp(s.pattern, 'u').test(v)))) fail('invalid text');
      if (Array.isArray(v)) {
        if (v.length < (s.minItems ?? 0) || v.length > (s.maxItems ?? Infinity)) fail('unsupported entry count');
        if (s.uniqueItems && new Set(v.map(stable)).size !== v.length) fail('entries must be unique');
        if (s.items) v.forEach((entry, index) => visit(entry, s.items!, path + '/' + index, out));
      } else if (isRecord(v)) {
        if (Object.keys(v).length < (s.minProperties ?? 0)) fail('too few properties');
        if (Object.keys(v).length > (s.maxProperties ?? Infinity)) fail('too many properties');
        for (const key of s.required ?? []) if (!Object.hasOwn(v, key)) fail('missing ' + key);
        for (const [key, entry] of Object.entries(v)) {
          if (s.propertyNames) visit(key, s.propertyNames, path + '/' + key, out);
          const next = s.properties?.[key] ?? s.additionalProperties;
          if (next === false) fail('unknown field ' + key);
          else if (isRecord(next)) visit(entry, next as JsonSchema, path + '/' + key, out);
        }
      }
      for (const rule of s.allOf ?? []) visit(v, rule, path, out);
      if (s.not) {
        const local: string[] = [];
        visit(v, s.not, path, local);
        if (local.length === 0) fail('matches a forbidden shape');
      }
      if (s.if) {
        const local: string[] = [];
        visit(v, s.if, path, local);
        if (local.length === 0 && s.then) visit(v, s.then, path, out);
        else if (local.length && s.else) visit(v, s.else, path, out);
      }
      for (const key of ['anyOf', 'oneOf'] as const) {
        const rules = s[key];
        if (!rules) continue;
        const matches = rules.filter(rule => {
          const local: string[] = [];
          visit(v, rule, path, local);
          return local.length === 0;
        }).length;
        if (matches === 0 || (key === 'oneOf' && matches !== 1)) fail('does not match a supported shape');
      }
    }
    visit(value, schema, '');
    return errors;
  }
  root.LWScenarioShape = validate;
  if (typeof module !== 'undefined' && module.exports) module.exports = validate;
})(globalThis);
