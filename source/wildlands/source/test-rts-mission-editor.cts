/// <reference path="./rts-mission-editor-contracts.d.ts" />
// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['ecs', 'rts-catalog', 'rts-stats', 'rts-checkpoint', 'rts-navigation', 'rts-systems', 'rts-production', 'rts-economy', 'rts-session', 'rts-application', 'rts-mission-editor'])
    require('./' + file + '.js');
const root = globalThis as any;
const results: { name: string; passed: boolean; error?: string }[] = [];
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const fresh = (): LWRTSMissionEditor.Session => root.LWRTSMissionEditor.create();
function test(name: string, work: () => void): void {
    try { work(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: String(error) }); }
}
function command(editor: LWRTSMissionEditor.Session, input: Record<string, unknown>): LWRTSMissionEditor.Result {
    return editor.command({ revision: editor.query().revision, ...input });
}
function accepted(editor: LWRTSMissionEditor.Session, input: Record<string, unknown>): void {
    const before = editor.query().revision;
    const receipt = command(editor, input);
    assert.equal(receipt.ok, true, receipt.message);
    assert.equal(receipt.revision, before + 1);
    assert.equal(editor.query().revision, receipt.revision);
}
function rejected(editor: LWRTSMissionEditor.Session, input: unknown): void {
    const before = editor.query();
    const receipt = editor.command(input);
    assert.equal(receipt.ok, false, 'Invalid intent was accepted');
    assert(receipt.message.length > 0);
    assert.equal(receipt.revision, before.revision);
    assert.deepEqual(editor.query(), before, 'Rejected intent changed draft or history');
}
function invalid(editor: LWRTSMissionEditor.Session, input: Record<string, unknown>): void {
    rejected(editor, { revision: editor.query().revision, ...input });
}
function terrainAt(mission: LWRTSData.Mission, x: number, y: number): string {
    let result = mission.defaultTerrain;
    for (const patch of mission.terrain)
        if (x >= patch.x && y >= patch.y && x < patch.x + patch.width && y < patch.y + patch.height)
            result = patch.terrain;
    return result;
}

