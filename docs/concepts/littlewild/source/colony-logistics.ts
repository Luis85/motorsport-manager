/// <reference path="./balancing-contracts.d.ts" />
/// <reference path="./legacy-task-contracts.d.ts" />
/* Personal inventory, equipment and physical warehouse supply commands. */
(function (inputRoot: unknown) {
    'use strict';
 const B = (typeof module!=='undefined'&&module.exports?require('./balancing-rules.js'):(globalThis as unknown as {LWBalanceRules:LWBalanceRules.Api}).LWBalanceRules) as LWBalanceRules.Api;
    interface Host extends LWTaskPorts.ColonyHost {
        depositKeep(c?: LWTaskPorts.Actor): LWTaskPorts.Numbers;
        depositTask(reason?: string, all?: boolean): LWTaskPorts.Draft | null;
        recordTransfer(direction: string, goods: LWTaskPorts.Numbers): void;
        resourceTask(resource: string, orderId?: string | null, force?: boolean, quantity?: number, visited?: string[]): LWTaskPorts.Draft | null;
        refundPreview(o: LWTaskPorts.Order): LWTaskPorts.Numbers;
        sellItem(id: string, qty?: number): {
            ok: boolean;
            reason?: string;
            amount?: number;
        };
        cancel(id: string): unknown;
    }
    interface Methods {
        depositKeep(c?: LWTaskPorts.Actor): LWTaskPorts.Numbers;
        surplus(c?: LWTaskPorts.Actor): LWTaskPorts.Numbers;
        depositTask(reason?: string, all?: boolean): LWTaskPorts.Draft | null;
        recordTransfer(direction: string, goods: LWTaskPorts.Numbers): void;
        resourceTask(resource: string, orderId?: string | null, force?: boolean, quantity?: number, visited?: string[]): LWTaskPorts.Draft | null;
        assessResource(resource: string, amount: number | undefined, seen?: Set<string>): LWTaskPorts.Issue | null;
        createNeedTask(which: string): LWTaskPorts.Draft | null;
        orderTask(o: LWTaskPorts.Order): LWTaskPorts.Draft | null;
        requestEquipment(id: string): {
            ok: boolean;
            reason?: string;
        };
        unequip(slot: string): {
            ok: boolean;
            reason?: string;
        };
        cancelEquipment(id: string): {
            ok: boolean;
            reason?: string;
        };
        sellItem(id: string, qty?: number): {
            ok: boolean;
            reason?: string;
            amount?: number;
        };
        trade(id: string, mode: string, qty?: number): {
            ok: boolean;
            reason?: string;
            amount?: number;
        };
        cancel(id: string): {
            ok: boolean;
            reason?: string;
        };
    }
    interface Root {
        LW: LWTaskPorts.Tables;
        LWAdventure: LWTaskPorts.Adventure;
        LWPolicies: {
            protectedInventory(host: Host, actor: LWTaskPorts.Actor): LWTaskPorts.Numbers;
        };
        LWColonyLogistics?: Api;
    }
    interface Api {
        install(target: object, predecessor: object, dependencies: LWTaskPorts.ColonyDependencies): void;
    }
    const root = inputRoot as Root;
    function install(target: object, predecessor: object, dependencies: LWTaskPorts.ColonyDependencies): void {
        const { RECIPES } = root.LW;
        const A = root.LWAdventure, copy = A.copy;
        const FOOD = ['meals', 'bread', 'berries', 'meat'];
        const safeInt = (x: number, a: number, b: number): boolean => Number.isInteger(x) && x >= a && x <= b;
        const fail = (reason: string) => ({ ok: false, reason }), ok = (x: object = {}) => ({ ok: true, ...x });
        const { definition, item, profile, arrivalPoint } = dependencies;
        const base = predecessor as Host;
        const methods: Methods & ThisType<Host> = {
            depositKeep(this: Host, c = this.actor) { return root.LWPolicies.protectedInventory(this, c); },
            surplus(this: Host, c = this.actor) { const keep = this.depositKeep(c); return Object.fromEntries(Object.entries(c.inventory).map(([id, n]): [
                string,
                number
            ] => [id, Math.max(0, n - (keep[id]! || 0))]).filter(([, n]) => n > 0)); },
            depositTask(reason = 'Bringing useful things home', all = false) {
                const goods = this.surplus();
                if (!Object.keys(goods).length && !this.actor.needsDeposit)
                    return null;
                return { kind: 'deposit', target: this.warehouse(), duration: 3, label: reason, reason: 'Only a visit to the warehouse can make carried items available to the whole glade.', thought: 'A place for everything we brought home.', all };
            },
            recordTransfer(direction, goods) { const w = this.s.colony.warehouse; w.transfers.unshift({ actorId: this.actor.id, name: this.s.name, direction, items: copy(goods), time: this.s.simTime }); w.transfers = w.transfers.slice(0, 50); this.emit('transfer', this.s.name + (direction === 'in' ? ' stocked the warehouse.' : ' picked up supplies.'), { items: goods, direction }); },
            resourceTask(resource, orderId = null, force = false, quantity = 0, visited = []) {
                if (visited.includes(resource) || visited.length > 12)
                    return null;
                const inv = this.s.inventory, w = this.s.colony.warehouse.inventory;
                const order = this.s.orders.find(o => o.id === orderId);
                let wanted = quantity || (['build', 'upgrade'].includes(order?.type!) ? this.constructionCost(order!)[resource]! : 0) || 3;
                if (!force && w[resource]! > 0) {
                    const capacity = Math.floor((this.load().maximumKg * 1000 - this.load().grams) / (item(resource)?.weight || 1));
                    const amount = Math.min(w[resource]!, Math.max(1, wanted - (inv[resource]! || 0)), Math.max(0, capacity));
                    if (amount > 0)
                        return { kind: 'withdraw', resource, amount, orderId, target: this.warehouse(), duration: 2, label: 'Collecting ' + item(resource).name.toLowerCase() + ' from the warehouse', reason: 'I need it in my own satchel before I can use it.', thought: 'I’ll pick up only what I need.' };
                }
                const g = definition(resource);
                const rec = g?.recipe || RECIPES[resource]!;
                if (rec) {
                    if (!this.s.skills[rec.skill]! || !this.has(rec.station))
                        return null;
                    for (const [k, n] of Object.entries(rec.cost))
                        if ((inv[k]! || 0) < n)
                            return this.resourceTask(k, orderId, false, n, [...visited, resource]);
                    return { kind: g ? 'gearcraft' : 'craft', resource, orderId, target: this.s.buildings.find(b => b.kind === rec.station), duration: rec.time, label: 'Making ' + item(resource).name.toLowerCase(), reason: 'The required ingredients are in my satchel. I can use our station.', thought: 'A little care in every piece.' };
                }
                return base.resourceTask.call(this, resource, orderId, force);
            },
            assessResource(resource, amount, seen = new Set()) {
                if ((this.s.inventory[resource]! || 0) + (this.s.colony.warehouse.inventory[resource]! || 0) >= amount!)
                    return null;
                return base.assessResource.call(this, resource, amount, seen);
            },
            createNeedTask(which) {
                if (['food', 'water'].includes(which)) {
                    const available = which === 'food' ? FOOD.find(r => this.s.inventory[r]! > 0) : (this.s.inventory.water > 0 ? 'water' : null);
                    if (available)
                        return base.createNeedTask.call(this, which);
                    const stored = which === 'food' ? FOOD.find(r => (this.s.colony.warehouse.inventory[r]! || 0) > 0) : 'water';
                    if (stored && (this.s.colony.warehouse.inventory[stored]! || 0) > 0)
                        return this.resourceTask(stored, null, false, 2);
                    if (which === 'food' && this.s.skills.cooking && this.has('fire') && this.s.inventory.meat > 0)
                        return this.resourceTask('meals', null, false, 1);
                    return base.createNeedTask.call(this, which);
                }
                return base.createNeedTask.call(this, which);
            },
            orderTask(o) { return base.orderTask.call(this, o); },
            requestEquipment(id) {
                if (!definition(id))
                    return fail('Unknown equipment.');
                if (this.actor.equipQueue.includes(id) || Object.values(this.actor.equipment).includes(id))
                    return fail('This item is already worn or being prepared.');
                if (this.actor.equipQueue.length >= 4)
                    return fail('Prepare at most four outfit pieces at a time.');
                this.actor.equipQueue.push(id);
                this.log('You suggested ' + definition(id)!.name + '. ' + this.s.name + ' will fetch or make it when ready.', 'bag');
                return ok();
            },
            unequip(slot) {
                if (!A.slots.includes(slot) || !this.actor.equipment[slot]!)
                    return fail('Nothing is worn in this slot.');
                this.actor.equipment[slot] = null;
                this.visual('equip');
                return ok();
            },
            cancelEquipment(id) {
                if (!this.actor.equipQueue.includes(id))
                    return fail('That equipment is no longer being prepared.');
                this.actor.equipQueue = this.actor.equipQueue.filter(g => g !== id);
                const task = this.actor.task;
                if (task?.itemId === id || (task?.kind === 'gearcraft' && task.resource === id))
                    this.actor.task = null;
                return ok();
            },
            sellItem(id, qty = 1) {
                if (!this.has('market'))
                    return fail('Build a market before selling stored goods.');
                if (!item(id) || !safeInt(qty, 1, 99))
                    return fail('Choose an item and a quantity from 1 to 99.');
                const w = this.s.colony.warehouse.inventory;
                if ((w[id]! || 0) < qty)
                    return fail('Only goods already deposited in the warehouse can be sold.');
                const total = Math.max(1, Math.floor(item(id).price * B.forEngine(this).policy.sellFraction)) * qty;
                w[id]! -= qty;
                const settlement = this.settleEconomy({ id: this.economySettlementId('warehouse-sale'), guide: total }, 'Sold warehouse stock: ' + item(id).name);
                if (!settlement.ok) {
                    w[id]! += qty;
                    return fail('The sale could not be settled.');
                }
                this.log('Sold ' + qty + ' ' + item(id).name.toLowerCase() + ' from the warehouse for ' + total + ' guide coins.', 'coin');
                return ok({ amount: total });
            },
            trade(id, mode, qty = 1) { return mode === 'sell' ? this.sellItem(id, qty) : fail('The guide cannot buy or transfer global inventory. Creatures shop with their own pocket coins.'); },
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
                base.cancel.call(this, id);
                return ok();
            },
        };
        for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(methods))) {
            Object.defineProperty(target, name, { ...descriptor, enumerable: false });
        }
    }
    const api: Api = Object.freeze({ install });
    root.LWColonyLogistics = api;
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
})(globalThis);
