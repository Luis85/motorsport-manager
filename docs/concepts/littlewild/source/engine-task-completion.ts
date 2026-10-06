/// <reference path="./balancing-contracts.d.ts" />
/// <reference path="./legacy-task-contracts.d.ts" />
/* Authorized base-task completion consequences; ECS settlement owns balances. */
(function (inputRoot: unknown) {
    'use strict';
    interface Methods {
        finishTask(t: LWTaskPorts.Task): void;
    }
    interface Api {
        install(target: object): void;
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
        LWEngineTaskCompletion?: Api;
    }
    const root = inputRoot as Root;
 const B = (typeof module!=='undefined'&&module.exports?require('./balancing-rules.js'):(globalThis as unknown as {LWBalanceRules:LWBalanceRules.Api}).LWBalanceRules) as LWBalanceRules.Api;
    function install(target: object): void {
        const { RES, SKILLS, BUILDINGS, RECIPES, CONTRACTS } = root.LWContent.tables;
        const clamp = (n: number, a: number, b: number): number => Math.max(a, Math.min(b, n));
        const methods: Methods & ThisType<LWTaskPorts.BaseHost> = {
            finishTask(t) {
                const s = this.s, n = s.needs, o = s.orders.find(o => o.id === t.orderId), usedSkill = this.taskSkill(t);
                let achievement = false;
                if (t.kind === 'gather') {
                    const node = t.nodeId === 'garden' ? s.buildings.find(b => b.kind === 'garden') : s.nodes.find(n => n.id === t.nodeId);
                    let amount = t.resource! === 'water' ? 3 : Math.min(t.resource! === 'stone' ? 2 : 3, node?.stock ?? 0);
                    if (o?.type === 'gather' && o.resource === t.resource!)
                        amount = Math.min(amount, o.amount - o.done);
                    if (amount <= 0) {
                        s.task = null;
                        return;
                    }
                    s.inventory[t.resource!]! += amount;
                    if (node && t.resource! !== 'water') {
                        node.stock = Math.max(0, node.stock - amount);
                    }
                    s.stats.gathered += amount;
                    if (o?.type === 'gather' && o.resource === t.resource!)
                        o.done += amount;
                    this.xp('creature', B.forEngine(this).completion.gatherActorXp);
                    this.xp('player', B.forEngine(this).completion.gatherPlayerXp);
                    if (Math.floor((s.stats.gathered - amount) / B.forEngine(this).completion.gatherResearchEvery) !== Math.floor(s.stats.gathered / B.forEngine(this).completion.gatherResearchEvery))
                        this.researchGain(1);
                    this.log(s.name + ' gathered ' + amount + ' ' + RES[t.resource!]!.name.toLowerCase() + '.', t.resource!);
                    achievement = true;
                }
                else if (t.kind === 'craft') {
                    const r = RECIPES[t.resource!]!;
                    if (Object.entries(r.cost).every(([k, v]) => s.inventory[k]! >= v)) {
                        for (const [k, v] of Object.entries(r.cost))
                            s.inventory[k]! -= v;
                        s.inventory[t.resource!]! += r.amount;
                        if (t.resource! === 'planks')
                            s.stats.planksMade += r.amount;
                        if (o?.type === 'craft' && o.resource === t.resource!)
                            o.done += r.amount;
                        this.xp('creature', B.forEngine(this).completion.craftActorXp);
                        this.xp('player', B.forEngine(this).completion.craftPlayerXp);
                        this.log(s.name + ' made ' + r.amount + ' ' + RES[t.resource!]!.name.toLowerCase() + '.', 'planks');
                        achievement = true;
                    }
                }
                else if (t.kind === 'build' && o) {
                    if (!o.paid)
                        return;
                    s.buildings.push({ id: 'b' + s.nextId++, kind: o.kind, x: o.x, y: o.y, stock: o.kind === 'garden' ? 4 : 0, regen: 0 });
                    s.orders = s.orders.filter(a => a.id !== o.id);
                    s.stats.built++;
                    this.remember('build-' + o.kind, 'Our ' + BUILDINGS[o.kind]!.name.toLowerCase(), 'An idea became somewhere to belong.', BUILDINGS[o.kind]!.icon);
                    this.xp('creature', B.forEngine(this).completion.buildActorXp);
                    this.xp('player', B.forEngine(this).completion.buildPlayerXp);
                    this.researchGain(2);
                    s.bond = clamp(s.bond + B.forEngine(this).completion.buildBond, 0, 100);
                    n.joy = clamp(n.joy + B.forEngine(this).completion.buildJoy, 0, 100);
                    this.log('Our ' + BUILDINGS[o.kind]!.name.toLowerCase() + ' is finished. Look what we made together.', 'home');
                    this.emit('celebrate', BUILDINGS[o.kind]!.name + ' completed!');
                    achievement = true;
                }
                else if (t.kind === 'train' && s.training) {
                    const id = s.training.id;
                    s.skills[id]! = true;
                    s.training = null;
                    s.stats.trained++;
                    this.remember('learn-' + id, 'I learned ' + SKILLS[id]!.short, 'You believed I could. Now I can.', 'book');
                    this.xp('creature', B.forEngine(this).completion.trainActorXp);
                    this.xp('player', B.forEngine(this).completion.trainPlayerXp);
                    s.bond = clamp(s.bond + B.forEngine(this).completion.trainBond, 0, 100);
                    n.joy = clamp(n.joy + B.forEngine(this).completion.trainJoy, 0, 100);
                    this.log(s.name + ' learned ' + SKILLS[id]!.short + '. A new possibility unlocked.', 'book');
                    this.emit('celebrate', 'New skill: ' + SKILLS[id]!.short);
                    achievement = true;
                }
                else if (t.kind === 'eat') {
                    const r = s.inventory.meals ? 'meals' : s.inventory.berries ? 'berries' : s.inventory.meat ? 'meat' : null;
                    if (r) {
                        s.inventory[r]!--;
                        n.food = clamp(n.food + (r === 'meals' ? B.forEngine(this).completion.mealFood : r === 'meat' ? B.forEngine(this).completion.meatFood : B.forEngine(this).completion.berryFood), 0, 100);
                        this.log(s.name + ' chose to stop for a snack.', 'berries');
                    }
                }
                else if (t.kind === 'drink') {
                    if (s.inventory.water) {
                        s.inventory.water--;
                        n.water = clamp(n.water + B.forEngine(this).completion.drinkWater, 0, 100);
                    }
                }
                else if (t.kind === 'rest') {
                    const b = this.has('cottage') ? 'cottage' : this.has('shelter') ? 'shelter' : null;
                    n.energy = clamp(n.energy + (b === 'cottage' ? B.forEngine(this).completion.cottageEnergy : b ? B.forEngine(this).completion.shelterEnergy : B.forEngine(this).completion.outsideEnergy), 0, 100);
                    n.comfort = clamp(n.comfort + (b ? B.forEngine(this).completion.shelterComfort : B.forEngine(this).completion.outsideComfort), 0, 100);
                }
                else if (t.kind === 'warm') {
                    n.comfort = clamp(n.comfort + B.forEngine(this).completion.warmComfort, 0, 100);
                    n.joy = clamp(n.joy + B.forEngine(this).completion.warmJoy, 0, 100);
                }
                else if (t.kind === 'play') {
                    n.joy = clamp(n.joy + B.forEngine(this).completion.playJoy, 0, 100);
                    n.energy = clamp(n.energy - B.forEngine(this).completion.playEnergy, 0, 100);
                }
                else if (t.kind === 'explore') {
                    const settlement = this.settleEconomy({ id: this.economySettlementId('explore'), guide: B.forEngine(this).completion.exploreGuideCoins, pocket: B.forEngine(this).completion.explorePocketCoins, research: B.forEngine(this).completion.exploreResearch, actorXp: B.forEngine(this).completion.exploreActorXp, playerXp: B.forEngine(this).completion.explorePlayerXp, stats: { explored: 1 } }, 'Helped a traveler');
                    if (!settlement.ok) {
                        s.task = null;
                        return;
                    }
                    s.cooldowns.explore = s.simTime + B.forEngine(this).completion.exploreCooldown;
                    this.log(s.name + ' discovered a trail marker and helped a traveler. +6 guide coins, +2 pocket coins, +2 research.', 'compass');
                    if (o)
                        o.done = 1;
                    achievement = true;
                }
                else if (t.kind === 'hunt') {
                    s.inventory.meat += 2;
                    s.inventory.fiber++;
                    n.energy = clamp(n.energy - B.forEngine(this).completion.huntEnergy, 0, 100);
                    this.xp('creature', B.forEngine(this).completion.huntActorXp);
                    this.xp('player', B.forEngine(this).completion.craftPlayerXp);
                    this.log(s.name + ' returned from a woodland hunt with 2 provisions and 1 fiber.', 'paw');
                    if (o?.type === 'hunt')
                        o.done = 1;
                    achievement = true;
                }
                else if (t.kind === 'shop') {
                    const cost = RES[t.resource!]!.price * t.amount!;
                    if (s.creature.coins >= cost) {
                        const settlement = this.settleEconomy({ id: this.economySettlementId('shop'), pocket: -cost }, s.name + ' bought ' + t.amount! + ' ' + RES[t.resource!]!.name.toLowerCase());
                        if (!settlement.ok) {
                            s.task = null;
                            return;
                        }
                        s.inventory[t.resource!]! += t.amount!;
                        this.remember('first-shop', 'My very own choice', 'I bought what I needed with my pocket money.', 'market');
                        this.log(s.name + ' chose to buy ' + t.amount! + ' ' + RES[t.resource!]!.name.toLowerCase() + ' with ' + cost + ' pocket coins.', 'market');
                        this.xp('creature', B.forEngine(this).completion.shopActorXp);
                    }
                }
                else if (t.kind === 'deliver' && o) {
                    const contract = CONTRACTS[o.contract]!;
                    if (Object.entries(contract.cost).every(([r, q]) => s.inventory[r]! >= q)) {
                        const income = this.economyRuntime().splitIncome(contract.coins);
                        const settlement = this.settleEconomy({ id: this.economySettlementId('delivery'), ...income, research: contract.rp, actorXp: B.forEngine(this).completion.deliverActorXp, playerXp: B.forEngine(this).completion.deliverPlayerXp, stats: { earned: contract.coins, deliveries: 1 } }, 'Shared trade income');
                        if (!settlement.ok) {
                            s.task = null;
                            return;
                        }
                        for (const [r, q] of Object.entries(contract.cost))
                            s.inventory[r]! -= q;
                        s.contractIndex++;
                        o.done = 1;
                        s.bond = clamp(s.bond + B.forEngine(this).completion.trainBond, 0, 100);
                        this.log('A grateful neighbor paid ' + contract.coins + ' coins, shared between you and ' + s.name + '.', 'coin');
                        achievement = true;
                    }
                }
                else if (t.kind === 'research') {
                    const settlement = this.settleEconomy({ id: this.economySettlementId('experiment'), research: B.forEngine(this).completion.exploreResearch, actorXp: 5, playerXp: 2 }, 'Shared discovery');
                    if (!settlement.ok) {
                        s.task = null;
                        return;
                    }
                    s.cooldowns.research = s.simTime + B.forEngine(this).completion.researchCooldown;
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
            },
        };
        for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(methods))) {
            Object.defineProperty(target, name, { ...descriptor, enumerable: false });
        }
    }
    const api: Api = Object.freeze({ install });
    root.LWEngineTaskCompletion = api;
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
})(globalThis);
