/// <reference path="./balancing-contracts.d.ts" />
/// <reference path="./legacy-task-contracts.d.ts" />
/* Companion care, skill practice, learning and shared milestone commands. */
(function (inputRoot: unknown) {
    'use strict';
    interface Chapter {
        id: string;
        title: string;
        checks: [
            string,
            (state: LWTaskPorts.State) => boolean
        ][];
        reward: {
            coins: number;
            rp: number;
            xp: number;
        };
    }
    interface CompanionState extends LWTaskPorts.State {
        hour: number;
        rp: number;
        completedQuests: string[];
        practice: LWTaskPorts.Numbers;
        researched: Record<string, boolean>;
        memories: {
            key: string;
            title: string;
            description: string;
            icon: string;
            day: number;
            hour: number;
        }[];
        wish: {
            stat: string;
            amount: number;
            title: string;
            thought: string;
            action: string;
            day: number;
            start: number;
            complete: boolean;
        } | null;
        daily: {
            bonded: number;
        };
        memory: {
            lastAchievement: number;
            lastPraise: number;
        };
        allowance: {
            sourcing: string;
            reserve: number;
            limit: number;
            given: number;
        };
        player: {
            level: number;
            coins: number;
        };
    }
    interface Mastery {
        points: number;
        rank: number;
        label: string;
        bonus: number;
        next: number | null;
    }
    interface Host extends LWTaskPorts.BaseHost {
        s: CompanionState;
        mastery(id: string | undefined): Mastery;
        careIssue(kind: string): string | null;
        quest(): Chapter | null;
    }
    interface Methods {
        remember(key: string, title: string, description: string, icon?: string): void;
        newWish(): void;
        checkWish(): void;
        mastery(id: string | undefined): Mastery;
        practiceSkill(id: string | undefined): void;
        taskSkill(t: LWTaskPorts.Task): string | undefined;
        workRate(t: LWTaskPorts.Task): number;
        setStockTarget(resource: string, amount: number): {
            ok: boolean;
            reason?: string;
        };
        careIssue(kind: string): string | null;
        mood(): string;
        friendship(): string;
        quest(): Chapter | null;
        claimQuest(): {
            ok: boolean;
            reason?: string;
        };
        care(kind: string): {
            ok: boolean;
            reason?: string;
        };
        research(id: string): {
            ok: boolean;
            reason?: string;
        };
        teach(id: string): {
            ok: boolean;
            reason?: string;
        };
        setAllowance(n: number): void;
        topUp(automatic?: boolean): {
            ok: boolean;
            reason?: string;
            amount?: number;
        };
    }
    interface Root {
        LWContent: {
            tables: LWTaskPorts.Tables & {
                QUESTS: Chapter[];
                SKILLS: Record<string, LWTaskPorts.Skill & {
                    name: string;
                    tier: number;
                    requires: string[];
                    rp: number;
                    coins: number;
                }>;
            };
        };
        LWEngineCompanion?: Api;
    }
    interface Api {
        install(target: object): void;
    }
    const root = inputRoot as Root;
 const B = (typeof module!=='undefined'&&module.exports?require('./balancing-rules.js'):(globalThis as unknown as {LWBalanceRules:LWBalanceRules.Api}).LWBalanceRules) as LWBalanceRules.Api;
    function install(target: object): void {
        const { RES, SKILLS, BUILDINGS, RECIPES, QUESTS } = root.LWContent.tables;
        const clamp = (n: number, a: number, b: number): number => Math.max(a, Math.min(b, n));
        const owns = (table: object, key: string): boolean => typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key);
        const methods: Methods & ThisType<Host> = {
            remember(key, title, description, icon = 'heart') {
                const s = this.s;
                if (s.memories.some(m => m.key === key))
                    return;
                s.memories.unshift({ key, title, description, icon, day: s.day, hour: s.hour });
                s.memories = s.memories.slice(0, 60);
            },
            newWish() {
                const wishes = [{ stat: 'bonded', amount: 1, title: 'A moment, just us', thought: 'Could we watch the clouds together?', action: 'bond' },
                    { stat: 'explored', amount: 1, title: 'Something we haven’t seen', thought: 'I wonder what is hiding along the trail.', action: 'explore' },
                    { stat: 'gathered', amount: 9, title: 'A little for tomorrow', thought: 'I’d like to bring something home for us.', action: 'gather' },
                    { stat: 'fed', amount: 1, title: 'A snack from a friend', thought: 'Berries taste better when you share them.', action: 'feed' }];
                const w = wishes[(this.s.day - 1) % wishes.length]!;
                this.s.wish = { ...w, day: this.s.day, start: this.s.stats[w.stat]!, complete: false };
            },
            checkWish() {
                const s = this.s, w = s.wish;
                if (!w || w.complete || s.stats[w.stat]! - w.start < w.amount)
                    return;
                w.complete = true;
                s.bond = clamp(s.bond + 2, 0, 100);
                this.researchGain(1, 'A small wish');
                this.remember('wish-' + s.day, w.title, 'We made room for a small wish. No grand plans needed.');
                this.log('A small wish fulfilled: ' + w.title + '. +2 friendship, +1 shared research.', 'heart');
                this.emit('celebrate', 'A small wish, a shared memory.');
            },
            mastery(id) {
                const points = this.s.practice[id!]! || 0, limits = [0, 8, 20, 40];
                let rank = 0;
                for (let i = 1; i < limits.length; i++)
                    if (points >= limits[i]!)
                        rank = i;
                return { points, rank, label: ['New paws', 'Practiced', 'Confident', 'Fluent'][rank]!, bonus: rank * 6, next: limits[rank + 1]! || null };
            },
            practiceSkill(id) {
                if (!id || !this.s.skills[id]!)
                    return;
                const before = this.mastery(id).rank;
                this.s.practice[id!]! = (this.s.practice[id!]! || 0) + 1;
                const m = this.mastery(id);
                if (m.rank > before) {
                    this.log(this.s.name + ' feels ' + m.label.toLowerCase() + ' with ' + SKILLS[id]!.short + '. +' + m.bonus + '% work speed.', 'star');
                    this.emit('celebrate', SKILLS[id]!.short + ': ' + m.label);
                }
            },
            taskSkill(t) {
                if (t.kind === 'build')
                    return BUILDINGS[this.s.orders.find(o => o.id === t.orderId)?.kind!]!?.skill;
                if (t.kind === 'craft')
                    return RECIPES[t.resource!]!?.skill;
                if (t.kind === 'gather')
                    return ({ wood: 'woodcraft', stone: 'stonework' })[t.resource!]!;
                return ({ hunt: 'tracking', shop: 'commerce', deliver: 'commerce', research: 'invention' })[t.kind]!;
            },
            workRate(t) { return 1 + (this.mastery(this.taskSkill(t)).bonus / 100); },
            setStockTarget(resource, amount) {
                if (!owns(RES, resource) || !Number.isInteger(amount) || amount < 0 || amount > 24)
                    return { ok: false, reason: 'Choose a stock target from 0 to 24.' };
                this.s.stockTargets[resource]! = amount;
                return { ok: true };
            },
            careIssue(kind) {
                const s = this.s, n = s.needs, wait = Math.max(0, Math.ceil((s.cooldowns[kind]! || 0) - s.simTime));
                if (wait)
                    return 'Enjoying that moment · ' + wait + 's';
                if (kind === 'feed' && n.food >= B.forEngine(this).care.fullGate)
                    return 'A full tummy already. Save that snack for later.';
                if (kind === 'water' && n.water >= B.forEngine(this).care.waterFullGate)
                    return 'Not thirsty right now. Thank you for checking.';
                if (kind === 'feed' && !s.inventory.meals && !s.inventory.berries)
                    return 'No snack in the pantry. Pip can forage for berries.';
                if (kind === 'water' && !s.inventory.water)
                    return 'No stored water. Pip can collect more at the spring.';
                if (kind === 'bond' && (n.food < B.forEngine(this).care.bondFoodGate || n.water < B.forEngine(this).care.bondWaterGate || n.energy < B.forEngine(this).care.bondEnergyGate))
                    return 'Pip needs food, water or rest before play.';
                if (kind === 'praise' && (s.memory.lastAchievement <= s.memory.lastPraise || s.simTime - s.memory.lastAchievement > B.forEngine(this).care.praiseAge))
                    return 'Notice a recent effort: gathering, learning, crafting or building.';
                return null;
            },
            mood() {
                const s = this.s, n = s.needs;
                if (n.water < B.forEngine(this).mood.needGate)
                    return 'Thirsty';
                if (n.food < B.forEngine(this).mood.needGate)
                    return 'Hungry';
                if (n.energy < B.forEngine(this).mood.needGate)
                    return 'Sleepy';
                if (n.joy < B.forEngine(this).mood.joyLow)
                    return 'Lonely';
                if (n.comfort < B.forEngine(this).mood.comfortLow)
                    return 'Unsettled';
                if (s.bond >= B.forEngine(this).mood.lovedBond && n.joy > B.forEngine(this).mood.lovedJoy)
                    return 'Loved';
                if (n.food > B.forEngine(this).mood.contentFood && n.water > B.forEngine(this).mood.contentWater && n.energy > B.forEngine(this).mood.contentEnergy)
                    return 'Content';
                return s.task?.kind === 'train' ? 'Curious' : s.task?.kind === 'build' ? 'Determined' : 'Feeling good';
            },
            friendship() { const b = this.s.bond; return b < B.forEngine(this).mood.friendOne ? 'Getting to know you' : b < B.forEngine(this).mood.friendTwo ? 'Little companions' : b < B.forEngine(this).mood.friendThree ? 'Trusted buddies' : b < B.forEngine(this).mood.friendFour ? 'Best of friends' : 'A bond for life'; },
            quest() { return QUESTS.find(q => !this.s.completedQuests.includes(q.id)) || null; },
            claimQuest() {
                let q = this.quest();
                if (!q || !q.checks.every(c => c[1]!(this.s)))
                    return { ok: false, reason: 'There is a little more to discover first.' };
                const settlement = this.settleEconomy({ id: 'chapter:' + q.id, chapterId: q.id, guide: q.reward.coins, research: q.reward.rp, playerXp: q.reward.xp }, 'Chapter: ' + q.title);
                if (!settlement.ok)
                    return { ok: false, reason: settlement.state === 'duplicate' ? 'This chapter is already complete.' : 'The reward could not be settled.' };
                this.remember('chapter-' + q.id, q.title, 'A chapter of our shared story.', 'star');
                this.log('A shared milestone: ' + q.title + '. +' + q.reward.coins + ' coins, +' + q.reward.rp + ' research.', 'star');
                this.emit('celebrate', 'A little chapter, a big memory.');
                return { ok: true };
            },
            care(kind) {
                const s = this.s, n = s.needs;
                const issue = this.careIssue(kind);
                if (issue)
                    return { ok: false, reason: issue };
                if ((s.cooldowns[kind]! || 0) > s.simTime)
                    return { ok: false, reason: 'A little moment to enjoy that first.' };
                if (kind === 'feed') {
                    let resource = s.inventory.meals ? 'meals' : 'berries';
                    if (!s.inventory[resource]!)
                        return { ok: false, reason: 'Our pantry is empty. Suggest foraging, or let Pip find a snack.' };
                    s.inventory[resource]!--;
                    n.food = clamp(n.food + (resource === 'meals' ? B.forEngine(this).care.feedMeal : B.forEngine(this).care.feedBerry), 0, 100);
                    n.joy = clamp(n.joy + B.forEngine(this).care.feedJoy, 0, 100);
                    s.bond = clamp(s.bond + B.forEngine(this).care.feedBond, 0, 100);
                    s.stats.fed++;
                    s.cooldowns.feed = s.simTime + B.forEngine(this).care.feedCooldown;
                    this.xp('player', 3);
                    this.log('You shared ' + (resource === 'meals' ? 'a warm meal' : 'a berry snack') + ' with ' + s.name + '.', 'berries');
                    this.emit('heart', 'For me? Thank you!');
                }
                else if (kind === 'water') {
                    if (s.inventory.water < 1)
                        return { ok: false, reason: 'No water in the pantry. Pip can collect more at the spring.' };
                    s.inventory.water--;
                    n.water = clamp(n.water + B.forEngine(this).care.waterAmount, 0, 100);
                    s.bond = clamp(s.bond + B.forEngine(this).care.waterBond, 0, 100);
                    s.stats.watered++;
                    s.cooldowns.water = s.simTime + B.forEngine(this).care.waterCooldown;
                    this.xp('player', 3);
                    this.log('A cool drink and a little kindness.', 'water');
                    this.emit('heart', 'Just what I needed.');
                }
                else if (kind === 'bond') {
                    if (n.water < B.forEngine(this).care.bondWaterGate || n.food < B.forEngine(this).care.bondFoodGate || n.energy < B.forEngine(this).care.bondEnergyGate) {
                        this.log(s.name + ' would love to play, but needs care first.', 'heart');
                        return { ok: false, reason: s.name + ' needs food, water or rest first. Friendship also means listening.' };
                    }
                    s.stats.bonded++;
                    n.joy = clamp(n.joy + B.forEngine(this).care.bondJoy, 0, 100);
                    s.daily.bonded++;
                    s.bond = clamp(s.bond + (s.daily.bonded <= B.forEngine(this).care.freshBondCount ? 4 : 1), 0, 100);
                    s.cooldowns.bond = s.simTime + B.forEngine(this).care.bondCooldown;
                    if (s.daily.bonded <= B.forEngine(this).care.freshBondCount) {
                        this.xp('player', 4);
                        this.xp('creature', 2);
                    }
                    this.log('You watched the clouds together. Some moments are worth slowing down for.', 'heart');
                    this.emit('heart', 'This is my favorite kind of afternoon.');
                }
                else if (kind === 'praise') {
                    if (s.memory.lastAchievement <= s.memory.lastPraise || s.simTime - s.memory.lastAchievement > B.forEngine(this).care.praiseAge)
                        return { ok: false, reason: 'Praise follows effort. Wait for Pip to gather, build, learn or discover something.' };
                    s.memory.lastPraise = s.memory.lastAchievement;
                    n.joy = clamp(n.joy + B.forEngine(this).care.praiseJoy, 0, 100);
                    s.bond = clamp(s.bond + B.forEngine(this).care.praiseBond, 0, 100);
                    s.cooldowns.praise = s.simTime + B.forEngine(this).care.praiseCooldown;
                    this.xp('player', 2);
                    this.log('You noticed ' + s.name + '’s effort. Being seen feels good.', 'star');
                    this.emit('heart', 'You saw what I did!');
                }
                else
                    return { ok: false, reason: 'Unknown care action.' };
                this.checkWish();
                return { ok: true };
            },
            research(id) {
                const k = owns(SKILLS, id) ? SKILLS[id]! : null, s = this.s;
                if (!k)
                    return { ok: false, reason: 'Unknown lesson.' };
                if (s.researched[id]! || s.skills[id]!)
                    return { ok: false, reason: 'Already researched.' };
                if (s.player.level < k.tier)
                    return { ok: false, reason: 'Reach guide level ' + k.tier + ' to explore this tier.' };
                const missing = k.requires.filter(r => !s.skills[r]!);
                if (missing.length)
                    return { ok: false, reason: 'First teach ' + missing.map(r => SKILLS[r]!.short).join(' and ') + '.' };
                if (s.rp < k.rp)
                    return { ok: false, reason: 'Need ' + k.rp + ' shared research. Explore, practice, or finish a chapter.' };
                const settlement = this.settleEconomy({ id: this.economySettlementId('lesson-research', id), research: -k.rp, playerXp: 2 }, 'Research: ' + k.short);
                if (!settlement.ok)
                    return { ok: false, reason: 'The research cost could not be settled.' };
                s.researched[id]! = true;
                this.log('You researched “' + k.name + '”. The lesson is ready to teach.', 'research');
                return { ok: true };
            },
            teach(id) {
                const s = this.s, k = owns(SKILLS, id) ? SKILLS[id]! : null;
                if (!k)
                    return { ok: false, reason: 'Unknown lesson.' };
                if (s.skills[id]!)
                    return { ok: false, reason: 'Pip already knows this.' };
                if (!s.researched[id]!)
                    return { ok: false, reason: 'Research this lesson first.' };
                if (s.training)
                    return { ok: false, reason: 'One lesson at a time. Let the current lesson settle in.' };
                if (s.player.coins < k.coins)
                    return { ok: false, reason: 'Need ' + k.coins + ' guide coins to buy this training.' };
                const settlement = this.settleEconomy({ id: this.economySettlementId('lesson-buy', id), guide: -k.coins }, 'Lesson: ' + k.short);
                if (!settlement.ok)
                    return { ok: false, reason: 'The lesson cost could not be settled.' };
                s.training = { id, progress: 0 };
                this.log('You bought a ' + k.short + ' lesson. ' + s.name + ' will study when ready.', 'book');
                return { ok: true };
            },
            setAllowance(n) {
                if (!Number.isFinite(n))
                    return;
                this.s.allowance.limit = clamp(Math.round(n), 0, 30);
                this.emit('change', 'Allowance updated.');
            },
            topUp(automatic = false) {
                const s = this.s, a = s.allowance;
                const remaining = Math.max(0, a.limit - a.given), amount = Math.min(remaining, s.player.coins);
                if (amount <= 0)
                    return { ok: false, reason: remaining === 0 ? 'Today’s allowance has already been issued. Lowering a limit does not reclaim coins.' : 'You need guide coins to fund an allowance.' };
                const settlement = this.settleEconomy({ id: this.economySettlementId('allowance'), guide: -amount, pocket: amount }, 'Daily allowance');
                if (!settlement.ok)
                    return { ok: false, reason: 'The allowance could not be settled.' };
                a.given += amount;
                this.log((automatic ? 'New-day allowance: ' : 'You shared ') + amount + ' coins with ' + s.name + '.', 'coin');
                return { ok: true, amount };
            }
        };
        for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(methods))) {
            Object.defineProperty(target, name, { ...descriptor, enumerable: false });
        }
    }
    const api: Api = Object.freeze({ install });
    root.LWEngineCompanion = api;
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
})(globalThis);
