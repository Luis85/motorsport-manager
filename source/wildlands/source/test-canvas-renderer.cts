/* Drawing-operation characterization captured from the renderer before extraction.
 * This recording context verifies order, geometry, camera transforms and state isolation;
 * browser suites retain responsibility for actual pixels and native input. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const L = require('./simulation.cjs');
const contract = require('./fixtures/canvas-renderer.json');
const results = [];
function test(name, action) {
    try {
        action();
        results.push({ name, passed: true });
    } catch (error) {
        results.push({ name, passed: false, error: error.stack });
        console.error('FAIL', name, error.message);
    }
}
function recordingCanvasEnvironment() {
    const calls = [];
    let gradient = 0;
    function canvas() {
        const element = {
            width: 900,
            height: 700,
            getBoundingClientRect: () => ({ width: 900, height: 700, left: 0, top: 0 }),
            addEventListener() {},
            focus() {},
            setPointerCapture() {}
        };
        const state = {};
        const context = new Proxy(state, {
            get(target, key) {
                if (key in target) return target[key];
                if (key === 'createRadialGradient') return (...args) => {
                    calls.push([key, ...args]);
                    const id = ++gradient;
                    return {
                        gradient: id,
                        addColorStop(...args) { calls.push(['color-stop', id, ...args]); }
                    };
                };
                if (key === 'measureText') return text => ({ width: String(text).length * 6 });
                return (...args) => calls.push([
                    key,
                    ...args.map(arg => arg?.getContext ? { canvas: [arg.width, arg.height] } : arg)
                ]);
            },
            set(target, key, value) {
                calls.push(['set', key, value]);
                target[key] = value;
                return true;
            }
        });
        element.getContext = () => context;
        return element;
    }
    const root = {
        LW: L,
        LWWorldContent: global.LWWorldContent,
        document: { createElement: canvas },
        ResizeObserver: class { observe() {} },
        AbortController,
        console
    };
    root.window = root;
    const context = vm.createContext(root);
    for (const name of ['canvas-art', 'canvas-buildings', 'canvas-ground', 'canvas-scene', 'world']) {
        vm.runInContext(fs.readFileSync(__dirname + '/' + name + '.js', 'utf8'), context, { filename: name });
    }
    return { calls, canvas, root };
}
const environment = recordingCanvasEnvironment();
const engine = L.createWorldDemo();
engine.selectCreature('c1');
const beforeConstruction = JSON.stringify(engine.export());
const view = new environment.root.LWArt.World(environment.canvas(), engine);
function expectDrawing(name, action = () => {}) {
    const snapshot = JSON.stringify(view.engine.export());
    action();
    assert.equal(JSON.stringify(view.engine.export()), snapshot, 'Rendering changed authoritative state.');
    const expected = contract.fixtures[name];
    assert(expected, 'No retained renderer fixture for ' + name);
    assert.equal(environment.calls.length, expected.operations, 'Canvas operation count changed.');
    // Keep this oracle independent of platform-sensitive last bits in trigonometric functions.
    const normalized = JSON.stringify(environment.calls, (_key, value) =>
        typeof value === 'number' ? Math.round(value * 1e9) / 1e9 : value);
    assert.equal(crypto.createHash('sha256').update(normalized).digest('hex'), expected.sha256,
        'Canvas operation content or order changed.');
    environment.calls.length = 0;
}
test('Cached terrain generation', () => {
    assert.equal(JSON.stringify(engine.export()), beforeConstruction, 'Ground creation changed authoritative state.');
    expectDrawing('Cached terrain generation');
});
test('Day frame', () => expectDrawing('Day frame', () => view.draw(12, .016)));
engine.s.hour = 22;
test('Night frame', () => expectDrawing('Night frame', () => view.draw(13, .016)));
engine.s.settings.reducedMotion = true;
test('Reduced motion', () => expectDrawing('Reduced motion', () => view.draw(15, .1)));
view.resourceLens = true;
view.placement = 'well';
view.hover = { x: 8, y: 8 };
view.feedbackEvent({ actorId: engine.selected.id, type: 'interaction', kind: 'water' });
view.say('A trace parity test.');
test('Placement, resource lens and feedback', () =>
    expectDrawing('Placement, resource lens and feedback', () => view.draw(16, .016)));
for (const kind of Object.keys(L.BUILDINGS)) {
    const name = 'Building ' + kind;
    test(name, () => expectDrawing(name, () =>
        environment.root.LWArt.building(environment.canvas().getContext(), 7, 10, kind, 17, true)));
}
view.engine = L.createColonyDemo();
test('Replaced engine frame', () => expectDrawing('Replaced engine frame', () => view.draw(19, .016)));
const passed = results.filter(result => result.passed).length;
fs.writeFileSync(__dirname + '/canvas-renderer-results.json', JSON.stringify({
    passed, total: results.length, failed: results.length - passed, results
}, null, 2) + '\n');
console.log(passed + '/' + results.length + ' canvas renderer checks passed');
if (passed !== results.length) process.exitCode = 1;