test('Mission editor queries and exported catalogs are detached from each other and admitted input', () => {
    const input = root.LWRTSCatalog.clone();
    const original = copy(input);
    const editor = root.LWRTSMissionEditor.create(input);
    input.missions[0].name = 'Changed externally';
    const view = editor.query() as any;
    view.catalog.units[0].speed = 999;
    view.mission.spawns[0].x = 999;
    const exported = editor.exportCatalog() as any;
    exported.missions[0].name = 'Changed export';
    assert.deepEqual(editor.exportCatalog(), original);
    assert.equal(editor.query().mission.name, original.missions[0].name);
    assert.equal(editor.query().canUndo, false);
    assert.equal(editor.query().canRedo, false);
    assert.equal(editor.query().dirty, false);
});
test('Mission editor rejects stale intents without changing revision draft or history', () => {
    const editor = fresh(), revision = editor.query().revision;
    accepted(editor, { action: 'metadata', values: { name: 'New title' } });
    rejected(editor, { revision, action: 'metadata', values: { name: 'Stale title' } });
    for (const stale of [-1, 0.5, Infinity, NaN, editor.query().revision + 1])
        rejected(editor, { revision: stale, action: 'undo' });
});
test('Mission editor undo redo advance revisions and a new branch invalidates redo', () => {
    const editor = fresh(), original = editor.exportCatalog();
    accepted(editor, { action: 'metadata', values: { name: 'First title' } });
    accepted(editor, { action: 'metadata', values: { name: 'Second title' } });
    accepted(editor, { action: 'undo' });
    assert.equal(editor.query().mission.name, 'First title');
    assert.equal(editor.query().canRedo, true);
    accepted(editor, { action: 'redo' });
    assert.equal(editor.query().mission.name, 'Second title');
    accepted(editor, { action: 'undo' });
    accepted(editor, { action: 'undo' });
    assert.deepEqual(editor.exportCatalog(), original);
    assert.equal(editor.query().dirty, false);
    accepted(editor, { action: 'metadata', values: { name: 'Different branch' } });
    assert.equal(editor.query().canRedo, false);
    invalid(editor, { action: 'redo' });
});
test('Mission editor history retains at most sixty four accepted catalog changes', () => {
    const editor = fresh();
    assert.equal(editor.query().historyLimit, 64);
    for (let index = 1; index <= 70; index++)
        accepted(editor, { action: 'metadata', values: { name: 'Revision ' + index } });
    for (let index = 0; index < 64; index++) accepted(editor, { action: 'undo' });
    assert.equal(editor.query().mission.name, 'Revision 6');
    assert.equal(editor.query().canUndo, false);
    invalid(editor, { action: 'undo' });
    for (let index = 0; index < 64; index++) accepted(editor, { action: 'redo' });
    assert.equal(editor.query().mission.name, 'Revision 70');
});
test('Mission editor equivalent metadata selection and import preserve revision and redo history', () => {
    const editor = fresh();
    accepted(editor, { action: 'metadata', values: { name: 'Temporary title' } });
    accepted(editor, { action: 'undo' });
    const before = editor.query();
    for (const input of [
        { action: 'metadata', values: { name: before.mission.name } },
        { action: 'select-mission', missionId: before.mission.id },
        { action: 'import-catalog', catalog: editor.exportCatalog() }
    ]) {
        const receipt = command(editor, input);
        assert.equal(receipt.ok, true, receipt.message);
        assert.equal(receipt.revision, before.revision);
        assert.deepEqual(editor.query(), before);
    }
    accepted(editor, { action: 'redo' });
    assert.equal(editor.query().mission.name, 'Temporary title');
});
test('Mission editor metadata commits a complete validated mission and rejects unsafe resizing', () => {
    const editor = fresh();
    accepted(editor, { action: 'metadata', values: { name: 'Authored frontier', description: 'Edited mission metadata.', width: 42, height: 34, fog: false, seed: 42, playerFaction: 'raiders', defaultTerrain: 'road' } });
    assert.deepEqual(Object.fromEntries(['name', 'description', 'width', 'height', 'fog', 'seed', 'playerFaction', 'defaultTerrain'].map(key => [key, (editor.query().mission as any)[key]])), {
        name: 'Authored frontier', description: 'Edited mission metadata.', width: 42, height: 34, fog: false, seed: 42, playerFaction: 'raiders', defaultTerrain: 'road'
    });
    for (const values of [{ width: 8 }, { height: 8 }, { width: 257 }, { width: 40.5 }, { seed: -1 }, { fog: 'false' }, { playerFaction: 'missing' }, { defaultTerrain: 'water' }, { id: 'rewritten-id' }])
        invalid(editor, { action: 'metadata', values });
});
test('Mission editor terrain painting overwrites cells while preserving unaffected terrain and supports undo', () => {
    const editor = fresh(), original = editor.query().mission;
    accepted(editor, { action: 'paint', terrain: 'forest', x: 0, y: 0, width: 3, height: 3 });
    accepted(editor, { action: 'paint', terrain: 'road', x: 1, y: 1, width: 1, height: 1 });
    const mission = editor.query().mission;
    assert.equal(terrainAt(mission, 0, 0), 'forest');
    assert.equal(terrainAt(mission, 1, 1), 'road');
    assert.equal(terrainAt(mission, 2, 2), 'forest');
    assert.equal(terrainAt(mission, 3, 3), terrainAt(original, 3, 3));
    assert.equal(terrainAt(mission, 15, 25), 'water');
    accepted(editor, { action: 'undo' });
    assert.equal(terrainAt(editor.query().mission, 1, 1), 'forest');
    root.LWRTSCatalog.validate(editor.exportCatalog());
});
test('Mission editor rejects terrain bounds incompatible actors and blocked building footprints atomically', () => {
    const editor = fresh();
    for (const patch of [
        { terrain: 'water', x: 5, y: 5, width: 1, height: 1 },
        { terrain: 'rock', x: 8, y: 6, width: 1, height: 1 },
        { terrain: 'missing', x: 0, y: 0, width: 1, height: 1 },
        { terrain: 'grass', x: -1, y: 0, width: 1, height: 1 },
        { terrain: 'grass', x: 39, y: 0, width: 2, height: 1 },
        { terrain: 'grass', x: 0.5, y: 0, width: 1, height: 1 },
        { terrain: 'grass', x: 0, y: 0, width: 0, height: 1 }
    ]) invalid(editor, { action: 'paint', ...patch });
});
test('Mission editor places updates and removes unit building and creature spawn records', () => {
    const editor = fresh(), count = editor.query().mission.spawns.length;
    for (const value of [
        { archetype: 'worker', faction: 'alliance', x: 2, y: 2, count: 2 },
        { archetype: 'house', faction: 'alliance', x: 36, y: 4, count: 1 },
        { archetype: 'wolf', faction: 'wildlife', x: 2, y: 28, count: 3 }
    ]) accepted(editor, { action: 'set-record', collection: 'spawns', index: null, value });
    assert.equal(editor.query().mission.spawns.length, count + 3);
    accepted(editor, { action: 'set-record', collection: 'spawns', index: count, value: { archetype: 'worker', faction: 'alliance', x: 2, y: 3, count: 1 } });
    assert.equal(editor.query().mission.spawns[count]!.y, 3);
    accepted(editor, { action: 'remove-record', collection: 'spawns', index: count });
    assert.equal(editor.query().mission.spawns.length, count + 2);
});
test('Mission editor rejects expanded off map actors forbidden movement and overlapping building placement', () => {
    const editor = fresh();
    for (const value of [
        { archetype: 'worker', faction: 'alliance', x: 39.9, y: 1, count: 2 },
        { archetype: 'gunboat', faction: 'alliance', x: 2, y: 2, count: 1 },
        { archetype: 'house', faction: 'alliance', x: 5, y: 5, count: 1 },
        { archetype: 'house', faction: 'alliance', x: 0, y: 0, count: 1 },
        { archetype: 'worker', faction: 'missing', x: 2, y: 2, count: 1 },
        { archetype: 'missing', faction: 'alliance', x: 2, y: 2, count: 1 },
        { archetype: 'worker', faction: 'alliance', x: 2, y: 2, count: 101 }
    ]) invalid(editor, { action: 'set-record', collection: 'spawns', index: null, value });
});
test('Mission editor authors deposits item drops and all registered objective types', () => {
    const editor = fresh(), before = editor.query().mission;
    accepted(editor, { action: 'set-record', collection: 'deposits', index: null, value: { resource: 'ore', x: 1, y: 28, amount: 500 } });
    accepted(editor, { action: 'set-record', collection: 'items', index: null, value: { item: 'medkit', x: 1, y: 27 } });
    for (const value of [
        { id: 'editor-eliminate', name: 'Defeat enemy', description: 'Eliminate opponents.', type: 'eliminate', target: 'raiders', amount: 0 },
        { id: 'editor-stockpile', name: 'Ore reserve', description: 'Gather resources.', type: 'stockpile', target: 'ore', amount: 100 },
        { id: 'editor-survive', name: 'Stay alive', description: 'Survive a duration.', type: 'survive', target: 'alliance', amount: 60 }
    ]) accepted(editor, { action: 'set-record', collection: 'objectives', index: null, value });
    assert.equal(editor.query().mission.deposits.length, before.deposits.length + 1);
    assert.equal(editor.query().mission.items.length, before.items.length + 1);
    assert.equal(editor.query().mission.objectives.length, before.objectives.length + 3);
    accepted(editor, { action: 'remove-record', collection: 'deposits', index: before.deposits.length });
    accepted(editor, { action: 'remove-record', collection: 'items', index: before.items.length });
    assert.deepEqual(editor.query().mission.deposits, before.deposits);
    assert.deepEqual(editor.query().mission.items, before.items);
});
test('Mission editor record commands reject bad indices references payload shapes and unsafe amounts', () => {
    const editor = fresh();
    for (const input of [
        { action: 'remove-record', collection: 'spawns', index: -1 },
        { action: 'remove-record', collection: 'spawns', index: 10000 },
        { action: 'remove-record', collection: 'unknown', index: 0 },
        { action: 'set-record', collection: 'items', index: 0.5, value: { item: 'medkit', x: 1, y: 1 } },
        { action: 'set-record', collection: 'items', index: null, value: { item: 'missing', x: 1, y: 1 } },
        { action: 'set-record', collection: 'deposits', index: null, value: { resource: 'ore', x: 5, y: 5, amount: 1 } },
        { action: 'set-record', collection: 'deposits', index: null, value: { resource: 'ore', x: 1, y: 1, amount: -1 } },
        { action: 'set-record', collection: 'items', index: null, value: { item: 'medkit', x: 1, y: 1, script: 'execute' } },
        { action: 'set-record', collection: 'objectives', index: null, value: { id: 'bad-objective', name: 'Invalid', description: 'Unknown resource.', type: 'stockpile', target: 'missing', amount: 1 } }
    ]) invalid(editor, input);
});
test('Mission editor cloning removal and history preserve other missions and catalog families', () => {
    const editor = fresh(), original = editor.exportCatalog();
    accepted(editor, { action: 'clone-mission', id: 'second-frontier', name: 'Second frontier' });
    assert.equal(editor.query().mission.id, 'second-frontier');
    accepted(editor, { action: 'metadata', values: { seed: 42 } });
    const exported = editor.exportCatalog();
    assert.deepEqual(exported.missions[0], original.missions[0]);
    for (const kind of ['units', 'buildings', 'factions', 'resources', 'abilities', 'items', 'technologies', 'terrain'] as const)
        assert.deepEqual(exported[kind], original[kind]);
    invalid(editor, { action: 'clone-mission', id: 'frontier', name: 'Duplicate' });
    accepted(editor, { action: 'remove-mission' });
    assert.deepEqual(editor.exportCatalog(), original);
    accepted(editor, { action: 'undo' });
    assert.equal(editor.query().mission.id, 'second-frontier');
    accepted(editor, { action: 'redo' });
    invalid(editor, { action: 'remove-mission' });
});
test('Mission editor selection invalidates gestures without adding undo history or dirty content', () => {
    const catalog = root.LWRTSCatalog.clone();
    catalog.missions.push({ ...copy(catalog.missions[0]), id: 'other-mission', name: 'Other mission' });
    const editor = root.LWRTSMissionEditor.create(catalog), revision = editor.query().revision;
    accepted(editor, { action: 'select-mission', missionId: 'other-mission' });
    assert.equal(editor.query().mission.id, 'other-mission');
    assert.equal(editor.query().canUndo, false);
    assert.equal(editor.query().dirty, false);
    rejected(editor, { revision, action: 'metadata', values: { name: 'Wrong mission' } });
    invalid(editor, { action: 'select-mission', missionId: 'missing' });
});
test('Mission editor whole catalog import is detached undoable and rejects incomplete catalogs', () => {
    const editor = fresh(), original = editor.exportCatalog();
    const input = copy(original) as any;
    input.units[0].speed = 4;
    input.missions.push({ ...copy(input.missions[0]), id: 'imported-mission', name: 'Imported mission' });
    accepted(editor, { action: 'import-catalog', catalog: input, missionId: 'imported-mission' });
    assert.equal(editor.query().mission.id, 'imported-mission');
    assert.deepEqual(editor.exportCatalog(), input);
    input.units[0].speed = 999;
    assert.equal(editor.exportCatalog().units[0]!.speed, 4);
    invalid(editor, { action: 'import-catalog', catalog: { missions: [] } });
    invalid(editor, { action: 'import-catalog', catalog: original, missionId: 'missing' });
    accepted(editor, { action: 'undo' });
    assert.deepEqual(editor.exportCatalog(), original);
    assert.equal(editor.query().mission.id, original.missions[0]!.id);
    accepted(editor, { action: 'redo' });
    assert.equal(editor.exportCatalog().units[0]!.speed, 4);
});
test('Mission editor rejects executable getters cycles symbols and unknown actions before reading behavior', () => {
    const editor = fresh();
    let reads = 0;
    const actionGetter = { revision: editor.query().revision };
    Object.defineProperty(actionGetter, 'action', { enumerable: true, get() { reads++; return 'undo'; } });
    rejected(editor, actionGetter);
    const nested = { revision: editor.query().revision, action: 'metadata', values: {} };
    Object.defineProperty(nested.values, 'name', { enumerable: true, get() { reads++; return 'Unsafe'; } });
    rejected(editor, nested);
    const cyclic: any = { revision: editor.query().revision, action: 'metadata', values: {} };
    cyclic.values.name = cyclic;
    rejected(editor, cyclic);
    const symbolic: any = { revision: editor.query().revision, action: 'undo' };
    symbolic[Symbol('hidden')] = 1;
    rejected(editor, symbolic);
    for (const input of [null, [], new Date(), { revision: editor.query().revision, action: 'step' }, { revision: editor.query().revision, action: 'undo', extra: true }, { revision: editor.query().revision, action: 'metadata', values: { name: () => 'Unsafe' } }])
        rejected(editor, input);
    assert.equal(reads, 0);
    const hostileCatalog = root.LWRTSCatalog.clone();
    Object.defineProperty(hostileCatalog, 'missions', { enumerable: true, get() { reads++; return []; } });
    assert.throws(() => root.LWRTSMissionEditor.create(hostileCatalog));
    const inheritedSerializer = root.LWRTSCatalog.clone();
    const arrayPrototype = Object.create(Array.prototype);
    Object.defineProperty(arrayPrototype, 'toJSON', { get() { reads++; return () => []; } });
    Object.setPrototypeOf(inheritedSerializer.units, arrayPrototype);
    assert.throws(() => root.LWRTSMissionEditor.create(inheritedSerializer));
    invalid(editor, { action: 'import-catalog', catalog: inheritedSerializer });
    assert.equal(reads, 0);
});
test('Mission editor catalog limits reject excess actors and preserve accepted history', () => {
    const editor = fresh(), catalog = editor.exportCatalog() as any;
    catalog.missions[0].spawns.push(...Array.from({ length: 11 }, () => ({ archetype: 'worker', faction: 'alliance', x: 1, y: 25, count: 100 })));
    invalid(editor, { action: 'import-catalog', catalog });
    accepted(editor, { action: 'metadata', values: { name: 'Retained valid edit' } });
    invalid(editor, { action: 'import-catalog', catalog });
    assert.equal(editor.query().canUndo, true);
    accepted(editor, { action: 'undo' });
    assert.equal(editor.query().mission.name, root.LWRTSCatalog.data.missions[0].name);
});
test('Mission editor rejects duplicate objective identities and missions without a player spawn', () => {
    const editor = fresh();
    invalid(editor, { action: 'set-record', collection: 'objectives', index: null, value: editor.query().mission.objectives[0] });
    const duplicate = editor.exportCatalog() as any;
    duplicate.missions[0].objectives.push(copy(duplicate.missions[0].objectives[0]));
    invalid(editor, { action: 'import-catalog', catalog: duplicate });
    assert.throws(() => root.LWRTSMissionEditor.create(duplicate));
    const noPlayer = editor.exportCatalog() as any;
    noPlayer.missions[0].spawns = noPlayer.missions[0].spawns.filter((spawn: any) => spawn.faction !== noPlayer.missions[0].playerFaction);
    invalid(editor, { action: 'import-catalog', catalog: noPlayer });
    assert.throws(() => root.LWRTSMissionEditor.create(noPlayer));
    assert.throws(() => root.LWRTSMissionEditor.create(editor.exportCatalog(), 'missing-mission'));
});
test('Mission editor authoring and navigation never tick or replace an independent running ECS match', () => {
    const application = root.LWRTSApplication.create();
    application.enter();
    application.view.control('resume');
    application.advance(.1);
    const checkpoint = application.view.checkpoint(), status = application.view.status();
    const editor = root.LWRTSMissionEditor.create(application.view.catalog(), application.view.status().mission);
    accepted(editor, { action: 'metadata', values: { name: 'Independent draft' } });
    accepted(editor, { action: 'paint', terrain: 'forest', x: 0, y: 0, width: 1, height: 1 });
    accepted(editor, { action: 'undo' });
    accepted(editor, { action: 'redo' });
    for (let index = 0; index < 10; index++) { editor.query(); editor.exportCatalog(); }
    assert.equal(application.view.query().tick, 1);
    assert.deepEqual(application.view.checkpoint(), checkpoint);
    assert.deepEqual(application.view.status(), status);
});

const passed = results.filter(result => result.passed).length;
fs.writeFileSync(__dirname + '/rts-mission-editor-results.json', JSON.stringify({ passed, total: results.length, results }, null, 2) + '\n');
console.log(`${passed}/${results.length} RTS mission editor checks passed`);
if (passed !== results.length) {
    console.error(results.filter(result => !result.passed));
    process.exitCode = 1;
}
