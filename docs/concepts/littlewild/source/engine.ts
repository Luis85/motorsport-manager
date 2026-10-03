/// <reference path="./balancing-contracts.d.ts" />
/* Littlewild — pure simulation. No DOM, dependencies, network, or wall-clock catch-up. */
/// <reference path="./engine-core-contracts.d.ts" />
(function (inputRoot:unknown) {
    'use strict';
    const root=inputRoot as LWCorePorts.Root;
 const B=(typeof module!=='undefined'&&module.exports?require('./balancing-rules.js'):(globalThis as unknown as {LWBalanceRules:LWBalanceRules.Api}).LWBalanceRules) as LWBalanceRules.Api;
    if (typeof module !== 'undefined' && module.exports && !root.LWNavigation) require('./navigation.js');
    if (typeof module !== 'undefined' && module.exports && !root.LWCreatures) require('./creature-catalog.js');
    if (typeof module !== 'undefined' && module.exports && !root.LWEngineTaskPlanning) require('./engine-task-planning.js');
    if (typeof module !== 'undefined' && module.exports && !root.LWEngineTaskCompletion) require('./engine-task-completion.js');
    if (typeof module !== 'undefined' && module.exports && !root.LWEngineCompanion) require('./engine-companion.js');
    const VERSION = 3, SIZE = 19;
    const {RES, SKILLS, BUILDINGS, RECIPES, QUESTS, CONTRACTS} = root.LWContent.tables;
    function has(s:LWCorePorts.State, id:string) { return s.buildings.some(b => b.kind === id); }
    function seeded(n:number) { return function () { n |= 0; n = n + 0x6D2B79F5 | 0; let t = Math.imul(n ^ n >>> 15, 1 | n); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function terrain(x:number, y:number) { if (root.LWGeography) return root.LWGeography.terrain(x,y); if (x < 0 || y < 0 || x >= SIZE || y >= SIZE)
        return 'void'; const edge = (x === 0 && y < 3) || (y === 0 && x < 3) || (x > 16 && y > 16) || (x === 18 && y < 2) || (y === 18 && x < 2); if (edge)
        return 'void'; if ((x >= 13 && x <= 16 && y >= 3 && y <= 7) && !((x === 13 || x === 16) && (y === 3 || y === 7)))
        return 'water'; return 'grass'; }
    const canonical=(typeof module!=='undefined'&&module.exports?require('./content/balancing.json'):(globalThis as unknown as {LWDefaultBalancing:unknown}).LWDefaultBalancing) as {libraries:{world:{sites:{id:string}[]}};startingScenes:{initialState:{seed:number;player:LWCorePorts.State['player'];rp:number;nodes:LWCorePorts.State['nodes']}}[];simulation:{rules:{economy:{xp:{base:number;perLevel:number}}}}};
    const starter=canonical.startingScenes[0]!.initialState;
    function makeNodes():LWCorePorts.State['nodes'] {return root.LWContent.copy(starter.nodes.filter(node=>!canonical.libraries.world.sites.some(site=>site.id===node.id)));}
    function initial():LWCorePorts.State {
        const personal = root.LWCreatures.seed(root.LWCreatures.defaultArchetype, root.LWCreatures.defaultPersonality, 'founder', 0) as LWCorePorts.Personal;
        return { version: VERSION, ...personal, seed: starter.seed, simTime: 0, day: 1, hour: 8, started: false, speed: 1, paused: false, player: root.LWContent.copy(starter.player), rp: starter.rp, buildings: [], nodes: makeNodes(), log: [], completedQuests: [], contractIndex: 0, settings: { sound: false, follow: false, reducedMotion: false, highContrast: false }, ledger: [], nextId: 1 };
    }
    function threshold(level:number) { const rules=(root.LWSimulationProfile?.current.rules.economy??canonical.simulation.rules.economy) as {xp:{base:number;perLevel:number}};return rules.xp.base + level * rules.xp.perLevel; }
    function clamp(n:number, a:number, b:number) { return Math.max(a, Math.min(b, n)); }
    function owns(table:object, key:unknown):key is string { return typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key); }
    interface Engine extends LWCorePorts.EngineFields,LWCorePorts.InstalledMethods {}
    class Engine {
        constructor(state?:LWCorePorts.State|null, options:LWCorePorts.CompositionOptions = {}) {
            root.LWGameSettings?.validateState(state);
            const composition = root.LWEngineComposition;
            state = composition ? composition.prepare(state, options) : state;
            this.s = state || initial();
            this.simulationProfile = root.LWSimulationProfile ? root.LWSimulationProfile.current : null;
            this.events = [];
            this.acc = 0;
            this.refreshTimer = 0;
            if (!this.s.wish)
                this.newWish();
            this._blockedKey = '';
            this._blocked = new Set();
            // Economy ECS state is transient; serialized balances and progression remain authoritative.
            this.economyEcs = null;
            this._economySettlementSequence = 0;
            if (composition) composition.initialize(this, this.s, options);
        }
        /** A bounded audit trail. Amounts are deltas, never a second source of balances. */
        transaction(label:string, guide = 0, pocket = 0, research = 0) {
            const s = this.s;
            if (!guide && !pocket && !research)
                return;
            s.ledger.unshift({ label, guide, pocket, research, day: s.day, hour: s.hour });
            s.ledger = s.ledger.slice(0, 80);
        }
        economyRuntime() {
            if (!this.economyEcs) {
                if (!root.LWEconomyECS)
                    throw Error('Economy ECS runtime missing.');
                this.economyEcs = root.LWEconomyECS.create(this.simulationProfile?.rules?.economy);
            }
            return this.economyEcs;
        }
        economyActor() { return this._actor?.id ? this._actor : null; }
        economySettlementId(scope:string, key = '') {
            const actor = this._actor?.id || 'global';
            const suffix = key || (Math.round(this.s.simTime * 1000) + ':' + (++this._economySettlementSequence));
            return (scope + ':' + actor + ':' + suffix).replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 95);
        }
        /** Apply one authorized economic/progression change, then translate its neutral outbox. */
        settleEconomy(input:LWCorePorts.EconomySpec, label:string|null = null) {
            const spec = { ...input };
            spec.id ||= this.economySettlementId('economy');
            spec.actorCpPerLevel ??= root.LWAdventure?.content?.rules?.cpPerLevel || 0;
            const sharedState = root.LWActorStateView?.rootOf(this.s) || this.s;
            const out = this.economyRuntime().settle(sharedState, this.economyActor(), spec);
            if (!out.ok)
                return out;
            const d:Partial<NonNullable<LWCorePorts.EconomyResult['deltas']>> = out.deltas || {};
            if (label)
                this.transaction(label, d.guide || 0, d.pocket || 0, d.research || 0);
            for (const event of out.levelUps || []) {
                this.log((event.who === 'player' ? 'You' : this.s.name) + ' reached level ' + event.level + '!', 'star');
                if (event.who === 'player') {
                    this.transaction('Guide level ' + event.level, 0, 0, this.economyRuntime().rules.xp.playerResearchPerLevel);
                    this.emit('celebrate', 'Your level grew. +' + this.economyRuntime().rules.xp.playerResearchPerLevel + ' shared research!');
                }
                else
                    this.emit('celebrate', this.s.name + ' is growing in confidence!');
            }
            if (out.actorCp)
                this.emit('notice', this.s.name + ' earned ' + out.actorCp + ' character points.');
            return out;
        }
        emit(type:LWRuntime.EventKind, text:string, extra:LWRuntime.EventPayload = {}) { this.events.push({ type, text, ...extra }); }
        log(text:string, icon = 'leaf') { const entry = { text, icon, time: this.s.simTime, day: this.s.day, hour: this.s.hour }; this.s.log.unshift(entry); this.s.log = this.s.log.slice(0, 70); this.emit('log', text, { icon }); }
        drain() { const ev = this.events; this.events = []; return ev; }
        xp(who:string, amount:number) {
            return this.settleEconomy({ id: this.economySettlementId('xp'), [who === 'player' ? 'playerXp' : 'actorXp']: amount });
        }
        researchGain(n:number, label = 'Shared discovery') {
            return this.settleEconomy({ id: this.economySettlementId('research'), research: n }, label);
        }
        get buildingNames() { return BUILDINGS; }
        has(kind:string) { return has(this.s, kind); }
        walkable(x:number, y:number) {
            if (!root.LWNavigation) return terrain(x, y) === 'grass' &&
                !this.s.buildings.some(b => b.x === x && b.y === y) &&
                !this.s.nodes.some(n => ['wood', 'stone'].includes(n.kind) && n.x === x && n.y === y);
            return root.LWNavigation.grid(this.s).pass(x, y);
        }
        canBuild(x:number, y:number) {
            if (!Number.isInteger(x) || !Number.isInteger(y) || x < 2 || y < 2 || x > 16 || y > 16)
                return false;
            if (terrain(x, y) !== 'grass')
                return false;
            if (this.s.nodes.some(n => n.x === x && n.y === y))
                return false;
            if (this.s.buildings.some(b => b.x === x && b.y === y) || this.s.orders.some(o => o.type === 'build' && o.x === x && o.y === y))
                return false;
            const c = this.s.creature;
            if (Math.hypot(c.x - x, c.y - y) < 0.7)
                return false; // Reject plans that would isolate a pocket of the map or block access to another plan.
            const blocked = new Set(this.s.nodes.filter(n => ['wood', 'stone'].includes(n.kind)).map(n => n.x + ',' + n.y));
            const places = [...this.s.buildings, ...this.s.orders.filter(o => o.type === 'build'), { x, y }];
            for (const p of places)
                blocked.add(p.x + ',' + p.y);
            const pass = (a:number, b:number) => a >= 0 && b >= 0 && a < SIZE && b < SIZE && terrain(a, b) === 'grass' && !blocked.has(a + ',' + b);
            const start = { x: Math.round(c.x), y: Math.round(c.y) }, queue = [start], visited = new Set([start.x + ',' + start.y]);
            let head = 0;
            while (head < queue.length) {
                const p = queue[head++]!;
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
                    const a = p.x + dx, b = p.y + dy, k = a + ',' + b;
                    if (pass(a, b) && !visited.has(k)) {
                        visited.add(k);
                        queue.push({ x: a, y: b });
                    }
                }
            }
            for (let a = 0; a < SIZE; a++)
                for (let b = 0; b < SIZE; b++)
                    if (pass(a, b) && !visited.has(a + ',' + b))
                        return false;
            return places.every(p => ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([a, b]) => pass(p.x! + a, p.y! + b) && visited.has((p.x! + a) + ',' + (p.y! + b))));
        }
        place(kind:string, x:number, y:number):LWCorePorts.PlanResult { const b = owns(BUILDINGS, kind) ? BUILDINGS[kind] : null; if (!b)
            return { ok: false, reason: 'Unknown plan.' }; if (this.s.orders.length >= 12)
            return { ok: false, reason: 'Twelve ideas is plenty for one little buddy. Finish or cancel one first.' }; if (b.unique && (this.has(kind) || this.s.orders.some(o => o.kind === kind)))
            return { ok: false, reason: 'There is already a ' + b.name.toLowerCase() + ' or a plan for one.' }; if (!this.canBuild(x, y))
            return { ok: false, reason: 'Choose an open, reachable grass tile away from the edge.' }; const o = { id: 'o' + this.s.nextId++, type: 'build', kind, x, y, progress: 0, paid: false, paused: false, priority: 0, created: this.s.simTime }; this.s.orders.push(o); this.log('You imagined a ' + b.name.toLowerCase() + '. ' + this.s.name + ' will work out how to make it happen.', 'plan'); return { ok: true, order: o }; }
        request(type:string, resource:string|null = null, quantity:number|null = null):LWCorePorts.PlanResult { const s = this.s; if (s.orders.length >= 12)
            return { ok: false, reason: 'The idea queue is full.' }; if (!['gather', 'craft', 'explore', 'hunt', 'deliver'].includes(type))
            return { ok: false, reason: 'Unknown suggestion.' }; if (type === 'gather' && !['wood', 'stone', 'fiber', 'berries', 'water'].includes(resource!))
            return { ok: false, reason: 'Unknown resource.' }; if (type === 'craft' && !owns(RECIPES, resource))
            return { ok: false, reason: 'Unknown recipe.' }; if (type === 'deliver' && !this.has('market'))
            return { ok: false, reason: 'Build a market stall to meet your neighbors.' }; if (s.orders.some(o => o.type === type && o.resource === resource && type !== 'build'))
            return { ok: false, reason: 'Pip already has that idea in mind.' }; if (quantity !== null && (!Number.isInteger(quantity) || quantity < 1 || quantity > 24))
            return { ok: false, reason: 'Choose an amount from 1 to 24.' }; let amount = ['gather', 'craft'].includes(type) ? (quantity ?? (type === 'gather' ? 6 : 3)) : 1; if (type === 'craft')
            amount = Math.ceil(amount / RECIPES[resource!]!.amount) * RECIPES[resource!]!.amount; let o:LWCorePorts.Order = { id: 'o' + s.nextId++, type, resource, amount, done: 0, paused: false, priority: 0, created: s.simTime }; if (type === 'deliver') {
            o.contract = s.contractIndex % CONTRACTS.length;
        } s.orders.push(o); this.log('You suggested: ' + this.orderName(o).toLowerCase() + '.', 'plan'); return { ok: true, order: o }; }
        orderName(o:LWCorePorts.Order) { if (o.type === 'build')
            return BUILDINGS[o.kind!]!.name; if (o.type === 'gather')
            return 'Gather ' + o.amount + ' ' + RES[o.resource!]!.name.toLowerCase(); if (o.type === 'craft')
            return 'Craft ' + o.amount + ' ' + RES[o.resource!]!.name.toLowerCase(); if (o.type === 'explore')
            return 'Explore the glade'; if (o.type === 'hunt')
            return 'Hunt for provisions'; if (o.type === 'deliver')
            return CONTRACTS[o.contract!]!.name; return 'A little idea'; }
        cancel(id:string) { const s = this.s, o = s.orders.find(o => o.id === id); if (!o)
            return; if (o.paid && o.type === 'build')
            for (const [k, n] of Object.entries(BUILDINGS[o.kind!]!.cost))
                s.inventory[k]! += n; if (s.task?.orderId === id)
            s.task = null; s.orders = s.orders.filter(o => o.id !== id); this.log('You set aside a plan. ' + (o.paid ? 'Reserved materials returned to the pantry.' : 'There is no rush.'), 'plan'); }
        pauseOrder(id:string) { let o = this.s.orders.find(o => o.id === id); if (!o)
            return; o.paused = !o.paused; if (o.paused && this.s.task?.orderId === id)
            this.s.task = null; }
        prioritize(id:string) { for (const o of this.s.orders)
            o.priority = o.id === id ? 1 : 0; this.emit('change', 'Suggestion prioritized. Needs still come first.'); }
        missingSkill(resource:string) { if (resource === 'wood' && !this.s.skills.woodcraft)
            return 'woodcraft'; if (resource === 'stone' && !this.s.skills.stonework)
            return 'stonework'; if (resource === 'meat' && !this.s.skills.tracking)
            return 'tracking'; if (RECIPES[resource!]! && !this.s.skills[RECIPES[resource!]!.skill])
            return RECIPES[resource!]!.skill; return null; }
        assessResource(resource:string, amount:number, seen = new Set<string>()):LWCorePorts.Issue|null { const s = this.s; if (s.inventory[resource]! >= amount)
            return null; if (seen.has(resource))
            return { text: 'A circular recipe needs attention.' }; seen.add(resource); const skill = this.missingSkill(resource); if (skill)
            return { text: 'Teach ' + SKILLS[skill]!.short, skill }; const recipe = RECIPES[resource!]!; if (recipe) {
            if (!this.has(recipe.station))
                return { text: 'Build a ' + BUILDINGS[recipe.station]!.name.toLowerCase(), building: recipe.station };
            for (const [r, n] of Object.entries(recipe.cost)) {
                const issue = this.assessResource(r, n, seen);
                if (issue)
                    return issue;
            }
        } return null; }
        orderIssue(o:LWCorePorts.OrderView):LWCorePorts.Issue|null {
            const s = this.s;
            if (o.paused)
                return { text: 'On hold — no rush', paused: true };
            if (o.type === 'build') {
                if (!s.skills[BUILDINGS[o.kind!]!.skill]) {
                    const skill = BUILDINGS[o.kind!]!.skill;
                    return { text: 'Teach ' + SKILLS[skill]!.short, skill };
                }
                if (!o.paid)
                    for (const [r, n] of Object.entries(BUILDINGS[o.kind!]!.cost)) {
                        const issue = this.assessResource(r, n);
                        if (issue)
                            return issue;
                    }
            }
            if (o.type === 'gather' || o.type === 'craft') {
                const skill = this.missingSkill(o.resource!);
                if (skill)
                    return { text: 'Teach ' + SKILLS[skill]!.short, skill };
                if (o.type === 'craft') {
                    const rec = RECIPES[o.resource!]!;
                    if (!this.has(rec.station))
                        return { text: 'Build a ' + BUILDINGS[rec.station]!.name.toLowerCase(), building: rec.station };
                    for (const [r, n] of Object.entries(rec.cost)) {
                        const issue = this.assessResource(r, n);
                        if (issue)
                            return issue;
                    }
                }
            }
            if (o.type === 'hunt' && !s.skills.tracking)
                return { text: 'Teach Tracking', skill: 'tracking' };
            if (o.type === 'explore' && s.cooldowns.explore! > s.simTime)
                return { text: 'Resting curiosity · ' + Math.ceil(s.cooldowns.explore! - s.simTime) + 's' };
            if (o.type === 'deliver') {
                for (const [r, n] of Object.entries(CONTRACTS[o.contract!]!.cost)) {
                    const issue = this.assessResource(r, n);
                    if (issue)
                        return issue;
                }
            }
            return null;
        }
        nearest<T extends LWCorePorts.Point>(nodes:T[]):T|undefined { const c = this.s.creature; return [...nodes].sort((a, b) => Math.hypot(c.x - a.x, c.y - a.y) - Math.hypot(c.x - b.x, c.y - b.y))[0]; }
        findPath(target:LWCorePorts.Point, adjacent = false) {
            return root.LWNavigation.path(this.s, target, adjacent);
        }
        startTask(task:LWCorePorts.Draft) { const path = this.findPath(task.target || { x: Math.round(this.s.creature.x), y: Math.round(this.s.creature.y) }, ['build', 'gather', 'craft', 'shop', 'research', 'warm', 'rest', 'deliver', 'train', 'practice', 'reflect'].includes(task.kind)); if (path === null)
            return false; task.path = path; task.phase = path.length ? 'walk' : 'work'; task.elapsed = task.elapsed || 0; task.duration = Math.max(1, task.duration || 3); this.s.task = task as LWCorePorts.Task; return true; }
        splitIncome(amount:number) { const income = this.economyRuntime().splitIncome(amount); return this.settleEconomy({ id: this.economySettlementId('income'), ...income, stats: { earned: amount } }, 'Shared trade income'); }
        trade(resource:string, mode:string, qty = 1) { const s = this.s; if (!this.has('market'))
            return { ok: false, reason: 'Build a market stall to welcome traders.' }; if (!owns(RES, resource) || !['buy', 'sell'].includes(mode) || !Number.isInteger(qty) || qty < 1 || qty > 99)
            return { ok: false, reason: 'Invalid trade.' }; const price = mode === 'sell' ? Math.max(1, Math.floor(RES[resource]!.price * (globalThis as unknown as {LWBalanceRules:LWBalanceRules.Api}).LWBalanceRules.forEngine(this).policy.sellFraction)) : RES[resource]!.price; const total = price * qty; if (mode === 'sell') {
            if (s.inventory[resource]! < qty)
                return { ok: false, reason: 'Not enough in our pantry.' };
            const settlement = this.splitIncome(total);
            if (!settlement.ok) return { ok: false, reason: 'The sale could not be settled.' };
            s.inventory[resource]! -= qty;
            this.log('Sold ' + qty + ' ' + RES[resource]!.name.toLowerCase() + ' for ' + total + ' coins. Earnings shared according to this world’s income rules.', 'coin');
        }
        else {
            if (s.player.coins < total)
                return { ok: false, reason: 'Not enough guide coins.' };
            const settlement = this.settleEconomy({ id: this.economySettlementId('trade-buy'), guide: -total }, 'You bought ' + qty + ' ' + RES[resource]!.name.toLowerCase());
            if (!settlement.ok) return { ok: false, reason: 'The purchase could not be settled.' };
            s.inventory[resource]! += qty;
            this.log('You bought ' + qty + ' ' + RES[resource]!.name.toLowerCase() + ' for the pantry.', 'market');
        } return { ok: true }; }
        step(dt:number) {
            const s = this.s;
            if (!s.started || s.paused)
                return;
            dt = clamp(dt, 0, .25);
            s.simTime += dt;
            s.hour += dt * B.forEngine(this).clock.hourRate;
            if (s.hour >= 24) {
                s.hour -= 24;
                s.day++;
                s.daily = { day: s.day, bonded: 0 };
                this.newWish();
                s.allowance.given = 0;
                if (s.allowance.auto)
                    this.topUp(true);
                this.log('A new day in Aster Glade. Day ' + s.day + '.', 'sun');
            }
            for (const node of s.nodes) {
                if (node.stock < node.max) {
                    node.regen += dt;
                    if (node.regen >= ((node.kind === 'berries') ? 18 : 24)) {
                        node.regen = 0;
                        node.stock = Math.min(node.max, node.stock + 1);
                    }
                }
            }
            for (const b of s.buildings) {
                if (b.kind === 'garden') {
                    b.regen += dt;
                    if (b.regen >= 80) {
                        b.regen = 0;
                        b.stock = Math.min(12, b.stock + 4);
                    }
                }
            }
            this.checkWish();
            const n = s.needs, t = s.task;
            const working = t && ['build', 'gather', 'craft', 'hunt', 'practice'].includes(t.kind);
            n.food = clamp(n.food - dt * (working ? B.forEngine(this).legacy.foodWork : B.forEngine(this).legacy.foodIdle), 0, 100);
            n.water = clamp(n.water - dt * (working ? B.forEngine(this).legacy.waterWork : B.forEngine(this).legacy.waterIdle), 0, 100);
            n.energy = clamp(n.energy - dt * (working ? B.forEngine(this).legacy.energyWork : B.forEngine(this).legacy.energyIdle), 0, 100);
            n.comfort = clamp(n.comfort - dt * (this.has('cottage') ? B.forEngine(this).legacy.cottageComfortRate : this.has('shelter') ? B.forEngine(this).legacy.shelterComfortRate : B.forEngine(this).legacy.outsideComfortRate), 0, 100);
            n.joy = clamp(n.joy - dt * B.forEngine(this).legacy.joyRate, 0, 100);
            if ((n.food < 8 || n.water < 8) && s.simTime - s.memory.lastGentleWarning > 45) {
                s.memory.lastGentleWarning = s.simTime;
                this.emit('notice', s.name + ' needs a little care. No one gets left behind.');
            }
            if (!t) {
                this.decide();
                return;
            }
            // Interrupt long work only for a critical need, keeping construction/training progress.
            const emergencies = ['water', 'food', 'energy'].filter(k => n[k]! < (k === 'energy' ? B.forEngine(this).legacy.urgentEnergy : B.forEngine(this).legacy.urgentNeed)).sort((a, b) => n[a]! - n[b]!);
            if (emergencies.length && !t.need && !['eat', 'drink', 'rest'].includes(t.kind)) {
                s.task = null;
                this.decide();
                return;
            }
            // Essential recovery is committed long enough to finish. This prevents low-needs oscillation.
            if (t.phase === 'walk') {
                const p = t.path[0];
                if (p && !this.walkable(p.x, p.y)) {
                    s.task = null;
                    return;
                }
                if (!p) {
                    t.phase = 'work';
                    return;
                }
                const c = s.creature, dx = p.x - c.x, dy = p.y - c.y, dist = Math.hypot(dx, dy), speed = (B.forEngine(this).legacy.speed + (s.bond >= B.forEngine(this).legacy.bondGate ? B.forEngine(this).legacy.bondSpeedBonus : 0)) * dt;
                if (dx !== 0)
                    c.dir = dx > 0 ? 1 : -1;
                if (dist <= speed) {
                    c.x = p.x;
                    c.y = p.y;
                    t.path.shift();
                    if (!t.path.length)
                        t.phase = 'work';
                }
                else {
                    c.x += dx / dist * speed;
                    c.y += dy / dist * speed;
                }
                return;
            }
            if (t.kind === 'build') {
                const o = s.orders.find(o => o.id === t.orderId);
                if (!o) {
                    s.task = null;
                    return;
                }
                if (!o.paid) {
                    const cost = this.constructionCost ? this.constructionCost(o) : BUILDINGS[o.kind!]!.cost;
                    if (!Object.entries(cost).every(([r, a]) => s.inventory[r]! >= a)) {
                        s.task = null;
                        return;
                    }
                    for (const [r, a] of Object.entries(cost))
                        s.inventory[r]! -= a;
                    o.paid = true;
                }
                o.progress = Math.min(t.duration, t.elapsed + dt * this.workRate(t));
            }
            if (t.kind === 'train' && s.training)
                s.training.progress = Math.min(t.duration, t.elapsed + dt * this.workRate(t));
            t.elapsed += dt * this.workRate(t);
            if (t.elapsed >= t.duration)
                this.finishTask(t);
        }
        advance(seconds:number) {
            if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0 || seconds > 3600) return;
            const count = Math.floor(seconds * 10 + 1e-9);
            for (let i = 0; i < count; i++) this.step(.1);
            const remainder = seconds - count / 10;
            if (remainder > 1e-9) this.step(remainder);
        }
        export() { const s = root.LWContent.copy(this.s); s.task = null; return { app: 'littlewild', version: VERSION, state: s }; }

    }
    root.LWEngineCompanion.install(Engine.prototype);
    root.LWEngineTaskPlanning.install(Engine.prototype);
    root.LWEngineTaskCompletion.install(Engine.prototype);
    const api = { Engine, initial, SKILLS, BUILDINGS, RES, RECIPES, QUESTS, CONTRACTS, SIZE, terrain, seeded, threshold, clamp };
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
    root.LW = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
