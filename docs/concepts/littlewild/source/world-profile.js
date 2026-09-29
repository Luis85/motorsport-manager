/* A world template is immutable authored data. This registry owns no simulation state.
 * The supported topology is a 19-cell square island with four edge bridges. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const C = node ? require('./content-runtime.js') : root.LWContent;
  const defaults = node ? require('./content/default-profile.json') : root.LWDefaultProfile;
  function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
  function hash(v) {
    const text = C.stable(v); let n = 2166136261;
    for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619);
    return (n >>> 0).toString(16).padStart(8, '0');
  }
  let active = freeze(C.copy(defaults)), revision = hash(active);
  const api = {
    defaults: freeze(C.copy(defaults)), hashOf: hash,
    get current() { return active; }, get hash() { return revision; },
    apply(profile) { active = freeze(C.copy(profile)); revision = hash(active); },
    withProfile(profile, work) { const prior = active, priorHash = revision; try { this.apply(profile); return work(); } finally { active = prior; revision = priorHash; } }
  };
  root.LWWorldProfile = api;
  if (node) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
