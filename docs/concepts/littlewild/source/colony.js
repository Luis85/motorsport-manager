/* Littlewild v5 — multiple independent actors in one authoritative world.
 * Existing learning/construction services read a scoped actor view (s.*).
 * Only this module advances the shared clock, nodes, crops and quest director.
 * Warehouse transfers are commands completed at a physical destination, never UI transfers.
 */
(function (root) {
    'use strict';
    const L = root.LW, LegacyEngine = L.Engine, R = root.LWRPG, A = root.LWAdventure;
    const { RES, SKILLS, BUILDINGS, RECIPES, DRILLS, STYLES, CONTRACTS, clamp, terrain, SIZE } = L;
    const copy = A.copy, fail = reason => ({ ok: false, reason }), ok = (x = {}) => ({ ok: true, ...x });
    const PERSONAL = ['name', 'creature', 'bond', 'needs', 'inventory', 'allowance', 'skills', 'researched', 'training', 'orders', 'task', 'focus', 'cooldowns', 'memory', 'stats', 'stockTargets', 'practice', 'memories', 'wish', 'daily', 'learning', 'specializations', 'fieldStudies', 'buildPolicy', 'metrics'];
    const FOOD = ['meals', 'bread', 'berries', 'meat'], GATE = { x: 17, y: 16 };
    const safeInt = (x, a, b) => Number.isInteger(x) && x >= a && x <= b;
    const listKnown = (o, keys) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).every(k => keys.includes(k));
    function definition(id) { return A.content.equipment.find(x => x.id === id); }
    function item(id) { return RES[id] ? { id, ...RES[id], weight: A.content.weights[id] } : definition(id) || (id === 'wooden_chest' ? (A.content.chest || A.defaultContent.chest) : null); }
    function profile(id) { return A.content.personalities.find(x => x.id === id) || A.content.personalities[0]; }
    function decorateActor(c, id, personality = 'curious') {
        const p = profile(personality);
        c.id = id;
        c.personality = p.id;
        c.traits = [...p.traits];
        c.rpg = { attributes: { ...p.attributes }, cp: 0, points: {}, practiceCredit: {}, rolls: [], rng: 2718 + Number(id.slice(1)) * 1913 };
        for (const key of Object.keys(c.skills))
            if (c.skills[key])
                c.rpg.points[key] = Math.min(12, 1 + Math.floor((c.practice[key] || 0) / 8));
        c.equipment = Object.fromEntries(A.slots.map(k => [k, null]));
        c.equipQueue = [];
        c.questPlan = null;
        c.activeQuest = null;
        c.questHistory = [];
        c.needsDeposit = false;
        c.feelings = { anger: 0, social: 76, causes: [], lastControl: -100, coolingUntil: 0, lastSocial: -100, mood: 'Content' };
        c.behavior = { trace: [], memory: {}, lastAction: 'A new beginning' };
        c.lastRoll = null;
        c.careVisual = null;
        c.salvage = [];
        return c;
    }
    class Engine extends LegacyEngine {
        constructor(state) {
            super(state);
            this._simulating = false;
            this._actor = null;
            if (!this.s.colony) {
                const c = decorateActor(Object.fromEntries(PERSONAL.map(k => [k, this.s[k]])), 'c1');
                const warehouse = { inventory: { ...c.inventory }, transfers: [] };
                c.inventory = Object.fromEntries(Object.keys(RES).map(k => [k, 0]));
                for (const [r, n] of [['berries', 2], ['water', 2]]) {
                    const take = Math.min(n, warehouse.inventory[r] || 0);
                    c.inventory[r] = take;
                    warehouse.inventory[r] -= take;
                }
                this.s.colony = { version: 1, selectedId: 'c1', nextCreatureId: 2, purchased: 1, creatures: [c], warehouse, relationships: {}, rng: 86420, board: { offers: [], nextAt: 0, misses: 0, sequence: 0 }, message: 'A shared home; a life of their own.' };
            }
            this._actor = this.s.colony.creatures.find(c => c.id === this.s.colony.selectedId) || this.s.colony.creatures[0];
            for (const key of PERSONAL)
                Object.defineProperty(this.s, key, { enumerable: true, configurable: true, get: () => this._actor[key], set: value => { this._actor[key] = value; } });
            this.s.version = 5;
            this.ensureWarehouse();
            this.behaviorTree = new root.LWBehaviorTree(this.handlers());
            this.ecs = root.LWActorECS.create();
            this.ecs.sync(this.creatures);
            if (!this.s.colony.board.offers.length && this.s.colony.board.nextAt === 0) {
                this.addOffer('meadow', 'A neighbor’s invitation');
                this.addOffer('woodland', 'Fresh trail signs');
                this.s.colony.board.nextAt = this.s.simTime + A.content.rules.questCooldown;
            }
        }
        get actor() { return this._actor; }
        get creatures() { return this.s.colony.creatures; }
        get selected() { return this.s.colony.selectedId ? this.creatures.find(c => c.id === this.s.colony.selectedId) : null; }
        withActor(c, fn) {
            const prior = this._actor;
            this._actor = typeof c === 'string' ? this.creatures.find(x => x.id === c) : c;
            if (!this._actor) {
                this._actor = prior;
                throw Error('Unknown creature.');
            }
            try {
                return fn();
            }
            finally {
                this._actor = prior;
            }
        }
        selectCreature(id) {
            const c = this.creatures.find(x => x.id === id);
            if (!c)
                return fail('That creature is not in this glade.');
            this.s.colony.selectedId = id;
            this._actor = c;
            return ok();
        }
        interactionIssue() {
            if (this._simulating)
                return null;
            if (!this.selected)
                return 'Select a creature in the roster or in the world first.';
            if (this.actor.activeQuest)
                return this.actor.name + ' is away. Only recalling the quest is possible.';
            return null;
        }
        ensureWarehouse() {
            if (this.has('storehouse'))
                return;
            const candidates = [[8, 7], [9, 9], [7, 7], [9, 13]];
            for (let y = 4; y < 16; y++)
                for (let x = 4; x < 16; x++)
                    candidates.push([x, y]);
            const p = candidates.find(([x, y]) => super.canBuild(x, y));
            if (!p)
                throw Error('No reachable place is available for the starter warehouse.');
            this.s.buildings.push({ id: 'b' + this.s.nextId++, kind: 'storehouse', x: p[0], y: p[1], level: 1, quality: 60, stock: 0, regen: 0 });
            this._blockedKey = '';
        }
        warehouse() { return this.s.buildings.find(b => b.kind === 'storehouse'); }
        at(target) { return target && Math.hypot(this.s.creature.x - target.x, this.s.creature.y - target.y) <= 1.6; }
        allOrders() { return this.creatures.flatMap(c => c.orders.map(o => ({ ...o, creatureId: c.id, creatureName: c.name }))); }
        canBuild(x, y) {
            if (!this.s.colony)
                return super.canBuild(x, y);
            if (this.creatures.some(c => !c.activeQuest && Math.hypot(c.creature.x - x, c.creature.y - y) < .7))
                return false;
            const own = this.actor.orders;
            try {
                this.actor.orders = this.creatures.flatMap(c => c.orders);
                return super.canBuild(x, y);
            }
            finally {
                this.actor.orders = own;
            }
        }
        place(kind, x, y) {
            if (this.allOrders().some(o => o.type === 'build' && o.kind === kind))
                return fail('A creature is already planning this building.');
            return super.place(kind, x, y);
        }
        upgrade(id, approach) {
            const b = this.s.buildings.find(b => b.id === id);
            if (b && this.allOrders().some(o => o.type === 'upgrade' && o.kind === b.kind))
                return fail('This improvement already has a creature looking after it.');
            return super.upgrade(id, approach);
        }
        emit(type, text, extra = {}) { super.emit(type, text, { actorId: this._actor?.id, ...extra }); }
        log(text, icon = 'leaf') {
            const before = this.s.log.length;
            super.log(text, icon);
            if (this.s.log[0])
                this.s.log[0].actorId = this._actor?.id || null;
        }
        transaction(label, guide = 0, pocket = 0, research = 0) {
            super.transaction(label, guide, pocket, research);
            if ((guide || pocket || research) && this.s.ledger[0])
                this.s.ledger[0].actorId = this._actor?.id || null;
        }
        xp(who, amount) {
            const level = this.s.creature.level;
            super.xp(who, amount);
            if (who === 'creature' && this.actor?.rpg && this.s.creature.level > level) {
                const points = (this.s.creature.level - level) * A.content.rules.cpPerLevel;
                this.actor.rpg.cp += points;
                this.emit('notice', this.s.name + ' earned ' + points + ' character points.');
            }
        }
        random(stream = 'actor') { const holder = stream === 'world' ? this.s.colony : this.actor.rpg, key = stream === 'world' ? 'rng' : 'rng'; const next = R.next(holder[key]); holder[key] = next.seed; return next.value; }
        load(c = this.actor) { return R.encumbrance(c.rpg.attributes.ST, Object.entries(c.inventory).reduce((n, [id, q]) => n + (item(id)?.weight || 0) * q, 0)); }
        traitEffects(c = this.actor) { return c.traits.map(id => A.content.traits.find(t => t.id === id)).filter(Boolean); }
        modifiers(skill, c = this.actor) {
            const rule = A.content.skillRules[skill], attr = rule?.attribute || (['ST', 'DX', 'IQ', 'HT'].includes(skill) ? skill : skill === 'Per' || skill === 'Will' || skill === 'social' ? 'IQ' : 'DX');
            const mods = [], add = (name, n) => {
                if (n)
                    mods.push({ name, value: n });
            };
            const matches = bonuses => (bonuses[skill] || 0) + (skill !== attr ? (bonuses[attr] || 0) : 0) + ((skill === 'Per' || skill === 'Will') ? 0 : rule && ['craft', 'making', 'homestead'].includes(SKILLS[skill]?.discipline) ? (bonuses.craft || 0) : 0);
            for (const id of Object.values(c.equipment)) {
                const g = definition(id);
                if (g)
                    add(g.name, matches(g.bonuses));
            }
            for (const t of this.traitEffects(c))
                add(t.name, matches(t.bonuses));
            if (c.needs.energy < 30)
                add('Tired', -2);
            else if (c.needs.energy < 45)
                add('Low energy', -1);
            if (c.needs.food < 25 || c.needs.water < 25)
                add('Needs attention', -1);
            if (c.feelings.anger >= 60)
                add('Angry', -2);
            else if (c.feelings.anger >= 30)
                add('Frustrated', -1);
            if (attr === 'DX')
                add('Encumbrance', -this.load(c).level);
            return { attribute: attr, mods };
        }
        skillRating(skill, c = this.actor, extra = 0) { const rule = A.content.skillRules[skill], m = this.modifiers(skill, c); const base = rule ? R.skillLevel(c.rpg.attributes[m.attribute], rule.difficulty, c.rpg.points[skill] || 0) : c.rpg.attributes[m.attribute]; const mods = [...m.mods, ...(extra ? [{ name: 'Task difficulty', value: extra }] : [])]; const target = base + mods.reduce((n, x) => n + x.value, 0); return { skill, attribute: m.attribute, base, points: c.rpg.points[skill] || 0, difficulty: rule?.difficulty || null, modifiers: mods, target, chance: R.odds(target).success }; }
        check(skill, extra = 0, label = skill) { const view = this.skillRating(skill, this.actor, extra); const dice = Array.from({ length: 3 }, () => 1 + Math.floor(this.random() * 6)); const r = { ...R.resolve(view.target, dice), skill, label, base: view.base, modifiers: view.modifiers, time: this.s.simTime, actorId: this.actor.id }; this.actor.rpg.rolls.unshift(r); this.actor.rpg.rolls = this.actor.rpg.rolls.slice(0, 60); this.actor.lastRoll = r; this.emit('roll', label, { roll: r }); return r; }
        spendPoint(id) {
            const c = this.actor;
            if (Object.hasOwn(c.rpg.attributes, id)) {
                const cost = ['IQ', 'DX'].includes(id) ? 20 : 10;
                if (c.rpg.cp < cost)
                    return fail('This attribute improvement needs ' + cost + ' character points.');
                if (c.rpg.attributes[id] >= 16)
                    return fail('This prototype caps attributes at 16.');
                c.rpg.cp -= cost;
                c.rpg.attributes[id]++;
                return ok();
            }
            if (!c.skills[id])
                return fail('Learn this skill before investing character points.');
            const cost = R.nextCost(c.rpg.points[id] || 1);
            if (c.rpg.cp < cost)
                return fail('The next skill level needs ' + cost + ' character points.');
            if ((c.rpg.points[id] || 0) >= 40)
                return fail('This skill has reached the prototype point cap.');
            c.rpg.cp -= cost;
            c.rpg.points[id] = (c.rpg.points[id] || 1) + cost;
            return ok();
        }
        practiceSkill(id, amount = 1) {
            super.practiceSkill(id, amount);
            if (!this.actor?.rpg || !this.s.skills[id])
                return;
            this.actor.rpg.points[id] ??= 1;
            const p = this.actor.rpg.practiceCredit;
            p[id] = (p[id] || 0) + amount;
            while (p[id] >= A.content.rules.practicePerPoint) {
                p[id] -= A.content.rules.practicePerPoint;
                this.actor.rpg.points[id] = Math.min(40, this.actor.rpg.points[id] + 1);
            }
        }
        careIssue(kind) {
            const gate = this.interactionIssue();
            if (gate)
                return gate;
            if (kind === 'soothe' || kind === 'space')
                return this.s.cooldowns[kind] > this.s.simTime ? 'Let that moment settle first.' : null;
            return super.careIssue(kind);
        }
        care(kind) {
            const issue = this.careIssue(kind);
            if (issue)
                return fail(issue);
            if (['soothe', 'space'].includes(kind)) {
                this.s.cooldowns[kind] = this.s.simTime + 25;
                if (kind === 'space') {
                    this.actor.feelings.coolingUntil = this.s.simTime + 14;
                    if (!this.s.task?.need) {
                        this.releaseSocial(this.s.task);
                        this.s.task = null;
                    }
                    this.changeFeeling('Room to breathe', 5, -12);
                    this.emit('heart', 'Thank you for giving me a little room.');
                }
                else {
                    this.changeFeeling('A reassuring moment', 8, -18);
                    this.s.bond = clamp(this.s.bond + 1, 0, 100);
                    this.emit('heart', 'We can take this one little step at a time.');
                }
                this.visual(kind);
                return ok();
            }
            const r = super.care(kind);
            if (r.ok) {
                this.changeFeeling(kind === 'praise' ? 'My effort was noticed' : kind === 'bond' ? 'Time with my guide' : 'A caring moment', 5, -5);
                this.visual(kind);
            }
            return r;
        }
        visual(kind) { this.actor.careVisual = { kind, time: this.s.simTime }; this.emit('interaction', this.s.name + ' · ' + kind, { kind, x: this.s.creature.x, y: this.s.creature.y }); }
        changeFeeling(reason, joy = 0, anger = 0) { const f = this.actor.feelings, traits = this.traitEffects(); const multiplier = anger > 0 ? traits.reduce((n, t) => n * t.angerRate, 1) : traits.reduce((n, t) => n * t.soothing, 1); f.anger = clamp(f.anger + anger * multiplier, 0, 100); this.s.needs.joy = clamp(this.s.needs.joy + joy, 0, 100); f.causes.unshift({ reason, joy, anger: Math.round(anger * multiplier), time: this.s.simTime }); f.causes = f.causes.slice(0, 8); }
        mood(c = this.actor) {
            const n = c.needs, f = c.feelings;
            if (!f)
                return super.mood();
            return f.anger >= 60 ? 'Angry' : f.anger >= 30 ? 'Frustrated' : n.energy < 25 ? 'Sleepy' : n.food < 25 ? 'Hungry' : n.water < 25 ? 'Thirsty' : f.social < 25 ? 'Lonely' : n.joy >= 85 && c.bond >= 50 ? 'Delighted' : n.joy >= 58 ? 'Content' : n.joy < 35 ? 'Low spirits' : 'Thoughtful';
        }
        purchasePrice() { return Math.ceil(A.content.rules.purchaseBase * Math.pow(A.content.rules.purchaseGrowth, this.s.colony.purchased - 1)); }
        purchaseCreature(personality) {
            if (!A.content.personalities.some(p => p.id === personality))
                return fail('Choose an available personality.');
            if (this.creatures.length >= A.content.rules.maxCreatures)
                return fail('This prototype supports ' + A.content.rules.maxCreatures + ' creatures.');
            const price = this.purchasePrice();
            if (this.s.player.coins < price)
                return fail('Need ' + price + ' guide coins to welcome another creature.');
            const raw = new LegacyEngine().s, id = 'c' + this.s.colony.nextCreatureId++, names = ['Pip', 'Fern', 'Mochi', 'Clover', 'Bramble', 'Wren', 'Pebble', 'Juniper'];
            const c = decorateActor(Object.fromEntries(PERSONAL.map(k => [k, copy(raw[k])])), id, personality);
            c.name = names[(this.s.colony.purchased) % names.length];
            c.inventory = Object.fromEntries(Object.keys(RES).map(k => [k, 0]));
            c.creature.coins = 0;
            c.creature.x = GATE.x;
            c.creature.y = GATE.y;
            c.allowance.given = 0;
            c.feelings.causes = [{ reason: 'A new place, and a new beginning', joy: 6, anger: 0, time: this.s.simTime }];
            this.s.player.coins -= price;
            this.s.colony.purchased++;
            this.creatures.push(c);
            this.s.colony.selectedId = null;
            this.transaction('Welcomed ' + c.name, -price);
            this.log(c.name + ' arrived. Select a creature before giving an idea or sharing a moment.', 'paw');
            this.emit('arrival', c.name + ' found a place in our glade.', { actorId: c.id });
            return ok({ creature: c, price });
        }
        depositKeep(c = this.actor) { return root.LWPolicies.protectedInventory(this, c); }
        surplus(c = this.actor) { const keep = this.depositKeep(c); return Object.fromEntries(Object.entries(c.inventory).map(([id, n]) => [id, Math.max(0, n - (keep[id] || 0))]).filter(([, n]) => n > 0)); }
        depositTask(reason = 'Bringing useful things home', all = false) {
            const goods = this.surplus();
            if (!Object.keys(goods).length && !this.actor.needsDeposit)
                return null;
            return { kind: 'deposit', target: this.warehouse(), duration: 3, label: reason, reason: 'Only a visit to the warehouse can make carried items available to the whole glade.', thought: 'A place for everything we brought home.', all };
        }
        recordTransfer(direction, goods) { const w = this.s.colony.warehouse; w.transfers.unshift({ actorId: this.actor.id, name: this.s.name, direction, items: copy(goods), time: this.s.simTime }); w.transfers = w.transfers.slice(0, 50); this.emit('transfer', this.s.name + (direction === 'in' ? ' stocked the warehouse.' : ' picked up supplies.'), { items: goods, direction }); }
        resourceTask(resource, orderId = null, force = false, quantity = 0, visited = []) {
            if (visited.includes(resource) || visited.length > 12)
                return null;
            const inv = this.s.inventory, w = this.s.colony.warehouse.inventory;
            const order = this.s.orders.find(o => o.id === orderId);
            let wanted = quantity || (['build', 'upgrade'].includes(order?.type) ? this.constructionCost(order)[resource] : 0) || 3;
            if (!force && w[resource] > 0) {
                const capacity = Math.floor((this.load().maximumKg * 1000 - this.load().grams) / (item(resource)?.weight || 1));
                const amount = Math.min(w[resource], Math.max(1, wanted - (inv[resource] || 0)), Math.max(0, capacity));
                if (amount > 0)
                    return { kind: 'withdraw', resource, amount, orderId, target: this.warehouse(), duration: 2, label: 'Collecting ' + item(resource).name.toLowerCase() + ' from the warehouse', reason: 'I need it in my own satchel before I can use it.', thought: 'I’ll pick up only what I need.' };
            }
            const g = definition(resource);
            const rec = g?.recipe || RECIPES[resource];
            if (rec) {
                if (!this.s.skills[rec.skill] || !this.has(rec.station))
                    return null;
                for (const [k, n] of Object.entries(rec.cost))
                    if ((inv[k] || 0) < n)
                        return this.resourceTask(k, orderId, false, n, [...visited, resource]);
                return { kind: g ? 'gearcraft' : 'craft', resource, orderId, target: this.s.buildings.find(b => b.kind === rec.station), duration: rec.time, label: 'Making ' + item(resource).name.toLowerCase(), reason: 'The required ingredients are in my satchel. I can use our station.', thought: 'A little care in every piece.' };
            }
            return super.resourceTask(resource, orderId, force);
        }
        assessResource(resource, amount, seen = new Set()) {
            if ((this.s.inventory[resource] || 0) + (this.s.colony.warehouse.inventory[resource] || 0) >= amount)
                return null;
            return super.assessResource(resource, amount, seen);
        }
        createNeedTask(which) {
            if (['food', 'water'].includes(which)) {
                const available = which === 'food' ? FOOD.find(r => this.s.inventory[r] > 0) : (this.s.inventory.water > 0 ? 'water' : null);
                if (available)
                    return super.createNeedTask(which);
                const stored = which === 'food' ? FOOD.find(r => (this.s.colony.warehouse.inventory[r] || 0) > 0) : 'water';
                if (stored && (this.s.colony.warehouse.inventory[stored] || 0) > 0)
                    return this.resourceTask(stored, null, false, 2);
                if (which === 'food' && this.s.skills.cooking && this.has('fire') && this.s.inventory.meat > 0)
                    return this.resourceTask('meals', null, false, 1);
                return super.createNeedTask(which);
            }
            return super.createNeedTask(which);
        }
        orderTask(o) { return super.orderTask(o); }
        requestEquipment(id) {
            if (!definition(id))
                return fail('Unknown equipment.');
            if (this.actor.equipQueue.includes(id) || Object.values(this.actor.equipment).includes(id))
                return fail('This item is already worn or being prepared.');
            if (this.actor.equipQueue.length >= 4)
                return fail('Prepare at most four outfit pieces at a time.');
            this.actor.equipQueue.push(id);
            this.log('You suggested ' + definition(id).name + '. ' + this.s.name + ' will fetch or make it when ready.', 'bag');
            return ok();
        }
        unequip(slot) {
            if (!A.slots.includes(slot) || !this.actor.equipment[slot])
                return fail('Nothing is worn in this slot.');
            this.actor.equipment[slot] = null;
            this.visual('equip');
            return ok();
        }
        cancelEquipment(id) {
            if (!this.actor.equipQueue.includes(id))
                return fail('That equipment is no longer being prepared.');
            this.actor.equipQueue = this.actor.equipQueue.filter(g => g !== id);
            const task = this.actor.task;
            if (task?.itemId === id || (task?.kind === 'gearcraft' && task.resource === id))
                this.actor.task = null;
            return ok();
        }
        sellItem(id, qty = 1) {
            if (!this.has('market'))
                return fail('Build a market before selling stored goods.');
            if (!item(id) || !safeInt(qty, 1, 99))
                return fail('Choose an item and a quantity from 1 to 99.');
            const w = this.s.colony.warehouse.inventory;
            if ((w[id] || 0) < qty)
                return fail('Only goods already deposited in the warehouse can be sold.');
            const total = Math.max(1, Math.floor(item(id).price * .65)) * qty;
            w[id] -= qty;
            this.s.player.coins += total;
            this.transaction('Sold warehouse stock: ' + item(id).name, total);
            this.log('Sold ' + qty + ' ' + item(id).name.toLowerCase() + ' from the warehouse for ' + total + ' guide coins.', 'coin');
            return ok({ amount: total });
        }
        trade(id, mode, qty = 1) { return mode === 'sell' ? this.sellItem(id, qty) : fail('The guide cannot buy or transfer global inventory. Creatures shop with their own pocket coins.'); }
        cancel(id) {
            const o = this.s.orders.find(o => o.id === id);
            if (!o)
                return fail('That plan has already finished.');
            if (['build', 'upgrade'].includes(o.type)) {
                const refund = this.refundPreview(o);
                if (Object.values(refund).some(n => n > 0))
                    this.actor.salvage.push({ x: o.x, y: o.y, items: refund });
                this.s.orders = this.s.orders.filter(x => x.id !== id);
                if (this.s.task?.orderId === id)
                    this.s.task = null;
                this.log('Plan set aside. Salvage stays at the site until ' + this.s.name + ' collects it.', 'plan');
                return ok();
            }
            super.cancel(id);
            return ok();
        }
        addOffer(questId, source) {
            const board = this.s.colony.board, q = A.content.quests.find(q => q.id === questId);
            if (!q || board.offers.some(o => o.questId === questId) || board.offers.length >= 4)
                return;
            board.offers.push({ id: 'offer' + (++board.sequence), questId, source, created: this.s.simTime, expires: this.s.simTime + A.content.rules.questOfferLife });
        }
        questForecast(q, c = this.actor) {
            const travel = Math.min(.35, Object.values(c.equipment).reduce((n, id) => n + (definition(id)?.travel || 0), 0) + this.traitEffects(c).reduce((n, t) => n + t.travel, 0));
            const load = this.load(c);
            const duration = Math.round(q.duration * (1 - travel) * (1 + load.level * .15));
            const checks = q.steps.map(st => ({ ...st, ...this.skillRating(st.skill, c, st.modifier) }));
            let distribution = [1];
            for (const st of checks) {
                const next = Array(distribution.length + 1).fill(0);
                distribution.forEach((p, i) => { next[i] += p * (1 - st.chance); next[i + 1] += p * st.chance; });
                distribution = next;
            }
            const required = Math.ceil(checks.length * .6);
            return { duration, travel, load, checks, required, chance: distribution.slice(required).reduce((a, b) => a + b, 0), energy: q.energy, missing: Object.entries(q.cost).filter(([id, n]) => (c.inventory[id] || 0) < n).map(([id, n]) => ({ id, need: n, carried: c.inventory[id] || 0, stored: this.s.colony.warehouse.inventory[id] || 0 })) };
        }
        acceptQuest(offerId) {
            if (this.actor.questPlan || this.actor.activeQuest)
                return fail('This creature already has an adventure planned.');
            const offer = this.s.colony.board.offers.find(o => o.id === offerId);
            if (!offer || offer.expires <= this.s.simTime)
                return fail('That invitation is no longer available.');
            const q = A.content.quests.find(q => q.id === offer.questId);
            if (this.s.player.level < q.tier)
                return fail('Reach guide level ' + q.tier + ' first.');
            this.actor.questPlan = { questId: q.id, accepted: this.s.simTime, source: offer.source };
            this.s.colony.board.offers = this.s.colony.board.offers.filter(o => o.id !== offerId);
            this.log(this.s.name + ' is preparing for ' + q.name + '. No supplies are spent until departure.', 'compass');
            return ok();
        }
        cancelQuestPlan() {
            if (!this.actor.questPlan)
                return fail('No preparations to cancel.');
            this.actor.questPlan = null;
            return ok();
        }
        depart() {
            const c = this.actor, q = A.content.quests.find(q => q.id === c.questPlan?.questId);
            if (!q)
                return false;
            const forecast = this.questForecast(q);
            if (c.equipQueue.length || forecast.missing.length || this.s.needs.energy < q.energy + 15 || forecast.load.overloaded)
                return false;
            for (const [id, n] of Object.entries(q.cost))
                this.s.inventory[id] -= n;
            c.activeQuest = { questId: q.id, name: q.name, status: 'exploring', elapsed: 0, duration: forecast.duration, checkIndex: 0, checks: copy(forecast.checks), required: forecast.required, successes: 0, rolls: [], found: {}, energy: q.energy, energySpent: 0, coins: q.coins, research: q.research, started: this.s.simTime, returnRemaining: 0, aborted: false, outcome: null };
            c.questPlan = null;
            this.s.task = null;
            this.visual('depart');
            this.log(c.name + ' left for ' + q.name + '. Personal provisions packed; no interaction while away.', 'compass');
            return true;
        }
        abortQuest() {
            const gate = !this.selected ? 'Select the creature whose quest you want to recall.' : null;
            if (gate)
                return fail(gate);
            const q = this.actor.activeQuest;
            if (!q)
                return fail('This creature is not away.');
            if (q.status === 'returning')
                return fail('Already returning to the glade.');
            q.status = 'returning';
            q.aborted = true;
            q.outcome = 'Recalled';
            q.returnRemaining = A.content.rules.abortReturnSeconds;
            this.s.needs.energy = clamp(this.s.needs.energy - A.content.rules.abortEnergy, 0, 100);
            this.changeFeeling('Our expedition was recalled', -2, 3);
            this.log(this.s.name + ' is returning. ' + A.content.rules.abortEnergy + ' energy recall cost; packed provisions stay spent. Finds are kept, but there is no completion reward.', 'compass');
            return ok();
        }
        discover(q, template) {
            const pool = template.loot.filter(row => !q.found[row.item] && this.random() <= row.chance);
            if (!pool.length)
                return;
            const row = pool[Math.floor(this.random() * pool.length)], count = row.min + Math.floor(this.random() * (row.max - row.min + 1));
            const room = Math.max(0, Math.floor((this.load().maximumKg * 1000 - this.load().grams) / item(row.item).weight)), take = Math.min(room, count);
            if (take) {
                this.s.inventory[row.item] = (this.s.inventory[row.item] || 0) + take;
                q.found[row.item] = (q.found[row.item] || 0) + take;
            }
        }
        stepQuest(dt) {
            const c = this.actor, q = c.activeQuest;
            if (q.status === 'returning') {
                q.returnRemaining -= dt;
                if (q.returnRemaining <= 0)
                    this.returnQuest();
                return;
            }
            const template = A.content.quests.find(x => x.id === q.questId);
            q.elapsed = Math.min(q.duration, q.elapsed + dt);
            const expenditure = Math.min(q.energy, q.energy * q.elapsed / q.duration);
            this.s.needs.energy = clamp(this.s.needs.energy - (expenditure - q.energySpent), 0, 100);
            q.energySpent = expenditure;
            this.s.needs.food = clamp(this.s.needs.food - dt * .02, 0, 100);
            this.s.needs.water = clamp(this.s.needs.water - dt * .03, 0, 100);
            while (q.checkIndex < q.checks.length && q.elapsed >= q.duration * (q.checkIndex + 1) / (q.checks.length + 1)) {
                const step = q.checks[q.checkIndex++], dice = Array.from({ length: 3 }, () => 1 + Math.floor(this.random() * 6));
                const r = { ...R.resolve(step.target, dice), skill: step.skill, label: step.name, base: step.base, modifiers: copy(step.modifiers), time: this.s.simTime, actorId: c.id };
                q.rolls.push(r);
                c.rpg.rolls.unshift(r);
                c.rpg.rolls = c.rpg.rolls.slice(0, 60);
                c.lastRoll = r;
                if (r.success) {
                    q.successes++;
                    this.discover(q, template);
                }
                if (c.skills[step.skill])
                    this.practiceSkill(step.skill);
                this.emit('quest-check', c.name + ': ' + step.name + ' · ' + r.outcome, { roll: r });
            }
            if (q.elapsed >= q.duration) {
                q.outcome = q.successes >= q.required ? 'Completed' : 'A partial discovery';
                q.status = 'returning';
                q.returnRemaining = A.content.rules.returnSeconds;
            }
        }
        returnQuest() {
            const c = this.actor, q = c.activeQuest;
            if (!q)
                return false; // A return is settled only once.
            const completed = !q.aborted && q.successes >= q.required;
            if (completed) {
                const pocket = Math.floor(q.coins * .3);
                this.s.player.coins += q.coins - pocket;
                this.s.creature.coins += pocket;
                this.transaction('Adventure: ' + q.name, q.coins - pocket, pocket, q.research);
                this.s.rp += q.research;
                this.xp('player', 10);
                this.xp('creature', 18);
                this.changeFeeling('I completed ' + q.name, 10, -9);
            }
            else {
                this.xp('creature', q.aborted ? 1 : 6);
                this.changeFeeling(q.aborted ? 'Back home after a recall' : 'We learned from a difficult adventure', q.aborted ? 0 : -4, q.aborted ? 0 : 7);
            }
            const report = { ...copy(q), finished: this.s.simTime, delivered: false, reward: completed ? q.coins : 0, researchReward: completed ? q.research : 0 };
            c.questHistory.unshift(report);
            c.questHistory = c.questHistory.slice(0, 15);
            c.activeQuest = null;
            c.needsDeposit = true;
            c.creature.x = GATE.x;
            c.creature.y = GATE.y;
            c.task = null;
            this.log(c.name + ' returned: ' + q.outcome + '. Finds remain in the satchel until the warehouse visit.', 'compass');
            this.emit('return', c.name + ' is home. First, a visit to the warehouse.');
            return true;
        }
        relationship(a, b) { const key = [a, b].sort().join('|'); return this.s.colony.relationships[key] || { a: [a, b].sort()[0], b: [a, b].sort()[1], affinity: 0, trust: 0, meetings: 0, lastTime: -100, memories: [] }; }
        suggestSocial(otherId) {
            const other = this.creatures.find(c => c.id === otherId);
            if (!other || other === this.actor)
                return fail('Choose another creature.');
            if (other.activeQuest)
                return fail(other.name + ' is away.');
            this.actor.socialIntent = otherId;
            return ok();
        }
        socialTask() {
            const c = this.actor;
            let others = this.creatures.filter(o => o !== c && !o.activeQuest && !o.task && o.needs.food > 30 && o.needs.water > 30 && o.needs.energy > 25 && this.s.simTime - o.feelings.lastSocial > 50);
            if (c.socialIntent)
                others = others.filter(o => o.id === c.socialIntent);
            const other = others.sort((a, b) => this.relationship(c.id, b.id).affinity - this.relationship(c.id, a.id).affinity)[0];
            if (!other)
                return null;
            return { kind: 'social', otherId: other.id, target: { x: Math.round(other.creature.x), y: Math.round(other.creature.y) }, duration: 6, label: 'Spending time with ' + other.name, reason: 'We can get to know each other without our guide directing every step.', thought: 'There is room for another friend.' };
        }
        handlers() {
            const start = t => t && this.startTask(t) ? 'running' : 'failure';
            return {
                essential: () => {
                    const n = this.s.needs;
                    for (const k of ['water', 'food', 'energy'].filter(k => n[k] < (k === 'energy' ? 15 : 20)).sort((a, b) => n[a] - n[b])) {
                        const r = start(this.needTask(k));
                        if (r !== 'failure')
                            return r;
                    }
                    return 'failure';
                },
                homecoming: () => this.actor.needsDeposit ? start(this.depositTask('Bringing expedition finds home')) : 'failure',
                overburdened: () => this.load().level >= 2 ? start(this.depositTask('Lightening a heavy satchel')) : 'failure',
                feelings: () => {
                    if (this.actor.feelings.coolingUntil > this.s.simTime || this.actor.feelings.anger >= 60)
                        return start({ kind: 'calmdown', target: { x: 8, y: 10 }, duration: 9, label: 'Taking a little breathing space', reason: 'My temper is running high. A quiet pause helps me settle.', thought: 'A little space. Then I can try again.' });
                    return 'failure';
                },
                comfort: () => {
                    const n = this.s.needs;
                    for (const k of Object.keys(n).filter(k => n[k] < (k === 'energy' ? 28 : k === 'comfort' ? 26 : 35) + (this.s.focus === 'cozy' ? 12 : 0)).sort((a, b) => n[a] - n[b])) {
                        const r = start(this.needTask(k));
                        if (r !== 'failure')
                            return r;
                    }
                    return 'failure';
                },
                outfit: () => {
                    const id = this.actor.equipQueue[0];
                    if (!id)
                        return 'failure';
                    if (this.s.inventory[id] > 0)
                        return start({ kind: 'equip', itemId: id, target: { x: Math.round(this.s.creature.x), y: Math.round(this.s.creature.y) }, duration: 2, label: 'Putting on ' + item(id).name.toLowerCase(), reason: 'This item is in my satchel; now it can help me.', thought: 'Ready for a little more of the world.' });
                    return start(this.resourceTask(id, null, false, 1));
                },
                quest: () => {
                    const plan = this.actor.questPlan;
                    if (!plan)
                        return 'failure';
                    const q = A.content.quests.find(q => q.id === plan.questId);
                    if (!q) {
                        this.actor.questPlan = null;
                        return 'failure';
                    }
                    for (const [r, n] of Object.entries(q.cost))
                        if ((this.s.inventory[r] || 0) < n)
                            return start(this.resourceTask(r, null, false, n));
                    if (this.s.needs.energy < q.energy + 15)
                        return start(this.needTask('energy'));
                    if (this.depart())
                        return 'running';
                    return 'failure';
                },
                learning: () => {
                    const s = this.s, l = s.learning;
                    if (!s.training && l.queue.length)
                        s.training = l.queue.shift();
                    if (l.paused)
                        return 'failure';
                    if (l.recovering)
                        return start({ kind: 'reflect', target: s.buildings.find(b => b.kind === 'circle') || { x: 8, y: 10 }, duration: 10, label: 'Letting a lesson settle', reason: 'A learning break restores my focus.', thought: 'I am putting the pieces together.' });
                    if (s.training) {
                        const k = SKILLS[s.training.id];
                        return start({ kind: 'train', skillId: s.training.id, style: s.training.style, target: s.buildings.find(b => b.kind === 'circle') || { x: 8, y: 10 }, duration: k.time, elapsed: s.training.progress, label: 'Learning ' + k.short.toLowerCase(), reason: STYLES[s.training.style].name + '. A 3d6 check resolves my understanding.', thought: 'Watch, try, reflect. I can learn this.' });
                    }
                    return 'failure';
                },
                plans: () => {
                    if (this.actor.salvage.length) {
                        const s = this.actor.salvage[0];
                        return start({ kind: 'salvage', target: s, duration: 3, label: 'Collecting the set-aside materials', reason: 'Salvage has to be carried home, too.', thought: 'These can still become something useful.' });
                    }
                    const orders = this.s.orders.filter(o => !o.paused).sort((a, b) => b.priority - a.priority || a.created - b.created);
                    for (const o of orders) {
                        const r = start(this.orderTask(o));
                        if (r !== 'failure')
                            return r;
                    }
                    return 'failure';
                },
                companionship: () => {
                    if (this.actor.socialIntent || (this.actor.feelings.social < clamp(45 + this.traitEffects().reduce((n, t) => n + t.social, 0), 15, 75) && this.s.simTime - this.actor.feelings.lastSocial > 50))
                        return start(this.socialTask());
                    return 'failure';
                },
                supplies: () => {
                    for (const id of Object.keys(RES)) {
                        const total = (this.s.inventory[id] || 0) + (this.s.colony.warehouse.inventory[id] || 0);
                        if (total < (this.s.stockTargets[id] || 0) && !this.assessResource(id, this.s.stockTargets[id])) {
                            const t = this.resourceTask(id, null, true);
                            if (t) {
                                t.stock = true;
                                return start(t);
                            }
                        }
                    }
                    return 'failure';
                },
                deposit: () => Object.keys(this.surplus()).length ? start(this.depositTask()) : 'failure',
                curiosity: () => {
                    const c = this.actor, p = profile(c.personality);
                    if (this.s.skills.invention && this.has('study') && this.s.cooldowns.research <= this.s.simTime)
                        return start({ kind: 'research', target: this.s.buildings.find(b => b.kind === 'study'), duration: 9, label: 'Trying a little experiment', reason: 'My curiosity has room to lead.', thought: 'What happens when these pieces fit together?' });
                    if (this.s.simTime - (c.lastCuriosity || 0) > 55 / p.preferences.explore * (this.s.focus === 'curious' ? .75 : 1)) {
                        c.lastCuriosity = this.s.simTime;
                        return start({ kind: 'explore', target: { x: 4 + Math.floor(this.random() * 9), y: 12 }, duration: 7, label: 'Following a little curiosity', reason: 'My own interests matter, too.', thought: 'I wonder what we haven’t noticed yet.' });
                    }
                    return 'failure';
                },
                restful: () => start({ kind: 'idle', target: { x: 7 + Math.floor(this.random() * 4), y: 9 + Math.floor(this.random() * 3) }, duration: 5, label: 'Enjoying the glade', reason: 'There is no hurry and no unfinished need to chase.', thought: 'A good life has quiet moments.' })
            };
        }
        decide() {
            if (this.actor.activeQuest)
                return;
            const result = this.behaviorTree.tick(A.content.behaviorTree, { time: this.s.simTime, behaviorMemory: this.actor.behavior.memory });
            this.actor.behavior.trace = result.trace;
            this.actor.behavior.lastAction = this.s.task?.label || (this.actor.activeQuest ? 'Beyond the glade' : 'Considering my next step');
        }
        startTask(t) {
            if (!t || this.actor?.activeQuest)
                return false;
            const r = super.startTask(t);
            if (r && t.kind === 'social') {
                const other = this.creatures.find(c => c.id === t.otherId);
                if (!other || other.activeQuest || other.task) {
                    this.s.task = null;
                    return false;
                }
                other.task = { kind: 'socialwait', partner: this.actor.id, path: [], phase: 'work', elapsed: 0, duration: 24, label: 'Making time for ' + this.s.name, reason: 'A friend is on their way.', thought: 'We can share a quiet moment.', target: { x: other.creature.x, y: other.creature.y } };
            }
            return r;
        }
        workRate(t) { const p = profile(this.actor.personality).preferences; const preference = t.kind === 'train' || t.kind === 'practice' ? p.train : t.kind === 'build' ? p.build : 1; return super.workRate(t) * (this.actor?.feelings?.anger >= 60 ? .85 : 1) * (1 + (preference - 1) * .15) * (this.s.focus === 'builder' && t.kind === 'build' ? 1.1 : 1); }
        taskSkill(t) {
            if (t.kind === 'train' || t.kind === 'practice')
                return t.skillId;
            if (t.kind === 'gearcraft')
                return definition(t.resource)?.recipe.skill;
            if (t.kind === 'gather')
                return super.taskSkill(t) || 'Per';
            if (t.kind === 'explore')
                return 'Per';
            return super.taskSkill(t);
        }
        finishTask(t) {
            const c = this.actor, s = this.s, inv = s.inventory, w = s.colony.warehouse.inventory;
            if (t.kind === 'withdraw') {
                if (this.at(this.warehouse())) {
                    const room = Math.max(0, Math.floor((this.load().maximumKg * 1000 - this.load().grams) / item(t.resource).weight));
                    const n = Math.min(t.amount, w[t.resource] || 0, room);
                    if (n > 0) {
                        w[t.resource] -= n;
                        inv[t.resource] = (inv[t.resource] || 0) + n;
                        this.recordTransfer('out', { [t.resource]: n });
                    }
                }
                s.task = null;
                return;
            }
            if (t.kind === 'deposit') {
                if (this.at(this.warehouse())) {
                    const goods = this.surplus();
                    for (const [id, n] of Object.entries(goods)) {
                        inv[id] -= n;
                        w[id] = (w[id] || 0) + n;
                    }
                    if (Object.keys(goods).length)
                        this.recordTransfer('in', goods);
                    if (c.needsDeposit && c.questHistory[0])
                        c.questHistory[0].delivered = true;
                    c.needsDeposit = false;
                }
                s.task = null;
                return;
            }
            if (t.kind === 'salvage') {
                const cache = c.salvage[0];
                if (cache && this.at(cache)) {
                    for (const [id, n] of Object.entries(cache.items))
                        inv[id] = (inv[id] || 0) + n;
                    c.salvage.shift();
                }
                s.task = null;
                return;
            }
            if (t.kind === 'equip') {
                const g = definition(t.itemId);
                if (g && inv[g.id] > 0) {
                    c.equipment[g.slot] = g.id;
                    c.equipQueue = c.equipQueue.filter(id => id !== g.id);
                    this.visual('equip');
                    this.log(s.name + ' put on ' + g.name + '.', 'bag');
                }
                s.task = null;
                return;
            }
            if (t.kind === 'calmdown') {
                this.changeFeeling('A quiet pause helped', 8, -24);
                c.feelings.coolingUntil = 0;
                s.task = null;
                return;
            }
            if (t.kind === 'socialwait') {
                this.releaseSocial(t);
                s.task = null;
                return;
            }
            if (t.kind === 'social') {
                const other = this.creatures.find(x => x.id === t.otherId);
                if (other && !other.activeQuest && other.task?.kind === 'socialwait' && other.task.partner === c.id && Math.hypot(other.creature.x - s.creature.x, other.creature.y - s.creature.y) < 2.5) {
                    const relationship = this.relationship(c.id, other.id), r = this.check('social', relationship.affinity >= 30 ? 1 : 0, 'A moment with ' + other.name);
                    relationship.affinity = clamp(relationship.affinity + (r.success ? 7 : -2), -100, 100);
                    relationship.trust = clamp(relationship.trust + (r.success ? 4 : -1), 0, 100);
                    relationship.meetings++;
                    relationship.lastTime = s.simTime;
                    const memory = { time: s.simTime, text: r.success ? 'Shared a small story and felt closer.' : 'A slightly awkward moment. We can try another day.' };
                    relationship.memories.unshift(memory);
                    relationship.memories = relationship.memories.slice(0, 8);
                    this.s.colony.relationships[[c.id, other.id].sort().join('|')] = relationship;
                    c.feelings.social = clamp(c.feelings.social + 35, 0, 100);
                    other.feelings.social = clamp(other.feelings.social + 30, 0, 100);
                    c.feelings.lastSocial = other.feelings.lastSocial = s.simTime;
                    this.changeFeeling(r.success ? 'A good moment with ' + other.name : 'We didn’t quite understand each other', r.success ? 8 : -2, r.success ? -5 : 4);
                    other.needs.joy = clamp(other.needs.joy + (r.success ? 7 : 0), 0, 100);
                    if (other.task?.kind === 'socialwait')
                        other.task = null;
                    this.log(c.name + ' and ' + other.name + (r.success ? ' shared a moment. Their bond grew.' : ' had an awkward moment, then gave each other space.'), 'heart');
                    this.emit('social', c.name + ' & ' + other.name, { otherId: other.id, success: r.success });
                }
                c.socialIntent = null;
                s.task = null;
                return;
            }
            if (t.kind === 'unpack') {
                if (this.at(this.warehouse()) && inv.wooden_chest > 0) {
                    inv.wooden_chest--;
                    const chest = A.content.chest || A.defaultContent.chest, options = chest.equipmentPool.map(definition), g = options[Math.floor(this.random() * options.length)];
                    inv[g.id] = (inv[g.id] || 0) + 1;
                    for (const [id, n] of Object.entries(chest.supplies))
                        inv[id] = (inv[id] || 0) + n;
                    c.needsDeposit = true;
                    this.log(s.name + ' opened a woodland chest: ' + g.name + ' and packed supplies.', 'bag');
                    this.emit('celebrate', 'A chest held ' + g.name + '!');
                }
                s.task = null;
                return;
            }
            const uncertain = ['gather', 'craft', 'gearcraft', 'build', 'train', 'practice', 'hunt', 'explore', 'research', 'deliver'].includes(t.kind);
            if (uncertain) {
                const skill = this.taskSkill(t) || 'IQ', difficulty = t.kind === 'gather' ? 3 : t.kind === 'train' ? 3 : t.kind === 'build' ? 2 : t.kind === 'practice' ? 2 : 1;
                const r = this.check(skill, difficulty, t.label || t.kind);
                if (!r.success) {
                    const o = s.orders.find(x => x.id === t.orderId);
                    if (t.kind === 'build' && o)
                        o.progress = t.duration * .45;
                    if (t.kind === 'train' && s.training)
                        s.training.progress = t.duration * .6;
                    if (t.kind === 'practice' && o)
                        o.progress = 0;
                    this.xp('creature', 1);
                    this.changeFeeling('A setback while ' + (t.label || 'trying').toLowerCase(), -1, r.critical ? 7 : 2);
                    if (r.critical && ['craft', 'gearcraft'].includes(t.kind)) {
                        const recipe = definition(t.resource)?.recipe || RECIPES[t.resource], first = Object.keys(recipe.cost).find(id => inv[id] > 0);
                        if (first)
                            inv[first]--;
                    }
                    this.log(s.name + ' rolled ' + r.total + ' against ' + r.target + ': ' + (r.critical ? 'a critical setback' : 'a setback') + '. Work can be tried again.', 'leaf');
                    s.task = null;
                    return;
                }
                if (r.critical)
                    this.changeFeeling('A small breakthrough', 6, -5);
            }
            if (t.kind === 'gearcraft') {
                const g = definition(t.resource);
                if (Object.entries(g.recipe.cost).every(([id, n]) => inv[id] >= n)) {
                    for (const [id, n] of Object.entries(g.recipe.cost))
                        inv[id] -= n;
                    inv[g.id] = (inv[g.id] || 0) + 1;
                    this.practiceSkill(g.recipe.skill);
                    this.xp('creature', 7);
                    this.xp('player', 3);
                    this.log(s.name + ' made ' + g.name + '.', 'bench');
                }
                s.task = null;
                return;
            }
            const trainingId = s.training?.id;
            super.finishTask(t);
            if (t.kind === 'train' && trainingId && s.skills[trainingId])
                c.rpg.points[trainingId] ??= 1;
            if (t.kind === 'rest')
                this.changeFeeling('A good rest', 0, -12);
        }
        requestUnpack() {
            if (!(this.s.inventory.wooden_chest > 0) && !(this.s.colony.warehouse.inventory.wooden_chest > 0))
                return fail('No chest is available.');
            this.actor.unpackIntent = true;
            return ok();
        }
        updateQuestBoard() {
            const s = this.s;
                const board = s.colony.board;
                board.offers = board.offers.filter(o => o.expires > s.simTime);
                if (s.simTime >= board.nextAt) {
                    board.nextAt = s.simTime + A.content.rules.questCooldown;
                    const draw = this.random('world');
                    if (draw < A.content.rules.eventChance || board.misses >= 2) {
                        const available = A.content.quests.filter(q => q.tier <= s.player.level && !board.offers.some(o => o.questId === q.id));
                        if (available.length) {
                            const q = available[Math.floor(this.random('world') * available.length)];
                            this.addOffer(q.id, ['A letter from a neighbor', 'A strange glimmer beyond the gate', 'Fresh footprints on the trail'][Math.floor(this.random('world') * 3)]);
                            board.misses = 0;
                            this.emit('notice', 'A new invitation arrived at the adventure board.');
                        }
                    }
                    else
                        board.misses++;
                }
        }
        // One shared world tick. Actors cannot accelerate time by multiplying the population.
        step(dt) {
            if (typeof dt !== 'number' || !Number.isFinite(dt)) return;
            const s = this.s;
            if (!s.started || s.paused)
                return;
            dt = clamp(dt, 0, .25);
            if (!dt)
                return;
            this._simulating = true;
            const previous = this._actor;
            try {
                s.simTime += dt;
                s.hour += dt * .05;
                let newDay = false;
                if (s.hour >= 24) {
                    s.hour -= 24;
                    s.day++;
                    newDay = true;
                }
                if (this.stepWorld) this.stepWorld(dt);
                else {
                for (const node of s.nodes)
                    if (node.stock < node.max) {
                        node.regen += dt;
                        const limit = node.kind === 'berries' ? 18 : 24;
                        if (node.regen >= limit) {
                            node.regen -= limit;
                            node.stock = Math.min(node.max, node.stock + 1);
                        }
                    }
                for (const b of s.buildings)
                    if (L.CROP_RES[b.kind]) {
                        b.regen += dt * (1 + ((b.level || 1) - 1) * .1);
                        if (b.regen >= 80) {
                            b.regen -= 80;
                            b.stock = Math.min(12, b.stock + (b.kind === 'orchard' ? 6 : 4) + ((b.level || 1) - 1));
                        }
                    }
                }
                this.updateQuestBoard();
                this.ecs.sync(this.creatures);
                for (const c of this.creatures) {
                    this._actor = c;
                    if (newDay) {
                        c.daily = { day: s.day, bonded: 0 };
                        c.allowance.given = 0;
                        this.newWish();
                        if (c.allowance.auto && !c.activeQuest)
                            this.topUp(true);
                    }
                    if (c.activeQuest) {
                        this.stepQuest(dt);
                        continue;
                    }
                    this.stepActor(dt);
                }
            }
            finally {
                this._actor = previous;
                this._simulating = false;
            }
        }
        stepActor(dt) {
            const s = this.s, c = this.actor, n = s.needs, f = c.feelings, t = s.task;
            // The ECS owns deterministic physiology, learning fatigue and baseline social
            // recovery. Legacy task/incident handlers consume those component values.
            const {studying} = this.ecs.step(c, dt, {
                day: s.day,
                socialPreference: profile(c.personality).preferences.social,
                loadLevel: this.load().level,
                hasShelter: this.has('shelter')
            });
            if ((n.food < 12 || n.water < 12) && s.simTime - (c.lastNeedFeeling || 0) > 40) {
                c.lastNeedFeeling = s.simTime;
                this.changeFeeling('An essential need is waiting', -3, 5);
            }
            if (f.anger >= 45 && s.simTime - f.lastControl > 30) {
                f.lastControl = s.simTime;
                const dice = Array.from({ length: 3 }, () => 1 + Math.floor(this.random() * 6)), r = R.resolve(profile(c.personality).selfControl, dice);
                c.lastTemperCheck = { ...r, time: s.simTime };
                if (!r.success) {
                    f.coolingUntil = s.simTime + 12;
                    if (!t?.need) {
                        this.releaseSocial(t);
                        s.task = null;
                    }
                    this.emit('temper', c.name + ' needs a little room to settle.');
                }
            }
            f.mood = this.mood();
            this.checkWish();
            if (!s.task) {
                if (c.unpackIntent && !root.LWPlanner?.paused(this,'unpack:'+c.id)) {
                    if (n.food >= 20 && n.water >= 20 && n.energy >= 15) {
                        if (invCount(c, 'wooden_chest')) {
                            c.unpackIntent = false;
                            this.startTask({ kind: 'unpack', target: this.warehouse(), duration: 4, label: 'Opening a woodland chest', reason: 'A safe place to unpack an unexpected find.', thought: 'What could be tucked inside?' });
                            return;
                        }
                        if (this.s.colony.warehouse.inventory.wooden_chest > 0) {
                            this.startTask(this.resourceTask('wooden_chest', null, false, 1));
                            return;
                        }
                        c.unpackIntent = false;
                    }
                }
                this.decide();
                return;
            }
            const task = s.task;
            if (['water', 'food', 'energy'].some(k => n[k] < (k === 'energy' ? 10 : 12)) && !task.need && !['eat', 'eatbread', 'drink', 'rest'].includes(task.kind)) {
                this.releaseSocial(task);
                s.task = null;
                this.decide();
                return;
            }
            if (studying && c.learning.recovering) {
                s.task = null;
                this.decide();
                return;
            }
            // Task selection and completion consequences remain domain responsibilities.
            // ECS owns the deterministic movement and elapsed-work transition between them.
            if (task.phase !== 'walk' && task.kind === 'build') {
                const o = s.orders.find(o => o.id === task.orderId);
                if (!o) {
                    s.task = null;
                    return;
                }
                if (!o.paid) {
                    const cost = this.constructionCost(o);
                    if (!Object.entries(cost).every(([id, n]) => (s.inventory[id] || 0) >= n)) {
                        s.task = null;
                        return;
                    }
                    for (const [id, n] of Object.entries(cost))
                        s.inventory[id] -= n;
                    o.paid = true;
                }
            }
            const outcome = this.ecs.advanceActivity(c, dt, {
                walkable: (x, y) => this.walkable(x, y),
                moveRate: 1.8 * this.load().move,
                workRate: this.workRate(task)
            });
            if (outcome.state === 'blocked') {
                this.releaseSocial(task);
                s.task = null;
                return;
            }
            if (outcome.state === 'walking' || outcome.state === 'arrived')
                return;
            if (task.kind === 'build') {
                const o = s.orders.find(o => o.id === task.orderId);
                if (o) o.progress = Math.min(task.duration, task.elapsed);
            }
            if (task.kind === 'train' && s.training)
                s.training.progress = Math.min(task.duration, task.elapsed);
            if (task.kind === 'practice') {
                const o = s.orders.find(o => o.id === task.orderId);
                if (o) o.progress = Math.min(task.duration, task.elapsed);
            }
            if (outcome.completed)
                this.finishTask(task);
        }
        releaseSocial(task) {
            if (task?.kind === 'social') {
                const other = this.creatures.find(c => c.id === task.otherId);
                if (other?.task?.kind === 'socialwait' && other.task.partner === this.actor.id)
                    other.task = null;
            }
            else if (task?.kind === 'socialwait') {
                const other = this.creatures.find(c => c.id === task.partner);
                if (other?.task?.kind === 'social' && other.task.otherId === this.actor.id)
                    other.task = null;
            }
        }
        decisionSummary() {
            const base = super.decisionSummary();
            if (this.actor.activeQuest)
                return { source: 'An independent adventure', text: 'Beyond the glade' };
            return { ...base, trace: this.actor.behavior.trace };
        }
        export() {
            const state = {};
            for (const [k, v] of Object.entries(this.s))
                if (!PERSONAL.includes(k))
                    state[k] = copy(v);
            state.version = 5;
            return { app: 'littlewild', version: 5, state };
        }
        static import(doc) {
            if (doc?.version !== 5) {
                const base = LegacyEngine.import(doc);
                return new Engine(base.s);
            }
            return importV5(doc);
        }
    }
    function invCount(c, id) { return c.inventory[id] || 0; }
    // Public creature commands share one guard. Simulation-internal calls use an explicit scope.
    for (const name of ['care', 'research', 'teach', 'practice', 'cancelLesson', 'setLearningStyle', 'pauseLearning', 'chooseSpecialization', 'startStudy', 'pauseStudy', 'claimStudy', 'setAllowance', 'topUp', 'setStockTarget', 'place', 'upgrade', 'request', 'cancel', 'pauseOrder', 'prioritize', 'requestEquipment', 'unequip', 'cancelEquipment', 'acceptQuest', 'cancelQuestPlan', 'suggestSocial', 'requestUnpack', 'spendPoint']) {
        const method = Engine.prototype[name] || LegacyEngine.prototype[name];
        if (typeof method !== 'function')
            continue;
        Engine.prototype[name] = function (...args) { const issue = this.interactionIssue(); return issue ? fail(issue) : method.apply(this, args); };
    }
    function importV5(doc) {
        const raw = A.parse(doc);
        if (raw.app !== 'littlewild' || raw.version !== 5 || !raw.state?.colony)
            throw Error('Not a v5 Littlewild story.');
        const s = raw.state, col = s.colony;
        const lo=s.estate?-1200:0, hi=s.estate?1200:18;
        const check = (x, m) => {
            if (!x)
                throw Error('Story: ' + m);
        };
        const finite = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
        const str = (v, n) => typeof v === 'string' && v.length <= n;
        check(finite(s.simTime, 0, 1e10) && safeInt(s.day, 1, 1e8) && finite(s.hour, 0, 24), 'invalid time.');
        check(safeInt(s.player?.coins, 0, 1e12) && safeInt(s.player?.level, 1, 10000) && finite(s.player?.xp, 0, 1e8) && safeInt(s.rp, 0, 1e12), 'invalid shared balances.');
        check([1, 2, 4, 8].includes(s.speed), 'invalid speed.');
        check(Array.isArray(col.creatures) && col.creatures.length >= 1 && col.creatures.length <= A.content.rules.maxCreatures, 'invalid creature roster.');
        check(safeInt(col.nextCreatureId, 2, 1e6) && safeInt(col.purchased, 1, 1e6) && safeInt(col.rng, 0, 4294967295), 'invalid colony counters.');
        const ids = col.creatures.map(c => c.id);
        check(new Set(ids).size === ids.length && ids.every(id => /^c[1-9][0-9]*$/.test(id)), 'duplicate or invalid creature IDs.');
        check(col.selectedId === null || ids.includes(col.selectedId), 'invalid selection.');
        const itemIds = [...Object.keys(RES), ...A.content.equipment.map(g => g.id), 'wooden_chest'];
        const inventory = (inv, label, fill = true) => {
            check(listKnown(inv, itemIds), label + ' contains an unknown item.');
            for (const n of Object.values(inv))
                check(safeInt(n, 0, 1000000), label + ' contains an invalid quantity.');
            if (fill)
                for (const id of Object.keys(RES))
                    inv[id] ??= 0;
        };
        inventory(col.warehouse?.inventory, 'warehouse');
        check(Array.isArray(col.warehouse.transfers) && col.warehouse.transfers.length <= 50, 'invalid transfer history.');
        check(Array.isArray(s.buildings) && s.buildings.length <= (s.estate?1000:30), 'invalid buildings.');
        const occupied = new Set();
        for (const b of s.buildings) {
            check(Object.hasOwn(BUILDINGS, b.kind) && safeInt(b.x, lo, hi) && safeInt(b.y, lo, hi) && terrain(b.x, b.y) === 'grass' && safeInt(b.level, 1, 3) && finite(b.quality, 0, 100), 'invalid building.');
            check(!occupied.has(b.x + ',' + b.y), 'overlapping buildings.');
            occupied.add(b.x + ',' + b.y);
        }
        check(Array.isArray(s.nodes) && s.nodes.length <= (s.estate?8000:120), 'invalid resource nodes.');
        for (const n of s.nodes)
            check(str(n.id, 80) && safeInt(n.x, lo, hi) && safeInt(n.y, lo, hi) && finite(n.stock, 0, 1000) && finite(n.max, 1, 1000) && n.stock <= n.max && finite(n.regen, 0, 100), 'invalid deposit.');
        const taskKinds = ['build', 'gather', 'craft', 'gearcraft', 'train', 'practice', 'rest', 'warm', 'play', 'idle', 'eat', 'eatbread', 'drink', 'usebalm', 'hunt', 'explore', 'research', 'deliver', 'shop', 'reflect', 'withdraw', 'deposit', 'equip', 'unpack', 'social', 'socialwait', 'calmdown', 'salvage', ...(L.worldTaskKinds || [])];
        for (const c of col.creatures) {
            check(str(c.name, 24) && c.name.trim() && A.content.personalities.some(p => p.id === c.personality), 'invalid creature identity.');
            check(Array.isArray(c.traits) && c.traits.length <= 4 && new Set(c.traits).size === c.traits.length && c.traits.every(id => A.content.traits.some(t => t.id === id)), 'invalid traits.');
            inventory(c.inventory, c.name + ' satchel');
            check(listKnown(c.needs, ['food', 'water', 'energy', 'comfort', 'joy']) && Object.keys(c.needs).length === 5 && Object.values(c.needs).every(v => finite(v, 0, 100)), 'invalid needs.');
            check(finite(c.bond, 0, 100) && safeInt(c.creature?.coins, 0, 1e12) && safeInt(c.creature?.level, 1, 10000) && finite(c.creature?.xp, 0, 1e8) && finite(c.creature.x, lo, hi) && finite(c.creature.y, lo, hi), 'invalid creature state.');
            for (const id of ['ST', 'DX', 'IQ', 'HT'])
                check(safeInt(c.rpg?.attributes?.[id], 8, 16), 'invalid RPG attribute.');
            check(safeInt(c.rpg.cp, 0, 100000) && safeInt(c.rpg.rng, 0, 4294967295), 'invalid RPG points or seed.');
            check(listKnown(c.rpg.points, Object.keys(SKILLS)) && Object.values(c.rpg.points).every(n => safeInt(n, 0, 40)), 'invalid skill points.');
            check(listKnown(c.skills, Object.keys(SKILLS)) && Object.values(c.skills).every(n => n === true), 'invalid learned skills.');
            check(listKnown(c.researched, Object.keys(SKILLS)), 'invalid researched skills.');
            check(Array.isArray(c.rpg.rolls) && c.rpg.rolls.length <= 60, 'invalid roll history.');
            check(listKnown(c.equipment, A.slots) && Object.keys(c.equipment).length === A.slots.length, 'invalid equipment slots.');
            for (const [slot, id] of Object.entries(c.equipment))
                if (id !== null)
                    check(definition(id)?.slot === slot && c.inventory[id] >= 1, 'equipped item must be in the owner’s inventory.');
            check(Array.isArray(c.equipQueue) && c.equipQueue.length <= 4 && c.equipQueue.every(id => definition(id)), 'invalid outfit plan.');
            check(finite(c.feelings?.anger, 0, 100) && finite(c.feelings?.social, 0, 100) && Array.isArray(c.feelings.causes) && c.feelings.causes.length <= 8, 'invalid feelings.');
            check(Array.isArray(c.orders) && c.orders.length <= 12 && Array.isArray(c.salvage) && c.salvage.length <= 24, 'invalid plans.');
            for (const o of c.orders) {
                check(str(o.id, 60) && ['build', 'upgrade', 'practice', 'gather', 'craft', 'explore', 'hunt', 'deliver'].includes(o.type), 'invalid work order.');
                if (['build', 'upgrade'].includes(o.type))
                    check(Object.hasOwn(BUILDINGS, o.kind) && safeInt(o.x, lo, hi) && safeInt(o.y, lo, hi) && safeInt(o.stage || 0, 0, 2) && finite(o.progress || 0, 0, 10000), 'invalid construction order.');
                if (['gather', 'craft'].includes(o.type))
                    check(Object.hasOwn(RES, o.resource) && safeInt(o.amount, 1, 24) && safeInt(o.done || 0, 0, o.amount), 'invalid production order.');
                if (o.type === 'practice')
                    check(Object.hasOwn(SKILLS, o.skillId) && safeInt(o.amount, 1, 3), 'invalid practice.');
            }
            check(c.learning && Array.isArray(c.learning.queue) && c.learning.queue.length <= 4 && Object.hasOwn(STYLES, c.learning.style) && finite(c.learning.fatigue, 0, 100), 'invalid learning plan.');
            for (const t of [...c.learning.queue, ...(c.training ? [c.training] : [])])
                check(Object.hasOwn(SKILLS, t.id) && finite(t.progress, 0, SKILLS[t.id].time) && Object.hasOwn(STYLES, t.style), 'invalid lesson.');
            if (c.questPlan)
                check(A.content.quests.some(q => q.id === c.questPlan.questId), 'unknown planned quest.');
            if (c.activeQuest) {
                const q = c.activeQuest;
                check(A.content.quests.some(t => t.id === q.questId) && ['exploring', 'returning'].includes(q.status) && finite(q.duration, 10, 5000) && finite(q.elapsed, 0, q.duration) && safeInt(q.checkIndex, 0, 8) && safeInt(q.successes, 0, q.checkIndex) && Array.isArray(q.checks) && q.checks.length >= 1 && q.checks.length <= 8 && q.checkIndex <= q.checks.length && Array.isArray(q.rolls) && q.rolls.length === q.checkIndex, 'invalid active quest.');
                check(finite(q.energy, 0, 100) && finite(q.energySpent, 0, q.energy) && finite(q.returnRemaining, 0, 60) && safeInt(q.coins, 0, 1000) && safeInt(q.research, 0, 50), 'invalid quest balances.');
                inventory(q.found, 'quest finds', false);
                check(!c.task, 'an absent creature cannot have a world task.');
            }
            check(Array.isArray(c.questHistory) && c.questHistory.length <= 15, 'invalid adventure history.');
            if (c.task) {
                const t = c.task;
                check(taskKinds.includes(t.kind) && ['walk', 'work'].includes(t.phase) && Array.isArray(t.path) && t.path.length <= (s.estate?20000:361) && t.path.every(p => safeInt(p.x, lo, hi) && safeInt(p.y, lo, hi) && terrain(p.x, p.y) === 'grass') && finite(t.duration, 1, 10000) && finite(t.elapsed, 0, t.duration + .25), 'invalid active task.');
                if (t.resource)
                    check(itemIds.includes(t.resource), 'unknown task resource.');
            }
        }
        check(col.board && Array.isArray(col.board.offers) && col.board.offers.length <= (s.atlas ? 128 : 4) && finite(col.board.nextAt, 0, 1e10) && safeInt(col.board.sequence, 0, 1e9), 'invalid quest director.');
        for (const o of col.board.offers)
            check(str(o.id, 60) && A.content.quests.some(q => q.id === o.questId) && finite(o.expires, 0, 1e10), 'invalid offer.');
        check(col.relationships && typeof col.relationships === 'object' && !Array.isArray(col.relationships) && Object.keys(col.relationships).length <= 28, 'invalid relationships.');
        for (const [key, r] of Object.entries(col.relationships))
            check(ids.includes(r.a) && ids.includes(r.b) && r.a !== r.b && key === [r.a, r.b].sort().join('|') && finite(r.affinity, -100, 100) && finite(r.trust, 0, 100) && Array.isArray(r.memories) && r.memories.length <= 8, 'invalid relationship record.');
        // Validate optional persisted subtrees before any live registry is committed.
        const mapNumbers = (m, label, keys = null, max = 1e10) => {
            check(m && typeof m === 'object' && !Array.isArray(m), label + ' must be a map.');
            if (keys)
                check(Object.keys(m).every(k => keys.includes(k)), label + ' has an unknown reference.');
            check(Object.values(m).every(n => finite(n, 0, max)), label + ' has an invalid value.');
        };
        const roll = r => {
            check(r && Array.isArray(r.dice) && r.dice.length === 3 && r.dice.every(n => safeInt(n, 1, 6)) && finite(r.target, -50, 100) && str(r.label || '', 200), 'invalid roll record.');
            const resolved = R.resolve(r.target, r.dice);
            for (const key of ['total', 'margin', 'success', 'critical', 'outcome'])
                check(r[key] === resolved[key], 'inconsistent roll result.');
        };
        check(safeInt(s.seed, 0, 4294967295) && safeInt(s.nextId, 1, 1e9) && safeInt(s.contractIndex, 0, 1e8), 'invalid world counters.');
        check(typeof s.started === 'boolean' && typeof s.paused === 'boolean', 'invalid world status.');
        check(listKnown(s.settings, ['sound', 'follow', 'reducedMotion', 'highContrast']) && Object.values(s.settings).every(v => typeof v === 'boolean'), 'invalid preferences.');
        check(Array.isArray(s.log) && s.log.length <= 120 && s.log.every(r => str(r.text, 1000) && finite(r.time, 0, 1e10)), 'invalid journal.');
        check(Array.isArray(s.ledger) && s.ledger.length <= 120 && s.ledger.every(r => str(r.label, 300) && ['guide', 'pocket', 'research'].every(k => finite(r[k], -1e12, 1e12))), 'invalid ledger.');
        check(Array.isArray(s.completedQuests) && s.completedQuests.every(id => L.QUESTS.some(q => q.id === id)), 'invalid story chapters.');
        check(col.nextCreatureId > Math.max(...ids.map(id => Number(id.slice(1)))) && col.purchased >= col.creatures.length, 'invalid roster sequence.');
        check(new Set(s.buildings.map(b => b.id)).size === s.buildings.length && s.buildings.every(b => str(b.id, 60) && finite(b.stock || 0, 0, 1000) && finite(b.regen || 0, 0, 100)), 'invalid building record.');
        check(s.buildings.some(b => b.kind === 'storehouse'), 'a colony needs a warehouse.');
        check(new Set(s.nodes.map(n => n.id)).size === s.nodes.length && s.nodes.every(n => ['wood', 'stone', 'fiber', 'berries', 'water', 'hunt', 'clay', 'ore', 'herbs', 'grain', 'soil', 'groundwater', 'stream'].includes(n.kind)), 'unknown or duplicated resource node.');
        for (const tr of col.warehouse.transfers) {
            check(ids.includes(tr.actorId) && ['in', 'out'].includes(tr.direction) && str(tr.name, 24) && finite(tr.time, 0, 1e10), 'invalid transfer record.');
            inventory(tr.items, 'transfer record', false);
        }
        for (const c of col.creatures) {
            check(['balanced', 'cozy', 'builder', 'curious'].includes(c.focus), 'invalid creature focus.');
            check(c.allowance && safeInt(c.allowance.limit, 0, 30) && safeInt(c.allowance.given, 0, 1000) && safeInt(c.allowance.reserve, 0, 30) && typeof c.allowance.auto === 'boolean' && ['balanced', 'shop', 'gather'].includes(c.allowance.sourcing), 'invalid allowance.');
            mapNumbers(c.cooldowns, 'cooldowns');
            mapNumbers(c.stats, 'statistics');
            mapNumbers(c.stockTargets, 'reserve targets', Object.keys(RES), 99);
            mapNumbers(c.practice, 'practice history', Object.keys(SKILLS));
            mapNumbers(c.rpg.practiceCredit, 'practice credit', Object.keys(SKILLS));
            mapNumbers(c.learning.practicedToday, 'daily practice', Object.keys(SKILLS));
            check(Object.values(c.researched).every(v => v === true), 'invalid research status.');
            check(L.PATHS[c.learning.path] && typeof c.learning.paused === 'boolean' && typeof c.learning.recovering === 'boolean' && safeInt(c.learning.practiceDay, 1, 1e8), 'invalid learning preferences.');
            check(L.APPROACHES[c.buildPolicy?.approach], 'unknown construction approach.');
            check(listKnown(c.specializations, Object.keys(L.DISCIPLINES)) && Object.entries(c.specializations).every(([d, id]) => L.SPECIALIZATIONS[d]?.some(t => t.id === id)), 'invalid talent.');
            check(c.fieldStudies && (!c.fieldStudies.active || L.STUDIES[c.fieldStudies.active]) && Array.isArray(c.fieldStudies.completed) && c.fieldStudies.completed.every(id => L.STUDIES[id]), 'invalid field study.');
            check(c.fieldStudies.progress && typeof c.fieldStudies.progress === 'object' && !Array.isArray(c.fieldStudies.progress), 'invalid study evidence.');
            check(c.metrics && ['crafts', 'gathered', 'practices'].every(k => c.metrics[k] && typeof c.metrics[k] === 'object'), 'invalid work metrics.');
            check(Array.isArray(c.memories) && c.memories.length <= 100 && c.memories.every(m => str(m.title, 200) && str(m.description, 600)), 'invalid memories.');
            check(c.memory && typeof c.memory === 'object' && !Array.isArray(c.memory) && c.daily && finite(c.daily.bonded, 0, 1e6), 'invalid daily memory.');
            if (c.wish)
                check(str(c.wish.title, 200) && str(c.wish.thought, 300) && safeInt(c.wish.amount, 1, 100) && Object.hasOwn(c.stats, c.wish.stat) && finite(c.wish.start, 0, 1e10), 'invalid daily wish.');
            check(c.behavior && Array.isArray(c.behavior.trace) && c.behavior.trace.length <= 100 && c.behavior.trace.every(t => str(t.id, 61) && str(t.name, 100) && ['running', 'success', 'failure'].includes(t.status)), 'invalid behavior trace.');
            mapNumbers(c.behavior.memory, 'behavior cooldown memory');
            check(c.feelings.causes.every(r => str(r.reason, 400) && finite(r.time, 0, 1e10) && finite(r.joy, -100, 100) && finite(r.anger, -100, 100)), 'invalid feeling cause.');
            for (const k of ['lastControl', 'coolingUntil', 'lastSocial'])
                check(finite(c.feelings[k], -1000, 1e10), 'invalid feeling timer.');
            c.rpg.rolls.forEach(roll);
            if (c.lastRoll)
                roll(c.lastRoll);
            if (c.socialIntent)
                check(ids.includes(c.socialIntent) && c.socialIntent !== c.id, 'invalid social intent.');
            for (const cache of c.salvage) {
                check(safeInt(cache.x, lo, hi) && safeInt(cache.y, lo, hi), 'invalid salvage position.');
                inventory(cache.items, 'salvage', false);
            }
            for (const o of c.orders) {
                if (o.paid !== undefined)
                    check(typeof o.paid === 'boolean', 'invalid paid construction stage.');
                if (['build', 'upgrade'].includes(o.type))
                    check(L.APPROACHES[o.approach] && (o.quality === undefined || finite(o.quality, 0, 100)), 'invalid project finish.');
                if (o.type === 'upgrade')
                    check(s.buildings.some(b => b.kind === o.kind && b.x === o.x && b.y === o.y), 'unknown upgrade target.');
            }
            if (c.task) {
                const t = c.task;
                if (t.target)
                    check(finite(t.target.x, lo, hi) && finite(t.target.y, lo, hi), 'invalid task destination.');
                if (t.skillId)
                    check(SKILLS[t.skillId], 'unknown task skill.');
                if (t.kind === 'withdraw')
                    check(safeInt(t.amount, 1, 1000000), 'invalid withdrawal amount.');
                if (t.kind === 'equip')
                    check(definition(t.itemId), 'unknown equipment task.');
                if (['social', 'socialwait'].includes(t.kind))
                    check(ids.includes(t.otherId || t.partner), 'unknown social partner.');
                if (['craft', 'gearcraft'].includes(t.kind))
                    check(RECIPES[t.resource] || definition(t.resource)?.recipe, 'unknown craft recipe.');
                if (t.orderId)
                    check(c.orders.some(o => o.id === t.orderId), 'orphaned task order.');
            }
            if (c.activeQuest) {
                const q = c.activeQuest;
                check(safeInt(q.required, 1, q.checks.length) && typeof q.aborted === 'boolean' && str(q.name, 160), 'invalid quest snapshot.');
                for (const st of q.checks)
                    check((SKILLS[st.skill] || ['ST', 'DX', 'IQ', 'HT', 'Per', 'Will', 'social'].includes(st.skill)) && finite(st.target, -50, 100) && finite(st.base, -50, 100) && Array.isArray(st.modifiers) && st.modifiers.every(m => str(m.name, 100) && finite(m.value, -30, 30)), 'invalid quest check.');
                q.rolls.forEach(roll);
                check(q.rolls.filter(r => r.success).length === q.successes, 'invalid quest success count.');
            }
            for (const q of c.questHistory) {
                check(str(q.name, 160) && str(q.outcome, 80) && finite(q.finished, 0, 1e10) && typeof q.delivered === 'boolean' && Array.isArray(q.rolls) && q.rolls.length <= 8, 'invalid quest history.');
                inventory(q.found, 'past quest finds', false);
                q.rolls.forEach(roll);
            }
        }
        const first = col.creatures.find(c => c.id === col.selectedId) || col.creatures[0];
        for (const key of PERSONAL)
            s[key] = copy(first[key]);
        const e = new Engine(s);
        return e;
    }
    L.LegacyEngine = LegacyEngine;
    L.Engine = Engine;
    L.colony = { item, definition, profile, PERSONAL, GATE };
    const oldDemo = L.createWorkshopDemo;
    L.createWorkshopDemo = () => new Engine(oldDemo().s);
    L.createColonyDemo = function () {
        const e = L.createWorkshopDemo();
        e.s.player.coins = 920;
        e.s.rp = 62;
        e.s.training = null;
        e.s.learning.queue = [];
        e.s.orders = [];
        e.actor.equipment = { head: 'trail_cap', body: 'rain_cape', tool: 'walking_staff', feet: 'walking_boots', back: 'field_satchel', charm: 'friendship_charm' };
        for (const id of Object.values(e.actor.equipment))
            e.s.inventory[id] = 1;
        Object.assign(e.s.inventory, { berries: 5, water: 5, wood: 3, rope: 2, meals: 2 });
        Object.assign(e.s.colony.warehouse.inventory, { bread: 6, meals: 6, rope: 8, cloth: 8, iron: 4, glass: 3, wooden_chest: 1, walking_boots: 1, gathering_axe: 1, woodland_vest: 1, friendship_charm: 1 });
        e.purchaseCreature('maker');
        e.purchaseCreature('sunny');
        e.s.player.coins = 620;
        const fern = e.creatures[1];
        for (const id of ['woodcraft', 'shelter', 'woodwork', 'stonework', 'fiberwork', 'commerce']) {
            fern.skills[id] = true;
            fern.researched[id] = true;
            fern.rpg.points[id] = 4;
        }
        fern.creature.x = 9;
        fern.creature.y = 10;
        fern.feelings.anger = 34;
        fern.feelings.causes = [{ reason: 'A first construction attempt was frustrating (authored scenario)', joy: -2, anger: 34, time: 0 }];
        e.creatures[2].creature.x = 8;
        e.creatures[2].creature.y = 11;
        e.creatures[2].feelings.social = 32;
        e.s.colony.selectedId = null;
        e._actor = e.creatures[0];
        e.s.started = true;
        e.s.paused = false;
        e.addOffer('brook', 'A neighbor needs a messenger');
        e.s.log = [];
        e.log('A shared-glade example: select Pip, Fern or Mochi before interacting. All supplies still need to travel.', 'paw');
        return e;
    };
    if (typeof module !== 'undefined' && module.exports)
        module.exports = L;
})(typeof globalThis !== 'undefined' ? globalThis : this);
