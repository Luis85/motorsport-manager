import assert from 'node:assert/strict';
import fs from 'node:fs';
for (const file of ['developer-data', 'ecs', 'rts-catalog', 'rts-stats', 'rts-navigation', 'rts-systems', 'rts-production', 'rts-economy', 'rts-checkpoint', 'rts-session'])
    require('./' + file + '.js');
const root = globalThis as any;
let checks = 0;
const results: {
    name: string;
    passed: boolean;
}[] = [];
function test(name: string, work: () => void): void { work(); checks++; results.push({ name, passed: true }); console.log('PASS ' + name); }
function fixture(ai = false) {
    const data = root.LWRTSCatalog.clone(), mission = data.missions[0];
    for (const faction of data.factions)
        faction.ai.enabled = ai && faction.id === 'raiders';
    const raiders = data.factions.find((value: any) => value.id === 'raiders');
    raiders.ai.attackInterval = .1;
    raiders.ai.preferredUnit = 'rifleman';
    mission.fog = false;
    mission.terrain = [];
    mission.deposits = [];
    mission.objectives = [{ id: 'survive', name: 'Survive', description: 'Finite test', type: 'survive', target: 'alliance', amount: 10000 }];
    mission.spawns = [{ archetype: 'hq', faction: 'alliance', x: 5, y: 5, count: 1 }, { archetype: 'worker', faction: 'alliance', x: 9, y: 5, count: 1 }, { archetype: 'hq', faction: 'raiders', x: 32, y: 22, count: 1 }, { archetype: 'barracks', faction: 'raiders', x: 28, y: 22, count: 1 }];
    const session = root.LWRTS.create(data, mission.id), worker = session.query('').entities.find((value: any) => value.definition === 'worker');
    return { session, worker, data };
}
test('Purchased item pays authored costs once and adds authored charges to the owned unit', () => {
    const f = fixture(), before = f.session.query(''), item = f.data.items[0];
    const result = f.session.command({ kind: 'purchase', faction: 'alliance', entities: [f.worker.id], definition: item.id });
    assert(result.ok, result.message);
    const after = f.session.query(''), unit = after.entities.find((value: any) => value.id === f.worker.id);
    assert.equal(unit.inventory[item.id], item.charges);
    for (const [id, cost] of Object.entries(item.cost))
        assert.equal(after.factions.find((value: any) => value.id === 'alliance').resources[id], before.factions.find((value: any) => value.id === 'alliance').resources[id] - Number(cost));
});
test('Foreign, unknown and unaffordable item purchases leave the whole checkpoint unchanged', () => {
    const f = fixture(), before = JSON.stringify(f.session.checkpoint());
    for (const command of [{ kind: 'purchase', faction: 'raiders', entities: [f.worker.id], definition: f.data.items[0].id }, { kind: 'purchase', faction: 'alliance', entities: [f.worker.id], definition: 'missing' }])
        assert.equal(f.session.command(command).ok, false);
    assert.equal(JSON.stringify(f.session.checkpoint()), before);
    const item = f.data.items[0];
    item.cost = { credits: 1000000 };
    const session = root.LWRTS.create(f.data), worker = session.query('').entities.find((value: any) => value.definition === 'worker');
    const poor = JSON.stringify(session.checkpoint());
    assert.equal(session.command({ kind: 'purchase', faction: 'alliance', entities: [worker.id], definition: item.id }).ok, false);
    assert.equal(JSON.stringify(session.checkpoint()), poor);
});
test('Enabled AI uses its preferred authored unit through the same paid production queue', () => {
    const f = fixture(true), before = f.session.query(''), unit = f.data.units.find((value: any) => value.id === 'rifleman');
    f.session.step();
    const after = f.session.query(''), building = after.entities.find((value: any) => value.definition === 'barracks' && value.faction === 'raiders');
    assert.equal(building.queue.length, 1);
    assert.equal(building.queue[0].definitionId, 'rifleman');
    for (const [id, cost] of Object.entries(unit.cost))
        assert.equal(after.factions.find((value: any) => value.id === 'raiders').resources[id], before.factions.find((value: any) => value.id === 'raiders').resources[id] - Number(cost));
    f.session.step();
    assert.equal(f.session.query('').entities.find((value: any) => value.id === building.id).queue.length, 1);
});
test('Entity capacity blocks construction before spending and holds completed unit queues before spawning', () => {
    const world = new root.LWECS.World(), catalog = root.LWRTSCatalog, mission = catalog.data.missions[0];
    world.create('state');
    world.set('state', 'rts-state', { tick: 0, status: 'running', serial: 0, mission: mission.id });
    world.create('faction:alliance');
    world.set('faction:alliance', 'rts-owner', { faction: 'alliance' });
    world.set('faction:alliance', 'rts-faction', { resources: { food: 10000, wood: 10000, ore: 10000, credits: 10000 }, technologies: [], population: 0, populationCap: 0, power: 0 });
    world.create('worker');
    world.set('worker', 'rts-owner', { faction: 'alliance' });
    world.set('worker', 'rts-kind', { definition: 'worker', category: 'unit' });
    world.set('worker', 'rts-worker', { capacity: 12, rate: 3, carried: 0, resource: '' });
    world.set('worker', 'rts-position', { x: 9, y: 5 });
    world.create('hq');
    world.set('hq', 'rts-owner', { faction: 'alliance' });
    world.set('hq', 'rts-kind', { definition: 'hq', category: 'building' });
    world.set('hq', 'rts-building', { complete: true, progress: 1 });
    world.set('hq', 'rts-production', { queue: [] });
    world.set('hq', 'rts-position', { x: 5, y: 5 });
    while (world.entities.size < 1200)
        world.create('filler:' + world.entities.size);
    const context = { world, catalog, data: catalog.data, mission, map: { width: mission.width, height: mission.height, tiles: Array(mission.width * mission.height).fill(mission.defaultTerrain), blocked: [] }, spawn() { throw Error('Spawn must be guarded.'); }, emit() { } };
    root.LWRTSProduction.refresh(context);
    const before = JSON.stringify(world.get('faction:alliance', 'rts-faction'));
    assert.equal(root.LWRTSEconomy.command(context, { kind: 'build', faction: 'alliance', entities: ['worker'], definition: 'house', x: 14, y: 10 }).ok, false);
    assert.equal(JSON.stringify(world.get('faction:alliance', 'rts-faction')), before);
    assert.equal(root.LWRTSProduction.command(context, { kind: 'train', faction: 'alliance', entityId: 'hq', definition: 'worker' }).ok, true);
    const scheduler = new root.LWECS.Scheduler();
    root.LWRTSProduction.register(scheduler, context);
    for (let i = 0; i < 200; i++)
        scheduler.step(world, .1);
    assert.equal(world.get('hq', 'rts-production').queue.length, 1);
    assert.equal(world.get('hq', 'rts-production').queue[0].remaining, 0);
    assert.equal(world.entities.size, 1200);
});
fs.writeFileSync(__dirname + '/rts-economy-results.json', JSON.stringify({ passed: checks, total: checks, results }, null, 2) + '\n');
console.log(checks + '/ ' + checks + ' RTS economy checks passed');
