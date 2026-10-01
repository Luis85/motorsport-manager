/* A bounded validator for the keywords in our bundled schema, not arbitrary schemas.
 * No external refs, regexes, source code or URLs are loaded from content. */
(function (root) {
  'use strict';
  const stable=value=>Array.isArray(value)?'['+value.map(stable).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}':JSON.stringify(value);
  function validate(value, schema) {
    const errors = [];
    function visit(v, s, path, out=errors) {
      if (out.length >= 80) return;
      const fail = message => out.push((path || '/') + ': ' + message);
      if (s.$ref) {
        let ref = schema;
        for (const part of s.$ref.slice(2).split('/')) ref = ref[part.replace(/~1/g,'/').replace(/~0/g,'~')];
        visit(v, ref, path, out); return;
      }
      if ('const' in s && stable(v) !== stable(s.const)) fail('unexpected constant');
      if (s.enum && !s.enum.some(item=>stable(item)===stable(v))) fail('choose a supported value');
      if (s.type) {
        const valid = s.type === 'array' ? Array.isArray(v) : s.type === 'object' ?
          v !== null && typeof v === 'object' && !Array.isArray(v) :
          s.type === 'integer' ? Number.isInteger(v) : s.type==='null' ? v===null : typeof v === s.type;
        if (!valid) { fail('expected ' + s.type); return; }
      }
      if (typeof v === 'number' && (!Number.isFinite(v) || v < (s.minimum ?? -Infinity) || v > (s.maximum ?? Infinity))) fail('outside supported bounds');
      if (typeof v === 'string' && (v.length < (s.minLength ?? 0) || v.length > (s.maxLength ?? Infinity) || s.pattern && !new RegExp(s.pattern, 'u').test(v))) fail('invalid text');
      if (Array.isArray(v)) {
        if (v.length < (s.minItems ?? 0) || v.length > (s.maxItems ?? Infinity)) fail('unsupported entry count');
        if (s.uniqueItems && new Set(v.map(stable)).size!==v.length)fail('entries must be unique');
        if (s.items) v.forEach((entry, i) => visit(entry, s.items, path + '/' + i, out));
      } else if (v && typeof v === 'object') {
        if (Object.keys(v).length < (s.minProperties ?? 0)) fail('too few properties');
        if (Object.keys(v).length > (s.maxProperties ?? Infinity)) fail('too many properties');
        for (const k of s.required || []) if (!Object.hasOwn(v, k)) fail('missing ' + k);
        for (const [k, entry] of Object.entries(v)) {
          if (s.propertyNames) visit(k, s.propertyNames, path + '/' + k, out);
          const next = s.properties?.[k] ?? s.additionalProperties;
          if (next === false) fail('unknown field ' + k);
          else if (next && typeof next === 'object') visit(entry, next, path + '/' + k, out);
        }
      }
      for(const rule of s.allOf||[])visit(v,rule,path,out);
      if(s.not){const local=[];visit(v,s.not,path,local);if(local.length===0)fail('matches a forbidden shape');}
      if(s.if){const local=[];visit(v,s.if,path,local);if(local.length===0&&s.then)visit(v,s.then,path,out);else if(local.length&&s.else)visit(v,s.else,path,out);}
      for(const key of ['anyOf','oneOf'])if(s[key]){
        const matches=s[key].filter(rule=>{const local=[];visit(v,rule,path,local);return local.length===0;}).length;
        if(matches===0||(key==='oneOf'&&matches!==1))fail('does not match a supported shape');
      }
    }
    visit(value, schema, ''); return errors;
  }
  root.LWScenarioShape = validate;
  if (typeof module !== 'undefined' && module.exports) module.exports = validate;
})(typeof globalThis !== 'undefined' ? globalThis : this);
