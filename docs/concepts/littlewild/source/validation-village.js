/* Additional v10 integrity checks: bounded data, claims and physical navigation.
 * Validation never repairs a save or changes an active story. */
(function (root) {
 'use strict';
 const own = (o, k) => Object.hasOwn(o, k);
 const dict = o => o && typeof o === 'object' && !Array.isArray(o);
 const whole = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;
 function validate(s) {
  const fail = message => { throw Error('Village save: ' + message); };
  const G = root.LWGeography, C = root.LWGrowth, p = s.progression;
  const creatures = s.colony.creatures, events = new Set();
  let largest = 0;
  if (typeof p.grandfathered !== 'boolean') fail('invalid migration flag');
  if (!dict(s.planning) || !dict(s.planning.controls) || Object.keys(s.planning.controls).length > 4000 || !Array.isArray(s.planning.history) || s.planning.history.length > 60) fail('invalid planner state');
  for (const [key, value] of Object.entries(s.planning.controls)) {
   if (!/^(order|lesson|outfit|quest|social|unpack|activity):[\w:.-]{1,160}$/.test(key) || !dict(value)) fail('invalid planner control');
   for (const [field, n] of Object.entries(value)) {
    if (field === 'priority' ? !whole(n, 0, 2) : !['paused', 'stopped'].includes(field) || typeof n !== 'boolean') fail('invalid planner policy');
   }
  }
  const text = v => typeof v === 'string' && v.length <= 240 && !/[<>\x00-\x1f]/.test(v);
  for (const h of s.planning.history) if (!dict(h) || !Number.isFinite(h.time) || !text(h.key) || !text(h.name) || !text(h.action) || h.actorId && !creatures.some(c => c.id === h.actorId)) fail('invalid planner history');
  for (const c of creatures) {
   if (!dict(c.interactionCooldowns) || Object.keys(c.interactionCooldowns).length > 100) fail('invalid interaction cooldowns');
   for (const [id, until] of Object.entries(c.interactionCooldowns)) if (!C.content.interactions.some(d => d.id === id) || !Number.isFinite(until) || until < 0 || until > s.simTime + 86400) fail('invalid interaction cooldown');
   for (const ev of c.eventInteractions) {
    if (!dict(ev) || typeof ev.id !== 'string' || !/^event-[1-9]\d*$/.test(ev.id) || events.has(ev.id) || !Number.isFinite(ev.created) || ev.created < 0 || ev.created > s.simTime + .001 || !Number.isFinite(ev.expires) || ev.expires < ev.created || ev.expires - ev.created > 86400 || !text(ev.trigger)) fail('invalid temporary interaction');
    events.add(ev.id); largest = Math.max(largest, Number(ev.id.slice(6)));
   }
  }
  if (p.interactionSequence <= largest) fail('event sequence collision');
  const grid = G.grid(s);
  for (const b of s.buildings) if (root.LW.Village.indoor.has(b.kind) && (!b.door || !grid.pass(b.x + b.door.dx, b.y + b.door.dy))) fail('blocked building doorway');
  const first = creatures.find(c => !c.activeQuest)?.creature || { x: 9, y: 9 };
  if (grid.flood({ x: Math.round(first.x), y: Math.round(first.y) }).size !== grid.cells.size) fail('disconnected walking paths');
  const claimed = new Map();
  for (const o of s.market.orders) {
   if (!dict(o.transit) || !dict(o.staged) || !Number.isFinite(o.created) || o.created < 0 || o.created > s.simTime + .001) fail('invalid sale claims');
   if (o.status === 'done' && (o.sold !== o.amount || o.remaining || Object.values(o.transit).some(Boolean) || Object.values(o.staged).some(Boolean))) fail('settled sale still has goods');
   if (['cancelling', 'cancelled'].includes(o.status) && (o.remaining || Object.values(o.transit).some(Boolean))) fail('cancelled sale still reserves cargo');
   if (o.status === 'cancelled' && Object.values(o.staged).some(Boolean)) fail('cancelled sale still has stall goods');
   for (const [id, n] of Object.entries(o.transit)) { const key = id + ':' + o.item; claimed.set(key, (claimed.get(key) || 0) + n); }
  }
  for (const c of creatures) for (const [key, n] of claimed) if (key.startsWith(c.id + ':') && n > (c.inventory[key.slice(c.id.length + 1)] || 0)) fail('market orders claim the same carried goods');
  for (const b of s.buildings) if (Object.values(b.marketInventory || {}).reduce((n, x) => n + x, 0) > C.content.rules.marketCapacity) fail('market stall over capacity');
  const receiptIds = new Set();
  for (const h of s.market.history) {
   if (!dict(h) || !text(h.id) || receiptIds.has(h.id) || !root.LW.colony.item(h.item) || !whole(h.amount, 1, 99) || !whole(h.coins, 0, 990000) || !Number.isFinite(h.time) || h.time > s.simTime + .001 || !creatures.some(c => c.id === h.actorId)) fail('invalid market receipt');
   receiptIds.add(h.id);
  }
 }
 root.LWVillageValidation = { validate };
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWVillageValidation;
})(typeof globalThis !== 'undefined' ? globalThis : this);
