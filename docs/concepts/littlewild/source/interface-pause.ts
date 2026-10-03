/* Presentation-only pause policy. No simulation fields or random streams are written.
 * A manual pause always wins. Inspection holds disappear when the last view closes.
 * Preference belongs to this browser, not a content pack or somebody else's save. */
(function (root) {
  'use strict';
  const KEY = 'littlewild.interface.v1';
  function evaluate(state, views = {}, pauseOnOpen = true) {
    if (!state.started) return { running: false, automatic: false, reason: 'Not started', kind: 'start' };
    if (views.hidden) return { running: false, automatic: false, reason: 'Tab hidden', kind: 'visibility' };
    if (state.paused) return { running: false, automatic: false, reason: 'Paused by you', kind: 'manual' };
    // A file replacement is not ordinary inspection. Do not simulate a different
    // state behind an atomic import/recovery preview. Closing never unpauses state.
    if (views.safety) return { running: false, automatic: true, reason: 'Save / content safety review', kind: 'safety' };
    const reason = views.modal ? 'Reading a panel' : views.tile ? 'Choosing a tile action' :
      views.creature ? 'Choosing an interaction' : views.more ? 'Browsing world tools' :
      views.world ? 'Inspecting the world' : views.planner ? 'Using the planner' :
      views.placement ? 'Placing a blueprint' : '';
    if (pauseOnOpen && reason) return { running: false, automatic: true, reason, kind: 'inspection' };
    return { running: true, automatic: false, reason: 'World running', kind: 'running' };
  }
  function safetyView(name) { return !!name && (name === 'reset' || name === 'recover' || name === 'import-preview' || /(?:content-preview|adventure-review|world-import|growth-preview|scenario-preview)/.test(name)); }
  function create(storageProvider) {
    let pauseOnOpen = true, persisted = false, error = '';
    try {
      const raw = storageProvider()?.getItem(KEY);
      if (raw != null) { const data = JSON.parse(raw); if (data.version === 1 && typeof data.pauseOnOpen === 'boolean') pauseOnOpen = data.pauseOnOpen; }
      persisted = true;
    } catch (_) { error = 'Preferences are available for this session. Browser storage is unavailable.'; }
    return {
      get pauseOnOpen() { return pauseOnOpen; },
      get persisted() { return persisted; },
      get error() { return error; },
      set(value) {
        if (typeof value !== 'boolean') throw new TypeError('Pause preference must be a boolean.');
        pauseOnOpen = value;
        try { storageProvider().setItem(KEY, JSON.stringify({ version: 1, pauseOnOpen })); persisted = true; error = ''; }
        catch (_) { persisted = false; error = 'Changed for this session only. Browser storage is unavailable.'; }
        return { pauseOnOpen, persisted, error };
      },
      status: (state, views) => evaluate(state, views, pauseOnOpen)
    };
  }
  const api = { evaluate, create, safetyView, KEY };
  root.LWInterfacePause = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
