/* A Well-Charted Home.
 * The map is a read model; purchases and expeditions cross this domain boundary.
 * No DOM, wall-clock time, remote inventory access, or presentation-driven dice.
 */
(function (root) {
  'use strict';
  const L = root.LW, Composition = L.EngineComposition, G = root.LWGeography;
  const C = root.LWGrowth, A = root.LWAdventure, B = root.LWContent;
  const copy = C.clone, fail = reason => ({ok: false, reason});
  const whole = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;
  const finite = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  const coords = id => typeof id === 'string' && /^-?\d+,-?\d+$/.test(id) ? id.split(',').map(Number) : null;
  const islandKey = i => G.key(i.ix, i.iy);
  function seedFor(id) {
    let value = 2166136261;
    for (const letter of 'littlewild-island-quests:' + id) value = Math.imul(value ^ letter.charCodeAt(0), 16777619);
    return value >>> 0 || 1;
  }
  function draw(clock) {
    let x = clock.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    clock.rng = x >>> 0 || 1;
    return clock.rng / 4294967296;
  }
  function metadata(engine, id, questId) {
    const p = coords(id) || [0, 0], region = engine.islandProfile(...p);
    const quest = A.content.quests.find(q => q.id === questId);
    return {islandId: G.key(...p), islandName: region.name,
      playerLevel: Math.max(quest?.tier || 1, region.minimumLevel), creatureLevel: quest?.tier || 1};
  }
  /** Reject invalid current-format records. */
  function validateAtlas(s) {
    const bad = text => { throw Error('World map save: ' + text); };
    const a = s.atlas;
    if (!a || a.version !== 1 || !a.clocks || Array.isArray(a.clocks) || !Array.isArray(a.history) || a.history.length > 256) bad('invalid island director.');
    const owned = new Set(s.estate.islands.map(islandKey));
    if (Object.keys(a.clocks).length !== owned.size) bad('every owned island needs one quest clock.');
    for (const [id, clock] of Object.entries(a.clocks)) {
      if (!owned.has(id) || !clock || !finite(clock.nextAt, 0, 1e10) || !whole(clock.misses, 0, 100) || !whole(clock.rng, 1, 4294967295)) bad('invalid clock or island reference.');
    }
    const activeIds = new Set(), receiptIds = new Set();
    let largest = 0;
    function reference(q, active) {
      if (!q || !owned.has(q.islandId) || typeof q.islandName !== 'string' || q.islandName.length > 100 ||
          !whole(q.playerLevel, 1, 100) || !whole(q.creatureLevel, 1, 100) ||
          typeof q.offerId !== 'string' || !/^offer\d+$/.test(q.offerId)) bad('invalid expedition origin.');
      if (q.offerId.startsWith('offer')) largest = Math.max(largest, Number(q.offerId.slice(5)));
      if (active) { if (activeIds.has(q.offerId)) bad('an invitation cannot have two owners.'); activeIds.add(q.offerId); }
    }
    for (const offer of s.colony.board.offers) {
      reference(offer, true);
      if (offer.id !== offer.offerId || !finite(offer.created, 0, s.simTime + .001) || !finite(offer.expires, offer.created, 1e10)) bad('invalid invitation identity or time.');
    }
    for (const c of s.colony.creatures) {
      if (c.questPlan && c.activeQuest) bad('a creature cannot prepare and travel simultaneously.');
      if (c.questPlan) reference(c.questPlan, true);
      if (c.activeQuest) {
        reference(c.activeQuest, true);
        const q = c.activeQuest;
        if (q.required !== Math.ceil(q.checks.length * .6) || typeof q.aborted !== 'boolean') bad('invalid expedition completion threshold.');
        if (q.status === 'returning' && !q.aborted && (q.checkIndex !== q.checks.length || q.elapsed < q.duration)) bad('an incomplete expedition cannot be returning successfully.');
      }
      for (const q of c.questHistory) reference(q, false);
    }
    for (const r of a.history) {
      reference(r, false);
      if (receiptIds.has(r.offerId) || activeIds.has(r.offerId)) bad('an expedition receipt is duplicated or still active.');
      receiptIds.add(r.offerId);
      if (!s.colony.creatures.some(c => c.id === r.actorId) || !finite(r.finished, 0, s.simTime + .001) ||
          !['completed', 'partial', 'recalled'].includes(r.outcome) || !whole(r.prestige, 0, 10000)) bad('invalid expedition receipt.');
    }
    if (s.colony.board.sequence < largest) bad('invitation sequence would reuse an identity.');
  }
  function initializeCartography(self) {
    if (!self.s.atlas) {
      self.s.atlas = {version: 1, clocks: {}, history: []};
      for (const island of self.s.estate.islands) self.initializeIsland(islandKey(island));
      // Earlier composition layers may seed current quest-board offers before cartography initializes.
      for (const offer of self.s.colony.board.offers) Object.assign(offer, metadata(self, '0,0', offer.questId), {offerId: offer.id});
    }
    self.s.version = 8;
  }
  function defineLayer(Base){return class CartographyLayer extends Base {
    initializeIsland(id) {
      this.s.atlas.clocks[id] = {nextAt: this.s.simTime + C.content.cartography.cooldown, misses: 0, rng: seedFor(id)};
    }
    islandProfile(ix, iy) {
      const desc = G.describe(ix, iy), profile = C.content.cartography.biomes.find(b => b.id === desc.biome);
      const distance = Math.abs(ix) + Math.abs(iy);
      return {...desc, ix, iy, id: G.key(ix, iy), description: profile.description,
        minimumLevel: distance === 0 ? 1 : Math.min(100, Math.max(C.content.rules.landLevel, profile.minimumLevel) + Math.max(0, distance - 1) * C.content.cartography.distanceLevelStep),
        questIds: distance === 0 ? ['meadow', 'woodland', 'brook'] : profile.questIds.slice()};
    }
    mapTable() {
      const grid = G.grid(this.s);
      return this.s.buildings.find(b => b.kind === 'map_table' && grid.approach(b)) || null;
    }
    mapAccessIssue() {
      if (this.mapTable()) return null;
      if (this.s.buildings.some(b => b.kind === 'map_table')) return 'Clear an approach to the map table.';
      if (this.allOrders().some(o => o.type === 'build' && o.kind === 'map_table')) return 'Finish the map table construction. A blueprint does not open the world map.';
      return this.gateIssue('buildings', 'map_table')
        ? 'Research Shared cartography in Discoveries, then build a map table to open the world map.'
        : 'The blueprint is known. Assign a companion to build the map table.';
    }
    landQuote(ix, iy) {
      const q = super.landQuote();
      if (ix === undefined && iy === undefined) return q; // aggregate next-price summary
      const region = this.islandProfile(ix, iy);
      return {...q, level: region.minimumLevel, islandId: region.id, name: region.name,
        token: B.fingerprint({schemaVersion: 1, library: {id: C.hash}, components: {
          island: region.id, purchases: this.s.estate.purchases,
          owned: this.s.estate.islands.map(islandKey).sort(), tables: this.s.buildings.filter(b => b.kind === 'map_table').map(b => b.id).sort()
        }})};
    }
    islandPurchaseIssue(ix, iy) {
      if (!whole(ix, -48, 48) || !whole(iy, -48, 48)) return 'Choose a valid island coordinate.';
      const gate = this.mapAccessIssue() || this.gateIssue('features', 'land');
      if (gate) return gate;
      if (!G.frontier(this.s).some(i => i.ix === ix && i.iy === iy)) return 'Choose an unowned island sharing an edge with your land.';
      if (this.s.estate.islands.length >= C.content.rules.maxIslands) return 'The configured island limit is reached.';
      const q = this.landQuote(ix, iy);
      if (this.s.player.level < q.level) return q.name + ' requires guide level ' + q.level + '. Your level is ' + this.s.player.level + '.';
      if (this.s.player.coins < q.coins || this.s.progression.prestige < q.prestige) return 'Need ' + q.coins + ' coins and ' + q.prestige + ' prestige.';
      return null;
    }
    buyIsland(ix, iy, reviewedQuote = null) {
      const issue = this.islandPurchaseIssue(ix, iy);
      if (issue) return fail(issue);
      const q = this.landQuote(ix, iy);
      if (reviewedQuote && B.stable(reviewedQuote) !== B.stable(q)) return fail('This island review is stale. Review its requirements and price again.');
      const result = super.buyIsland(ix, iy);
      if (!result.ok) return result;
      this.initializeIsland(q.islandId);
      this.offerForIsland(q.islandId, true);
      result.quote = q;
      return result;
    }
    /** A colony quest board may show the same template from different islands. */
    addOffer(questId, source, islandId = '0,0') {
      if (!this.s.atlas) return super.addOffer(questId, source);
      const board = this.s.colony.board;
      if (!A.content.quests.some(q => q.id === questId) || !this.s.atlas.clocks[islandId] ||
          board.offers.length >= 128 || board.sequence >= 1e9 ||
          board.offers.some(o => o.questId === questId && o.islandId === islandId)) return false;
      const id = 'offer' + (++board.sequence);
      board.offers.push({id, offerId: id, questId, source,
        ...metadata(this, islandId, questId), created: this.s.simTime, expires: this.s.simTime + A.content.rules.questOfferLife});
      return true;
    }
    offerForIsland(id, guaranteed = false) {
      const clock = this.s.atlas.clocks[id];
      if (!clock || this.s.colony.board.offers.some(o => o.islandId === id) ||
          this.creatures.some(c => (c.questPlan || c.activeQuest)?.islandId === id)) return false;
      const profile = this.islandProfile(...coords(id));
      const available = profile.questIds.filter(id => A.content.quests.some(q => q.id === id));
      const roll = draw(clock);
      if (!guaranteed && roll >= C.content.cartography.eventChance && clock.misses < C.content.cartography.guaranteedAfterMisses) { clock.misses++; return false; }
      if (!available.length) return false;
      const questId = available[Math.floor(draw(clock) * available.length)];
      const added = this.addOffer(questId, 'An invitation from ' + profile.name, id);
      if (added) clock.misses = 0;
      return added;
    }
    updateQuestBoard() {
      if (!this.s.atlas) return super.updateQuestBoard();
      const board = this.s.colony.board, now = this.s.simTime;
      board.offers = board.offers.filter(o => o.expires > now);
      let added = 0;
      for (const id of Object.keys(this.s.atlas.clocks).sort()) {
        const clock = this.s.atlas.clocks[id];
        if (now < clock.nextAt) continue;
        clock.nextAt = now + C.content.cartography.cooldown;
        if (this.offerForIsland(id)) added++;
      }
      board.nextAt = Math.min(...Object.values(this.s.atlas.clocks).map(c => c.nextAt));
      if (added) this.emit('notice', added === 1 ? 'An island invitation arrived. Open Quests to review its origin and requirements.' : added + ' island invitations arrived.');
    }
    questPlanIssue(q, c = this.actor) {
      if (!q || !A.content.quests.some(d => d.id === q.questId)) return 'This expedition is unavailable.';
      if (!this.s.atlas.clocks[q.islandId]) return 'This expedition belongs to an island you do not own.';
      if (this.s.player.level < q.playerLevel) return 'Guide level ' + q.playerLevel + ' required for this island expedition.';
      if (c.creature.level < q.creatureLevel) return c.name + ' needs creature level ' + q.creatureLevel + ' for this expedition.';
      return this.gateIssue('features', 'quests');
    }
    questOfferIssue(offerId, c = this.actor) {
      if (!c) return 'Select a creature.';
      if (c.activeQuest || c.questPlan) return c.name + ' already has an adventure planned.';
      const q = this.s.colony.board.offers.find(o => o.id === offerId);
      if (!q || q.expires <= this.s.simTime) return 'That invitation is no longer available.';
      return this.questPlanIssue(q, c);
    }
    acceptQuest(id) {
      const issue = this.interactionIssue() || this.questOfferIssue(id);
      if (issue) return fail(issue);
      const offer = copy(this.s.colony.board.offers.find(o => o.id === id));
      const result = super.acceptQuest(id);
      if (result.ok) Object.assign(this.actor.questPlan, {offerId: offer.id, islandId: offer.islandId,
        islandName: offer.islandName, playerLevel: offer.playerLevel, creatureLevel: offer.creatureLevel});
      return result;
    }
    depart() {
      const plan = this.actor.questPlan;
      if (!plan || this.questPlanIssue(plan)) return false;
      const snapshot = copy(plan);
      const result = super.depart();
      if (result) Object.assign(this.actor.activeQuest, {offerId: snapshot.offerId, islandId: snapshot.islandId,
        islandName: snapshot.islandName, playerLevel: snapshot.playerLevel, creatureLevel: snapshot.creatureLevel});
      return result;
    }
    returnQuest() {
      const q = this.actor.activeQuest;
      // Timer/checkpoint completion, not a UI callback, authorizes settlement.
      if (!q || q.status !== 'returning' || q.returnRemaining > 0 ||
          (!q.aborted && (q.elapsed < q.duration || q.checkIndex !== q.checks.length)) ||
          this.s.atlas.history.some(r => r.offerId === q.offerId)) return false;
      const result = super.returnQuest();
      if (result) {
        const report = this.actor.questHistory[0];
        this.s.atlas.history.unshift({offerId: q.offerId, questId: q.questId, islandId: q.islandId,
          islandName: q.islandName, playerLevel: q.playerLevel, creatureLevel: q.creatureLevel,
          actorId: this.actor.id, finished: this.s.simTime, outcome: q.aborted ? 'recalled' : q.successes >= q.required ? 'completed' : 'partial',
          prestige: report.prestigeReward || 0});
        this.s.atlas.history = this.s.atlas.history.slice(0, 256);
      }
      return result;
    }
    export() { const doc = super.export(); doc.version = 8; doc.state.version = 8; return doc; }
    static import(input) {
      if (input?.version !== 8) throw Error('Only the current Littlewild save format (v8) is supported.');
      const raw = copy(input); validateAtlas(raw.state);
      raw.version = 7; raw.state.version = 7;
      const old = super.import(raw), engine = Composition.constructThrough('cartography',old.export().state);
      validateAtlas(engine.export().state); return engine;
    }
  };}

  // Authored scenario setup only.
  function installFactories(){
    const scenarioNames = ['createWorldDemo', 'createColonyDemo', 'createWorkshopDemo'];
    const original = Object.fromEntries(scenarioNames.map(name => [name, L[name]])), factories = {};
    for (const name of scenarioNames) factories[name] = () => {
      let previous;
      try { Object.assign(L, original); previous = original[name](); }
      finally { Object.assign(L, factories); }
      const e = Composition.constructThrough('cartography',previous.export().state);
      if (name !== 'createWorldDemo') return e;
      e.s.progression.research['blueprint-map-table'] = true;
      e.s.progression.research['discovery-1'] = true;
      e.s.progression.research['discovery-2'] = true;
      e.s.progression.features.discovery = Math.max(2, e.s.progression.features.discovery || 0);
      for (let y = 8; y <= 15 && !e.mapTable(); y++) for (let x = 5; x <= 14 && !e.mapTable(); x++) {
        if (!e.placementIssue('map_table', x, y)) e.s.buildings.push({id: 'b' + e.s.nextId++, kind: 'map_table', x, y, level: 1, quality: 75, stock: 0, regen: 0});
      }
      return e;
    };
    Object.assign(L, factories);
  }
  Composition.register({id:'cartography',order:60,define:defineLayer,initialize:initializeCartography,installFactories});
  root.LWCartography = {validate: validateAtlas, seedFor};
  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})(typeof globalThis !== 'undefined' ? globalThis : this);
