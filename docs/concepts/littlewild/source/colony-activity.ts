/// <reference path="./balancing-contracts.d.ts" />
/// <reference path="./legacy-task-contracts.d.ts" />
/* Actor decisions, social task pairing and ECS activity orchestration. */
(function (inputRoot: unknown) {
    'use strict';
    interface Methods {
        relationship(a: string, b: string): LWTaskPorts.Relationship;
        suggestSocial(otherId: string): {
            ok: boolean;
            reason?: string;
        };
        socialTask(): LWTaskPorts.Draft | null;
        handlers(): Record<string, () => string>;
        decide(): void;
        startTask(t: LWTaskPorts.Draft | null): boolean;
        workRate(t: LWTaskPorts.Task): number;
        taskSkill(t: LWTaskPorts.Task): string | undefined;
        stepActor(dt: number): void;
        releaseSocial(task: LWTaskPorts.Task | null): void;
        decisionSummary(): LWTaskPorts.Summary;
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
        LWColonyActivity?: Api;
    }
    const root = inputRoot as Root;
    const B = (typeof module!=='undefined'&&module.exports?require('./balancing-rules.js'):(globalThis as unknown as {LWBalanceRules:LWBalanceRules.Api}).LWBalanceRules) as LWBalanceRules.Api;
    function install(target: object, predecessor: object, dependencies: LWTaskPorts.ColonyDependencies): void {
        const { RES, SKILLS, STYLES } = root.LW!;
        const A = root.LWAdventure, R = root.LWRPG;
        const clamp = (n: number, a: number, b: number): number => Math.max(a, Math.min(b, n));
        const fail = (reason: string) => ({ ok: false, reason }), ok = () => ({ ok: true });
        const invCount = (c: LWTaskPorts.Actor, id: string): number => c.inventory[id]! || 0;
        const { definition, item, profile, arrivalPoint } = dependencies;
        const base = predecessor as LWTaskPorts.ColonyHost;
        const methods: Methods & ThisType<LWTaskPorts.ColonyHost> = {
            relationship(a, b) { const key = [a, b].sort().join('|'); return this.s.colony.relationships[key]! || { a: [a, b].sort()[0]!, b: [a, b].sort()[1]!, affinity: 0, trust: 0, meetings: 0, lastTime: -100, memories: [] }; },
            suggestSocial(otherId) {
                const other = this.creatures.find(c => c.id === otherId);
                if (!other || other === this.actor)
                    return fail('Choose another creature.');
                if (other.activeQuest)
                    return fail(other.name + ' is away.');
                this.actor.socialIntent = otherId;
                return ok();
            },
            socialTask() {
                const c = this.actor;
                let others = this.creatures.filter(o => o !== c && !o.activeQuest && !o.task && o.needs.food > B.forEngine(this).autonomy.socialFood && o.needs.water > B.forEngine(this).autonomy.socialWater && o.needs.energy > B.forEngine(this).autonomy.socialEnergy && this.s.simTime - o.feelings.lastSocial > B.forEngine(this).autonomy.socialCooldown);
                if (c.socialIntent)
                    others = others.filter(o => o.id === c.socialIntent);
                const other = others.sort((a, b) => this.relationship(c.id, b.id).affinity - this.relationship(c.id, a.id).affinity)[0]!;
                if (!other)
                    return null;
                return { kind: 'social', otherId: other.id, target: { x: Math.round(other.creature.x), y: Math.round(other.creature.y) }, duration: B.forEngine(this).autonomy.socialDuration, label: 'Spending time with ' + other.name, reason: 'We can get to know each other without our guide directing every step.', thought: 'There is room for another friend.' };
            },
            handlers() {
                const start = (t: LWTaskPorts.Draft | null): string => t && this.startTask(t) ? 'running' : 'failure';
                return {
                    essential: () => {
                        const n = this.s.needs;
                        for (const k of ['water', 'food', 'energy'].filter(k => n[k]! < (k === 'energy' ? B.forEngine(this).autonomy.urgentEnergy : B.forEngine(this).autonomy.urgentNeed)).sort((a, b) => n[a]! - n[b]!)) {
                            const r = start(this.needTask(k));
                            if (r !== 'failure')
                                return r;
                        }
                        return 'failure';
                    },
                    homecoming: () => this.actor.needsDeposit ? start(this.depositTask('Bringing expedition finds home')) : 'failure',
                    overburdened: () => this.load().level >= 2 ? start(this.depositTask('Lightening a heavy satchel')) : 'failure',
                    feelings: () => {
                        if (this.actor.feelings.coolingUntil > this.s.simTime || this.actor.feelings.anger >= B.forEngine(this).autonomy.coolAnger)
                            return start({ kind: 'calmdown', target: { x: 8, y: 10 }, duration: B.forEngine(this).autonomy.coolDuration, label: 'Taking a little breathing space', reason: 'My temper is running high. A quiet pause helps me settle.', thought: 'A little space. Then I can try again.' });
                        return 'failure';
                    },
                    comfort: () => {
                        const n = this.s.needs;
                        for (const k of Object.keys(n).filter(k => n[k]! < (k === 'energy' ? B.forEngine(this).autonomy.comfortEnergy : k === 'comfort' ? B.forEngine(this).autonomy.comfortComfort : B.forEngine(this).autonomy.comfortNeed) + (this.s.focus === 'cozy' ? B.forEngine(this).autonomy.cozyBonus : 0)).sort((a, b) => n[a]! - n[b]!)) {
                            const r = start(this.needTask(k));
                            if (r !== 'failure')
                                return r;
                        }
                        return 'failure';
                    },
                    outfit: () => {
                        const id = this.actor.equipQueue[0]!;
                        if (!id)
                            return 'failure';
                        if (this.s.inventory[id]! > 0)
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
                            if ((this.s.inventory[r]! || 0) < n)
                                return start(this.resourceTask(r, null, false, n));
                        if (this.s.needs.energy < q.energy + B.forEngine(this).quest.energyReserve)
                            return start(this.needTask('energy'));
                        if (this.depart())
                            return 'running';
                        return 'failure';
                    },
                    learning: () => {
                        const s = this.s, l = s.learning;
                        if (!s.training && l.queue.length)
                            s.training = l.queue.shift()!;
                        if (l.paused)
                            return 'failure';
                        if (l.recovering)
                            return start({ kind: 'reflect', target: s.buildings.find(b => b.kind === 'circle') || { x: 8, y: 10 }, duration: 10, label: 'Letting a lesson settle', reason: 'A learning break restores my focus.', thought: 'I am putting the pieces together.' });
                        if (s.training) {
                            const k = SKILLS[s.training.id]!;
                            return start({ kind: 'train', skillId: s.training.id, style: s.training.style, target: s.buildings.find(b => b.kind === 'circle') || { x: 8, y: 10 }, duration: k.time, elapsed: s.training.progress, label: 'Learning ' + k.short.toLowerCase(), reason: STYLES[s.training.style!]!.name + '. A 3d6 check resolves my understanding.', thought: 'Watch, try, reflect. I can learn this.' });
                        }
                        return 'failure';
                    },
                    plans: () => {
                        if (this.actor.salvage.length) {
                            const s = this.actor.salvage[0]!;
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
                            const total = (this.s.inventory[id]! || 0) + (this.s.colony.warehouse.inventory[id]! || 0);
                            if (total < (this.s.stockTargets[id]! || 0) && !this.assessResource(id, this.s.stockTargets[id]!)) {
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
            },
            decide() {
                if (this.actor.activeQuest)
                    return;
                const result = this.behaviorTree.tick(A.content.behaviorTree, { time: this.s.simTime, behaviorMemory: this.actor.behavior.memory });
                this.actor.behavior.trace = result.trace;
                this.actor.behavior.lastAction = this.s.task?.label || (this.actor.activeQuest ? 'Beyond the glade' : 'Considering my next step');
            },
            startTask(t) {
                if (!t || this.actor?.activeQuest)
                    return false;
                const r = base.startTask.call(this, t);
                if (r && t.kind === 'social') {
                    const other = this.creatures.find(c => c.id === t.otherId);
                    if (!other || other.activeQuest || other.task) {
                        this.s.task = null;
                        return false;
                    }
                    other.task = { kind: 'socialwait', partner: this.actor.id, path: [], phase: 'work', elapsed: 0, duration: 24, label: 'Making time for ' + this.s.name, reason: 'A friend is on their way.', thought: 'We can share a quiet moment.', target: { x: other.creature.x, y: other.creature.y } };
                }
                return r;
            },
            workRate(t) { const p = profile(this.actor.personality).preferences; const preference = t.kind === 'train' || t.kind === 'practice' ? p.train : t.kind === 'build' ? p.build : 1; return base.workRate.call(this, t) * (this.actor?.feelings?.anger >= 60 ? .85 : 1) * (1 + (preference - 1) * .15) * (this.s.focus === 'builder' && t.kind === 'build' ? 1.1 : 1); },
            taskSkill(t) {
                if (t.kind === 'train' || t.kind === 'practice')
                    return t.skillId;
                if (t.kind === 'gearcraft')
                    return definition(t.resource!)?.recipe.skill;
                if (t.kind === 'gather')
                    return base.taskSkill.call(this, t) || 'Per';
                if (t.kind === 'explore')
                    return 'Per';
                return base.taskSkill.call(this, t);
            },
            stepActor(dt) {
                const s = this.s, c = this.actor, n = s.needs, f = c.feelings, t = s.task;
                // The ECS owns deterministic physiology, learning fatigue and baseline social
                // recovery. Task and incident handlers consume those component values.
                const { studying } = this.ecs.step(c, dt, {
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
                    if (c.unpackIntent && !root.LWPlanner?.paused(this, 'unpack:' + c.id)) {
                        if (n.food >= 20 && n.water >= 20 && n.energy >= 15) {
                            if (invCount(c, 'wooden_chest')) {
                                c.unpackIntent = false;
                                this.startTask({ kind: 'unpack', target: this.warehouse(), duration: 4, label: 'Opening a woodland chest', reason: 'A safe place to unpack an unexpected find.', thought: 'What could be tucked inside?' });
                                return;
                            }
                            if (this.s.colony.warehouse.inventory.wooden_chest! > 0) {
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
                if (['water', 'food', 'energy'].some(k => n[k]! < (k === 'energy' ? 10 : 12)) && !task.need && !['eat', 'eatbread', 'drink', 'rest'].includes(task.kind)) {
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
                        if (!Object.entries(cost).every(([id, n]) => (s.inventory[id]! || 0) >= n)) {
                            s.task = null;
                            return;
                        }
                        for (const [id, n] of Object.entries(cost))
                            s.inventory[id]! -= n;
                        o.paid = true;
                    }
                }
                const outcome = this.ecs.advanceActivity(c, dt, {
                    walkable: (x, y) => this.walkable(x, y),
                    moveRate: this.movementRate(c),
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
                    if (o)
                        o.progress = Math.min(task.duration, task.elapsed);
                }
                if (task.kind === 'train' && s.training)
                    s.training.progress = Math.min(task.duration, task.elapsed);
                if (task.kind === 'practice') {
                    const o = s.orders.find(o => o.id === task.orderId);
                    if (o)
                        o.progress = Math.min(task.duration, task.elapsed);
                }
                if (outcome.completed)
                    this.finishTask(task);
            },
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
            },
            decisionSummary() {
                const base = (predecessor as {
                    decisionSummary(this: LWTaskPorts.ColonyHost): LWTaskPorts.Summary;
                }).decisionSummary.call(this);
                if (this.actor.activeQuest)
                    return { source: 'An independent adventure', text: 'Beyond the glade' };
                return { ...base, trace: this.actor.behavior.trace };
            },
        };
        for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(methods))) {
            Object.defineProperty(target, name, { ...descriptor, enumerable: false });
        }
    }
    const api: Api = Object.freeze({ install });
    root.LWColonyActivity = api;
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
})(globalThis);
