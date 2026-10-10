/// <reference path="./process-contracts.d.ts" />
/**
 * The static markup of the Process Studio shell, written once by `process-ui.ts`: the header (title, Process selector, Edit
 * process…, the draft chip, Import… and the Export/⋯ menu), the run bar slot, the step list, the stage with its view controls, the
 * legend, the metrics, Inputs & outputs and the inspector. Pure strings with fixed ids and wording; no DOM access, session or
 * storage. Every id here is a contract with the browser suites and the shell modules (LWProcessDom.must names a missing one).
 *
 * The Export/⋯ menu holds, in order: Import JSON or BPMN…, Present slides and Dashboard (phone only), Export JSON, Export draft JSON (while a
 * draft exists), Export BPMN, Export BPMN with BPSim, Show export notes… (after a BPMN export with notes), Export run report,
 * Download HTML, New process… and Import as a new process….
 */
declare namespace LWProcessShellMarkup {
 interface Parts {
  /** The run bar markup (LWProcessRunBar.markup()). */
  runBar: string;
  /** The 2D legend markup (LWProcess2D.legend()). */
  legend: string;
 }
 interface Api {markup(parts: Parts): string;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessShellMarkup?: LWProcessShellMarkup.Api};
 const item = (id: string, label: string, extra = '') => `<button id="${id}" role="menuitem" tabindex="-1"${extra}>${label}</button>`;
 const caret = '<span aria-hidden="true">▾</span>';
 function header(): string {
  const items = [
   item('import-item', 'Import JSON or BPMN…', ' class="menu-phone"'),
   item('present-item', 'Present slides', ' class="menu-phone" aria-haspopup="dialog"'),
   // Dashboard view (Package DB-UI): the phone entry of the stage's Dashboard button, which phones hide.
   item('dashboard-item', 'Dashboard', ' class="menu-phone"'),
   item('json', 'Export JSON'), item('draft-json', 'Export draft JSON', ' hidden'), item('bpmn', 'Export BPMN'),
   item('bpmn-bpsim', 'Export BPMN with BPSim'), item('export-notes', 'Show export notes…', ' aria-haspopup="dialog" hidden'),
   item('report', 'Export run report'), item('html', 'Download HTML'),
   item('new-process', 'New process…', ' aria-haspopup="dialog"'), item('import-new', 'Import as a new process…'),
  ].join('\n     ');
  return `
 <header class="process-header"><div class="process-titles"><h1 id="process-title"></h1><p id="process-subtitle">Wildlands · Process Studio</p></div>
 <div class="process-file-actions">
  <label id="process-switch-label" class="process-switch" hidden>Process <select id="process-switch" aria-describedby="process-subtitle"></select></label>
  <button id="open-definition" aria-haspopup="dialog" aria-label="Edit process" title="Edit process…">Edit<span class="long"> process…</span></button>
  <button id="draft-chip" class="process-draft-chip" aria-haspopup="dialog" hidden></button>
  <button id="import" title="Import a process from a JSON or BPMN file">Import…</button>
  <div class="process-menu">
   <button id="export-menu" class="menu-long" aria-haspopup="menu" aria-expanded="false" aria-controls="export-items">Export ${caret}</button>
   <button id="more-menu" class="menu-short" aria-haspopup="menu" aria-expanded="false" aria-controls="export-items" aria-label="More actions">⋯</button>
   <div id="export-popup" class="process-menu-popup" hidden><p id="export-hint" class="menu-hint"></p>
    <div id="export-items" role="menu" aria-label="Import, present, export and add processes">
     ${items}</div></div></div>
  <input type="file" id="file" accept=".json,.bpmn,.xml,application/json,application/xml,text/xml" hidden></div></header>`;
 }
 function workspace(legend: string): string {
  return `
 <div class="process-workspace">
 <nav class="process-nav" aria-label="Process steps"><div class="process-sticky">
  <div class="process-panel-heading"><h2 id="steps-heading">Steps</h2><span id="step-count"></span></div>
  <button id="overview">Whole process</button></div>
  <ol id="steps" class="process-steps"></ol>
  <p class="process-note">Choose a step to enter its scene. Navigation keeps the run at the same minute.</p></nav>
 <section class="process-stage" aria-label="Simulation viewport"><div class="process-stagebar">
  <div class="process-stagetitle"><h2 id="scene-title" tabindex="-1">Whole process</h2><p id="scene-subtitle"></p>
   <p id="message" class="process-message" role="status" aria-live="polite"></p></div>
  <div class="process-view-controls">
   <button id="back-overview" class="scene-back" hidden><span aria-hidden="true">← </span>Whole process</button>
   <button id="mode-2d" aria-pressed="false">2D</button><button id="mode-3d" aria-pressed="true">3D</button>
   <button id="mode-lens" aria-pressed="false">SIPOC</button>
   <button id="mode-dashboard" aria-pressed="false" title="Dashboard: the metrics and charts of this process">Dashboard</button>
   <button id="mode-present" aria-haspopup="dialog">Present</button><button id="frame">Fit to view</button>
   <button id="edit-step" aria-haspopup="dialog" hidden>Edit step…</button></div></div>
 <div id="viewport">
  <canvas id="canvas" role="img" aria-label="3D process scenes. Use the scene list for keyboard selection." aria-describedby="camera-hint"
   tabindex="0"></canvas>
  <div id="map" hidden></div><div id="lens" hidden></div><div id="dashboard" hidden></div></div>
 <div class="process-legend">${legend}<span id="marker-count"></span><span id="camera-hint">Drag to orbit · Scroll to zoom</span></div>
 <div id="metrics" class="process-metrics" role="group" aria-label="Run metrics"></div><p id="latest" class="process-latest"></p>
 <details id="io-panel" class="process-io"><summary>Inputs &amp; outputs</summary>
  <section id="process-data" aria-label="Process inputs and outputs"></section></details></section>
 <aside class="process-inspector" aria-label="Scene inspector"><div class="process-sticky"><h2 id="inspector-title">Process overview</h2>
  <button id="inspector-toggle" class="panel-toggle" aria-expanded="true" aria-controls="inspector-body">Details ${caret}</button></div>
  <div id="inspector-body"><section aria-labelledby="pools-title"><h3 id="pools-title">Shared resources</h3><div id="pools"></div></section>
  <div id="inspector"></div></div></aside></div>
 <div id="feed-announcer" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>`;
 }
 const markup = (parts: LWProcessShellMarkup.Parts) => header() + '\n ' + parts.runBar + workspace(parts.legend);
 root.LWProcessShellMarkup = {markup};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessShellMarkup;
})(globalThis);
