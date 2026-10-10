/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-palette.ts" />
/**
 * The studio's colour theme (LWProcessTheme): Dark, the default, or Light, chosen with the Light theme toggle that ends the studio
 * menu (`#theme-item` in LWProcessShellMarkup, the same popup on desktop and phone). Presentation only: it never ticks the run and
 * never touches a definition, draft, selection, camera, Present slide or storage.
 *  - The choice is the `data-theme` attribute of the document element ('light', or absent for dark). It lives for the page: it
 *    survives Present, dialogs and process switches (they never touch the attribute) and is gone after a reload. It is never
 *    written to storage; draft recovery stays the studio's only storage use.
 *  - process.css declares the light token block and `color-scheme` under `:root[data-theme="light"]`, so styled HTML and SVG (the
 *    shell, 2D map, lenses, Dashboard, dialogs, Present, tooltips and the legend) follow at once without a redraw.
 *    LWProcessPalette.scheme() reads the same attribute for colours drawn by scripts.
 *  - `changed(theme)` is called once per actual change, after the attribute is set, so the composition root re-colours what
 *    scripts drew with literal colours (the 3D clear colour and the 2D map's room accents) exactly once.
 *  - The toggle is a `menuitemcheckbox`: checked means Light. Its state also reads in words (`#theme-state`: On or Off). The
 *    menu keeps it open and focused when it is activated (LWProcessMenu), so keyboard focus stays where it was.
 */
declare namespace LWProcessTheme {
 type Name = LWProcessPalette.Scheme;
 interface Options {
  /** The toggle: a button with role `menuitemcheckbox` holding a `.theme-state` element for the state in words. */
  item: HTMLElement;
  /** Called once after each change of theme. */
  changed(theme: Name): void;
 }
 interface Surface {
  current(): Name;
  /** Apply a theme; nothing happens (and `changed` is not called) when it is already active. */
  set(theme: Name): void;
  dispose(): void;
 }
 interface Api {create(options: Options): Surface;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessTheme?: LWProcessTheme.Api; LWProcessPalette: LWProcessPalette.Api};
 function create(o: LWProcessTheme.Options): LWProcessTheme.Surface {
  const page = document.documentElement, state = o.item.querySelector<HTMLElement>('.theme-state');
  const current = (): LWProcessTheme.Name => root.LWProcessPalette.scheme();
  function sync(): void {
   const light = current() === 'light';
   o.item.setAttribute('aria-checked', String(light));
   if (state) state.textContent = light ? 'On' : 'Off';
  }
  function set(theme: LWProcessTheme.Name): void {
   if (theme === current()) return;
   if (theme === 'light') page.setAttribute('data-theme', 'light'); else page.removeAttribute('data-theme');
   sync();
   o.changed(theme);
  }
  const toggle = () => set(current() === 'light' ? 'dark' : 'light');
  o.item.addEventListener('click', toggle);
  sync();
  return {current, set, dispose() { o.item.removeEventListener('click', toggle); }};
 }
 root.LWProcessTheme = Object.freeze({create});
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessTheme;
})(globalThis);
