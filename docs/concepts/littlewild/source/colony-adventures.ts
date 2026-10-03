/// <reference path="./balancing-contracts.d.ts" />
/// <reference path="./legacy-task-contracts.d.ts" />
/* Adventure preparation, deterministic quest progression, rewards and invitations. */
(function (inputRoot: unknown) {
    'use strict';
    interface Methods {
        addOffer(questId: string, source: string): void;
        questForecast(q: LWTaskPorts.QuestDefinition, c?: LWTaskPorts.Actor): ReturnType<LWTaskPorts.ColonyHost["questForecast"]>;
        acceptQuest(offerId: string): {
            ok: boolean;
            reason?: string;
        };
        cancelQuestPlan(): {
            ok: boolean;
            reason?: string;
        };
        depart(): boolean;
        abortQuest(): {
            ok: boolean;
            reason?: string;
        };
        discover(q: LWTaskPorts.Quest, template: LWTaskPorts.QuestDefinition): void;
        stepQuest(dt: number): void;
        questRewardSpec(q: LWTaskPorts.Quest, completed: boolean): LWTaskPorts.EconomySpec;
        returnQuest(): boolean;
        updateQuestBoard(): void;
    }
    interface Api {
        install(target: object, predecessor: object, dependencies: LWTaskPorts.ColonyDependencies): void;
    }
    interface Root {
        LWContent: {
            tables: LWTaskPorts.Tables;
        };
        LW?: LWTaskPorts.Tables;
        LWAdventure: LWTaskPorts.Adventure;
        LWRPG: {
            resolve(target: number, dice: number[]): LWTaskPorts.Roll;
        };
        LWPlanner?: {
            paused(host: LWTaskPorts.ColonyHost, key: string): boolean;
        };
        LWColonyAdventures?: Api;
    }
    const root = inputRoot as Root;
    const B = (globalThis as unknown as {LWBalanceRules:LWBalanceRules.Api}).LWBalanceRules;
    function install(target: object, predecessor: object, dependencies: LWTaskPorts.ColonyDependencies): void {
        const A = root.LWAdventure, R = root.LWRPG, copy = A.copy;
        const clamp = (n: number, a: number, b: number): number => Math.max(a, Math.min(b, n));
        const fail = (reason: string) => ({ ok: false, reason }), ok = () => ({ ok: true });
        const { definition, item, profile, arrivalPoint } = dependencies;
        const base = predecessor as LWTaskPorts.ColonyHost;
        const methods: Methods & ThisType<LWTaskPorts.ColonyHost> = {
            addOffer(questId, source) {
                const board = this.s.colony.board, q = A.content.quests.find(q => q.id === questId);
                if (!q || board.offers.some(o => o.questId === questId) || board.offers.length >= 4)
                    return;
                board.offers.push({ id: 'offer' + (++board.sequence), questId, source, created: this.s.simTime, expires: this.s.simTime + A.content.rules.questOfferLife });
            },
            questForecast(this: LWTaskPorts.ColonyHost, q: LWTaskPorts.QuestDefinition, c = this.actor) {
                const travel = Math.min(B.forEngine(this).quest.travelCap, Object.values(c.equipment).reduce((n, id) => n + (definition(id!)?.travel || 0), 0) + this.traitEffects(c).reduce((n, t) => n + t.travel, 0));
                const load = this.load(c);
                const duration = Math.round(q.duration * (1 - travel) * (1 + load.level * B.forEngine(this).quest.loadTimeFactor));
                const checks = q.steps.map(st => ({ ...st, ...this.skillRating(st.skill, c, st.modifier) }));
                let distribution = [1];
                for (const st of checks) {
                    const next = Array(distribution.length + 1).fill(0);
                    distribution.forEach((p, i) => { next[i]! += p * (1 - st.chance); next[i + 1]! += p * st.chance; });
                    distribution = next;
                }
                const required = Math.ceil(checks.length * B.forEngine(this).quest.requiredFraction);
                return { duration, travel, load, checks, required, chance: distribution.slice(required).reduce((a, b) => a + b, 0), energy: q.energy, missing: Object.entries(q.cost).filter(([id, n]) => (c.inventory[id]! || 0) < n).map(([id, n]) => ({ id, need: n, carried: c.inventory[id]! || 0, stored: this.s.colony.warehouse.inventory[id]! || 0 })) };
            },
            acceptQuest(offerId) {
                if (this.actor.questPlan || this.actor.activeQuest)
                    return fail('This creature already has an adventure planned.');
                const offer = this.s.colony.board.offers.find(o => o.id === offerId);
                if (!offer || offer.expires <= this.s.simTime)
                    return fail('That invitation is no longer available.');
                const q = A.content.quests.find(q => q.id === offer.questId)!;
                if (this.s.player.level < q.tier)
                    return fail('Reach guide level ' + q.tier + ' first.');
                this.actor.questPlan = { questId: q.id, accepted: this.s.simTime, source: offer.source };
                this.s.colony.board.offers = this.s.colony.board.offers.filter(o => o.id !== offerId);
                this.log(this.s.name + ' is preparing for ' + q.name + '. No supplies are spent until departure.', 'compass');
                return ok();
            },
            cancelQuestPlan() {
                if (!this.actor.questPlan)
                    return fail('No preparations to cancel.');
                this.actor.questPlan = null;
                return ok();
            },
            depart() {
                const c = this.actor, q = A.content.quests.find(q => q.id === c.questPlan?.questId);
                if (!q)
                    return false;
                const forecast = this.questForecast(q);
                if (c.equipQueue.length || forecast.missing.length || this.s.needs.energy < q.energy + B.forEngine(this).quest.energyReserve || forecast.load.overloaded)
                    return false;
                for (const [id, n] of Object.entries(q.cost))
                    this.s.inventory[id]! -= n;
                c.activeQuest = { questId: q.id, name: q.name, status: 'exploring', elapsed: 0, duration: forecast.duration, checkIndex: 0, checks: copy(forecast.checks), required: forecast.required, successes: 0, rolls: [], found: {}, energy: q.energy, energySpent: 0, coins: q.coins, research: q.research, started: this.s.simTime, returnRemaining: 0, aborted: false, outcome: null };
                c.questPlan = null;
                this.s.task = null;
                this.visual('depart');
                this.log(c.name + ' left for ' + q.name + '. Personal provisions packed; no interaction while away.', 'compass');
                return true;
            },
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
            },
            discover(q, template) {
                const pool = template.loot.filter(row => !q.found[row.item]! && this.random() <= row.chance);
                if (!pool.length)
                    return;
                const row = pool[Math.floor(this.random() * pool.length)]!, count = row.min + Math.floor(this.random() * (row.max - row.min + 1));
                const room = Math.max(0, Math.floor((this.load().maximumKg * 1000 - this.load().grams) / item(row.item).weight)), take = Math.min(room, count);
                if (take) {
                    this.s.inventory[row.item]! = (this.s.inventory[row.item]! || 0) + take;
                    q.found[row.item]! = (q.found[row.item]! || 0) + take;
                }
            },
            stepQuest(dt) {
                const c = this.actor, q = c.activeQuest!;
                if (q.status === 'returning') {
                    q.returnRemaining -= dt;
                    if (q.returnRemaining <= 0)
                        this.returnQuest();
                    return;
                }
                const template = A.content.quests.find(x => x.id === q.questId)!;
                q.elapsed = Math.min(q.duration, q.elapsed + dt);
                const expenditure = Math.min(q.energy, q.energy * q.elapsed / q.duration);
                this.s.needs.energy = clamp(this.s.needs.energy - (expenditure - q.energySpent), 0, 100);
                q.energySpent = expenditure;
                this.s.needs.food = clamp(this.s.needs.food - dt * B.forEngine(this).quest.foodRate, 0, 100);
                this.s.needs.water = clamp(this.s.needs.water - dt * B.forEngine(this).quest.waterRate, 0, 100);
                while (q.checkIndex < q.checks.length && q.elapsed >= q.duration * (q.checkIndex + 1) / (q.checks.length + 1)) {
                    const step = q.checks[q.checkIndex++]!, dice = Array.from({ length: 3 }, () => 1 + Math.floor(this.random() * 6));
                    const r = { ...R.resolve(step.target, dice), skill: step.skill, label: step.name, base: step.base, modifiers: copy(step.modifiers), time: this.s.simTime, actorId: c.id };
                    q.rolls.push(r);
                    c.rpg.rolls.unshift(r);
                    c.rpg.rolls = c.rpg.rolls.slice(0, 60);
                    c.lastRoll = r;
                    if (r.success) {
                        q.successes++;
                        this.discover(q, template);
                    }
                    if (c.skills[step.skill]!)
                        this.practiceSkill(step.skill);
                    this.emit('quest-check', c.name + ': ' + step.name + ' · ' + r.outcome, { roll: r });
                }
                if (q.elapsed >= q.duration) {
                    q.outcome = q.successes >= q.required ? 'Completed' : 'A partial discovery';
                    q.status = 'returning';
                    q.returnRemaining = A.content.rules.returnSeconds;
                }
            },
            questRewardSpec(q, completed) {
                const id = 'adventure:' + this.actor.id + ':' + q.questId + ':' + Math.round(q.started * 1000);
                if (!completed)
                    return { id, actorXp: q.aborted ? B.forEngine(this).quest.abortedActorXp : B.forEngine(this).quest.partialActorXp };
                const income = this.economyRuntime().splitIncome(q.coins);
                return { id, ...income, research: q.research, playerXp: B.forEngine(this).quest.playerXp, actorXp: B.forEngine(this).quest.actorXp };
            },
            returnQuest() {
                const c = this.actor, q = c.activeQuest!;
                if (!q)
                    return false; // A return is settled only once.
                const completed = !q.aborted && q.successes >= q.required;
                const settlement = this.settleEconomy(this.questRewardSpec(q, completed), completed ? 'Adventure: ' + q.name : null);
                if (!settlement.ok)
                    return false;
                if (completed)
                    this.changeFeeling('I completed ' + q.name, 10, -9);
                else
                    this.changeFeeling(q.aborted ? 'Back home after a recall' : 'We learned from a difficult adventure', q.aborted ? 0 : -4, q.aborted ? 0 : 7);
                const report = { ...copy(q), finished: this.s.simTime, delivered: false, reward: completed ? q.coins : 0, researchReward: completed ? q.research : 0, prestigeReward: Math.max(0, settlement.deltas?.prestige || 0) };
                c.questHistory.unshift(report);
                c.questHistory = c.questHistory.slice(0, 15);
                c.activeQuest = null;
                c.needsDeposit = true;
                const arrival = arrivalPoint(c.archetype, c.personality);
                c.creature.x = arrival.x;
                c.creature.y = arrival.y;
                c.task = null;
                this.log(c.name + ' returned: ' + q.outcome + '. Finds remain in the satchel until the warehouse visit.', 'compass');
                this.emit('return', c.name + ' is home. First, a visit to the warehouse.');
                return true;
            },
            updateQuestBoard() {
                const s = this.s;
                const board = s.colony.board;
                board.offers = board.offers.filter(o => o.expires > s.simTime);
                if (s.simTime >= board.nextAt) {
                    board.nextAt = s.simTime + A.content.rules.questCooldown;
                    const draw = this.random('world');
                    if (draw < A.content.rules.eventChance || board.misses >= B.forEngine(this).quest.guaranteedAfterMisses) {
                        const available = A.content.quests.filter(q => q.tier <= s.player.level && !board.offers.some(o => o.questId === q.id));
                        if (available.length) {
                            const q = available[Math.floor(this.random('world') * available.length)]!;
                            this.addOffer(q.id, ['A letter from a neighbor', 'A strange glimmer beyond the gate', 'Fresh footprints on the trail'][Math.floor(this.random('world') * 3)]!);
                            board.misses = 0;
                            this.emit('notice', 'A new invitation arrived at the adventure board.');
                        }
                    }
                    else
                        board.misses++;
                }
            },
        };
        for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(methods))) {
            Object.defineProperty(target, name, { ...descriptor, enumerable: false });
        }
    }
    const api: Api = Object.freeze({ install });
    root.LWColonyAdventures = api;
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
})(globalThis);
