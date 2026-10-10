/**
 * The studio's colour roles (LWProcessPalette): the single list of the colours Process Studio presentation code draws with, and
 * their values. Presentation only: no session, clock or storage, and nothing here changes a document.
 *  - A role with a `token` is a process.css custom property of the token block at the top of process.css (`.process-studio`, and
 *    the lens roots that carry the same tokens). Its `value` is the same colour as a constant, for Node, tests and canvases drawn
 *    before layout. The business-process-analysis suite parses that token block and checks that every such constant equals its
 *    declaration, so the stylesheet and the scripts cannot drift apart. Several roles may share one token (Blocked work, the
 *    interrupting deadline and a lost outcome are all `--danger`).
 *  - Styled SVG and HTML draw with `css(role)` (`var(--token)`), so the stylesheet stays the source; canvases and three.js
 *    materials cannot read `var()`, so they take `read(element)`: each token as the element's computed style declares it (the
 *    studio root by default), else the constant. SVG presentation attributes that hold a literal colour (the journey map's mood
 *    faces) take `value(role)`.
 *  - A role without a token is drawn only by scripts (the 3D scene's lights, caption pills, sign plates, room shell and lamps), so
 *    no stylesheet declares it; its constant is its only definition.
 *  - `ROOMS` holds the room themes' floor, wall and accent colours by theme id (LWProcessRooms owns the themes' names and choice),
 *    `MOODS` the feeling faces from -3 to +3 (cool to warm) and `PHASES` the journey map's categorical phase colours.
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
  readonly value: string;
 }
 interface Theme {readonly floor: string; readonly wall: string; readonly accent: string}
 type Resolved = Readonly<Record<Role, string>>;
 interface Api {
  readonly ROLES: Readonly<Record<Role, Spec>>;
  readonly ROOMS: Readonly<Record<string, Theme>>;
  /** Feeling face colours for the levels -3 to +3, in that order. */
  readonly MOODS: readonly string[];
  readonly PHASES: readonly string[];
  /** The role's constant. */
  value(role: Role): string;
  /** A CSS colour for SVG and HTML: `var(--token)` for a token role, else the constant. */
  css(role: Role): string;
  /** Every role resolved for a canvas or material: tokens from `element`'s computed style (default: the studio root), else constants. */
  read(element?: Element | null): Resolved;
  /** The theme colours of a room theme id. */
  room(id: string): Theme;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessPalette?: LWProcessPalette.Api};
 type Role = LWProcessPalette.Role;
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
  'face-ink': token('--bg', '#13181f'),
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
 const MOODS = ['#5b86ff', '#62b0f0', '#7fd6cf', '#d9e4a8', '#f5d86a', '#ffb865', '#ff8a50'];
 const PHASES = ['#7fb3e0', '#ffbb73', '#8fd68a', '#e58ac8', '#a79bf0', '#6fc7e8', '#d9c58a'];
 const value = (role: Role) => ROLES[role].value;
 function css(role: Role): string {
  const spec = ROLES[role];
  return spec.token ? `var(${spec.token})` : spec.value;
 }
 function read(element?: Element | null): LWProcessPalette.Resolved {
  const host = element ?? (typeof document === 'undefined' ? null : document.querySelector('.process-studio'));
  const style = host && typeof getComputedStyle === 'function' ? getComputedStyle(host) : null;
  const out = {} as Record<Role, string>;
  for (const role of Object.keys(ROLES) as Role[]) {
   const spec = ROLES[role];
   out[role] = spec.token && style ? style.getPropertyValue(spec.token).trim() || spec.value : spec.value;
  }
  return Object.freeze(out);
 }
 function room(id: string): LWProcessPalette.Theme {
  const found = ROOMS[id];
  if (!found) throw Error('Unknown room theme ' + id);
  return found;
 }
 root.LWProcessPalette = Object.freeze({
  ROLES: Object.freeze(ROLES), ROOMS: Object.freeze(ROOMS), MOODS: Object.freeze(MOODS), PHASES: Object.freeze(PHASES),
  value, css, read, room,
 });
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessPalette;
})(globalThis);
