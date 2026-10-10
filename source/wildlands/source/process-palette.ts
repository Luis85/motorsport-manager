/**
 * The studio's colour roles (LWProcessPalette): the single list of the colours Process Studio presentation code draws with, and
 * their values in both studio themes. Presentation only: no session, clock or storage, and nothing here changes a document.
 *  - A role with a `token` is a process.css custom property of the token block at the top of process.css (`.process-studio`, and
 *    the lens roots that carry the same tokens). Its `value` is the dark (default) colour as a constant and `LIGHT_TOKENS` holds the
 *    token's light value, for Node, tests and canvases drawn before layout. The business-process-analysis suite parses both token
 *    blocks (dark, and light under `:root[data-theme="light"]`) and checks that every such constant equals its declaration, so the
 *    stylesheet and the scripts cannot drift apart. Several roles may share one token (Blocked work, the interrupting deadline and
 *    a lost outcome are all `--danger`).
 *  - The theme belongs to the page: LWProcessTheme writes `data-theme` on the document element and `scheme()` reads it ('dark'
 *    outside a page). Styled SVG and HTML draw with `css(role)` (`var(--token)`), so the stylesheet stays the source and a theme
 *    change needs no redraw; canvases and three.js materials cannot read `var()`, so they take `read(element)`: each token as the
 *    element's computed style declares it (the studio root by default), else the active scheme's constant. `value(role)` is the
 *    active scheme's constant and `resolve(scheme)` every role in one scheme.
 *  - A role without a token is drawn only by scripts (the 3D scene's lights, caption pills, sign plates, room shell and lamps, and
 *    the ink of the feeling faces), so no stylesheet declares it; its constant is its definition in both themes.
 *  - The 3D rooms are a lit diorama on their own dark floors: LWProcess3D builds them, their markers and their dark caption pills
 *    from `resolve('dark')` in both themes and takes only its clear colour from the active theme (its `restyle`), so every state
 *    keeps the step chosen for the room floors it sits on. (Light pills were tried: their thin dark ink washes out when the caption
 *    textures are minified, so the captions stay part of the diorama.)
 *  - `ROOMS` holds the room themes' floor, wall and accent colours by theme id (LWProcessRooms owns the themes' names and choice);
 *    `accent(id)` is a room accent for the 2D map in the active scheme (`LIGHT_ACCENTS` keeps each hue at 4.5:1 on the light cards).
 *    `MOODS` are the feeling faces from -3 to +3 (cool to warm): self-contained icons with their own dark ink in both themes.
 *    `PHASES` (dark) and `LIGHT_PHASES` are the journey map's categorical phase colours, the tokens `--phase-1` to `--phase-7`
 *    that `phase(i)` names.
 *  - `contrast(a, b)` is the WCAG 2.2 contrast ratio of two opaque colours (`#rgb`, `#rrggbb`, `rgb()`, or `rgba()` with alpha 1):
 *    the maths that the token check and the theme browser checks share.
 * Not roles: colours authored in a definition (a step's `scene.color`, attached scene assets) and the prop materials of the room and
 * actor models (furniture, paper, screens, skin and clothing in process-rooms-*.ts and process-3d-markers.ts), which are authored
 * with their geometry like scene assets and mean nothing beyond their prop.
 */
