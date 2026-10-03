/// <reference path="./balancing-contracts.d.ts" />
/* Multiple independent actors in one authoritative world.
 * Existing learning/construction services read a scoped actor view (s.*).
 * Only this module advances the shared clock, nodes, crops and quest director.
 * Warehouse transfers are commands completed at a physical destination, never UI transfers.
 */
(function (inputRoot:unknown) {
    'use strict';
    const root=inputRoot as LWColonyPorts.Root;
 const B = (typeof module!=='undefined'&&module.exports?require('./balancing-rules.js'):(globalThis as unknown as {LWBalanceRules:LWBalanceRules.Api}).LWBalanceRules) as LWBalanceRules.Api;
    type Actor=LWColonyPorts.Actor;type Host=LWColonyPorts.Host;
    if (typeof module !== 'undefined' && module.exports && !root.LWColonyAdventures) require('./colony-adventures.js');
    if (typeof module !== 'undefined' && module.exports && !root.LWColonyActivity) require('./colony-activity.js');
    if (typeof module !== 'undefined' && module.exports && !root.LWColonyLogistics) require('./colony-logistics.js');
    if (typeof module !== 'undefined' && module.exports && !root.LWColonyTaskCompletion) require('./colony-task-completion.js');
    const L = root.LW, Composition = L.EngineComposition, R = root.LWRPG, A = root.LWAdventure, Creatures = root.LWCreatures, Factory = root.LWCreatureFactory;
    const { RES, SKILLS, BUILDINGS, RECIPES, DRILLS, STYLES, CONTRACTS, clamp, terrain, SIZE } = L;
    const copy = A.copy, fail = root.LWRuntimeResults.failure;
    const ok=root.LWRuntimeResults.success;
    const PERSONAL = Factory.personalFields;
    const FOOD = ['meals', 'bread', 'berries', 'meat'];
    const safeInt = (x:number, a:number, b:number) => Number.isInteger(x) && x >= a && x <= b;
    function definition(id:string) { return A.content.equipment.find(x => x.id === id); }
    function item(id:string):LWColonyPorts.Item|null { return RES[id] ? { id, ...RES[id]!, weight: A.content.weights[id] } : definition(id) || (id === 'wooden_chest' ? (A.content.chest || A.defaultContent.chest) : null); }
    function profile(id:string):LWContentPorts.Personality { return A.content.personalities.find(x => x.id === id) || A.content.personalities[0]!; }
    function arrivalPoint(archetype = Creatures.defaultArchetype, personality = Creatures.defaultPersonality) { const transform = Creatures.seed(archetype, personality, 'arrival', 0).creature; return { x: transform.x, y: transform.y }; }
    function initializeColony(self:Host):void {
        self._simulating = false;
        self._actor = null;
        const state = self.s;
        if (!state.colony) {
            const base:Partial<Actor> = Object.fromEntries(PERSONAL.filter(k => state[k] !== undefined).map(k => [k, state[k]]));
            const archetype = base.archetype, personality = base.personality;
            if (typeof archetype !== 'string' || typeof personality !== 'string' || !Factory.supportsPersonality(archetype, personality)) throw Error('Fresh creature identity is invalid.');
            const c = Factory.hydrate(base, { id: 'c1', archetype, personality, mode: 'founder', sequence: 0, day: state.day, simTime: state.simTime });
            const warehouse:LWColonyPorts.State['colony']['warehouse'] = { inventory: { ...c.inventory }, transfers: [] };
            c.inventory = Object.fromEntries(Object.keys(RES).map(k => [k, 0]));
            for (const [r, n] of [['berries', 2], ['water', 2]] as const) {
                const take = Math.min(n, warehouse.inventory[r] || 0);
                c.inventory[r] = take;
                warehouse.inventory[r]! -= take;
            }
            state.colony = { version: 1, selectedId: 'c1', nextCreatureId: 2, purchased: 1, creatures: [c], warehouse, relationships: {}, rng: 86420, board: { offers: [], nextAt: 0, misses: 0, sequence: 0 }, message: 'A shared home; a life of their own.' };
        }
        self._actor = state.colony.creatures.find(c => c.id === state.colony.selectedId) || state.colony.creatures[0]!;
        self.state = state;
        const actorFields:Partial<Actor>=state;
        for (const key of PERSONAL) delete actorFields[key];
        self.s = root.LWActorStateView.create(self, state, PERSONAL);
        self.s.version = 5;
        self.ensureWarehouse();
        self.behaviorTree = new root.LWBehaviorTree(self.handlers());
        self.ecs = root.LWActorECS.create(self.simulationProfile?.rules?.actor);
        self.domainPipeline = root.LWSimulationPipeline.create(self.simulationProfile?.archetype);
        self.ecs.sync(self.creatures);
        if (!self.s.colony.board.offers.length && self.s.colony.board.nextAt === 0) {
            self.addOffer('meadow', 'A neighbor’s invitation');
            self.addOffer('woodland', 'Fresh trail signs');
            self.s.colony.board.nextAt = self.s.simTime + A.content.rules.questCooldown;
        }
    }
    function defineLayer(Base:LWColonyPorts.Constructor):LWColonyPorts.LayerConstructor{const Layer = class ColonyLayer extends Base implements Host {
        declare _simulating:boolean;declare _actor:Actor|null;declare simulationProfile:LWContentPorts.SimulationProfile|null|undefined;
        declare behaviorTree:object;declare ecs:Host['ecs'];declare domainPipeline:Host['domainPipeline'];
        declare handlers:Host['handlers'];declare addOffer:Host['addOffer'];declare releaseSocial:Host['releaseSocial'];
        declare requestEquipment:Host['requestEquipment'];declare unequip:Host['unequip'];declare cancelEquipment:Host['cancelEquipment'];
        declare cancel:Host['cancel'];
        declare acceptQuest:Host['acceptQuest'];declare cancelQuestPlan:Host['cancelQuestPlan'];declare suggestSocial:Host['suggestSocial'];
        get actor():Actor { return this._actor!; }
        get creatures():Actor[] { return this.s.colony.creatures; }
        get selected() { return this.s.colony.selectedId ? this.creatures.find(c => c.id === this.s.colony.selectedId) : null; }
        withActor<T>(c:Actor|string, fn:()=>T):T {
            const prior = this._actor;
            this._actor = typeof c === 'string' ? this.creatures.find(x => x.id === c)||null : c;
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
        selectCreature(id:string) {
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
            const candidates:[number,number][] = [[8, 7], [9, 9], [7, 7], [9, 13]];
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
        at(target:LWApplication.Point|null|undefined) { return target && Math.hypot(this.s.creature.x - target.x, this.s.creature.y - target.y) <= 1.6; }
        allOrders() { return this.creatures.flatMap(c => c.orders.map(o => ({ ...o, creatureId: c.id, creatureName: c.name }))); }
        override canBuild(x:number, y:number) {
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
        override place(kind:string, x:number, y:number) {
            if (this.allOrders().some(o => o.type === 'build' && o.kind === kind))
                return fail('A creature is already planning this building.');
            return super.place(kind, x, y);
        }
        override upgrade(id:string, approach?:string) {
            const b = this.s.buildings.find(b => b.id === id);
            if (b && this.allOrders().some(o => o.type === 'upgrade' && o.kind === b.kind))
                return fail('This improvement already has a creature looking after it.');
            return super.upgrade(id,approach);
        }
        override emit(type:LWRuntime.EventKind, text:string, extra:LWRuntime.EventPayload = {}) { super.emit(type, text, { actorId: this._actor?.id, ...extra }); }
        override log(text:string, icon = 'leaf') {
            const before = this.s.log.length;
            super.log(text, icon);
            if (this.s.log[0])
                this.s.log[0].actorId = this._actor?.id || null;
        }
        override transaction(label:string, guide = 0, pocket = 0, research = 0) {
            super.transaction(label, guide, pocket, research);
            if ((guide || pocket || research) && this.s.ledger[0])
                this.s.ledger[0].actorId = this._actor?.id || null;
        }
        override xp(who:string, amount:number) { return super.xp(who, amount); }
        random(stream = 'actor') { const holder = stream === 'world' ? this.s.colony : this.actor.rpg, key = stream === 'world' ? 'rng' : 'rng'; const next = R.next(holder[key]); holder[key] = next.seed; return next.value; }
        load(c = this.actor) { return R.encumbrance(c.rpg.attributes.ST!, Object.entries(c.inventory).reduce((n, [id, q]) => n + (item(id)?.weight || 0) * q, 0)); }
        creatureDefinition(c = this.actor) { return Factory.definitionFor(c); }
        movementRate(c = this.actor) { const movement = this.creatureDefinition(c).movement; return (movement.baseSpeed + (c.bond >= movement.bondThreshold ? movement.bondedSpeedBonus : 0)) * this.load(c).move; }
        traitEffects(c = this.actor) { return c.traits.map(id => A.content.traits.find(t => t.id === id)).filter((trait):trait is LWContentPorts.Trait=>trait!==undefined); }
        modifiers(skill:string, c = this.actor) {
            const rule = A.content.skillRules[skill], attr = rule?.attribute || (['ST', 'DX', 'IQ', 'HT'].includes(skill) ? skill : skill === 'Per' || skill === 'Will' || skill === 'social' ? 'IQ' : 'DX');
            const mods:LWColonyPorts.Modifier[] = [], add = (name:string, n:number) => {
                if (n)
                    mods.push({ name, value: n });
            };
            const matches = (bonuses:LWContentPorts.QuantityMap) => (bonuses[skill] || 0) + (skill !== attr ? (bonuses[attr] || 0) : 0) + ((skill === 'Per' || skill === 'Will') ? 0 : rule && ['craft', 'making', 'homestead'].includes(SKILLS[skill]?.discipline||'') ? (bonuses.craft || 0) : 0);
            for (const id of Object.values(c.equipment)) {
                const g = definition(id!);
                if (g)
                    add(g.name, matches(g.bonuses));
            }
            for (const t of this.traitEffects(c))
                add(t.name, matches(t.bonuses));
            if (c.needs.energy < B.forEngine(this).modifiers.tiredEnergy)
                add('Tired', B.forEngine(this).modifiers.tiredPenalty);
            else if (c.needs.energy < B.forEngine(this).modifiers.lowEnergy)
                add('Low energy', B.forEngine(this).modifiers.lowPenalty);
            if (c.needs.food < B.forEngine(this).modifiers.needGate || c.needs.water < B.forEngine(this).modifiers.needGate)
                add('Needs attention', B.forEngine(this).modifiers.needPenalty);
            if (c.feelings.anger >= B.forEngine(this).modifiers.angerGate)
                add('Angry', B.forEngine(this).modifiers.angerPenalty);
            else if (c.feelings.anger >= B.forEngine(this).modifiers.frustratedGate)
                add('Frustrated', B.forEngine(this).modifiers.frustratedPenalty);
            if (attr === 'DX')
                add('Encumbrance', -this.load(c).level);
            return { attribute: attr, mods };
        }
        skillRating(skill:string, c = this.actor, extra = 0) { const rule = A.content.skillRules[skill], m = this.modifiers(skill, c); const base = rule ? R.skillLevel(c.rpg.attributes[m.attribute]!, rule.difficulty, c.rpg.points[skill] || 0) : c.rpg.attributes[m.attribute]!; const mods = [...m.mods, ...(extra ? [{ name: 'Task difficulty', value: extra }] : [])]; const target = base + mods.reduce((n, x) => n + x.value, 0); return { skill, attribute: m.attribute, base, points: c.rpg.points[skill] || 0, difficulty: rule?.difficulty || null, modifiers: mods, target, chance: R.odds(target).success }; }
        check(skill:string, extra = 0, label = skill) { const view = this.skillRating(skill, this.actor, extra); const dice = Array.from({ length: 3 }, () => 1 + Math.floor(this.random() * 6)); const r = { ...R.resolve(view.target, dice), skill, label, base: view.base, modifiers: view.modifiers, time: this.s.simTime, actorId: this.actor.id }; this.actor.rpg.rolls.unshift(r); this.actor.rpg.rolls = this.actor.rpg.rolls.slice(0, 60); this.actor.lastRoll = r; this.emit('roll', label, { roll: r }); return r; }
        spendPoint(id:string) {
            const c = this.actor;
            if (Object.hasOwn(c.rpg.attributes, id)) {
                const cost = ['IQ', 'DX'].includes(id) ? 20 : 10;
                if (c.rpg.cp < cost)
                    return fail('This attribute improvement needs ' + cost + ' character points.');
                if (c.rpg.attributes[id]! >= 16)
                    return fail('This prototype caps attributes at 16.');
                c.rpg.cp -= cost;
                c.rpg.attributes[id]!++;
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
        override practiceSkill(id:string, amount = 1) {
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
        override careIssue(kind:string) {
            const gate = this.interactionIssue();
            if (gate)
                return gate;
            if (kind === 'soothe' || kind === 'space')
                return this.s.cooldowns[kind]! > this.s.simTime ? 'Let that moment settle first.' : null;
            return super.careIssue(kind);
        }
        override care(kind:string) {
            const issue = this.careIssue(kind);
            if (issue)
                return fail(issue);
            if (['soothe', 'space'].includes(kind)) {
                this.s.cooldowns[kind] = this.s.simTime + B.forEngine(this).care.soothingCooldown;
                if (kind === 'space') {
                    this.actor.feelings.coolingUntil = this.s.simTime + B.forEngine(this).care.spaceCooling;
                    if (!this.s.task?.need) {
                        this.releaseSocial(this.s.task);
                        this.s.task = null;
                    }
                    this.changeFeeling('Room to breathe', B.forEngine(this).care.spaceJoy, B.forEngine(this).care.spaceAnger);
                    this.emit('heart', 'Thank you for giving me a little room.');
                }
                else {
                    this.changeFeeling('A reassuring moment', B.forEngine(this).care.sootheJoy, B.forEngine(this).care.sootheAnger);
                    this.s.bond = clamp(this.s.bond + B.forEngine(this).care.sootheBond, 0, 100);
                    this.emit('heart', 'We can take this one little step at a time.');
                }
                this.visual(kind);
                return ok();
            }
            const r = super.care(kind);
            if (r.ok) {
                this.changeFeeling(kind === 'praise' ? 'My effort was noticed' : kind === 'bond' ? 'Time with my guide' : 'A caring moment', B.forEngine(this).care.careJoy, B.forEngine(this).care.careAnger);
                this.visual(kind);
            }
            return r;
        }
        visual(kind:string) { this.actor.careVisual = { kind, time: this.s.simTime }; this.emit('interaction', this.s.name + ' · ' + kind, { kind, x: this.s.creature.x, y: this.s.creature.y }); }
        changeFeeling(reason:string, joy = 0, anger = 0) { const f = this.actor.feelings, traits = this.traitEffects(); const multiplier = anger > 0 ? traits.reduce((n, t) => n * t.angerRate, 1) : traits.reduce((n, t) => n * t.soothing, 1); f.anger = clamp(f.anger + anger * multiplier, 0, 100); this.s.needs.joy = clamp(this.s.needs.joy + joy, 0, 100); f.causes.unshift({ reason, joy, anger: Math.round(anger * multiplier), time: this.s.simTime }); f.causes = f.causes.slice(0, 8); }
        override mood(c = this.actor) {
            const n = c.needs, f = c.feelings;
            if (!f)
                return super.mood();
            return f.anger >= B.forEngine(this).modifiers.angerGate ? 'Angry' : f.anger >= B.forEngine(this).modifiers.frustratedGate ? 'Frustrated' : n.energy < B.forEngine(this).mood.needGate ? 'Sleepy' : n.food < B.forEngine(this).mood.needGate ? 'Hungry' : n.water < B.forEngine(this).mood.needGate ? 'Thirsty' : f.social < B.forEngine(this).mood.socialLow ? 'Lonely' : n.joy >= B.forEngine(this).mood.delightedJoy && c.bond >= B.forEngine(this).mood.delightedBond ? 'Delighted' : n.joy >= B.forEngine(this).mood.contentJoy ? 'Content' : n.joy < B.forEngine(this).mood.sadJoy ? 'Low spirits' : 'Thoughtful';
        }
        purchasePrice() { return Math.ceil(A.content.rules.purchaseBase * Math.pow(A.content.rules.purchaseGrowth, this.s.colony.purchased - 1)); }
        purchaseCreature(personality:string, archetype = Creatures.defaultArchetype) {
            if (!Factory.supportsPersonality(archetype, personality))
                return fail('Choose an available creature archetype and personality.');
            if (this.creatures.length >= A.content.rules.maxCreatures)
                return fail('This prototype supports ' + A.content.rules.maxCreatures + ' creatures.');
            const price = this.purchasePrice();
            if (this.s.player.coins < price)
                return fail('Need ' + price + ' guide coins to welcome another creature.');
            const id = 'c' + this.s.colony.nextCreatureId;
            const c = Factory.create({ id, archetype, personality, mode: 'arrival', sequence: this.s.colony.purchased, day: this.s.day, simTime: this.s.simTime });
            const settlement = this.settleEconomy({ id: this.economySettlementId('welcome'), guide: -price }, 'Welcomed ' + c.name);
            if (!settlement.ok)
                return fail('The welcome cost could not be settled.');
            this.s.colony.nextCreatureId++;
            this.s.colony.purchased++;
            this.creatures.push(c);
            this.ecs.sync(this.creatures);
            this.s.colony.selectedId = null;
            this.log(c.name + ' arrived. Select a creature before giving an idea or sharing a moment.', 'paw');
            this.emit('arrival', c.name + ' found a place in our glade.', { actorId: c.id });
            return ok({ creature: c, price });
        }
        requestUnpack() {
            if (!(this.s.inventory.wooden_chest! > 0) && !(this.s.colony.warehouse.inventory.wooden_chest! > 0))
                return fail('No chest is available.');
            this.actor.unpackIntent = true;
            return ok();
        }
        // One shared world tick. The explicit pipeline owns phase order; domain methods own behavior.
        step(dt:number) { return this.domainPipeline.step(this, dt); }
        override export() {
            const state:Record<string,unknown> = {};
            for (const [k, v] of Object.entries(this.s))
                if (!PERSONAL.includes(k as keyof Actor))
                    state[k] = copy(v);
            state.version = 5;
            return { app: 'littlewild', version: 5, state };
        }

    };
        const dependencies = {definition, item, profile, arrivalPoint};
        root.LWColonyAdventures.install(Layer.prototype, Base.prototype, dependencies);
        root.LWColonyActivity.install(Layer.prototype, Base.prototype, dependencies);
        root.LWColonyLogistics.install(Layer.prototype, Base.prototype, dependencies);
        root.LWColonyTaskCompletion.install(Layer.prototype, Base.prototype, dependencies);
        return Layer;
    }
    function invCount(c:Actor, id:string) { return c.inventory[id] || 0; }
    // Public creature commands share one guard. Simulation-internal calls use an explicit scope.
    function decorateLayer(Layer:LWColonyPorts.LayerConstructor, Base:LWColonyPorts.Constructor) {
        const names:LWColonyPorts.GuardedName[]=['care', 'research', 'teach', 'practice', 'cancelLesson', 'setLearningStyle', 'pauseLearning', 'chooseSpecialization', 'startStudy', 'pauseStudy', 'claimStudy', 'setAllowance', 'topUp', 'setStockTarget', 'place', 'upgrade', 'request', 'cancel', 'pauseOrder', 'prioritize', 'requestEquipment', 'unequip', 'cancelEquipment', 'acceptQuest', 'cancelQuestPlan', 'suggestSocial', 'requestUnpack', 'spendPoint'];
        for(const name of names) {
            const method = Layer.prototype[name] || (Base.prototype as Partial<Host>)[name];
            if (typeof method !== 'function') continue;
            Object.defineProperty(Layer.prototype, name, {configurable:true,writable:true,value:function (this:Host,...args:unknown[]) {
                const issue = this.interactionIssue();
                return issue ? fail(issue) : (method as (this:Host,...args:unknown[])=>unknown).apply(this,args);
            }});
        }
    }
    L.colony = { item, definition, profile, PERSONAL, arrivalPoint };
    function installFactories() {
        const oldDemo = L.createWorkshopDemo;
        L.createWorkshopDemo = () => Composition.constructThrough('colony', oldDemo().s);
        L.createColonyDemo = function () {
            const e = L.createWorkshopDemo();
            e.s.player.coins = 920;
            e.s.rp = 62;
            e.s.training = null;
            e.s.learning.queue = [];
            e.s.orders = [];
            e.actor.equipment = { head: 'trail_cap', body: 'rain_cape', tool: 'walking_staff', feet: 'walking_boots', back: 'field_satchel', charm: 'friendship_charm' };
            for (const id of Object.values(e.actor.equipment)) e.s.inventory[id!] = 1;
            Object.assign(e.s.inventory, { berries: 5, water: 5, wood: 3, rope: 2, meals: 2 });
            Object.assign(e.s.colony.warehouse.inventory, { bread: 6, meals: 6, rope: 8, cloth: 8, iron: 4, glass: 3, wooden_chest: 1, walking_boots: 1, gathering_axe: 1, woodland_vest: 1, friendship_charm: 1 });
            e.purchaseCreature('maker');
            e.purchaseCreature('sunny');
            e.s.player.coins = 620;
            const fern = e.creatures[1]!;
            for (const id of ['woodcraft', 'shelter', 'woodwork', 'stonework', 'fiberwork', 'commerce']) {
                fern.skills[id] = true; fern.researched[id] = true; fern.rpg.points[id] = 4;
            }
            fern.creature.x = 9; fern.creature.y = 10; fern.feelings.anger = 34;
            fern.feelings.causes = [{ reason: 'A first construction attempt was frustrating (authored scenario)', joy: -2, anger: 34, time: 0 }];
            e.creatures[2]!.creature.x = 8; e.creatures[2]!.creature.y = 11; e.creatures[2]!.feelings.social = 32;
            e.s.colony.selectedId = null; e._actor = e.creatures[0]!; e.s.started = true; e.s.paused = false;
            e.addOffer('brook', 'A neighbor needs a messenger'); e.s.log = [];
            e.log('A shared-glade example: select Pip, Fern or Mochi before interacting. All supplies still need to travel.', 'paw');
            return e;
        };
    }
    Composition.register({id:'colony',order:20,define:defineLayer,initialize:initializeColony,decorate:decorateLayer,installFactories});
    if (typeof module !== 'undefined' && module.exports)
        module.exports = L;
})(typeof globalThis !== 'undefined' ? globalThis : this);
