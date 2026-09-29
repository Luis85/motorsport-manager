/* A bounded validator for the keywords in our bundled schema, not arbitrary schemas.
 * No external refs, regexes, source code or URLs are loaded from content. */
(function (root) {
  'use strict';
  function validate(value, schema) {
    const errors = [];
    function visit(v, s, path) {
      if (errors.length >= 80) return;
      const fail = message => errors.push((path || '/') + ': ' + message);
      if (s.$ref) {
        let ref = schema;
        for (const part of s.$ref.slice(2).split('/')) ref = ref[part];
        visit(v, ref, path); return;
      }
      if ('const' in s && v !== s.const) fail('unexpected constant');
      if (s.enum && !s.enum.includes(v)) fail('choose a supported value');
      if (s.type) {
        const valid = s.type === 'array' ? Array.isArray(v) : s.type === 'object' ?
          v !== null && typeof v === 'object' && !Array.isArray(v) :
          s.type === 'integer' ? Number.isInteger(v) : typeof v === s.type;
        if (!valid) { fail('expected ' + s.type); return; }
      }
      if (typeof v === 'number' && (!Number.isFinite(v) || v < (s.minimum ?? -Infinity) || v > (s.maximum ?? Infinity))) fail('outside supported bounds');
      if (typeof v === 'string' && (v.length < (s.minLength ?? 0) || v.length > (s.maxLength ?? Infinity) || s.pattern && !new RegExp(s.pattern, 'u').test(v))) fail('invalid text');
      if (Array.isArray(v)) {
        if (v.length < (s.minItems ?? 0) || v.length > (s.maxItems ?? Infinity)) fail('unsupported entry count');
        if (s.items) v.forEach((entry, i) => visit(entry, s.items, path + '/' + i));
      } else if (v && typeof v === 'object') {
        if (Object.keys(v).length > (s.maxProperties ?? Infinity)) fail('too many properties');
        for (const k of s.required || []) if (!Object.hasOwn(v, k)) fail('missing ' + k);
        for (const [k, entry] of Object.entries(v)) {
          if (s.propertyNames) visit(k, s.propertyNames, path + '/' + k);
          const next = s.properties?.[k] ?? s.additionalProperties;
          if (next === false) fail('unknown field ' + k);
          else if (next && typeof next === 'object') visit(entry, next, path + '/' + k);
        }
      }
    }
    visit(value, schema, ''); return errors;
  }
  root.LWScenarioShape = validate;
  if (typeof module !== 'undefined' && module.exports) module.exports = validate;
})(typeof globalThis !== 'undefined' ? globalThis : this);