declare namespace LWProcessPalette {
 type Role =
  // Stage and ink.
  | 'stage' | 'panel' | 'line' | 'text' | 'muted' | 'accent' | 'axis' | 'danger'
  // Work states, in legend order, and escalated work.
  | 'state-active' | 'state-queued' | 'state-timer' | 'state-backlog' | 'state-held' | 'state-escalated'
  // Map paths and gateways, deadlines and outcomes.
  | 'path-edge' | 'path-arrow' | 'path-conditional' | 'gateway' | 'deadline-interrupt' | 'deadline-escalate'
  | 'goal' | 'goal-bg' | 'goal-text' | 'lost' | 'lost-bg' | 'lost-text'
  // Data visualisation.
  | 'viz-measured' | 'viz-feel' | 'viz-track' | 'viz-fill' | 'heat-warm' | 'heat-hot' | 'face-ink'
  // The 3D scene: lights, captions, signs, the room shell, lamps and the selection frame.
  | 'light-sky' | 'light-ground' | 'light-key' | 'light-fill'
  | 'caption-pill' | 'caption-edge' | 'caption-front' | 'caption-detail' | 'sign-plate' | 'sign-ink' | 'sign-frame'
  | 'scene-path' | 'room-floor' | 'progress-track' | 'planter' | 'planter-leaf' | 'lamp-idle' | 'lamp-glow' | 'unlit'
  | 'selection-glow' | 'wall-lamp' | 'wall-lamp-glow' | 'standby-base' | 'board-frame' | 'board-slot' | 'board-first'
  | 'vertex-white';
 interface Spec {
  /** The process.css custom property that declares this role, or null for a script-only role. */
  readonly token: string | null;
  /** The dark (default) theme's colour. */
  readonly value: string;
 }
 interface Theme {readonly floor: string; readonly wall: string; readonly accent: string}
 type Resolved = Readonly<Record<Role, string>>;
 /** The studio themes; dark is the default. */
 type Scheme = 'dark' | 'light';
 interface Api {
  readonly ROLES: Readonly<Record<Role, Spec>>;
  /** The light value of every token that a role names, by token. */
  readonly LIGHT_TOKENS: Readonly<Record<string, string>>;
  readonly ROOMS: Readonly<Record<string, Theme>>;
  /** Room accents stepped for the light map cards, by room theme id. */
  readonly LIGHT_ACCENTS: Readonly<Record<string, string>>;
  /** Feeling face colours for the levels -3 to +3, in that order (both themes). */
  readonly MOODS: readonly string[];
  readonly PHASES: readonly string[];
  readonly LIGHT_PHASES: readonly string[];
  /** The page's theme: `data-theme="light"` on the document element, else dark (also outside a page). */
  scheme(): Scheme;
  /** The role's constant in `scheme` (default: the active scheme). */
  value(role: Role, scheme?: Scheme): string;
  /** A CSS colour for SVG and HTML: `var(--token)` for a token role, else the active scheme's constant. */
  css(role: Role): string;
  /** Every role resolved for a canvas or material: tokens from `element`'s computed style (default: the studio root), else constants. */
  read(element?: Element | null): Resolved;
  /** Every role as the constants of one scheme. */
  resolve(scheme: Scheme): Resolved;
  /** The theme colours of a room theme id (the 3D diorama's, the same in both themes). */
  room(id: string): Theme;
  /** A room theme's accent for the 2D map in `scheme` (default: the active scheme). */
  accent(id: string, scheme?: Scheme): string;
  /** The journey phase colour of a zero-based phase index (cycling every seven) as a CSS colour, `var(--phase-n)`. */
  phase(index: number): string;
  /** The WCAG 2.2 contrast ratio of two opaque CSS colours. */
  contrast(a: string, b: string): number;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessPalette?: LWProcessPalette.Api};
 type Role = LWProcessPalette.Role;
 type Scheme = LWProcessPalette.Scheme;
 const token = (name: string, value: string): LWProcessPalette.Spec => Object.freeze({token: name, value});
 const own = (value: string): LWProcessPalette.Spec => Object.freeze({token: null, value});
 const ROLES: Record<Role, LWProcessPalette.Spec> = {
  'stage': token('--bg', '#13181f'),
  'panel': token('--panel', '#1d242e'),
  'line': token('--line', '#364150'),
  'text': token('--text', '#edf2f7'),
  'muted': token('--muted', '#b1bdcd'),
  'accent': token('--accent', '#ffbb73'),
  'axis': token('--axis', '#6a7684'),
  'danger': token('--danger', '#e07a7a'),
  'state-active': token('--accent', '#ffbb73'),
  'state-queued': token('--state-queue', '#91b9d5'),
  'state-timer': token('--state-timer', '#d9c58a'),
  'state-backlog': token('--state-backlog', '#b79ad6'),
  'state-held': token('--danger', '#e07a7a'),
  'state-escalated': token('--escalated', '#ff8a5c'),
  'path-edge': token('--map-edge', '#65778b'),
  'path-arrow': token('--map-arrow', '#7b8b9f'),
  'path-conditional': token('--map-conditional', '#c79871'),
  'gateway': token('--map-conditional', '#c79871'),
  'deadline-interrupt': token('--danger', '#e07a7a'),
  'deadline-escalate': token('--deadline-escalate', '#e6b04a'),
  'goal': token('--goal', '#8fd68a'),
  'goal-bg': token('--goal-bg', '#1f3d2a'),
  'goal-text': token('--goal-text', '#b9f0bf'),
  'lost': token('--danger', '#e07a7a'),
  'lost-bg': token('--lost-bg', '#40222a'),
  'lost-text': token('--danger-text', '#ffc3bc'),
  'viz-measured': token('--viz-measured', '#7fd0c4'),
  'viz-feel': token('--viz-feel', '#141a21'),
  'viz-track': token('--viz-track', '#10151b'),
  'viz-fill': token('--viz-fill', '#ffcf9a'),
  'heat-warm': token('--heat-warm', '#f59e5b'),
  'heat-hot': token('--heat-hot', '#ff7a59'),
  'face-ink': own('#13181f'),
  'light-sky': own('#d9e8ff'),
  'light-ground': own('#38434e'),
  'light-key': own('#fff1df'),
  'light-fill': own('#a9cddd'),
  'caption-pill': own('rgba(14,18,24,.9)'),
  'caption-edge': own('rgba(177,189,205,.5)'),
  'caption-front': own('#e3eaf2'),
  'caption-detail': own('#9fb0c4'),
  'sign-plate': own('#10161f'),
  'sign-ink': own('#f4f7fb'),
  'sign-frame': own('#0a0e14'),
  'scene-path': own('#61738a'),
  'room-floor': own('#293544'),
  'progress-track': own('#15222e'),
  'planter': own('#b99c7f'),
  'planter-leaf': own('#6d9585'),
  'lamp-idle': own('#6d9585'),
  'lamp-glow': own('#704c2d'),
  'unlit': own('#000000'),
  'selection-glow': own('#ff9a3c'),
  'wall-lamp': own('#4a4f55'),
  'wall-lamp-glow': own('#ffd9a0'),
  'standby-base': own('#313c48'),
  'board-frame': own('#242b38'),
  'board-slot': own('#394356'),
  'board-first': own('#ffd27a'),
  'vertex-white': own('#ffffff'),
 };
 /** The light theme's value of every token a role names (process.css declares the same values under `[data-theme="light"]`). */
 const LIGHT_TOKENS: Record<string, string> = {
  '--bg': '#f3f5f8', '--panel': '#ffffff', '--line': '#d3d9e1', '--text': '#17202b', '--muted': '#4f5b6a', '--accent': '#8a5000',
  '--axis': '#727d8a', '--danger': '#c84455', '--state-queue': '#3584b0', '--state-timer': '#a48800', '--state-backlog': '#8046c0',
  '--escalated': '#cf5a26', '--map-edge': '#7a8796', '--map-arrow': '#66727f', '--map-conditional': '#a0682f',
  '--deadline-escalate': '#946800', '--goal': '#2f7d32', '--goal-bg': '#e2f2e2', '--goal-text': '#1d6224', '--lost-bg': '#fbe5e6',
  '--danger-text': '#a3262f', '--viz-measured': '#1f7f73', '--viz-feel': '#f7f9fb', '--viz-track': '#e8ecf1', '--viz-fill': '#b8722b',
  '--heat-warm': '#b35f00', '--heat-hot': '#c8401f',
 };
 const theme = (floor: string, wall: string, accent: string): LWProcessPalette.Theme => Object.freeze({floor, wall, accent});
 /** Room themes by id: task themes, step-kind themes, the backlog room, touchpoint channels and the generic touchpoint kiosk. */
 const ROOMS: Record<string, LWProcessPalette.Theme> = {
  office: theme('#314050', '#374756', '#86a6bb'),
  studio: theme('#3b3a4c', '#4a4560', '#b79ad6'),
  lab: theme('#2c4448', '#36585c', '#7fd0c4'),
  workshop: theme('#413a32', '#54483c', '#e0a35c'),
  review: theme('#3a4636', '#4c5e46', '#a8cf86'),
  archive: theme('#403747', '#54475c', '#d69aa8'),
  reception: theme('#2f4157', '#3b536c', '#91b9d5'),
  dispatch: theme('#38404a', '#4a5563', '#8fc9a2'),
  council: theme('#3f3a33', '#574d41', '#e6c06e'),
  junction: theme('#2b3a46', '#35495a', '#c79871'),
  machine: theme('#343a41', '#464e57', '#ff8f5a'),
  system: theme('#232c45', '#2d3a5e', '#4fc3ff'),
  clock: theme('#33384a', '#434a62', '#d9c58a'),
  backlog: theme('#33405a', '#46527a', '#9db4ff'),
  web: theme('#2b3f56', '#35506b', '#7fb3e0'),
  mobile: theme('#2f3a52', '#3d4a68', '#a79bf0'),
  store: theme('#43382f', '#5a4a3b', '#e0a35c'),
  phone: theme('#2e4247', '#3a5a60', '#7fd0c4'),
  chat: theme('#2f3f4a', '#3b5566', '#6fc7e8'),
  email: theme('#3a3f55', '#4a5170', '#9db4ff'),
  social: theme('#4a3552', '#613f6e', '#e58ac8'),
  ads: theme('#4a3a2b', '#614b36', '#ffb347'),
  delivery: theme('#3a4a3a', '#4a5f4a', '#8fd68a'),
  document: theme('#434034', '#5a5645', '#d9c58a'),
  journey: theme('#2f4a47', '#3b5f5a', '#7fd0c4'),
 };
 /** Each room accent's hue stepped to at least 4.5:1 on the light cards and stage (the map draws subtitles in it). */
 const LIGHT_ACCENTS: Record<string, string> = {
  office: '#537285', studio: '#7f639b', lab: '#257b71', workshop: '#9a620f', review: '#557832', archive: '#965f6d', reception: '#4c728c',
  dispatch: '#427a56', council: '#8c6902', junction: '#916540', machine: '#b84f10', system: '#1076a3', clock: '#806d34', backlog: '#586bb0',
  web: '#41739d', mobile: '#7163b3', store: '#9a620f', phone: '#257b71', chat: '#127897', email: '#586bb0', social: '#a5508c', ads: '#98630a',
  delivery: '#377c35', document: '#806d34', journey: '#257b71',
 };
 const MOODS = ['#5b86ff', '#62b0f0', '#7fd6cf', '#d9e4a8', '#f5d86a', '#ffb865', '#ff8a50'];
 const PHASES = ['#7fb3e0', '#ffbb73', '#8fd68a', '#e58ac8', '#a79bf0', '#6fc7e8', '#d9c58a'];
 const LIGHT_PHASES = ['#4088c8', '#864c03', '#599939', '#87366b', '#6e53cb', '#3a93b8', '#967f05'];
 function scheme(): Scheme {
  return typeof document !== 'undefined' && document.documentElement?.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
 }
 function value(role: Role, wanted: Scheme = scheme()): string {
  const spec = ROLES[role];
  if (wanted === 'dark') return spec.value;
  return (spec.token ? LIGHT_TOKENS[spec.token] : undefined) ?? spec.value;
 }
 function css(role: Role): string {
  const spec = ROLES[role];
  return spec.token ? `var(${spec.token})` : value(role);
 }
 function resolve(wanted: Scheme): LWProcessPalette.Resolved {
  const out = {} as Record<Role, string>;
  for (const role of Object.keys(ROLES) as Role[]) out[role] = value(role, wanted);
  return Object.freeze(out);
 }
 function read(element?: Element | null): LWProcessPalette.Resolved {
  const host = element ?? (typeof document === 'undefined' ? null : document.querySelector('.process-studio'));
  const style = host && typeof getComputedStyle === 'function' ? getComputedStyle(host) : null;
  const active = scheme(), out = {} as Record<Role, string>;
  for (const role of Object.keys(ROLES) as Role[]) {
   const spec = ROLES[role];
   out[role] = spec.token && style ? style.getPropertyValue(spec.token).trim() || value(role, active) : value(role, active);
  }
  return Object.freeze(out);
 }
 function room(id: string): LWProcessPalette.Theme {
  const found = ROOMS[id];
  if (!found) throw Error('Unknown room theme ' + id);
  return found;
 }
 const accent = (id: string, wanted: Scheme = scheme()) => wanted === 'light' ? LIGHT_ACCENTS[id] ?? room(id).accent : room(id).accent;
 const phase = (index: number) => `var(--phase-${(Math.max(0, Math.floor(index)) % PHASES.length) + 1})`;
 /** sRGB channels 0-1 of an opaque colour; anything else (named colours, translucency, other spaces) is refused. */
 function channels(colour: string): [number, number, number] {
  const c = colour.trim().toLowerCase(), hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(c);
  if (hex) {
   const h = hex[1]!.length === 3 ? [...hex[1]!].map(x => x + x).join('') : hex[1]!;
   return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/.exec(c);
  const alpha = rgb?.[4] === undefined ? 1 : rgb[4].endsWith('%') ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
  if (!rgb || alpha !== 1) throw Error('Contrast needs an opaque colour, not ' + colour);
  return [rgb[1], rgb[2], rgb[3]].map(v => Number(v) / 255) as [number, number, number];
 }
 function luminance(colour: string): number {
  const [r, g, b] = channels(colour).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4) as [number, number, number];
  return .2126 * r + .7152 * g + .0722 * b;
 }
 function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + .05) / (lo + .05);
 }
 root.LWProcessPalette = Object.freeze({
  ROLES: Object.freeze(ROLES), LIGHT_TOKENS: Object.freeze(LIGHT_TOKENS), ROOMS: Object.freeze(ROOMS),
  LIGHT_ACCENTS: Object.freeze(LIGHT_ACCENTS), MOODS: Object.freeze(MOODS), PHASES: Object.freeze(PHASES), LIGHT_PHASES: Object.freeze(LIGHT_PHASES),
  scheme, value, css, read, resolve, room, accent, phase, contrast,
 });
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessPalette;
})(globalThis);
