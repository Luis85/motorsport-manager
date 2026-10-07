// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// The application tests exercise explicit clock and admission boundaries independently of DOM.
for (const file of ['ecs', 'rts-catalog', 'rts-stats', 'rts-checkpoint', 'rts-navigation', 'rts-systems', 'rts-production', 'rts-economy', 'rts-session', 'rts-application'])
    require('./' + file + '.js');
const root = globalThis as any;
const results: {
    name: string;
    passed: boolean;
    error?: string;
}[] = [];
function test(name: string, work: () => void): void {
    try {
        work();
        results.push({ name, passed: true });
    }
    catch (error) {
        results.push({ name, passed: false, error: String(error) });
    }
}
function fixture() { const app = root.LWRTSApplication.create(); const data = app.view.catalog(); data.factions.forEach((f: any) => f.ai.enabled = false); data.missions[0].objectives = [{ id: 'long-survival', name: 'Survive', description: 'Bounded test mission.', type: 'survive', target: 'alliance', amount: 10000 }]; app.view.replace(data, 'catalog'); app.view.control('resume'); return app; }
test('Application navigation and detached queries never tick a session', () => {
    const app = fixture();
    const saved = JSON.stringify(app.view.checkpoint());
    app.enter();
    for (let i = 0; i < 20; i++)
        app.view.query();
    app.exit();
    app.advance(2);
    assert.equal(JSON.stringify(app.view.checkpoint()), saved);
});
test('Fixed frame subdivisions produce the same ECS checkpoint', () => {
    const a = fixture(), b = fixture();
    a.enter();
    b.enter();
    for (let i = 0; i < 10; i++)
        a.advance(.1);
    for (let i = 0; i < 40; i++)
        b.advance(.025);
    assert.equal(a.view.query().tick, 10);
    assert.deepEqual(a.view.checkpoint(), b.view.checkpoint());
});
test('Pause and navigation clear substep debt and preserve manual pause state', () => { const app = fixture(); app.enter(); app.advance(.05); app.view.control('pause'); app.advance(.1); app.exit(); app.enter(); assert.equal(app.view.status().paused, true); app.view.control('resume'); app.advance(.05); assert.equal(app.view.query().tick, 0); app.advance(.05); assert.equal(app.view.query().tick, 1); });
test('Invalid timing and speed reject before changing session or status', () => {
    const app = fixture();
    app.enter();
    const saved = JSON.stringify(app.view.checkpoint()), state = app.view.status();
    for (const seconds of [-1, NaN, Infinity])
        assert.throws(() => app.advance(seconds));
    for (const speed of [0, -1, 3, NaN, Infinity])
        assert.throws(() => app.view.control('speed', speed));
    assert.deepEqual(app.view.status(), state);
    assert.equal(JSON.stringify(app.view.checkpoint()), saved);
});
test('Malformed catalog/checkpoint replacement retains the running session atomically', () => { const app = fixture(); app.enter(); app.advance(.1); const saved = JSON.stringify(app.view.checkpoint()), state = app.view.status(); assert.throws(() => app.view.replace({}, 'catalog')); assert.throws(() => app.view.replace({}, 'checkpoint')); assert.throws(() => app.view.replace(app.view.catalog(), 'catalog', 'missing-mission')); assert.equal(JSON.stringify(app.view.checkpoint()), saved); assert.deepEqual(app.view.status(), state); });
test('Checkpoint import restores frozen catalog and pauses without advancing', () => { const app = fixture(); app.enter(); app.advance(.1); const saved = app.view.checkpoint(); app.view.control('restart'); assert.equal(app.view.query().tick, 0); app.view.replace(saved, 'checkpoint'); assert.equal(app.view.status().paused, true); assert.equal(app.view.status().mission, saved.missionId); assert.deepEqual(app.view.checkpoint(), saved); const data = app.view.catalog(); data.units[0].speed = 999; assert.notEqual(app.view.catalog().units[0].speed, 999); });
const passed = results.filter(r => r.passed).length;
fs.writeFileSync(__dirname + '/rts-application-results.json', JSON.stringify({ passed, total: results.length, results }, null, 2));
console.log(`${passed}/${results.length} RTS application checks passed`);
if (passed !== results.length) {
    console.error(results.filter(r => !r.passed));
    process.exitCode = 1;
}
