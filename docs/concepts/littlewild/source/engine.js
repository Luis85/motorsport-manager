/* Littlewild — pure simulation. No DOM, dependencies, network, or wall-clock catch-up. */
(function (root) {
    'use strict';
    if (typeof module !== 'undefined' && module.exports && !root.LWNavigation) require('./navigation.js');
    const VERSION = 3, SIZE = 19;
    const {RES, SKILLS, BUILDINGS, RECIPES, QUESTS, CONTRACTS} = root.LWContent.tables;
    function has(s, id) { return s.buildings.some(b => b.kind === id); }
    function seeded(n) { return function () { n |= 0; n = n + 0x6D2B79F5 | 0; let t = Math.imul(n ^ n >>> 15, 1 | n); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function terrain(x, y) { if (root.LWGeography) return root.LWGeography.terrain(x,y); if (x < 0 || y < 0 || x >= SIZE || y >= SIZE)
        return 'void'; const edge = (x === 0 && y < 3) || (y === 0 && x < 3) || (x > 16 && y > 16) || (x === 18 && y < 2) || (y === 18 && x < 2); if (edge)
        return 'void'; if ((x >= 13 && x <= 16 && y >= 3 && y <= 7) && !((x === 13 || x === 16) && (y === 3 || y === 7)))
        return 'water'; return 'grass'; }
    function makeNodes() {
        const n = [];
        let id = 0;
        function add(kind, x, y, stock) { n.push({ id: 'n' + id++, kind, x, y, stock, max: stock, regen: 0 }); }
        [[2, 3], [3, 6], [1, 10], [3, 13], [5, 15], [7, 16], [12, 16], [16, 13], [17, 10], [10, 2], [6, 2], [2, 16], [15, 15], [16, 2], [8, 4], [11, 14]].forEach(([x, y]) => add('wood', x, y, 6));
        [[4, 5], [5, 11], [12, 11], [10, 15], [7, 3], [16, 9]].forEach(([x, y]) => add('berries', x, y, 6));
        [[5, 4], [2, 8], [6, 14], [14, 12], [11, 3], [15, 10]].forEach(([x, y]) => add('fiber', x, y, 8));
        [[9, 3], [11, 5], [15, 14], [3, 15], [16, 12]].forEach(([x, y]) => add('stone', x, y, 8));
        add('water', 13, 5, 999);
        add('hunt', 17, 15, 999);
        return n;
    }
    function initial() { return { version: VERSION, name: 'Pip', seed: 2718, simTime: 0, day: 1, hour: 8, started: false, speed: 1, paused: false, focus: 'balanced', player: { level: 1, xp: 0, coins: 86 }, creature: { level: 1, xp: 0, coins: 6, x: 8, y: 9, dir: 1 }, rp: 10, bond: 22, needs: { food: 68, water: 58, energy: 82, comfort: 52, joy: 65 }, inventory: { wood: 2, stone: 0, fiber: 2, berries: 5, water: 4, planks: 0, meat: 0, meals: 0 }, allowance: { limit: 10, given: 6, auto: true, reserve: 4, sourcing: 'balanced' }, skills: {}, researched: {}, training: null, buildings: [], orders: [], nodes: makeNodes(), task: null, log: [], completedQuests: [], stats: { fed: 0, watered: 0, bonded: 0, gathered: 0, built: 0, trained: 0, planksMade: 0, deliveries: 0, explored: 0, earned: 0, researchEarned: 0 }, cooldowns: { feed: 0, water: 0, bond: 0, praise: 0, explore: 0, research: 0 }, memory: { lastAchievement: -100, lastPraise: -100, lastGentleWarning: -100, lastPlan: '', lastDecline: -100 }, contractIndex: 0, settings: { sound: false, follow: false, reducedMotion: false, highContrast: false }, stockTargets: { wood: 0, stone: 0, fiber: 0, berries: 4, water: 3, planks: 0, meat: 0, meals: 0 }, practice: {}, memories: [], ledger: [], wish: null, daily: { day: 1, bonded: 0 }, nextId: 1 }; }
    function threshold(level) { return 28 + level * 8; }
    function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
    function owns(table, key) { return typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key); }
    class Engine {
        constructor(state) {
            this.s = state || initial();
            this.events = [];
            this.acc = 0;
            this.refreshTimer = 0;
            // New systems have defaults for both legacy stories and the established-camp preset.
            this.s.stockTargets ||= { ...initial().stockTargets };
            this.s.practice ||= {};
            this.s.memories ||= [];
            this.s.ledger ||= [];
            this.s.daily ||= { day: this.s.day, bonded: 0 };
            this.s.allowance.reserve ??= 4;
            this.s.allowance.sourcing ||= 'balanced';
            if (!this.s.wish)
                this.newWish();
            this._blockedKey = '';
            this._blocked = new Set();
            // Economy ECS state is transient; serialized balances and progression remain authoritative.
            this.economyEcs = null;
            this._economySettlementSequence = 0;
        }
        /** A bounded audit trail. Amounts are deltas, never a second source of balances. */
        transaction(label, guide = 0, pocket = 0, research = 0) {
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
                this.economyEcs = root.LWEconomyECS.create();
            }
            return this.economyEcs;
        }
        economyActor() { return this._actor?.id ? this._actor : null; }
        economySettlementId(scope, key = '') {
            const actor = this._actor?.id || 'legacy';
            const suffix = key || (Math.round(this.s.simTime * 1000) + ':' + (++this._economySettlementSequence));
            return (scope + ':' + actor + ':' + suffix).replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 95);
        }
        /** Apply one authorized economic/progression change, then translate its neutral outbox. */
        settleEconomy(input, label = null) {
            const spec = { ...input };
            spec.id ||= this.economySettlementId('economy');
            spec.actorCpPerLevel ??= root.LWAdventure?.content?.rules?.cpPerLevel || 0;
            const out = this.economyRuntime().settle(this.s, this.economyActor(), spec);
            if (!out.ok)
                return out;
            const d = out.deltas || {};
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
        remember(key, title, description, icon = 'heart') {
            const s = this.s;
            if (s.memories.some(m => m.key === key))
                return;
            s.memories.unshift({ key, title, description, icon, day: s.day, hour: s.hour });
            s.memories = s.memories.slice(0, 60);
        }
        newWish() {
            const wishes = [{ stat: 'bonded', amount: 1, title: 'A moment, just us', thought: 'Could we watch the clouds together?', action: 'bond' },
                { stat: 'explored', amount: 1, title: 'Something we haven’t seen', thought: 'I wonder what is hiding along the trail.', action: 'explore' },
                { stat: 'gathered', amount: 9, title: 'A little for tomorrow', thought: 'I’d like to bring something home for us.', action: 'gather' },
                { stat: 'fed', amount: 1, title: 'A snack from a friend', thought: 'Berries taste better when you share them.', action: 'feed' }];
            const w = wishes[(this.s.day - 1) % wishes.length];
            this.s.wish = { ...w, day: this.s.day, start: this.s.stats[w.stat], complete: false };
        }
        checkWish() {
            const s = this.s, w = s.wish;
            if (!w || w.complete || s.stats[w.stat] - w.start < w.amount)
                return;
            w.complete = true;
            s.bond = clamp(s.bond + 2, 0, 100);
            this.researchGain(1, 'A small wish');
            this.remember('wish-' + s.day, w.title, 'We made room for a small wish. No grand plans needed.');
            this.log('A small wish fulfilled: ' + w.title + '. +2 friendship, +1 shared research.', 'heart');
            this.emit('celebrate', 'A small wish, a shared memory.');
        }
        mastery(id) {
            const points = this.s.practice[id] || 0, limits = [0, 8, 20, 40];
            let rank = 0;
            for (let i = 1; i < limits.length; i++)
                if (points >= limits[i])
                    rank = i;
            return { points, rank, label: ['New paws', 'Practiced', 'Confident', 'Fluent'][rank], bonus: rank * 6, next: limits[rank + 1] || null };
        }
        practiceSkill(id) {
            if (!id || !this.s.skills[id])
                return;
            const before = this.mastery(id).rank;
            this.s.practice[id] = (this.s.practice[id] || 0) + 1;
            const m = this.mastery(id);
            if (m.rank > before) {
                this.log(this.s.name + ' feels ' + m.label.toLowerCase() + ' with ' + SKILLS[id].short + '. +' + m.bonus + '% work speed.', 'star');
                this.emit('celebrate', SKILLS[id].short + ': ' + m.label);
            }
        }
        taskSkill(t) {
            if (t.kind === 'build')
                return BUILDINGS[this.s.orders.find(o => o.id === t.orderId)?.kind]?.skill;
            if (t.kind === 'craft')
                return RECIPES[t.resource]?.skill;
            if (t.kind === 'gather')
                return ({ wood: 'woodcraft', stone: 'stonework' })[t.resource];
            return ({ hunt: 'tracking', shop: 'commerce', deliver: 'commerce', research: 'invention' })[t.kind];
        }
        workRate(t) { return 1 + (this.mastery(this.taskSkill(t)).bonus / 100); }
        setStockTarget(resource, amount) {
            if (!owns(RES, resource) || !Number.isInteger(amount) || amount < 0 || amount > 24)
                return { ok: false, reason: 'Choose a stock target from 0 to 24.' };
            this.s.stockTargets[resource] = amount;
            return { ok: true };
        }
        careIssue(kind) {
            const s = this.s, n = s.needs, wait = Math.max(0, Math.ceil((s.cooldowns[kind] || 0) - s.simTime));
            if (wait)
                return 'Enjoying that moment · ' + wait + 's';
            if (kind === 'feed' && n.food >= 94)
                return 'A full tummy already. Save that snack for later.';
            if (kind === 'water' && n.water >= 94)
                return 'Not thirsty right now. Thank you for checking.';
            if (kind === 'feed' && !s.inventory.meals && !s.inventory.berries)
                return 'No snack in the pantry. Pip can forage for berries.';
            if (kind === 'water' && !s.inventory.water)
                return 'No stored water. Pip can collect more at the spring.';
            if (kind === 'bond' && (n.food < 16 || n.water < 16 || n.energy < 12))
                return 'Pip needs food, water or rest before play.';
            if (kind === 'praise' && (s.memory.lastAchievement <= s.memory.lastPraise || s.simTime - s.memory.lastAchievement > 90))
                return 'Notice a recent effort: gathering, learning, crafting or building.';
            return null;
        }
        /** Forecast consumes a virtual inventory across all active plans, so shared stock is not counted twice. */
        materialForecast(onlyOrder = null) {
            const s = this.s, available = { ...s.inventory }, rows = {}, steps = [], issues = [];
            const add = (r, n, chain = []) => {
                const row = rows[r] ||= { resource: r, needed: 0, onHand: s.inventory[r], used: 0, missing: 0 };
                row.needed += n;
                const use = Math.min(available[r], n);
                available[r] -= use;
                row.used += use;
                const lack = n - use;
                row.missing += lack;
                if (!lack)
                    return;
                const skill = this.missingSkill(r);
                if (skill)
                    issues.push({ text: 'Teach ' + SKILLS[skill].short, skill });
                const recipe = RECIPES[r];
                if (recipe && !chain.includes(r)) {
                    if (!this.has(recipe.station))
                        issues.push({ text: 'Build a ' + BUILDINGS[recipe.station].name.toLowerCase(), building: recipe.station });
                    const batches = Math.ceil(lack / recipe.amount);
                    for (const [key, count] of Object.entries(recipe.cost))
                        add(key, count * batches, [...chain, r]);
                    available[r] += batches * recipe.amount - lack;
                    steps.push({ resource: r, amount: batches * recipe.amount, kind: 'craft', station: recipe.station });
                }
                else
                    steps.push({ resource: r, amount: lack, kind: r === 'meat' ? 'hunt' : 'gather' });
            };
            const orders = onlyOrder ? [onlyOrder] : this.s.orders.filter(o => !o.paused).slice().sort((a, b) => b.priority - a.priority || a.created - b.created);
            for (const o of orders) {
                if (o.type === 'build') {
                    if (!s.skills[BUILDINGS[o.kind].skill]) {
                        const skill = BUILDINGS[o.kind].skill;
                        issues.push({ text: 'Teach ' + SKILLS[skill].short, skill });
                    }
                    if (!o.paid)
                        for (const [r, n] of Object.entries(BUILDINGS[o.kind].cost))
                            add(r, n);
                }
                else if (o.type === 'deliver')
                    for (const [r, n] of Object.entries(CONTRACTS[o.contract].cost))
                        add(r, n);
                else if (o.type === 'craft') {
                    const recipe = RECIPES[o.resource], batches = Math.ceil((o.amount - o.done) / recipe.amount);
                    for (const [r, n] of Object.entries(recipe.cost))
                        add(r, n * batches);
                }
            }
            return { rows: Object.values(rows), steps, issues: issues.filter((x, i, a) => a.findIndex(y => y.text === x.text) === i) };
        }
        planStatus(o) {
            const issue = this.orderIssue(o), t = this.s.task;
            if (issue)
                return { label: o.paused ? 'On hold' : 'Needs your help', detail: issue.text, kind: o.paused ? 'hold' : 'blocked', issue };
            if (t?.orderId === o.id)
                return { label: t.kind === 'build' ? 'Building' : t.kind === 'craft' ? 'Making supplies' : t.kind === 'gather' ? 'Finding supplies' : 'In progress', detail: t.label, kind: 'active' };
            return { label: 'Ready when Pip is', detail: t?.need ? 'Taking care of ' + t.need + ' first.' : 'Needs and lessons still come first.', kind: 'ready' };
        }
        decisionSummary() {
            const t = this.s.task;
            if (!t)
                return { source: 'Thinking', detail: 'Pip is choosing a next step.' };
            const o = this.s.orders.find(o => o.id === t.orderId);
            return { source: t.need ? 'Self-care' : t.kind === 'train' ? 'Your lesson' : o ? 'Shared plan' : t.stock ? 'Pantry reserve' : 'Pip’s choice',
                detail: o ? this.orderName(o) : t.stock ? 'Keeping ' + this.s.stockTargets[t.resource] + ' ' + RES[t.resource].name.toLowerCase() + ' in store.' : t.reason };
        }
        emit(type, text, extra = {}) { this.events.push({ type, text, ...extra }); }
        log(text, icon = 'leaf') { const entry = { text, icon, time: this.s.simTime, day: this.s.day, hour: this.s.hour }; this.s.log.unshift(entry); this.s.log = this.s.log.slice(0, 70); this.emit('log', text, { icon }); }
        drain() { const ev = this.events; this.events = []; return ev; }
        xp(who, amount) {
            return this.settleEconomy({ id: this.economySettlementId('xp'), [who === 'player' ? 'playerXp' : 'actorXp']: amount });
        }
        researchGain(n, label = 'Shared discovery') {
            return this.settleEconomy({ id: this.economySettlementId('research'), research: n }, label);
        }
        get buildingNames() { return BUILDINGS; }
        has(kind) { return has(this.s, kind); }
        mood() { const s = this.s, n = s.needs; if (n.water < 25)
            return 'Thirsty'; if (n.food < 25)
            return 'Hungry'; if (n.energy < 25)
            return 'Sleepy'; if (n.joy < 32)
            return 'Lonely'; if (n.comfort < 28)
            return 'Unsettled'; if (s.bond >= 65 && n.joy > 65)
            return 'Loved'; if (n.food > 70 && n.water > 65 && n.energy > 55)
            return 'Content'; return s.task?.kind === 'train' ? 'Curious' : s.task?.kind === 'build' ? 'Determined' : 'Feeling good'; }
        friendship() { const b = this.s.bond; return b < 30 ? 'Getting to know you' : b < 45 ? 'Little companions' : b < 65 ? 'Trusted buddies' : b < 85 ? 'Best of friends' : 'A bond for life'; }
        quest() { return QUESTS.find(q => !this.s.completedQuests.includes(q.id)) || null; }
        claimQuest() { let q = this.quest(); if (!q || !q.checks.every(c => c[1](this.s)))
            return { ok: false, reason: 'There is a little more to discover first.' };
            const settlement = this.settleEconomy({ id: 'chapter:' + q.id, chapterId: q.id, guide: q.reward.coins, research: q.reward.rp, playerXp: q.reward.xp }, 'Chapter: ' + q.title);
            if (!settlement.ok)
                return { ok: false, reason: settlement.state === 'duplicate' ? 'This chapter is already complete.' : 'The reward could not be settled.' };
            this.remember('chapter-' + q.id, q.title, 'A chapter of our shared story.', 'star'); this.log('A shared milestone: ' + q.title + '. +' + q.reward.coins + ' coins, +' + q.reward.rp + ' research.', 'star'); this.emit('celebrate', 'A little chapter, a big memory.'); return { ok: true }; }
        care(kind) {
            const s = this.s, n = s.needs;
            const issue = this.careIssue(kind);
            if (issue)
                return { ok: false, reason: issue };
            if ((s.cooldowns[kind] || 0) > s.simTime)
                return { ok: false, reason: 'A little moment to enjoy that first.' };
            if (kind === 'feed') {
                let resource = s.inventory.meals ? 'meals' : 'berries';
                if (!s.inventory[resource])
                    return { ok: false, reason: 'Our pantry is empty. Suggest foraging, or let Pip find a snack.' };
                s.inventory[resource]--;
                n.food = clamp(n.food + (resource === 'meals' ? 46 : 24), 0, 100);
                n.joy = clamp(n.joy + 4, 0, 100);
                s.bond = clamp(s.bond + 1.8, 0, 100);
                s.stats.fed++;
                s.cooldowns.feed = s.simTime + 8;
                this.xp('player', 3);
                this.log('You shared ' + (resource === 'meals' ? 'a warm meal' : 'a berry snack') + ' with ' + s.name + '.', 'berries');
                this.emit('heart', 'For me? Thank you!');
            }
            else if (kind === 'water') {
                if (s.inventory.water < 1)
                    return { ok: false, reason: 'No water in the pantry. Pip can collect more at the spring.' };
                s.inventory.water--;
                n.water = clamp(n.water + 32, 0, 100);
                s.bond = clamp(s.bond + 1.2, 0, 100);
                s.stats.watered++;
                s.cooldowns.water = s.simTime + 8;
                this.xp('player', 3);
                this.log('A cool drink and a little kindness.', 'water');
                this.emit('heart', 'Just what I needed.');
            }
            else if (kind === 'bond') {
                if (n.water < 16 || n.food < 16 || n.energy < 12) {
                    this.log(s.name + ' would love to play, but needs care first.', 'heart');
                    return { ok: false, reason: s.name + ' needs food, water or rest first. Friendship also means listening.' };
                }
                s.stats.bonded++;
                n.joy = clamp(n.joy + 23, 0, 100);
                s.daily.bonded++;
                s.bond = clamp(s.bond + (s.daily.bonded <= 3 ? 4 : 1), 0, 100);
                s.cooldowns.bond = s.simTime + 28;
                if (s.daily.bonded <= 3) {
                    this.xp('player', 4);
                    this.xp('creature', 2);
                }
                this.log('You watched the clouds together. Some moments are worth slowing down for.', 'heart');
                this.emit('heart', 'This is my favorite kind of afternoon.');
            }
            else if (kind === 'praise') {
                if (s.memory.lastAchievement <= s.memory.lastPraise || s.simTime - s.memory.lastAchievement > 90)
                    return { ok: false, reason: 'Praise follows effort. Wait for Pip to gather, build, learn or discover something.' };
                s.memory.lastPraise = s.memory.lastAchievement;
                n.joy = clamp(n.joy + 12, 0, 100);
                s.bond = clamp(s.bond + 3, 0, 100);
                s.cooldowns.praise = s.simTime + 12;
                this.xp('player', 2);
                this.log('You noticed ' + s.name + '’s effort. Being seen feels good.', 'star');
                this.emit('heart', 'You saw what I did!');
            }
            else
                return { ok: false, reason: 'Unknown care action.' };
            this.checkWish();
            return { ok: true };
        }
        research(id) { const k = owns(SKILLS, id) ? SKILLS[id] : null, s = this.s; if (!k)
            return { ok: false, reason: 'Unknown lesson.' }; if (s.researched[id] || s.skills[id])
            return { ok: false, reason: 'Already researched.' }; if (s.player.level < k.tier)
            return { ok: false, reason: 'Reach guide level ' + k.tier + ' to explore this tier.' }; const missing = k.requires.filter(r => !s.skills[r]); if (missing.length)
            return { ok: false, reason: 'First teach ' + missing.map(r => SKILLS[r].short).join(' and ') + '.' }; if (s.rp < k.rp)
            return { ok: false, reason: 'Need ' + k.rp + ' shared research. Explore, practice, or finish a chapter.' };
            const settlement = this.settleEconomy({ id: this.economySettlementId('lesson-research', id), research: -k.rp, playerXp: 2 }, 'Research: ' + k.short);
            if (!settlement.ok) return { ok: false, reason: 'The research cost could not be settled.' };
            s.researched[id] = true; this.log('You researched “' + k.name + '”. The lesson is ready to teach.', 'research'); return { ok: true }; }
        teach(id) { const s = this.s, k = owns(SKILLS, id) ? SKILLS[id] : null; if (!k)
            return { ok: false, reason: 'Unknown lesson.' }; if (s.skills[id])
            return { ok: false, reason: 'Pip already knows this.' }; if (!s.researched[id])
            return { ok: false, reason: 'Research this lesson first.' }; if (s.training)
            return { ok: false, reason: 'One lesson at a time. Let the current lesson settle in.' }; if (s.player.coins < k.coins)
            return { ok: false, reason: 'Need ' + k.coins + ' guide coins to buy this training.' };
            const settlement = this.settleEconomy({ id: this.economySettlementId('lesson-buy', id), guide: -k.coins }, 'Lesson: ' + k.short);
            if (!settlement.ok) return { ok: false, reason: 'The lesson cost could not be settled.' };
            s.training = { id, progress: 0 }; this.log('You bought a ' + k.short + ' lesson. ' + s.name + ' will study when ready.', 'book'); return { ok: true }; }
        setAllowance(n) { if (!Number.isFinite(n))
            return; this.s.allowance.limit = clamp(Math.round(n), 0, 30); this.emit('change', 'Allowance updated.'); }
        topUp(automatic = false) { const s = this.s, a = s.allowance; const remaining = Math.max(0, a.limit - a.given), amount = Math.min(remaining, s.player.coins); if (amount <= 0)
            return { ok: false, reason: remaining === 0 ? 'Today’s allowance has already been issued. Lowering a limit does not reclaim coins.' : 'You need guide coins to fund an allowance.' };
            const settlement = this.settleEconomy({ id: this.economySettlementId('allowance'), guide: -amount, pocket: amount }, 'Daily allowance');
            if (!settlement.ok) return { ok: false, reason: 'The allowance could not be settled.' };
            a.given += amount; this.log((automatic ? 'New-day allowance: ' : 'You shared ') + amount + ' coins with ' + s.name + '.', 'coin'); return { ok: true, amount }; }
        walkable(x, y) {
            if (!root.LWNavigation) return terrain(x, y) === 'grass' &&
                !this.s.buildings.some(b => b.x === x && b.y === y) &&
                !this.s.nodes.some(n => ['wood', 'stone'].includes(n.kind) && n.x === x && n.y === y);
            return root.LWNavigation.grid(this.s).pass(x, y);
        }
        canBuild(x, y) {
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
            const pass = (a, b) => a >= 0 && b >= 0 && a < SIZE && b < SIZE && terrain(a, b) === 'grass' && !blocked.has(a + ',' + b);
            const start = { x: Math.round(c.x), y: Math.round(c.y) }, queue = [start], visited = new Set([start.x + ',' + start.y]);
            let head = 0;
            while (head < queue.length) {
                const p = queue[head++];
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
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
            return places.every(p => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => pass(p.x + a, p.y + b) && visited.has((p.x + a) + ',' + (p.y + b))));
        }
        place(kind, x, y) { const b = owns(BUILDINGS, kind) ? BUILDINGS[kind] : null; if (!b)
            return { ok: false, reason: 'Unknown plan.' }; if (this.s.orders.length >= 12)
            return { ok: false, reason: 'Twelve ideas is plenty for one little buddy. Finish or cancel one first.' }; if (b.unique && (this.has(kind) || this.s.orders.some(o => o.kind === kind)))
            return { ok: false, reason: 'There is already a ' + b.name.toLowerCase() + ' or a plan for one.' }; if (!this.canBuild(x, y))
            return { ok: false, reason: 'Choose an open, reachable grass tile away from the edge.' }; const o = { id: 'o' + this.s.nextId++, type: 'build', kind, x, y, progress: 0, paid: false, paused: false, priority: 0, created: this.s.simTime }; this.s.orders.push(o); this.log('You imagined a ' + b.name.toLowerCase() + '. ' + this.s.name + ' will work out how to make it happen.', 'plan'); return { ok: true, order: o }; }
        request(type, resource = null, quantity = null) { const s = this.s; if (s.orders.length >= 12)
            return { ok: false, reason: 'The idea queue is full.' }; if (!['gather', 'craft', 'explore', 'hunt', 'deliver'].includes(type))
            return { ok: false, reason: 'Unknown suggestion.' }; if (type === 'gather' && !['wood', 'stone', 'fiber', 'berries', 'water'].includes(resource))
            return { ok: false, reason: 'Unknown resource.' }; if (type === 'craft' && !owns(RECIPES, resource))
            return { ok: false, reason: 'Unknown recipe.' }; if (type === 'deliver' && !this.has('market'))
            return { ok: false, reason: 'Build a market stall to meet your neighbors.' }; if (s.orders.some(o => o.type === type && o.resource === resource && type !== 'build'))
            return { ok: false, reason: 'Pip already has that idea in mind.' }; if (quantity !== null && (!Number.isInteger(quantity) || quantity < 1 || quantity > 24))
            return { ok: false, reason: 'Choose an amount from 1 to 24.' }; let amount = ['gather', 'craft'].includes(type) ? (quantity ?? (type === 'gather' ? 6 : 3)) : 1; if (type === 'craft')
            amount = Math.ceil(amount / RECIPES[resource].amount) * RECIPES[resource].amount; let o = { id: 'o' + s.nextId++, type, resource, amount, done: 0, paused: false, priority: 0, created: s.simTime }; if (type === 'deliver') {
            o.contract = s.contractIndex % CONTRACTS.length;
        } s.orders.push(o); this.log('You suggested: ' + this.orderName(o).toLowerCase() + '.', 'plan'); return { ok: true, order: o }; }
        orderName(o) { if (o.type === 'build')
            return BUILDINGS[o.kind].name; if (o.type === 'gather')
            return 'Gather ' + o.amount + ' ' + RES[o.resource].name.toLowerCase(); if (o.type === 'craft')
            return 'Craft ' + o.amount + ' ' + RES[o.resource].name.toLowerCase(); if (o.type === 'explore')
            return 'Explore the glade'; if (o.type === 'hunt')
            return 'Hunt for provisions'; if (o.type === 'deliver')
            return CONTRACTS[o.contract].name; return 'A little idea'; }
        cancel(id) { const s = this.s, o = s.orders.find(o => o.id === id); if (!o)
            return; if (o.paid && o.type === 'build')
            for (const [k, n] of Object.entries(BUILDINGS[o.kind].cost))
                s.inventory[k] += n; if (s.task?.orderId === id)
            s.task = null; s.orders = s.orders.filter(o => o.id !== id); this.log('You set aside a plan. ' + (o.paid ? 'Reserved materials returned to the pantry.' : 'There is no rush.'), 'plan'); }
        pauseOrder(id) { let o = this.s.orders.find(o => o.id === id); if (!o)
            return; o.paused = !o.paused; if (o.paused && this.s.task?.orderId === id)
            this.s.task = null; }
        prioritize(id) { for (const o of this.s.orders)
            o.priority = o.id === id ? 1 : 0; this.emit('change', 'Suggestion prioritized. Needs still come first.'); }
        missingSkill(resource) { if (resource === 'wood' && !this.s.skills.woodcraft)
            return 'woodcraft'; if (resource === 'stone' && !this.s.skills.stonework)
            return 'stonework'; if (resource === 'meat' && !this.s.skills.tracking)
            return 'tracking'; if (RECIPES[resource] && !this.s.skills[RECIPES[resource].skill])
            return RECIPES[resource].skill; return null; }
        assessResource(resource, amount, seen = new Set()) { const s = this.s; if (s.inventory[resource] >= amount)
            return null; if (seen.has(resource))
            return { text: 'A circular recipe needs attention.' }; seen.add(resource); const skill = this.missingSkill(resource); if (skill)
            return { text: 'Teach ' + SKILLS[skill].short, skill }; const recipe = RECIPES[resource]; if (recipe) {
            if (!this.has(recipe.station))
                return { text: 'Build a ' + BUILDINGS[recipe.station].name.toLowerCase(), building: recipe.station };
            for (const [r, n] of Object.entries(recipe.cost)) {
                const issue = this.assessResource(r, n, seen);
                if (issue)
                    return issue;
            }
        } return null; }
        orderIssue(o) {
            const s = this.s;
            if (o.paused)
                return { text: 'On hold — no rush', paused: true };
            if (o.type === 'build') {
                if (!s.skills[BUILDINGS[o.kind].skill]) {
                    const skill = BUILDINGS[o.kind].skill;
                    return { text: 'Teach ' + SKILLS[skill].short, skill };
                }
                if (!o.paid)
                    for (const [r, n] of Object.entries(BUILDINGS[o.kind].cost)) {
                        const issue = this.assessResource(r, n);
                        if (issue)
                            return issue;
                    }
            }
            if (o.type === 'gather' || o.type === 'craft') {
                const skill = this.missingSkill(o.resource);
                if (skill)
                    return { text: 'Teach ' + SKILLS[skill].short, skill };
                if (o.type === 'craft') {
                    const rec = RECIPES[o.resource];
                    if (!this.has(rec.station))
                        return { text: 'Build a ' + BUILDINGS[rec.station].name.toLowerCase(), building: rec.station };
                    for (const [r, n] of Object.entries(rec.cost)) {
                        const issue = this.assessResource(r, n);
                        if (issue)
                            return issue;
                    }
                }
            }
            if (o.type === 'hunt' && !s.skills.tracking)
                return { text: 'Teach Tracking', skill: 'tracking' };
            if (o.type === 'explore' && s.cooldowns.explore > s.simTime)
                return { text: 'Resting curiosity · ' + Math.ceil(s.cooldowns.explore - s.simTime) + 's' };
            if (o.type === 'deliver') {
                for (const [r, n] of Object.entries(CONTRACTS[o.contract].cost)) {
                    const issue = this.assessResource(r, n);
                    if (issue)
                        return issue;
                }
            }
            return null;
        }
        nearest(nodes) { const c = this.s.creature; return [...nodes].sort((a, b) => Math.hypot(c.x - a.x, c.y - a.y) - Math.hypot(c.x - b.x, c.y - b.y))[0]; }
        findPath(target, adjacent = false) {
            return root.LWNavigation.path(this.s, target, adjacent);
        }
        startTask(task) { const path = this.findPath(task.target || { x: Math.round(this.s.creature.x), y: Math.round(this.s.creature.y) }, ['build', 'gather', 'craft', 'shop', 'research', 'warm', 'rest', 'deliver', 'train', 'practice', 'reflect'].includes(task.kind)); if (path === null)
            return false; task.path = path; task.phase = path.length ? 'walk' : 'work'; task.elapsed = task.elapsed || 0; task.duration = Math.max(1, task.duration || 3); this.s.task = task; return true; }
        resourceTask(resource, orderId = null, force = false) {
            const s = this.s, base = { orderId, resource };
            if (!force && orderId && s.allowance.sourcing === 'shop') {
                const offer = this.shoppingTask(resource, orderId, false);
                if (offer)
                    return offer;
            }
            if (RECIPES[resource]) {
                const r = RECIPES[resource];
                if (!s.skills[r.skill] || !this.has(r.station))
                    return null;
                for (const [k, n] of Object.entries(r.cost))
                    if (s.inventory[k] < n)
                        return this.resourceTask(k, orderId, false);
                const b = s.buildings.find(b => b.kind === r.station);
                return { ...base, kind: 'craft', target: b, duration: r.time, label: 'Crafting ' + RES[resource].name.toLowerCase(), reason: 'A little making turns what we have into what we need.', thought: resource === 'planks' ? 'Two logs. Straight edges. I can do this.' : 'Something good is cooking.' };
            }
            if (resource === 'meat') {
                if (!s.skills.tracking)
                    return null;
                return { ...base, kind: 'hunt', target: { x: 16, y: 15 }, duration: 9, label: 'Following a woodland trail', reason: 'Tracking provides food that cannot be gathered from plants.', thought: 'Quiet paws. Eyes open.' };
            }
            if (this.missingSkill(resource))
                return null;
            let nodes = s.nodes.filter(n => n.kind === resource && n.stock > 0);
            if (resource === 'water' && this.has('well'))
                nodes = s.buildings.filter(b => b.kind === 'well').map(b => ({ ...b, id: 'well', stock: 999 }));
            if (resource === 'berries' && this.has('garden'))
                nodes = [...nodes, ...s.buildings.filter(b => b.kind === 'garden' && b.stock > 0).map(b => ({ ...b, id: 'garden', stock: b.stock }))];
            let node = this.nearest(nodes);
            if (!node)
                return !force ? this.shoppingTask(resource, orderId, false) : null;
            return { ...base, kind: 'gather', nodeId: node.id, target: node, duration: resource === 'water' ? (this.has('well') ? 1.6 : 2.8) : resource === 'wood' ? 4 : resource === 'stone' ? 4.5 : 3, label: resource === 'water' ? 'Collecting fresh water' : 'Gathering ' + RES[resource].name.toLowerCase(), reason: orderId ? 'I’m finding what our plan needs, one little step at a time.' : 'I’m keeping a little extra in our pantry. Just in case.', thought: resource === 'wood' ? 'These branches could become a home.' : resource === 'water' ? 'A little water for later.' : resource === 'berries' ? 'The ripe ones are the sweetest.' : 'This looks useful.' };
        }
        needTask(which) { const t = this.createNeedTask(which); if (t)
            t.need = which; return t; }
        createNeedTask(which) {
            const s = this.s, c = s.creature;
            const here = { x: Math.round(c.x), y: Math.round(c.y) };
            if (which === 'water') {
                if (s.inventory.water > 0)
                    return { kind: 'drink', target: here, duration: 2, label: 'Having a drink', reason: 'My thirst matters more than the plan for a moment.', thought: 'A sip first. Then our adventure.' };
                const shop = this.shoppingTask('water');
                return shop || this.resourceTask('water');
            }
            if (which === 'food') {
                if (s.inventory.meals || s.inventory.berries || s.inventory.meat)
                    return { kind: 'eat', target: here, duration: 3, label: 'Stopping for a snack', reason: 'I’m hungry. A full tummy helps me do my best.', thought: 'A small snack will help.' };
                const shop = this.shoppingTask('berries');
                return shop || this.resourceTask('berries');
            }
            if (which === 'energy') {
                const b = s.buildings.find(b => b.kind === 'cottage') || s.buildings.find(b => b.kind === 'shelter');
                return { kind: 'rest', target: b || { x: 8, y: 10 }, duration: b ? 10 : 12, label: b ? 'Curled up at home' : 'Napping under the sky', reason: b ? 'Home makes resting easier. Our plans can wait.' : 'I need a rest. A shelter would make this much cozier.', thought: b ? 'Wake me when the clouds look like berries.' : 'Someday we’ll have a little roof.' };
            }
            if (which === 'comfort') {
                const b = s.buildings.find(b => b.kind === 'fire') || s.buildings.find(b => b.kind === 'cottage') || s.buildings.find(b => b.kind === 'shelter');
                if (b)
                    return { kind: 'warm', target: b, duration: 5, label: b.kind === 'fire' ? 'Warming my paws' : 'Enjoying a quiet moment at home', reason: 'Feeling safe is a need, too.', thought: 'We made this. Together.' };
                return { kind: 'warm', target: here, duration: 7, label: 'Finding a sheltered sunny spot', reason: 'A quiet moment helps me feel safe, even before we have a home.', thought: 'The sun feels good on my paws.' };
            }
            if (which === 'joy')
                return { kind: 'play', target: { x: 9, y: 12 }, duration: 6, label: 'Chasing a little wonder', reason: 'A good life has room for play. Not just getting things done.', thought: 'Did that butterfly just wave at me?' };
            return null;
        }
        shoppingTask(resource, orderId = null, essential = true) {
            const s = this.s;
            if (!this.has('market') || !s.skills.commerce || !owns(RES, resource))
                return null;
            if (!essential && s.allowance.sourcing === 'gather')
                return null;
            const available = Math.max(0, s.creature.coins - (essential ? 0 : s.allowance.reserve)), price = RES[resource].price;
            if (available < price)
                return null;
            return { kind: 'shop', orderId, resource, essential, amount: Math.min(2, Math.floor(available / price)), target: s.buildings.find(b => b.kind === 'market'), duration: 3,
                label: 'Buying ' + RES[resource].name.toLowerCase(), reason: essential ? 'I can use my own pocket money for a necessity. My guide’s wallet stays untouched.' : 'I have enough pocket money left after my savings reserve to help our plan.', thought: 'I’ve saved enough for a little supply run.' };
        }
        orderTask(o) {
            const s = this.s, id = o.id;
            if (this.orderIssue(o))
                return null;
            if (o.type === 'build') {
                const b = BUILDINGS[o.kind];
                if (!o.paid) {
                    for (const [r, n] of Object.entries(b.cost))
                        if (s.inventory[r] < n)
                            return this.resourceTask(r, id);
                }
                return { kind: 'build', orderId: id, target: o, duration: b.time, elapsed: o.progress, label: 'Building our ' + b.name.toLowerCase(), reason: 'The materials are ready. I know how. Let’s make our plan real.', thought: 'One little piece at a time.' };
            }
            if (o.type === 'gather' || o.type === 'craft')
                return this.resourceTask(o.resource, id, true);
            if (o.type === 'explore')
                return { kind: 'explore', orderId: id, target: { x: 3 + (s.stats.explored * 5) % 12, y: s.stats.explored % 2 ? 15 : 3 }, duration: 8, label: 'Exploring the glade', reason: 'You sparked my curiosity. New places can mean new ideas.', thought: 'I wonder what we haven’t noticed yet.' };
            if (o.type === 'hunt')
                return { ...this.resourceTask('meat', id), kind: 'hunt', orderId: id };
            if (o.type === 'deliver') {
                const contract = CONTRACTS[o.contract];
                for (const [r, n] of Object.entries(contract.cost))
                    if (s.inventory[r] < n)
                        return this.resourceTask(r, id);
                return { kind: 'deliver', orderId: id, target: s.buildings.find(b => b.kind === 'market'), duration: 4, label: 'Helping a neighbor', reason: 'Our work can make someone else’s day a little better.', thought: 'I brought everything you asked for!' };
            }
            return null;
        }
        decide() {
            const s = this.s, n = s.needs;
            let task = null;
            // Needs outrank every player suggestion. No click ever sets the creature’s destination.
            const urgent = Object.keys(n).filter(k => n[k] < (k === 'energy' ? 27 : k === 'comfort' ? 25 : 35)).sort((a, b) => n[a] - n[b]);
            for (const k of urgent) {
                task = this.needTask(k);
                if (task && this.startTask(task))
                    return;
            }
            if (s.training) {
                const k = SKILLS[s.training.id];
                task = { kind: 'train', skillId: s.training.id, target: { x: 8, y: 10 }, duration: k.time, elapsed: s.training.progress, label: 'Learning ' + k.short.toLowerCase(), reason: 'You made time for a new skill. I’m giving it my best.', thought: 'Wait… I think I understand!' };
                if (this.startTask(task))
                    return;
            }
            if (s.focus === 'cozy') {
                for (const k of ['comfort', 'joy', 'energy'])
                    if (n[k] < 65) {
                        task = this.needTask(k);
                        if (task && this.startTask(task))
                            return;
                    }
            }
            const orders = [...s.orders].filter(o => !o.paused).sort((a, b) => b.priority - a.priority || (s.focus === 'builder' ? (a.type === 'build' ? -1 : 0) - (b.type === 'build' ? -1 : 0) : 0) || a.created - b.created);
            for (const o of orders) {
                task = this.orderTask(o);
                if (task && this.startTask(task))
                    return;
            }
            for (const k of ['water', 'food', 'energy', 'comfort', 'joy'])
                if (n[k] < (k === 'energy' ? 43 : k === 'comfort' ? 50 : 55)) {
                    task = this.needTask(k);
                    if (task && this.startTask(task))
                        return;
                }
            if (s.focus === 'curious' && s.cooldowns.explore < s.simTime) {
                task = { kind: 'explore', target: { x: 3 + (s.stats.explored * 5) % 12, y: s.stats.explored % 2 ? 15 : 3 }, duration: 9, label: 'Following my curiosity', reason: 'You’re encouraging curiosity. I’m seeing where it takes me.', thought: 'There’s a story behind every leaf.' };
                if (this.startTask(task))
                    return;
            }
            if (this.has('study') && s.cooldowns.research < s.simTime) {
                task = { kind: 'research', target: s.buildings.find(b => b.kind === 'study'), duration: 10, label: 'Trying a bright little idea', reason: 'A quiet space and a little practice can become shared knowledge.', thought: 'What happens if I try it this way?' };
                if (this.startTask(task))
                    return;
            }
            // Maintain requested reserves only after needs, lessons and runnable plans.
            for (const r of ['berries', 'water', 'wood', 'stone', 'fiber', 'planks', 'meat', 'meals']) {
                if (s.inventory[r] < (s.stockTargets[r] || 0) && !this.assessResource(r, s.stockTargets[r])) {
                    task = this.resourceTask(r);
                    if (task) {
                        task.stock = true;
                        task.reason = 'I’m keeping our pantry ready: ' + s.stockTargets[r] + ' ' + RES[r].name.toLowerCase() + '.';
                        if (this.startTask(task))
                            return;
                    }
                }
            }
            // A relaxed autonomous walk, never a hidden direct-control command.
            let dest = { x: 7 + Math.floor((s.simTime / 12) % 5), y: 8 + Math.floor((s.simTime / 27) % 5) };
            if (!this.walkable(dest.x, dest.y))
                dest = { x: 8, y: 10 };
            this.startTask({ kind: 'idle', target: dest, duration: 5, label: 'Enjoying the little things', reason: s.orders.length ? 'Some plans need a skill or a building first. I’ll enjoy the glade while we figure that out.' : 'All is well. I don’t need to be busy every moment.', thought: s.orders.length ? 'We can learn the next bit together.' : 'It’s a good day to be here.' });
        }
        finishTask(t) {
            const s = this.s, n = s.needs, o = s.orders.find(o => o.id === t.orderId), usedSkill = this.taskSkill(t);
            let achievement = false;
            if (t.kind === 'gather') {
                const node = t.nodeId === 'garden' ? s.buildings.find(b => b.kind === 'garden') : s.nodes.find(n => n.id === t.nodeId);
                let amount = t.resource === 'water' ? 3 : Math.min(t.resource === 'stone' ? 2 : 3, node?.stock ?? 0);
                if (o?.type === 'gather' && o.resource === t.resource)
                    amount = Math.min(amount, o.amount - o.done);
                if (amount <= 0) {
                    s.task = null;
                    return;
                }
                s.inventory[t.resource] += amount;
                if (node && t.resource !== 'water') {
                    node.stock = Math.max(0, node.stock - amount);
                }
                s.stats.gathered += amount;
                if (o?.type === 'gather' && o.resource === t.resource)
                    o.done += amount;
                this.xp('creature', 3);
                this.xp('player', 1);
                if (Math.floor((s.stats.gathered - amount) / 15) !== Math.floor(s.stats.gathered / 15))
                    this.researchGain(1);
                this.log(s.name + ' gathered ' + amount + ' ' + RES[t.resource].name.toLowerCase() + '.', t.resource);
                achievement = true;
            }
            else if (t.kind === 'craft') {
                const r = RECIPES[t.resource];
                if (Object.entries(r.cost).every(([k, v]) => s.inventory[k] >= v)) {
                    for (const [k, v] of Object.entries(r.cost))
                        s.inventory[k] -= v;
                    s.inventory[t.resource] += r.amount;
                    if (t.resource === 'planks')
                        s.stats.planksMade += r.amount;
                    if (o?.type === 'craft' && o.resource === t.resource)
                        o.done += r.amount;
                    this.xp('creature', 5);
                    this.xp('player', 2);
                    this.log(s.name + ' made ' + r.amount + ' ' + RES[t.resource].name.toLowerCase() + '.', 'planks');
                    achievement = true;
                }
            }
            else if (t.kind === 'build' && o) {
                if (!o.paid)
                    return;
                s.buildings.push({ id: 'b' + s.nextId++, kind: o.kind, x: o.x, y: o.y, stock: o.kind === 'garden' ? 4 : 0, regen: 0 });
                s.orders = s.orders.filter(a => a.id !== o.id);
                s.stats.built++;
                this.remember('build-' + o.kind, 'Our ' + BUILDINGS[o.kind].name.toLowerCase(), 'An idea became somewhere to belong.', BUILDINGS[o.kind].icon);
                this.xp('creature', 16);
                this.xp('player', 12);
                this.researchGain(2);
                s.bond = clamp(s.bond + 3, 0, 100);
                n.joy = clamp(n.joy + 10, 0, 100);
                this.log('Our ' + BUILDINGS[o.kind].name.toLowerCase() + ' is finished. Look what we made together.', 'home');
                this.emit('celebrate', BUILDINGS[o.kind].name + ' completed!');
                achievement = true;
            }
            else if (t.kind === 'train' && s.training) {
                const id = s.training.id;
                s.skills[id] = true;
                s.training = null;
                s.stats.trained++;
                this.remember('learn-' + id, 'I learned ' + SKILLS[id].short, 'You believed I could. Now I can.', 'book');
                this.xp('creature', 12);
                this.xp('player', 6);
                s.bond = clamp(s.bond + 2, 0, 100);
                n.joy = clamp(n.joy + 6, 0, 100);
                this.log(s.name + ' learned ' + SKILLS[id].short + '. A new possibility unlocked.', 'book');
                this.emit('celebrate', 'New skill: ' + SKILLS[id].short);
                achievement = true;
            }
            else if (t.kind === 'eat') {
                const r = s.inventory.meals ? 'meals' : s.inventory.berries ? 'berries' : s.inventory.meat ? 'meat' : null;
                if (r) {
                    s.inventory[r]--;
                    n.food = clamp(n.food + (r === 'meals' ? 48 : r === 'meat' ? 30 : 23), 0, 100);
                    this.log(s.name + ' chose to stop for a snack.', 'berries');
                }
            }
            else if (t.kind === 'drink') {
                if (s.inventory.water) {
                    s.inventory.water--;
                    n.water = clamp(n.water + 43, 0, 100);
                }
            }
            else if (t.kind === 'rest') {
                const b = this.has('cottage') ? 'cottage' : this.has('shelter') ? 'shelter' : null;
                n.energy = clamp(n.energy + (b === 'cottage' ? 78 : b ? 60 : 42), 0, 100);
                n.comfort = clamp(n.comfort + (b ? 24 : 5), 0, 100);
            }
            else if (t.kind === 'warm') {
                n.comfort = clamp(n.comfort + 33, 0, 100);
                n.joy = clamp(n.joy + 5, 0, 100);
            }
            else if (t.kind === 'play') {
                n.joy = clamp(n.joy + 32, 0, 100);
                n.energy = clamp(n.energy - 2, 0, 100);
            }
            else if (t.kind === 'explore') {
                const settlement = this.settleEconomy({ id: this.economySettlementId('explore'), guide: 6, pocket: 2, research: 2, actorXp: 7, playerXp: 5, stats: { explored: 1 } }, 'Helped a traveler');
                if (!settlement.ok) { s.task = null; return; }
                s.cooldowns.explore = s.simTime + 60;
                this.log(s.name + ' discovered a trail marker and helped a traveler. +6 guide coins, +2 pocket coins, +2 research.', 'compass');
                if (o)
                    o.done = 1;
                achievement = true;
            }
            else if (t.kind === 'hunt') {
                s.inventory.meat += 2;
                s.inventory.fiber++;
                n.energy = clamp(n.energy - 6, 0, 100);
                this.xp('creature', 7);
                this.xp('player', 2);
                this.log(s.name + ' returned from a woodland hunt with 2 provisions and 1 fiber.', 'paw');
                if (o?.type === 'hunt')
                    o.done = 1;
                achievement = true;
            }
            else if (t.kind === 'shop') {
                const cost = RES[t.resource].price * t.amount;
                if (s.creature.coins >= cost) {
                    const settlement = this.settleEconomy({ id: this.economySettlementId('shop'), pocket: -cost }, s.name + ' bought ' + t.amount + ' ' + RES[t.resource].name.toLowerCase());
                    if (!settlement.ok) { s.task = null; return; }
                    s.inventory[t.resource] += t.amount;
                    this.remember('first-shop', 'My very own choice', 'I bought what I needed with my pocket money.', 'market');
                    this.log(s.name + ' chose to buy ' + t.amount + ' ' + RES[t.resource].name.toLowerCase() + ' with ' + cost + ' pocket coins.', 'market');
                    this.xp('creature', 2);
                }
            }
            else if (t.kind === 'deliver' && o) {
                const contract = CONTRACTS[o.contract];
                if (Object.entries(contract.cost).every(([r, q]) => s.inventory[r] >= q)) {
                    const income = this.economyRuntime().splitIncome(contract.coins);
                    const settlement = this.settleEconomy({ id: this.economySettlementId('delivery'), ...income, research: contract.rp, actorXp: 10, playerXp: 8, stats: { earned: contract.coins, deliveries: 1 } }, 'Shared trade income');
                    if (!settlement.ok) { s.task = null; return; }
                    for (const [r, q] of Object.entries(contract.cost))
                        s.inventory[r] -= q;
                    s.contractIndex++;
                    o.done = 1;
                    s.bond = clamp(s.bond + 2, 0, 100);
                    this.log('A grateful neighbor paid ' + contract.coins + ' coins, shared between you and ' + s.name + '.', 'coin');
                    achievement = true;
                }
            }
            else if (t.kind === 'research') {
                const settlement = this.settleEconomy({ id: this.economySettlementId('experiment'), research: 2, actorXp: 5, playerXp: 2 }, 'Shared discovery');
                if (!settlement.ok) { s.task = null; return; }
                s.cooldowns.research = s.simTime + 50;
                this.log(s.name + '’s little experiment earned 2 shared research.', 'research');
                achievement = true;
            }
            if (achievement) {
                s.memory.lastAchievement = s.simTime;
                this.practiceSkill(usedSkill);
            }
            else if (t.kind === 'shop')
                this.practiceSkill(usedSkill);
            this.checkWish();
            if (o && o.type !== 'build' && (o.done || 0) >= o.amount) {
                s.orders = s.orders.filter(a => a.id !== o.id);
                this.emit('done', 'An idea became a little achievement.');
            }
            s.task = null;
        }
        splitIncome(amount) { const income = this.economyRuntime().splitIncome(amount); return this.settleEconomy({ id: this.economySettlementId('income'), ...income, stats: { earned: amount } }, 'Shared trade income'); }
        trade(resource, mode, qty = 1) { const s = this.s; if (!this.has('market'))
            return { ok: false, reason: 'Build a market stall to welcome traders.' }; if (!owns(RES, resource) || !['buy', 'sell'].includes(mode) || !Number.isInteger(qty) || qty < 1 || qty > 99)
            return { ok: false, reason: 'Invalid trade.' }; const price = mode === 'sell' ? Math.max(1, Math.floor(RES[resource].price * .65)) : RES[resource].price; const total = price * qty; if (mode === 'sell') {
            if (s.inventory[resource] < qty)
                return { ok: false, reason: 'Not enough in our pantry.' };
            const settlement = this.splitIncome(total);
            if (!settlement.ok) return { ok: false, reason: 'The sale could not be settled.' };
            s.inventory[resource] -= qty;
            this.log('Sold ' + qty + ' ' + RES[resource].name.toLowerCase() + ' for ' + total + ' coins. Earnings shared 70/30.', 'coin');
        }
        else {
            if (s.player.coins < total)
                return { ok: false, reason: 'Not enough guide coins.' };
            const settlement = this.settleEconomy({ id: this.economySettlementId('trade-buy'), guide: -total }, 'You bought ' + qty + ' ' + RES[resource].name.toLowerCase());
            if (!settlement.ok) return { ok: false, reason: 'The purchase could not be settled.' };
            s.inventory[resource] += qty;
            this.log('You bought ' + qty + ' ' + RES[resource].name.toLowerCase() + ' for the pantry.', 'market');
        } return { ok: true }; }
        step(dt) {
            const s = this.s;
            if (!s.started || s.paused)
                return;
            dt = clamp(dt, 0, .25);
            s.simTime += dt;
            s.hour += dt * .05;
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
            n.food = clamp(n.food - dt * (working ? .105 : .075), 0, 100);
            n.water = clamp(n.water - dt * (working ? .14 : .105), 0, 100);
            n.energy = clamp(n.energy - dt * (working ? .12 : .055), 0, 100);
            n.comfort = clamp(n.comfort - dt * (this.has('cottage') ? .008 : this.has('shelter') ? .025 : .055), 0, 100);
            n.joy = clamp(n.joy - dt * .05, 0, 100);
            if ((n.food < 8 || n.water < 8) && s.simTime - s.memory.lastGentleWarning > 45) {
                s.memory.lastGentleWarning = s.simTime;
                this.emit('notice', s.name + ' needs a little care. No one gets left behind.');
            }
            if (!t) {
                this.decide();
                return;
            }
            // Interrupt long work only for a critical need, keeping construction/training progress.
            const emergencies = ['water', 'food', 'energy'].filter(k => n[k] < (k === 'energy' ? 10 : 12)).sort((a, b) => n[a] - n[b]);
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
                const c = s.creature, dx = p.x - c.x, dy = p.y - c.y, dist = Math.hypot(dx, dy), speed = (1.65 + (s.bond >= 65 ? .15 : 0)) * dt;
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
                    const cost = this.constructionCost ? this.constructionCost(o) : BUILDINGS[o.kind].cost;
                    if (!Object.entries(cost).every(([r, a]) => s.inventory[r] >= a)) {
                        s.task = null;
                        return;
                    }
                    for (const [r, a] of Object.entries(cost))
                        s.inventory[r] -= a;
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
        advance(seconds) {
            if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0 || seconds > 3600) return;
            const count = Math.floor(seconds * 10 + 1e-9);
            for (let i = 0; i < count; i++) this.step(.1);
            const remainder = seconds - count / 10;
            if (remainder > 1e-9) this.step(remainder);
        }
        export() { const s = JSON.parse(JSON.stringify(this.s)); s.task = null; return { app: 'littlewild', version: VERSION, savedAt: new Date().toISOString(), state: s }; }
        static import(data) {
            if (!data || data.app !== 'littlewild' || ![1, 2, VERSION].includes(data.version) || !data.state)
                throw Error('This is not a supported Littlewild save (v1, v2 or v3).');
            const a = data.state, s = initial();
            const num = (v, min, max, label) => { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
                throw Error('Invalid ' + label + '.'); return v; };
            const int = (v, min, max, l) => { num(v, min, max, l); if (!Number.isInteger(v))
                throw Error('Invalid ' + l + '.'); return v; };
            if (typeof a.name !== 'string' || a.name.length < 1 || a.name.length > 20)
                throw Error('Invalid buddy name.');
            s.name = a.name.replace(/[<>\u0000-\u001f]/g, '').trim() || 'Pip';
            s.simTime = num(a.simTime, 0, 1e9, 'time');
            s.day = int(a.day, 1, 1e7, 'day');
            s.hour = num(a.hour, 0, 24, 'hour');
            s.started = !!a.started;
            s.paused = !!a.paused;
            s.speed = [1, 2, 4].includes(a.speed) ? a.speed : 1;
            s.focus = ['balanced', 'cozy', 'builder', 'curious'].includes(a.focus) ? a.focus : 'balanced';
            for (const k of ['player', 'creature']) {
                if (!a[k])
                    throw Error('Missing character.');
                s[k].level = int(a[k].level, 1, 9999, 'level');
                s[k].xp = num(a[k].xp, 0, threshold(s[k].level), 'experience');
                s[k].coins = int(a[k].coins, 0, 1e9, 'coins');
            }
            s.creature.x = num(a.creature.x, 0, SIZE - 1, 'position');
            s.creature.y = num(a.creature.y, 0, SIZE - 1, 'position');
            s.creature.dir = a.creature.dir === -1 ? -1 : 1;
            if (terrain(Math.round(s.creature.x), Math.round(s.creature.y)) !== 'grass')
                throw Error('Buddy must be on land.');
            s.rp = int(a.rp, 0, 1e9, 'research');
            s.bond = num(a.bond, 0, 100, 'friendship');
            for (const k of Object.keys(s.needs))
                s.needs[k] = num(a.needs?.[k], 0, 100, 'need');
            for (const k of Object.keys(RES))
                s.inventory[k] = int(a.inventory?.[k], 0, 1e7, 'inventory');
            if (!a.allowance)
                throw Error('Missing allowance.');
            s.allowance = { limit: int(a.allowance.limit, 0, 30, 'allowance'), given: int(a.allowance.given, 0, 1e9, 'allowance issued'), auto: !!a.allowance.auto, reserve: int(a.allowance.reserve ?? 4, 0, 30, 'pocket savings reserve'), sourcing: ['balanced', 'gather', 'shop'].includes(a.allowance.sourcing) ? a.allowance.sourcing : 'balanced' };
            for (const key of ['skills', 'researched']) {
                if (!a[key] || typeof a[key] !== 'object' || Array.isArray(a[key]))
                    throw Error('Invalid skills.');
                for (const id of Object.keys(a[key])) {
                    if (!owns(SKILLS, id) || a[key][id] !== true)
                        throw Error('Unknown lesson.');
                    s[key][id] = true;
                }
            }
            if (a.training) {
                if (!owns(SKILLS, a.training.id) || s.skills[a.training.id] || !s.researched[a.training.id])
                    throw Error('Invalid training.');
                s.training = { id: a.training.id, progress: num(a.training.progress, 0, SKILLS[a.training.id].time, 'training progress') };
            }
            const occupied = new Set(), builtKinds = new Set();
            if (!Array.isArray(a.buildings) || a.buildings.length > 40)
                throw Error('Invalid buildings.');
            s.buildings = a.buildings.map((b, i) => { if (!owns(BUILDINGS, b.kind))
                throw Error('Unknown building.'); if (builtKinds.has(b.kind))
                throw Error('Duplicate unique building.'); builtKinds.add(b.kind); const x = int(b.x, 2, 16, 'building position'), y = int(b.y, 2, 16, 'building position'), key = x + ',' + y; if (terrain(x, y) !== 'grass' || s.nodes.some(n => n.x === x && n.y === y) || occupied.has(key))
                throw Error('Building placement conflicts.'); occupied.add(key); return { id: 'bload' + i, kind: b.kind, x, y, stock: int(b.stock || 0, 0, 12, 'garden stock'), regen: num(b.regen || 0, 0, 80, 'growth') }; });
            if (!Array.isArray(a.orders) || a.orders.length > 12)
                throw Error('Invalid ideas.');
            s.orders = a.orders.map((o, i) => { if (!['build', 'gather', 'craft', 'explore', 'hunt', 'deliver'].includes(o.type))
                throw Error('Unknown idea.'); const n = { id: 'oload' + i, type: o.type, paused: !!o.paused, priority: o.priority === 1 ? 1 : 0, created: num(o.created || 0, 0, 1e9, 'idea time') }; if (o.type === 'build') {
                if (!owns(BUILDINGS, o.kind))
                    throw Error('Unknown plan.');
                if (builtKinds.has(o.kind))
                    throw Error('Duplicate unique plan.');
                builtKinds.add(o.kind);
                n.kind = o.kind;
                n.x = int(o.x, 2, 16, 'plan position');
                n.y = int(o.y, 2, 16, 'plan position');
                const key = n.x + ',' + n.y;
                if (terrain(n.x, n.y) !== 'grass' || occupied.has(key) || s.nodes.some(p => p.x === n.x && p.y === n.y))
                    throw Error('Plan placement conflicts.');
                occupied.add(key);
                n.progress = num(o.progress || 0, 0, BUILDINGS[o.kind].time, 'build progress');
                n.paid = !!o.paid;
            }
            else {
                if (o.type === 'gather' && !['wood', 'stone', 'fiber', 'berries', 'water', 'clay', 'ore', 'herbs', 'grain'].includes(o.resource))
                    throw Error('Invalid resource.');
                if (o.type === 'craft' && !owns(RECIPES, o.resource))
                    throw Error('Invalid recipe.');
                n.resource = o.resource || null;
                n.amount = int(o.amount, 1, 100, 'idea amount');
                n.done = int(o.done || 0, 0, 100, 'idea progress');
                if (o.type === 'deliver')
                    n.contract = int(o.contract, 0, CONTRACTS.length - 1, 'delivery');
            } return n; });
            s.nextId = int(a.nextId || 1, 1, 1e9, 'identifier');
            s.contractIndex = int(a.contractIndex || 0, 0, 1e9, 'contract');
            s.completedQuests = Array.isArray(a.completedQuests) ? a.completedQuests.filter(id => QUESTS.some(q => q.id === id)).filter((v, i, arr) => arr.indexOf(v) === i) : [];
            for (const k of Object.keys(s.stats))
                s.stats[k] = int(a.stats?.[k] || 0, 0, 1e9, 'statistics');
            for (const k of Object.keys(s.cooldowns))
                s.cooldowns[k] = num(a.cooldowns?.[k] || 0, 0, 1e9, 'cooldown');
            for (const k of ['lastAchievement', 'lastPraise', 'lastGentleWarning', 'lastDecline'])
                s.memory[k] = num(a.memory?.[k] ?? -100, -100, 1e9, 'memory');
            if (Array.isArray(a.nodes))
                for (const node of s.nodes) {
                    const source = a.nodes.find(n => n.id === node.id);
                    if (source) {
                        node.stock = int(source.stock, 0, node.max, 'resource stock');
                        node.regen = num(source.regen || 0, 0, 24, 'regrowth');
                    }
                }
            s.settings = { sound: !!a.settings?.sound, follow: !!a.settings?.follow, reducedMotion: !!a.settings?.reducedMotion, highContrast: !!a.settings?.highContrast };
            s.log = Array.isArray(a.log) ? a.log.slice(0, 70).filter(l => typeof l.text === 'string').map(l => ({ text: l.text.slice(0, 300), icon: typeof l.icon === 'string' ? l.icon : 'leaf', time: typeof l.time === 'number' ? l.time : 0, day: Number.isInteger(l.day) ? l.day : 1, hour: Number.isFinite(l.hour) ? l.hour : 8 })) : [];
            // v2 extensions are fully validated before any live story is replaced.
            if (a.stockTargets !== undefined) {
                if (!a.stockTargets || typeof a.stockTargets !== 'object')
                    throw Error('Invalid pantry policy.');
                for (const r of Object.keys(RES))
                    s.stockTargets[r] = int(a.stockTargets[r] ?? s.stockTargets[r], 0, 24, 'pantry target');
            }
            if (a.practice !== undefined) {
                if (!a.practice || typeof a.practice !== 'object' || Array.isArray(a.practice))
                    throw Error('Invalid practice.');
                for (const [id, n] of Object.entries(a.practice)) {
                    if (!owns(SKILLS, id))
                        throw Error('Unknown practiced skill.');
                    s.practice[id] = int(n, 0, 1e8, 'practice');
                }
            }
            const str = (v, max, label) => { if (typeof v !== 'string' || v.length > max)
                throw Error('Invalid ' + label + '.'); return v.replace(/[\u0000-\u001f]/g, ''); };
            if (a.memories !== undefined) {
                if (!Array.isArray(a.memories) || a.memories.length > 60)
                    throw Error('Invalid memories.');
                s.memories = a.memories.map(m => ({ key: str(m.key, 80, 'memory key'), title: str(m.title, 150, 'memory'), description: str(m.description, 350, 'memory'), icon: str(m.icon, 30, 'memory icon'), day: int(m.day, 1, s.day, 'memory day'), hour: num(m.hour, 0, 24, 'memory hour') }));
            }
            if (a.ledger !== undefined) {
                if (!Array.isArray(a.ledger) || a.ledger.length > 80)
                    throw Error('Invalid ledger.');
                s.ledger = a.ledger.map(m => ({ label: str(m.label, 180, 'transaction'), guide: int(m.guide, -1e9, 1e9, 'guide delta'), pocket: int(m.pocket, -1e9, 1e9, 'pocket delta'), research: int(m.research, -1e9, 1e9, 'research delta'), day: int(m.day, 1, s.day, 'ledger day'), hour: num(m.hour, 0, 24, 'ledger hour') }));
            }
            if (a.daily)
                s.daily = { day: s.day, bonded: int(a.daily.bonded, 0, 1e8, 'daily friendship') };
            else
                s.daily = { day: s.day, bonded: 0 };
            if (a.wish) {
                const w = a.wish;
                if (!['bonded', 'explored', 'gathered', 'fed'].includes(w.stat) || !['bond', 'explore', 'gather', 'feed'].includes(w.action))
                    throw Error('Invalid wish.');
                s.wish = { stat: w.stat, action: w.action, day: int(w.day, 1, s.day, 'wish day'), amount: int(w.amount, 1, 24, 'wish amount'), start: int(w.start, 0, 1e9, 'wish progress'), title: str(w.title, 100, 'wish'), thought: str(w.thought, 180, 'wish thought'), complete: !!w.complete };
            }
            s.task = null;
            const loaded = new Engine(s);
            // Older versions could save a buddy on the tile of the building they just completed.
            // Relocate only to an adjacent passable tile, never inside the spring or outside the glade.
            const cx = Math.round(s.creature.x), cy = Math.round(s.creature.y);
            if (!loaded.walkable(cx, cy)) {
                const free = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y]) => ({ x: cx + x, y: cy + y })).find(p => loaded.walkable(p.x, p.y));
                if (!free)
                    throw Error('Buddy has no safe place to stand.');
                s.creature.x = free.x;
                s.creature.y = free.y;
            }
            // Reject disconnected settlements instead of accepting a save whose planner can never recover.
            const queue = [{ x: Math.round(s.creature.x), y: Math.round(s.creature.y) }], seen = new Set(queue.map(p => p.x + ',' + p.y));
            let head = 0;
            while (head < queue.length) {
                const p = queue[head++];
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const x = p.x + dx, y = p.y + dy, k = x + ',' + y;
                    if (loaded.walkable(x, y) && !seen.has(k)) {
                        seen.add(k);
                        queue.push({ x, y });
                    }
                }
            }
            for (let x = 0; x < SIZE; x++)
                for (let y = 0; y < SIZE; y++)
                    if (loaded.walkable(x, y) && !seen.has(x + ',' + y))
                        throw Error('Buildings disconnect the glade.');
            return loaded;
        }
    }
    const api = { Engine, initial, SKILLS, BUILDINGS, RES, RECIPES, QUESTS, CONTRACTS, SIZE, terrain, seeded, threshold, clamp };
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
    root.LW = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
