/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-palette.ts" />
/**
 * Touchpoint display data (LWProcessRooms.channels and LWProcessRooms.moods, filled here): per channel its label, a stroke glyph and
 * its room theme, and the seven mood faces of the authored `emotion` (-3..3). Pure data shared by the 2D map (glyphs, labels) and
 * the 3D rooms (themes, mood sprites). Presentation only; loads after process-rooms.ts. Theme and face colours are the studio
 * palette's (LWProcessPalette.ROOMS by channel id and LWProcessPalette.MOODS by level).
 */
(function(inputRoot: unknown) {
 'use strict';
 const {LWProcessRooms: rooms, LWProcessPalette: palette} = inputRoot as {LWProcessRooms: LWProcessRooms.Api; LWProcessPalette: LWProcessPalette.Api};
 const theme = (id: string, label: string, task: string): LWProcessRooms.Theme =>
  ({id, label: 'Touchpoint · ' + label, ...palette.room(id), task});
 // Stroke glyphs in a -0.5..0.5 box (monitor, phone, shop, headset, chat bubble, envelope, megaphone, billboard, parcel, document).
 const CHANNELS: [string, string, string, LWProcessRooms.Theme][] = [
  ['web', 'Website', 'M-.5 -.4 H.5 V.2 H-.5 Z M-.5 -.2 H.5 M-.2 .45 H.2 M0 .2 V.45',
   theme('web', 'Website', 'Browsing the site')],
  ['mobile', 'Mobile app', 'M-.25 -.5 H.25 V.5 H-.25 Z M-.1 .37 H.1',
   theme('mobile', 'Mobile app', 'Using the app')],
  ['store', 'Store', 'M-.5 -.1 L-.4 -.45 H.4 L.5 -.1 Z M-.4 -.1 V.45 H.4 V-.1 M-.12 .45 V.12 H.12 V.45',
   theme('store', 'Store', 'Shopping in store')],
  ['phone', 'Phone', 'M-.4 .05 V-.1 A.4 .4 0 0 1 .4 -.1 V.05 M-.5 0 H-.32 V.3 H-.5 Z M.32 0 H.5 V.3 H.32 Z M.4 .3 Q.4 .5 .1 .5',
   theme('phone', 'Phone', 'On a call')],
  ['chat', 'Chat', 'M-.5 -.4 H.5 V.2 H0 L-.25 .45 V.2 H-.5 Z M-.25 -.1 H.25',
   theme('chat', 'Chat', 'Chatting')],
  ['email', 'Email', 'M-.5 -.35 H.5 V.35 H-.5 Z M-.5 -.35 L0 .05 L.5 -.35',
   theme('email', 'Email', 'Reading email')],
  ['social', 'Social media', 'M-.5 -.1 H-.25 L.3 -.4 V.4 L-.25 .1 H-.5 Z M-.3 .1 L-.2 .45 H-.05 L-.1 .12 M.42 -.1 H.5 M.42 .1 H.5',
   theme('social', 'Social media', 'Scrolling the feed')],
  ['ads', 'Advertising', 'M-.5 -.45 H.5 V.1 H-.5 Z M-.25 .1 V.5 M.25 .1 V.5 M-.3 -.2 H.3',
   theme('ads', 'Advertising', 'Seeing an advert')],
  ['delivery', 'Delivery', 'M-.45 -.25 L0 -.5 L.45 -.25 V.25 L0 .5 L-.45 .25 Z M-.45 -.25 L0 0 L.45 -.25 M0 0 V.5',
   theme('delivery', 'Delivery', 'Receiving the parcel')],
  ['document', 'Documents', 'M-.35 -.5 H.15 L.4 -.25 V.5 H-.35 Z M.15 -.5 V-.25 H.4 M-.2 0 H.25 M-.2 .2 H.25',
   theme('document', 'Documents', 'Filling in forms')],
 ];
 for (const [id, label, glyph, th] of CHANNELS) rooms.channels[id] = {label, glyph, theme: th};
 Object.assign(rooms.fallbackTheme, {label: 'Touchpoint', id: 'journey'});
 // Mood faces: colour runs cool to warm (the palette's MOODS); strokes are drawn in a 100-unit box (eyes at 35,40 and 65,40).
 const face = (level: number) => palette.MOODS[level + 3]!;
 rooms.moods.push(
  {level: -3, label: 'very unhappy', color: face(-3), mouth: 'M28 76 Q50 54 72 76', brow: 'M26 36 L42 28 M74 36 L58 28'},
  {level: -2, label: 'unhappy', color: face(-2), mouth: 'M30 72 Q50 58 70 72'},
  {level: -1, label: 'uneasy', color: face(-1), mouth: 'M34 70 Q50 63 66 70'},
  {level: 0, label: 'neutral', color: face(0), mouth: 'M34 68 H66'},
  {level: 1, label: 'pleased', color: face(1), mouth: 'M34 64 Q50 71 66 64'},
  {level: 2, label: 'happy', color: face(2), mouth: 'M30 62 Q50 80 70 62'},
  {level: 3, label: 'delighted', color: face(3), mouth: 'M28 60 Q50 92 72 60 Z', open: true},
 );
})(globalThis);
