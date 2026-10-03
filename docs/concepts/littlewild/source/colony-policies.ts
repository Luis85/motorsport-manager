/* Read-only colony policies shared by the simulation and presentation.
 * These functions never issue commands, consume RNG, transfer goods or mutate an actor.
 * The owning engine provides definitions and actor context explicitly. */
/// <reference path="./legacy-task-contracts.d.ts" />
/// <reference path="./application-records.d.ts" />
(function (inputRoot: unknown) {
    'use strict';
    type Actor = LWApplication.Actor;
    interface Storage { input: LWTaskPorts.Numbers; output: LWTaskPorts.Numbers; job?: { cost: LWTaskPorts.Numbers } | null; }
    interface Building extends LWTaskPorts.Place { storage?: Storage; }
    interface Host {
        s: { colony: { warehouse: { inventory: LWTaskPorts.Numbers } }; buildings: Building[] };
        creatures: Actor[];
        has(id: string): boolean;
        outputTotal?(id: string): number;
        withActor<T>(actor: Actor, action: () => T): T;
        assessResource(id: string, amount: number): string | { text?: string; reason?: string } | null;
        constructionCost(order: LWApplication.Order): LWTaskPorts.Numbers;
        questForecast(quest: LWTaskPorts.QuestDefinition, actor: Actor): { missing: unknown[]; load: { overloaded: boolean } };
        mood(actor: Actor): string;
    }
    const root = inputRoot as {
        LW: LWTaskPorts.Tables & { colony: LWTaskPorts.ColonyDependencies };
        LWAdventure: LWTaskPorts.Adventure;
        LWPolicies?: typeof api;
    };
    const L = root.LW;
    const food = ['meals', 'bread', 'berries', 'meat'];
    function equipmentStatus(engine: Host, actor: Actor, id: string) {
        const gear = L.colony.definition(id);
        if (!gear)
            return { state: 'blocked', text: 'Unknown equipment.', blockers: ['Unknown equipment.'] };
        if (actor.equipment[gear.slot] === id)
            return { state: 'worn', text: 'Worn', blockers: [] };
        if ((actor.inventory[id] || 0) > 0)
            return { state: 'carried', text: 'In this satchel', blockers: [] };
        if ((engine.s.colony.warehouse.inventory[id] || 0) > 0)
            return { state: 'stored', text: 'Collect from warehouse', blockers: [] };
        if((engine.outputTotal?.(id) || 0)>0)return {state:'workplace',text:'Collect finished equipment from its workplace',blockers:[]};
        const blockers: string[] = [];
        if (!actor.skills[gear.recipe.skill])
            blockers.push('Learn ' + L.SKILLS[gear.recipe.skill]!.short);
        if (!engine.has(gear.recipe.station))
            blockers.push('Build ' + L.BUILDINGS[gear.recipe.station]!.name);
        // Preserve the base planner as the authority for reachable supply chains.
        if (!blockers.length)
            engine.withActor(actor, () => {
                for (const [resource, quantity] of Object.entries(gear.recipe.cost)) {
                    const issue = engine.assessResource(resource, quantity);
                    if (issue)
                        blockers.push(typeof issue === 'string' ? issue : issue.text || issue.reason || 'Prepare ' + L.RES[resource]!.name);
                }
            });
        return { state: blockers.length ? 'blocked' : 'craft', text: blockers.length ? blockers.join(' · ') : 'Craft at ' + L.BUILDINGS[gear.recipe.station]!.name, blockers };
    }
    function questReadiness(engine: Host, actor: Actor, quest: LWTaskPorts.QuestDefinition) {
        const forecast = engine.questForecast(quest, actor);
        const equipment = actor.equipQueue.map(id => ({ id, ...equipmentStatus(engine, actor, id) }));
        const energyNeeded = quest.energy + 15;
        return {
            forecast, equipment, energyNeeded,
            energyReady: actor.needs.energy >= energyNeeded,
            suppliesReady: forecast.missing.length === 0,
            outfitReady: equipment.length === 0,
            loadReady: !forecast.load.overloaded,
            ready: !forecast.missing.length && !equipment.length && actor.needs.energy >= energyNeeded && !forecast.load.overloaded
        };
    }
    function protectedInventory(engine: Host, actor: Actor) {
        const keep: LWTaskPorts.Numbers = actor.needsDeposit ? {} : { water: 2, berries: 2, meals: actor.inventory.meals ? 1 : 0, bread: actor.inventory.bread ? 1 : 0 };
        for (const id of Object.values(actor.equipment))
            if (id)
                keep[id] = (keep[id] || 0) + 1;
        for (const id of actor.equipQueue)
            keep[id] = Math.max(keep[id] || 0, 1);
        // Work that is about to use these ingredients must not endlessly unload/re-fetch them.
        const reserve = (id: string, quantity: number, seen: string[] = []): void => {
            if (seen.includes(id) || seen.length > 12)
                return;
            keep[id] = Math.max(keep[id] || 0, quantity);
            const recipe = L.RECIPES[id] || L.colony.definition(id)?.recipe;
            if (recipe && (actor.inventory[id] || 0) < quantity) {
                const batches = Math.ceil((quantity - (actor.inventory[id] || 0)) / (recipe.amount || 1));
                for (const [input, n] of Object.entries(recipe.cost))
                    reserve(input, n * batches, [...seen, id]);
            }
        };
        if (!actor.needsDeposit) {
            const order = actor.orders.filter(o => !o.paused && ['build', 'upgrade'].includes(o.type) && !o.paid)
                .sort((a, b) => b.priority - a.priority || a.created - b.created)[0];
            if (order)
                engine.withActor(actor, () => {
                    for (const [id, n] of Object.entries(engine.constructionCost(order)))
                        reserve(id, n);
                });
            if (actor.equipQueue[0])
                reserve(actor.equipQueue[0], 1);
            if (actor.task?.resource && ['craft', 'gearcraft'].includes(actor.task.kind))
                reserve(actor.task.resource, 1);
        }
        if (actor.questPlan) {
            const questId = actor.questPlan.questId;
            const quest = root.LWAdventure.content.quests.find(q => q.id === questId);
            for (const [id, n] of Object.entries(quest?.cost || {}))
                reserve(id, n + (['berries', 'water'].includes(id) ? 1 : 0));
        }
        return keep;
    }
    function attention(engine: Host, actor: Actor) {
        if (actor.activeQuest)
            return { kind: 'away', label: actor.activeQuest.status === 'returning' ? 'Returning home' : 'On a quest', panel: 'adventures' };
        const needs: [keyof LWTaskPorts.Needs, string][] = [['water', 'Thirsty'], ['food', 'Hungry'], ['energy', 'Needs rest']];
        const urgent = needs.filter(([key]) => actor.needs[key]! < 25).sort((a, b) => actor.needs[a[0]]! - actor.needs[b[0]]!)[0];
        if (urgent)
            return { kind: 'need', label: urgent[1], panel: 'satchel' };
        if (actor.needsDeposit)
            return { kind: 'cargo', label: 'Bringing finds home', panel: 'satchel' };
        if (actor.feelings.anger >= 30)
            return { kind: 'mood', label: engine.mood(actor), panel: 'feelings' };
        if (actor.questPlan)
            return { kind: 'preparing', label: 'Preparing a quest', panel: 'adventures' };
        if (actor.equipQueue.length) {
            const gear = equipmentStatus(engine, actor, actor.equipQueue[0]!);
            if (gear.state === 'blocked')
                return { kind: 'blocked', label: 'Outfit needs preparation', panel: 'outfit' };
        }
        return { kind: 'calm', label: engine.mood(actor), panel: 'feelings' };
    }
    function inventoryRow(engine: Host, id: string) {
        const definition = L.colony.item(id);
        if (!definition)
            throw Error('Unknown inventory item.');
        const carriers = engine.creatures.filter(c => (c.inventory[id] || 0) > 0).map(c => ({ id: c.id, name: c.name, quantity: c.inventory[id]!, away: !!c.activeQuest }));
        const stored = engine.s.colony.warehouse.inventory[id] || 0;
        const carried = carriers.reduce((sum, c) => sum + c.quantity, 0);
        const workplaces=engine.s.buildings.filter(b=>(b.storage?.input[id]||0)+(b.storage?.output[id]||0)+(b.storage?.job?.cost[id]||0)>0).map(b=>({id:b.id,name:L.BUILDINGS[b.kind]!.name,input:b.storage!.input[id]||0,output:b.storage!.output[id]||0,reserved:b.storage!.job?.cost[id]||0}));
        const atWorkplaces=workplaces.reduce((n,b)=>n+b.input+b.output+b.reserved,0);
        const price = Math.max(1, Math.floor(definition.price * .65));
        return { id, name: definition.name, weight: definition.weight, stored, carried, carriers, workplaces, atWorkplaces, price, food: food.includes(id) || id === 'water' };
    }
    const api = { equipmentStatus, questReadiness, protectedInventory, attention, inventoryRow };
    root.LWPolicies = api;
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
