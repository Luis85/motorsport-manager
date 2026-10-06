/// <reference path="./legacy-task-contracts.d.ts" />
/* Autonomous task proposals and virtual material forecasts. No task advances here. */
(function (inputRoot: unknown) {
    'use strict';
    interface Methods {
        materialForecast(onlyOrder?: LWTaskPorts.Order | null): LWTaskPorts.Forecast;
        planStatus(o: LWTaskPorts.Order): LWTaskPorts.PlanStatus;
        decisionSummary(): LWTaskPorts.Summary;
        resourceTask(resource: string, orderId?: string | null, force?: boolean): LWTaskPorts.Draft | null;
        needTask(which: string): LWTaskPorts.Draft | null;
        createNeedTask(which: string): LWTaskPorts.Draft | null;
        shoppingTask(resource: string, orderId?: string | null, essential?: boolean): LWTaskPorts.Draft | null;
        orderTask(o: LWTaskPorts.Order): LWTaskPorts.Draft | null;
        decide(): void;
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
        LWEngineTaskPlanning?: Api;
    }
    const root = inputRoot as Root;
    function install(target: object): void {
        const { RES, SKILLS, BUILDINGS, RECIPES, CONTRACTS } = root.LWContent.tables;
        const owns = (table: object, key: string): boolean => typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key);
        const methods: Methods & ThisType<LWTaskPorts.BaseHost> = {
            /** Forecast consumes a virtual inventory across all active plans, so shared stock is not counted twice. */
            materialForecast(onlyOrder = null) {
                const s = this.s, available = { ...s.inventory }, rows: Record<string, LWTaskPorts.ForecastRow> = {}, steps: LWTaskPorts.Forecast["steps"] = [], issues: LWTaskPorts.Issue[] = [];
                const add = (r: string, n: number, chain: string[] = []): void => {
                    const row = rows[r]! ||= { resource: r, needed: 0, onHand: s.inventory[r]!, used: 0, missing: 0 };
                    row.needed += n;
                    const use = Math.min(available[r]!, n);
                    available[r]! -= use;
                    row.used += use;
                    const lack = n - use;
                    row.missing += lack;
                    if (!lack)
                        return;
                    const skill = this.missingSkill(r);
                    if (skill)
                        issues.push({ text: 'Teach ' + SKILLS[skill]!.short, skill });
                    const recipe = RECIPES[r]!;
                    if (recipe && !chain.includes(r)) {
                        if (!this.has(recipe.station))
                            issues.push({ text: 'Build a ' + BUILDINGS[recipe.station]!.name.toLowerCase(), building: recipe.station });
                        const batches = Math.ceil(lack / recipe.amount);
                        for (const [key, count] of Object.entries(recipe.cost))
                            add(key, count * batches, [...chain, r]);
                        available[r]! += batches * recipe.amount - lack;
                        steps.push({ resource: r, amount: batches * recipe.amount, kind: 'craft', station: recipe.station });
                    }
                    else
                        steps.push({ resource: r, amount: lack, kind: r === 'meat' ? 'hunt' : 'gather' });
                };
                const orders = onlyOrder ? [onlyOrder] : this.s.orders.filter(o => !o.paused).slice().sort((a, b) => b.priority - a.priority || a.created - b.created);
                for (const o of orders) {
                    if (o.type === 'build') {
                        if (!s.skills[BUILDINGS[o.kind]!.skill]!) {
                            const skill = BUILDINGS[o.kind]!.skill;
                            issues.push({ text: 'Teach ' + SKILLS[skill]!.short, skill });
                        }
                        if (!o.paid)
                            for (const [r, n] of Object.entries(BUILDINGS[o.kind]!.cost))
                                add(r, n);
                    }
                    else if (o.type === 'deliver')
                        for (const [r, n] of Object.entries(CONTRACTS[o.contract]!.cost))
                            add(r, n);
                    else if (o.type === 'craft') {
                        const recipe = RECIPES[o.resource]!, batches = Math.ceil((o.amount - o.done) / recipe.amount);
                        for (const [r, n] of Object.entries(recipe.cost))
                            add(r, n * batches);
                    }
                }
                return { rows: Object.values(rows), steps, issues: issues.filter((x, i, a) => a.findIndex(y => y.text === x.text) === i) };
            },
            planStatus(o) {
                const issue = this.orderIssue(o), t = this.s.task;
                if (issue)
                    return { label: o.paused ? 'On hold' : 'Needs your help', detail: issue.text, kind: o.paused ? 'hold' : 'blocked', issue };
                if (t?.orderId === o.id)
                    return { label: t.kind === 'build' ? 'Building' : t.kind === 'craft' ? 'Making supplies' : t.kind === 'gather' ? 'Finding supplies' : 'In progress', detail: t.label, kind: 'active' };
                return { label: 'Ready when Pip is', detail: t?.need ? 'Taking care of ' + t.need + ' first.' : 'Needs and lessons still come first.', kind: 'ready' };
            },
            decisionSummary() {
                const t = this.s.task;
                if (!t)
                    return { source: 'Thinking', detail: 'Pip is choosing a next step.' };
                const o = this.s.orders.find(o => o.id === t.orderId);
                return { source: t.need ? 'Self-care' : t.kind === 'train' ? 'Your lesson' : o ? 'Shared plan' : t.stock ? 'Pantry reserve' : 'Pip’s choice',
                    detail: o ? this.orderName(o) : t.stock ? 'Keeping ' + this.s.stockTargets[t.resource!]! + ' ' + RES[t.resource!]!.name.toLowerCase() + ' in store.' : t.reason };
            },
            resourceTask(resource, orderId = null, force = false) {
                const s = this.s, base = { orderId, resource };
                if (!force && orderId && s.allowance.sourcing === 'shop') {
                    const offer = this.shoppingTask(resource, orderId, false);
                    if (offer)
                        return offer;
                }
                if (RECIPES[resource]!) {
                    const r = RECIPES[resource]!;
                    if (!s.skills[r.skill]! || !this.has(r.station))
                        return null;
                    for (const [k, n] of Object.entries(r.cost))
                        if (s.inventory[k]! < n)
                            return this.resourceTask(k, orderId, false);
                    const b = s.buildings.find(b => b.kind === r.station);
                    return { ...base, kind: 'craft', target: b, duration: r.time, label: 'Crafting ' + RES[resource]!.name.toLowerCase(), reason: 'A little making turns what we have into what we need.', thought: resource === 'planks' ? 'Two logs. Straight edges. I can do this.' : 'Something good is cooking.' };
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
                return { ...base, kind: 'gather', nodeId: node.id, target: node, duration: resource === 'water' ? (this.has('well') ? 1.6 : 2.8) : resource === 'wood' ? 4 : resource === 'stone' ? 4.5 : 3, label: resource === 'water' ? 'Collecting fresh water' : 'Gathering ' + RES[resource]!.name.toLowerCase(), reason: orderId ? 'I’m finding what our plan needs, one little step at a time.' : 'I’m keeping a little extra in our pantry. Just in case.', thought: resource === 'wood' ? 'These branches could become a home.' : resource === 'water' ? 'A little water for later.' : resource === 'berries' ? 'The ripe ones are the sweetest.' : 'This looks useful.' };
            },
            needTask(which) {
                const t = this.createNeedTask(which);
                if (t)
                    t.need = which;
                return t;
            },
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
            },
            shoppingTask(resource, orderId = null, essential = true) {
                const s = this.s;
                if (!this.has('market') || !s.skills.commerce || !owns(RES, resource))
                    return null;
                if (!essential && s.allowance.sourcing === 'gather')
                    return null;
                const available = Math.max(0, s.creature.coins - (essential ? 0 : s.allowance.reserve)), price = RES[resource]!.price;
                if (available < price)
                    return null;
                return { kind: 'shop', orderId, resource, essential, amount: Math.min(2, Math.floor(available / price)), target: s.buildings.find(b => b.kind === 'market'), duration: 3,
                    label: 'Buying ' + RES[resource]!.name.toLowerCase(), reason: essential ? 'I can use my own pocket money for a necessity. My guide’s wallet stays untouched.' : 'I have enough pocket money left after my savings reserve to help our plan.', thought: 'I’ve saved enough for a little supply run.' };
            },
            orderTask(o) {
                const s = this.s, id = o.id;
                if (this.orderIssue(o))
                    return null;
                if (o.type === 'build') {
                    const b = BUILDINGS[o.kind]!;
                    if (!o.paid) {
                        for (const [r, n] of Object.entries(b.cost))
                            if (s.inventory[r]! < n)
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
                    const contract = CONTRACTS[o.contract]!;
                    for (const [r, n] of Object.entries(contract.cost))
                        if (s.inventory[r]! < n)
                            return this.resourceTask(r, id);
                    return { kind: 'deliver', orderId: id, target: s.buildings.find(b => b.kind === 'market'), duration: 4, label: 'Helping a neighbor', reason: 'Our work can make someone else’s day a little better.', thought: 'I brought everything you asked for!' };
                }
                return null;
            },
            decide() {
                const s = this.s, n = s.needs;
                let task = null;
                // Needs outrank every player suggestion. No click ever sets the creature’s destination.
                const urgent = Object.keys(n).filter(k => n[k]! < (k === 'energy' ? 27 : k === 'comfort' ? 25 : 35)).sort((a, b) => n[a]! - n[b]!);
                for (const k of urgent) {
                    task = this.needTask(k);
                    if (task && this.startTask(task))
                        return;
                }
                if (s.training) {
                    const k = SKILLS[s.training.id]!;
                    task = { kind: 'train', skillId: s.training.id, target: { x: 8, y: 10 }, duration: k.time, elapsed: s.training.progress, label: 'Learning ' + k.short.toLowerCase(), reason: 'You made time for a new skill. I’m giving it my best.', thought: 'Wait… I think I understand!' };
                    if (this.startTask(task))
                        return;
                }
                if (s.focus === 'cozy') {
                    for (const k of ['comfort', 'joy', 'energy'])
                        if (n[k]! < 65) {
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
                    if (n[k]! < (k === 'energy' ? 43 : k === 'comfort' ? 50 : 55)) {
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
                    if (s.inventory[r]! < (s.stockTargets[r]! || 0) && !this.assessResource(r, s.stockTargets[r]!)) {
                        task = this.resourceTask(r);
                        if (task) {
                            task.stock = true;
                            task.reason = 'I’m keeping our pantry ready: ' + s.stockTargets[r]! + ' ' + RES[r]!.name.toLowerCase() + '.';
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
            },
        };
        for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(methods))) {
            Object.defineProperty(target, name, { ...descriptor, enumerable: false });
        }
    }
    const api: Api = Object.freeze({ install });
    root.LWEngineTaskPlanning = api;
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
})(globalThis);
