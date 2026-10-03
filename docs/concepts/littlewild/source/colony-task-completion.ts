/// <reference path="./legacy-task-contracts.d.ts" />
/* Actor task completion: transfers, equipment, social outcomes and skill checks. */
(function (inputRoot: unknown) {
    'use strict';
    interface Host extends LWTaskPorts.ColonyHost {
        at(target: LWTaskPorts.Point): boolean;
        recordTransfer(direction: string, goods: LWTaskPorts.Numbers): void;
    }
    interface Methods {
        finishTask(t: LWTaskPorts.Task): void;
    }
    interface Root {
        LW: LWTaskPorts.Tables;
        LWAdventure: LWTaskPorts.Adventure;
        LWColonyTaskCompletion?: Api;
    }
    interface Api {
        install(target: object, predecessor: object, dependencies: LWTaskPorts.ColonyDependencies): void;
    }
    const root = inputRoot as Root;
    function install(target: object, predecessor: object, dependencies: LWTaskPorts.ColonyDependencies): void {
        const { RECIPES } = root.LW;
        const A = root.LWAdventure;
        const clamp = (n: number, a: number, b: number): number => Math.max(a, Math.min(b, n));
        const { definition, item, profile, arrivalPoint } = dependencies;
        const base = predecessor as Host;
        const methods: Methods & ThisType<Host> = {
            finishTask(t) {
                const c = this.actor, s = this.s, inv = s.inventory, w = s.colony.warehouse.inventory;
                if (t.kind === 'withdraw') {
                    if (this.at(this.warehouse())) {
                        const room = Math.max(0, Math.floor((this.load().maximumKg * 1000 - this.load().grams) / item(t.resource!).weight));
                        const n = Math.min(t.amount!, w[t.resource!]! || 0, room);
                        if (n > 0) {
                            w[t.resource!]! -= n;
                            inv[t.resource!]! = (inv[t.resource!]! || 0) + n;
                            this.recordTransfer('out', { [t.resource!]: n });
                        }
                    }
                    s.task = null;
                    return;
                }
                if (t.kind === 'deposit') {
                    if (this.at(this.warehouse())) {
                        const goods = this.surplus();
                        for (const [id, n] of Object.entries(goods)) {
                            inv[id]! -= n;
                            w[id]! = (w[id]! || 0) + n;
                        }
                        if (Object.keys(goods).length)
                            this.recordTransfer('in', goods);
                        if (c.needsDeposit && c.questHistory[0]!)
                            c.questHistory[0]!.delivered = true;
                        c.needsDeposit = false;
                    }
                    s.task = null;
                    return;
                }
                if (t.kind === 'salvage') {
                    const cache = c.salvage[0]!;
                    if (cache && this.at(cache)) {
                        for (const [id, n] of Object.entries(cache.items))
                            inv[id]! = (inv[id]! || 0) + n;
                        c.salvage.shift();
                    }
                    s.task = null;
                    return;
                }
                if (t.kind === 'equip') {
                    const g = definition(t.itemId!);
                    if (g && inv[g.id]! > 0) {
                        c.equipment[g.slot]! = g.id;
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
                        this.s.colony.relationships[[c.id, other.id].sort().join('|')]! = relationship;
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
                        const chest = A.content.chest || A.defaultContent.chest, options = chest.equipmentPool.map(definition), g = options[Math.floor(this.random() * options.length)]!;
                        inv[g.id]! = (inv[g.id]! || 0) + 1;
                        for (const [id, n] of Object.entries(chest.supplies))
                            inv[id]! = (inv[id]! || 0) + n;
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
                            const recipe = definition(t.resource!)?.recipe || RECIPES[t.resource!]!, first = Object.keys(recipe.cost).find(id => inv[id]! > 0);
                            if (first)
                                inv[first]!--;
                        }
                        this.log(s.name + ' rolled ' + r.total + ' against ' + r.target + ': ' + (r.critical ? 'a critical setback' : 'a setback') + '. Work can be tried again.', 'leaf');
                        s.task = null;
                        return;
                    }
                    if (r.critical)
                        this.changeFeeling('A small breakthrough', 6, -5);
                }
                if (t.kind === 'gearcraft') {
                    const g = definition(t.resource!)!;
                    if (Object.entries(g.recipe.cost).every(([id, n]) => inv[id]! >= n)) {
                        for (const [id, n] of Object.entries(g.recipe.cost))
                            inv[id]! -= n;
                        inv[g.id]! = (inv[g.id]! || 0) + 1;
                        this.practiceSkill(g.recipe.skill);
                        this.xp('creature', 7);
                        this.xp('player', 3);
                        this.log(s.name + ' made ' + g.name + '.', 'bench');
                    }
                    s.task = null;
                    return;
                }
                const trainingId = s.training?.id;
                base.finishTask.call(this, t);
                if (t.kind === 'train' && trainingId && s.skills[trainingId]!)
                    c.rpg.points[trainingId]! ??= 1;
                if (t.kind === 'rest')
                    this.changeFeeling('A good rest', 0, -12);
            },
        };
        for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(methods))) {
            Object.defineProperty(target, name, { ...descriptor, enumerable: false });
        }
    }
    const api: Api = Object.freeze({ install });
    root.LWColonyTaskCompletion = api;
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
})(globalThis);
