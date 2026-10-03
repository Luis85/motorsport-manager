/* Littlewild content boundary. Pure data validation, deterministic diffing and stable runtime tables.
 * No DOM, storage, network, dynamic code execution or game-state writes.
 * JSON Schema covers shape. Semantic checks cover IDs, references and acquisition cycles.
 */
(function (root) {
  'use strict';
  const IS_NODE = typeof module !== 'undefined' && module.exports;
  const DEFAULT = IS_NODE ? require('./content/default-library.json') : root.LWDefaultLibrary;
  const SCHEMA = IS_NODE ? require('./content/library.schema.json') : root.LWContentSchema;
  const MAX_BYTES = 1024 * 1024, MAX_DEPTH = 24, MAX_NODES = 60000;
  const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);
  const CATEGORIES = {
    items: 'Items', recipes: 'Recipes', skills: 'Skills & lessons', buildings: 'Buildings',
    drills: 'Practice drills', disciplines: 'Disciplines', teachingStyles: 'Teaching styles',
    buildingApproaches: 'Building approaches', talents: 'Talents', studies: 'Field studies',
    paths: 'Learning paths', deliveries: 'Deliveries', chapters: 'Story chapters'
  };
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  function cloneJson(value) {
    if (Array.isArray(value)) return value.map(cloneJson);
    if (value && typeof value === 'object') {
      const result = Object.create(Object.getPrototypeOf(value) === null ? null : Object.prototype);
      for (const key of Object.keys(value)) result[key] = cloneJson(value[key]);
      return result;
    }
    return value;
  }
  function copy(value) { inspectJson(value); return cloneJson(value); }
  const pointer = key => String(key).replace(/~/g, '~0').replace(/\//g, '~1');
  const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  const stable = value => Array.isArray(value) ? '[' + value.map(stable).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}' : JSON.stringify(value);
  /** An opaque, deterministic change identifier; NOT a cryptographic signature. */
  function fingerprint(doc) {
    const safe = copy(doc);
    const s = stable({schemaVersion: safe.schemaVersion, library: safe.library, components: safe.components});
    let a = 2166136261, b = 0x9e3779b9;
    for (let i = 0; i < s.length; i++) { a = Math.imul(a ^ s.charCodeAt(i), 16777619); b = Math.imul(b ^ s.charCodeAt(i), 2246822519); }
    return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
  }
  function diagnostic(code, path, message, hint = '', severity = 'error') { return {severity, code, path: path || '/', message, hint}; }
  class ContentError extends Error {
    constructor(issues) { super(issues[0]?.message || 'Invalid content file.'); this.name = 'ContentError'; this.issues = issues; }
  }
  /** JSON.parse accepts duplicate keys. Reject them instead of silently losing authored data. */
  function rejectDuplicateKeys(text) {
    const stack = [];
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '{') stack.push(new Set());
      else if (c === '[') stack.push(null);
      else if (c === '}' || c === ']') stack.pop();
      else if (c === '"') {
        const begin = i++;
        while (i < text.length) { if (text[i] === '\\') i += 2; else if (text[i] === '"') break; else i++; }
        let next = i + 1; while (/\s/.test(text[next] || '') && next < text.length) next++;
        if (text[next] === ':' && stack[stack.length - 1] instanceof Set) {
          const key = JSON.parse(text.slice(begin, i + 1)), keys = stack[stack.length - 1];
          if (keys.has(key)) throw new ContentError([diagnostic('DUPLICATE_KEY', '/', 'Duplicate JSON property “' + key + '”.', 'Remove the duplicate key; line ' + text.slice(0, begin).split('\n').length + '.')]);
          keys.add(key);
        }
      }
    }
  }
  function inspectJson(value) {
    let count = 0;
    const ancestors = new Set();
    function invalid(path, message) { throw new ContentError([diagnostic('JSON_ONLY', path, message)]); }
    function walk(v, path, depth) {
      if (++count > MAX_NODES || depth > MAX_DEPTH) throw new ContentError([diagnostic('COMPLEXITY_LIMIT', path, 'This file is too deeply nested or contains too many values.')]);
      if (v === null || typeof v === 'boolean') return;
      if (typeof v === 'number') { if (!Number.isFinite(v)) throw new ContentError([diagnostic('FINITE_NUMBER', path, 'Numbers must be finite.')]); return; }
      if (typeof v === 'string') { if ([...v].length > 10000) throw new ContentError([diagnostic('TEXT_LIMIT', path, 'This text exceeds 10,000 characters.')]); return; }
      if (typeof v !== 'object') invalid(path, 'Only JSON data is accepted; functions and undefined values are not content.');
      if (!Array.isArray(v) && ![Object.prototype, null].includes(Object.getPrototypeOf(v))) throw new ContentError([diagnostic('PLAIN_OBJECT', path, 'Only plain JSON objects are accepted.')]);
      if (ancestors.has(v)) invalid(path, 'Cyclic object graphs are not JSON content.');
      if (Object.getOwnPropertySymbols(v).length) invalid(path, 'Symbol-keyed properties are not JSON content.');
      ancestors.add(v);
      try {
        if (Array.isArray(v)) {
          const names = Object.getOwnPropertyNames(v);
          if (names.length !== v.length + 1 || !names.includes('length')) invalid(path, 'Arrays must be dense JSON lists with no extra properties.');
          for (let i = 0; i < v.length; i++) {
            const descriptor = Object.getOwnPropertyDescriptor(v, String(i));
            if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set)
              invalid(path + '/' + i, 'Accessors and hidden array values are not JSON content.');
            walk(descriptor.value, path + '/' + i, depth + 1);
          }
          return;
        }
        for (const [k, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(v))) {
          if (FORBIDDEN.has(k)) throw new ContentError([diagnostic('UNSAFE_KEY', path + '/' + pointer(k), 'Reserved object property is not allowed.')]);
          if (!descriptor.enumerable || descriptor.get || descriptor.set)
            invalid(path + '/' + pointer(k), 'Accessors and hidden properties are not JSON content.');
          walk(descriptor.value, path + '/' + pointer(k), depth + 1);
        }
      } finally { ancestors.delete(v); }
    }
    walk(value, '', 0);
  }
  function parse(input, limit = MAX_BYTES) {
    if (typeof input !== 'string') { inspectJson(input); const serialized = JSON.stringify(input); if (new TextEncoder().encode(serialized).length > limit) throw new ContentError([diagnostic('FILE_LIMIT', '/', 'Content exceeds the file size limit.')]); return cloneJson(input); }
    if (new TextEncoder().encode(input).length > limit) throw new ContentError([diagnostic('FILE_LIMIT', '/', 'Content exceeds the ' + Math.round(limit / 1024) + ' KiB file size limit.')]);
    let value;
    try { value = JSON.parse(input.replace(/^\uFEFF/, '')); } catch (error) { throw new ContentError([diagnostic('JSON_SYNTAX', '/', 'Could not read JSON: ' + error.message, 'Export UTF-8 JSON with no comments or trailing commas.')]); }
    rejectDuplicateKeys(input); inspectJson(value); return value;
  }
  /** Evaluates only the documented JSON Schema keywords used by our own offline contract.
   * It is intentionally NOT an arbitrary-schema validator. No remote references are resolved.
   */
  function validateShape(value) {
    const errors = [];
    function visit(v, s, path, out) {
      if (out.length >= 100) return;
      if (s.$ref) { let target = SCHEMA; for (const part of s.$ref.slice(2).split('/')) target = target[part.replace(/~1/g, '/').replace(/~0/g, '~')]; return visit(v, target, path, out); }
      const add = (code, message, hint = '') => out.push(diagnostic(code, path, message, hint));
      if (own(s, 'const') && stable(v) !== stable(s.const)) add('CONSTANT', 'Expected ' + JSON.stringify(s.const) + '.');
      if (s.enum && !s.enum.some(item => stable(item) === stable(v))) add('KNOWN_VALUE', 'Unknown value ' + JSON.stringify(v) + '.', 'Use a supported value from the exported schema.');
      if (s.type) {
        const valid = s.type === 'null' ? v === null : s.type === 'array' ? Array.isArray(v) : s.type === 'object' ? !!v && typeof v === 'object' && !Array.isArray(v) : s.type === 'integer' ? Number.isInteger(v) : typeof v === s.type;
        if (!valid) { add('TYPE', 'Expected ' + s.type + '.'); return; }
      }
      if (typeof v === 'number') {
        if (s.minimum !== undefined && v < s.minimum) add('MINIMUM', 'Must be at least ' + s.minimum + '.');
        if (s.maximum !== undefined && v > s.maximum) add('MAXIMUM', 'Must be no more than ' + s.maximum + '.');
      }
      if (typeof v === 'string') {
        if (s.minLength !== undefined && [...v].length < s.minLength) add('TEXT_REQUIRED', 'Text must not be empty.');
        if (s.maxLength !== undefined && [...v].length > s.maxLength) add('TEXT_LENGTH', 'Text exceeds ' + s.maxLength + ' characters.');
        if (s.pattern && !new RegExp(s.pattern, 'u').test(v)) add('TEXT_FORMAT', 'Text does not match the expected format.', 'Labels are plain text, not HTML. IDs and versions have restricted formats.');
      }
      if (Array.isArray(v)) {
        if (s.minItems !== undefined && v.length < s.minItems) add('MIN_ITEMS', 'At least ' + s.minItems + ' entries required.');
        if (s.maxItems !== undefined && v.length > s.maxItems) add('MAX_ITEMS', 'No more than ' + s.maxItems + ' entries supported.');
        if (s.uniqueItems && new Set(v.map(stable)).size !== v.length) add('DUPLICATE_VALUE', 'List entries must be unique.');
        if (s.items) v.forEach((item, i) => visit(item, s.items, path + '/' + i, out));
      }
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const keys = Object.keys(v);
        if (s.minProperties !== undefined && keys.length < s.minProperties) add('EMPTY_OBJECT', 'This object must not be empty.');
        if (s.maxProperties !== undefined && keys.length > s.maxProperties) add('MAX_PROPERTIES', 'Too many properties.');
        for (const k of s.required || []) if (!own(v, k)) out.push(diagnostic('REQUIRED', path + '/' + pointer(k), 'Missing required property “' + k + '”.'));
        for (const k of keys) {
          if (s.propertyNames) visit(k, s.propertyNames, path + '/' + pointer(k), out);
          if (s.properties && own(s.properties, k)) visit(v[k], s.properties[k], path + '/' + pointer(k), out);
          else if (s.additionalProperties === false) out.push(diagnostic('UNKNOWN_FIELD', path + '/' + pointer(k), 'Unknown property “' + k + '”.', 'Store tool-specific metadata inside extensions.'));
          else if (s.additionalProperties && typeof s.additionalProperties === 'object') visit(v[k], s.additionalProperties, path + '/' + pointer(k), out);
        }
      }
      for (const rule of s.allOf || []) visit(v, rule, path, out);
      for (const key of ['anyOf', 'oneOf']) if (s[key]) {
        const matches = s[key].map(rule => { const local = []; visit(v, rule, path, local); return local.length === 0; }).filter(Boolean).length;
        if (matches === 0 || key === 'oneOf' && matches !== 1) add('VARIANT', 'Value does not match a supported ' + (key === 'oneOf' ? 'single ' : '') + 'shape.');
      }
      if (s.if) { const local = []; visit(v, s.if, path, local); const branch = local.length === 0 ? s.then : s.else; if (branch) visit(v, branch, path, out); }
    }
    visit(value, SCHEMA, '', errors); return errors;
  }
  const index = arr => Object.fromEntries(arr.map(entry => [entry.id, entry]));
  function validateSemantics(doc) {
    const errors = [], maps = Object.fromEntries(Object.entries(doc.components).map(([k, arr]) => [k, index(arr)]));
    for (const [category, definitions] of Object.entries(doc.components)) {
      const seen = new Set();
      definitions.forEach((def, i) => { if (seen.has(def.id)) errors.push(diagnostic('DUPLICATE_ID', '/components/' + category + '/' + i + '/id', 'Duplicate component ID “' + def.id + '”.')); seen.add(def.id); });
      for (const def of DEFAULT.components[category]) if (!seen.has(def.id)) errors.push(diagnostic('REQUIRED_COMPONENT', '/components/' + category, 'The existing runtime requires ' + category + '/' + def.id + '.', 'Stable IDs cannot be deleted or renamed. Use a patch to update selected components.'));
    }
    if (errors.length) return errors;
    for (const [i, r] of doc.components.recipes.entries()) if (r.output !== r.id) errors.push(diagnostic('OUTPUT_BINDING', '/components/recipes/' + i + '/output', 'The recipe ID must equal its output item ID in this runtime.'));
    doc.components.talents.forEach((t, i) => { const base = DEFAULT.components.talents.find(b => b.id === t.id); if (t.discipline !== base.discipline) errors.push(diagnostic('RUNTIME_BINDING', '/components/talents/' + i + '/discipline', 'This talent is bound to its existing discipline.')); });
    doc.components.studies.forEach((s, i) => { if (new Set(s.goals.map(g => g.event)).size !== s.goals.length) errors.push(diagnostic('DUPLICATE_EVENT', '/components/studies/' + i + '/goals', 'Field-study goals must use distinct evidence events.')); });
    // Model actual acquisition dependencies, including a station's own bill of materials.
    // This catches e.g. a workbench requiring planks that can only be made at a workbench.
    const graph = new Map();
    for (const s of doc.components.skills) graph.set('skill:' + s.id, [...s.requires.map(id => 'skill:' + id), ...(s.practical ? ['skill:' + s.practical.skill, ...(maps.drills[s.practical.skill].station ? ['building:' + maps.drills[s.practical.skill].station] : [])] : [])]);
    for (const r of doc.components.recipes) graph.set('item:' + r.output, ['skill:' + r.skill, 'building:' + r.station, ...Object.keys(r.cost).map(id => 'item:' + id)]);
    for (const b of doc.components.buildings) graph.set('building:' + b.id, ['skill:' + b.skill, ...Object.keys(b.cost).map(id => 'item:' + id)]);
    const permanent = new Set(), visiting = new Set(), reported = new Set();
    function dfs(node, chain) {
      if (visiting.has(node)) {
        const cycle = [...chain.slice(chain.indexOf(node)), node], key = cycle.slice(0, -1).sort().join('|');
        if (!reported.has(key)) { reported.add(key); const [type, id] = node.split(':'), category = type === 'skill' ? 'skills' : type === 'building' ? 'buildings' : 'recipes'; const n = doc.components[category].findIndex(d => d.id === id); errors.push(diagnostic('DEPENDENCY_CYCLE', '/components/' + category + '/' + n, 'Impossible acquisition cycle: ' + cycle.join(' → '), 'At least one dependency must be obtainable before the thing that requires it.')); }
        return;
      }
      if (permanent.has(node)) return;
      visiting.add(node); for (const next of graph.get(node) || []) dfs(next, [...chain, node]); visiting.delete(node); permanent.add(node);
    }
    for (const node of graph.keys()) dfs(node, []);
    return errors;
  }
  function canonical(doc) {
    const result = copy(doc); result.kind = 'library'; delete result.base;
    for (const category of Object.keys(CATEGORIES)) {
      const map = index(result.components[category]); result.components[category] = DEFAULT.components[category].map(d => map[d.id]);
    }
    return result;
  }
  const PRESENTATION = new Set(['name', 'short', 'desc', 'description', 'unlocks', 'effect', 'title', 'chapter', 'icon', 'label', 'extensions']);
  function diff(before, after) {
    const components = [], fields = [];
    function walk(a, b, path, local, kind) {
      if (stable(a) === stable(b)) return;
      if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[key], b[key], path + '/' + pointer(key), local, kind === 'presentation' || PRESENTATION.has(key) ? 'presentation' : key === 'price' ? 'economy' : 'mechanics');
      } else { const change = {path, before: a ?? null, after: b ?? null, kind}; local.push(change); fields.push(change); }
    }
    const meta = []; walk(before.library, after.library, '/library', meta, 'presentation');
    for (const category of Object.keys(CATEGORIES)) {
      const old = index(before.components[category]);
      for (const [i, entry] of after.components[category].entries()) {
        const changes = []; walk(old[entry.id], entry, '/components/' + category + '/' + i, changes, 'mechanics');
        if (changes.length) components.push({category, id: entry.id, name: entry.name || entry.title || entry.id, fields: changes});
      }
    }
    return {components, metadata: meta, fields, mechanics: fields.filter(f => f.kind === 'mechanics').length, economy: fields.filter(f => f.kind === 'economy').length, presentation: fields.filter(f => f.kind === 'presentation').length};
  }
  function chapterCondition(state, condition) {
    switch (condition.type) {
      case 'stat': return (state.stats[condition.key] || 0) >= condition.gte;
      case 'skill': return !!state.skills[condition.key];
      case 'building': return state.buildings.some(b => b.kind === condition.key);
      case 'bond': return state.bond >= condition.gte;
      default: return false;
    }
  }
  const TABLE_MAP = {items:'RES',recipes:'RECIPES',skills:'SKILLS',buildings:'BUILDINGS',drills:'DRILLS',disciplines:'DISCIPLINES',teachingStyles:'STYLES',buildingApproaches:'APPROACHES',studies:'STUDIES',paths:'PATHS'};
  // Compare against a trusted tree via own descriptors, without reading caller accessors.
  // Review envelopes duplicate validated document values and do not use the document node budget.
  function matchesReview(value, reviewed) {
    if (value === reviewed) return true;
    if (!value || typeof value !== 'object' || !reviewed || typeof reviewed !== 'object') return false;
    if (Array.isArray(value) !== Array.isArray(reviewed) || Object.getOwnPropertySymbols(value).length) return false;
    if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
    const actual = Object.getOwnPropertyDescriptors(value), expected = Object.getOwnPropertyDescriptors(reviewed);
    if (Object.keys(actual).length !== Object.keys(expected).length) return false;
    return Object.entries(expected).every(([key, descriptor]) => own(actual, key) &&
      own(actual[key], 'value') && actual[key].enumerable === descriptor.enumerable &&
      matchesReview(actual[key].value, descriptor.value));
  }
  // The registry owns review evidence and persistent revisions; public preview data is detached.
  const registryReviews = new WeakMap();
  class Registry {
    constructor(defaults = DEFAULT) {
      this.tables = Object.fromEntries([...Object.values(TABLE_MAP), 'SPECIALIZATIONS'].map(key => [key, {}]));
      this.tables.QUESTS = []; this.tables.CONTRACTS = [];
      registryReviews.set(this, {revision: 0, previews: new WeakMap()});
      this._default = freeze(copy(defaults)); this._activate(canonical(defaults));
    }
    get current() { return this._current; }
    get hash() { return this._fingerprint; }
    get defaults() { return copy(this._default); }
    export(category = null, id = null) {
      if (!category) return copy(this._current);
      if (!own(CATEGORIES, category)) throw Error('Unknown component collection.');
      const entries = this._current.components[category].filter(d => !id || d.id === id);
      if (!entries.length) throw Error('Unknown component ID.');
      return {$schema: this._current.$schema, format: this._current.format, schemaVersion: 1, kind: 'patch', library: copy(this._current.library), base:{libraryId:this._current.library.id,fingerprint:this.hash},components:{[category]:copy(entries)}};
    }
    prepare(input) {
      const baseFingerprint = this.hash;
      try {
        const doc = parse(input), errors = validateShape(doc);
        if (errors.length) return {ok:false, errors, warnings:[], baseFingerprint};
        for (const [category, definitions] of Object.entries(doc.components)) {
          const seen = new Set(); definitions.forEach((d, i) => { if (seen.has(d.id)) errors.push(diagnostic('DUPLICATE_ID','/components/'+category+'/'+i+'/id','Duplicate component ID “'+d.id+'”.')); seen.add(d.id); });
        }
        if (doc.kind === 'patch' && (doc.base.fingerprint !== baseFingerprint || doc.base.libraryId !== this.current.library.id)) errors.push(diagnostic('BASE_MISMATCH','/base','This patch was exported from a different library revision.','Export a fresh patch from the current library, or import a complete library with an explicit replacement preview.'));
        if (errors.length) return {ok:false, errors, warnings:[], baseFingerprint};
        let candidate;
        if (doc.kind === 'patch') {
          candidate = this.export(); candidate.library = copy(doc.library);
          for (const [category, definitions] of Object.entries(doc.components)) { const updates = index(definitions); candidate.components[category] = candidate.components[category].map(d => updates[d.id] || d); }
        } else candidate = doc;
        errors.push(...validateSemantics(candidate));
        if (errors.length) return {ok:false,errors,warnings:[],baseFingerprint};
        candidate = canonical(candidate); const changes = diff(this.current, candidate), warnings = [];
        if (changes.components.length && candidate.library.version === this.current.library.version) warnings.push(diagnostic('SAME_VERSION','/library/version','Definitions changed without a library version change.','Bump the version in your authoring tool for a clearer history.','warning'));
        const preview = {ok:true,errors:[],warnings,kind:doc.kind,baseFingerprint,fingerprint:fingerprint(candidate),candidate:freeze(candidate),diff:changes,counts:Object.fromEntries(Object.entries(candidate.components).map(([k,arr])=>[k,arr.length]))};
        const state = registryReviews.get(this);
        state.previews.set(preview, {revision:state.revision, data:freeze(cloneJson(preview))});
        return preview;
      } catch (error) { return {ok:false,errors:error.issues || [diagnostic('INVALID_CONTENT','/',error.message)],warnings:[],baseFingerprint}; }
    }
    /** Return immutable registry-owned evidence only for an unchanged, current review. */
    reviewed(preview) {
      const state = registryReviews.get(this), review = preview && state.previews.get(preview);
      if (!review || review.revision !== state.revision || review.data.baseFingerprint !== this.hash)
        throw new ContentError([diagnostic('STALE_PREVIEW','/','Review this library revision again before applying.')]);
      if (!matchesReview(preview, review.data))
        throw new ContentError([diagnostic('CHANGED_PREVIEW','/','Content review changed; review again before applying.')]);
      return review.data;
    }
    commit(preview) {
      const reviewed = this.reviewed(preview);
      this._activate(reviewed.candidate);
      registryReviews.get(this).revision++;
      return this.hash;
    }
    /** Synchronous sandbox for validating save state against another library, always rolled back. */
    withLibrary(candidate, work) {
      const prior = this.current;
      try {
        this._activate(candidate); const result = work();
        if (result && ['object','function'].includes(typeof result) && typeof result.then === 'function')
          throw Error('Content library sandbox callback must be synchronous.');
        return result;
      } finally { this._activate(prior); }
    }
    _activate(doc) {
      this._current = freeze(copy(doc));
      this._fingerprint = fingerprint(this._current);
      const clean = entry => { const result = copy(entry); delete result.id; delete result.extensions; delete result.output; return result; };
      for (const [category, name] of Object.entries(TABLE_MAP)) {
        const table = this.tables[name]; for (const key of Object.keys(table)) delete table[key];
        for (const entry of this.current.components[category]) table[entry.id] = clean(entry);
      }
      const specs = this.tables.SPECIALIZATIONS; for (const key of Object.keys(specs)) delete specs[key];
      for (const t of this.current.components.talents) (specs[t.discipline] ||= []).push({id:t.id,name:t.name,desc:t.desc});
      this.tables.CONTRACTS.splice(0, this.tables.CONTRACTS.length, ...this.current.components.deliveries.map(clean));
      this.tables.QUESTS.splice(0, this.tables.QUESTS.length, ...this.current.components.chapters.map(q => ({...clean(q),id:q.id,checks:q.checks.map(c=>[c.label,s=>chapterCondition(s,c.condition),c.action])})));
    }
  }
  const registry = new Registry();
  const api = {Registry,ContentError,registry,tables:registry.tables,CATEGORIES,SCHEMA,MAX_BYTES,parse,validateShape,validateSemantics,fingerprint,stable,copy,diagnostic};
  if (IS_NODE) module.exports = api;
  root.LWContent = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
