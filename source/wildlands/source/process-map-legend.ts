/// <reference path="./process-contracts.d.ts" />
/**
 * The studio's legend row under the stage (LWProcessMapLegend): its markup and the 2D map's controls in it. Presentation only.
 *  - `markup()` is the work-state key (samples from LWProcessMapMarks, so the key and the map cannot drift apart) inside
 *    `#legend-key`, preceded by a **Legend** disclosure button (`#legend-toggle`, `aria-expanded`, `aria-controls="legend-key"`).
 *    process.css shows the key inline and hides the button, except on a desktop whose legend row is narrower than 38rem (a large
 *    browser text size): there the key, and a copy of the camera hint (`#legend-help`), fold behind the button into a popover above
 *    the row, so the row stays one line and the map keeps its height. The samples stay in the document either way; the button's
 *    `aria-expanded` tells everyone whether the key is open. Escape or a press outside the row closes it and keeps focus sensible.
 *  - `attach()` adds the map's "Zoom in for names / details" button (`#map-zoom-hint`) and the caption of the hovered or focused card
 *    (`#map-caption`) before `#camera-hint`, and wires the disclosure. The 2D surface decides their text and visibility.
 */
declare namespace LWProcessMapLegend {
 interface Row {hint: HTMLButtonElement; caption: HTMLParagraphElement; dispose(): void}
 interface Api {
  markup(): string;
  /** Mounts the zoom button and caption into the legend row of `host`'s stage (none outside the studio) and wires the disclosure. */
  attach(host: HTMLElement, zoom: () => void): Row;
  readonly CAPTION: string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessMapLegend?: LWProcessMapLegend.Api; LWProcessMapMarks: LWProcessMapMarks.Api};
 const CAPTION = 'Hover over or focus a card to read its full name and work counts.';
 function markup(): string {
  const toggle = '<button type="button" class="legend-toggle" id="legend-toggle" aria-expanded="false" aria-controls="legend-key">'
   + 'Legend</button>';
  return toggle + `<div class="legend-key" id="legend-key">${root.LWProcessMapMarks.legend()}`
   + '<p class="legend-help" id="legend-help"></p></div>';
 }
 function attach(host: HTMLElement, zoom: () => void): LWProcessMapLegend.Row {
  const legend = host.closest('.process-stage')?.querySelector<HTMLElement>('.process-legend');
  const hint = document.createElement('button'), caption = document.createElement('p');
  hint.type = 'button'; hint.id = 'map-zoom-hint'; hint.className = 'map-zoom-hint'; hint.textContent = 'Zoom in for details'; hint.hidden = true;
  hint.addEventListener('click', zoom);
  caption.id = 'map-caption'; caption.className = 'process-map-caption'; caption.textContent = CAPTION; caption.hidden = true;
  const anchor = legend?.querySelector('#camera-hint') ?? null;
  if (legend) { legend.insertBefore(hint, anchor); legend.insertBefore(caption, anchor); }
  const toggle = legend?.querySelector<HTMLButtonElement>('#legend-toggle'), help = legend?.querySelector('#legend-help');
  const open = () => toggle?.getAttribute('aria-expanded') === 'true';
  function set(value: boolean): void {
   if (!toggle) return;
   if (value && help) help.textContent = anchor?.textContent ?? '';
   toggle.setAttribute('aria-expanded', String(value));
  }
  const click = () => set(!open());
  const keydown = (e: KeyboardEvent) => {
   if (e.key !== 'Escape' || !open()) return;
   e.preventDefault(); e.stopPropagation(); set(false); toggle?.focus();
  };
  const outside = (e: PointerEvent) => { if (open() && legend && !legend.contains(e.target as Node)) set(false); };
  toggle?.addEventListener('click', click); legend?.addEventListener('keydown', keydown);
  document.addEventListener('pointerdown', outside);
  function dispose(): void {
   toggle?.removeEventListener('click', click); legend?.removeEventListener('keydown', keydown);
   document.removeEventListener('pointerdown', outside); set(false); hint.remove(); caption.remove();
  }
  return {hint, caption, dispose};
 }
 root.LWProcessMapLegend = {markup, attach, CAPTION};
})(globalThis);
