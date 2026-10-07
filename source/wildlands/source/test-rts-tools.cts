/// <reference path="./rts-contracts.d.ts" />
/// <reference path="./rts-runtime-contracts.d.ts" />
/** Experiments retain authoritative clocks and explicit rejection/continuation receipts. */
// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
for (const name of ['ecs', 'rts-catalog', 'rts-stats', 'rts-navigation', 'rts-systems', 'rts-production', 'rts-economy', 'rts-checkpoint', 'rts-session'])
    require('./' + name + '.js');
interface Run {
    ok: boolean;
    startTick: number;
    endTick: number;
    completedTicks: number;
    stopReason: string;
    skippedCommands: number;
    commands: {
        result: LWRTSRuntime.Result;
    }[];
    checkpoint: unknown;
}
const tools = require('./rts-tools.js') as {
    run(input: unknown, catalog?: unknown): Run;
    restore(checkpoint: unknown, input: unknown): Run;
    discover(): {
        commands: string[];
        denied: string[];
    };
    catalog(): LWRTSData.Catalog;
    validate(input: unknown): {
        ok: boolean;
    };
};
const results: {
    name: string;
    passed: boolean;
}[] = [];
const passed = (name: string): void => { results.push({ name, passed: true }); };
assert(tools.discover().commands.includes('gather'));
assert(tools.discover().denied.length > 0);
passed('Discovery exposes supported commands and denied arbitrary intentions');
const run = tools.run({ ticks: 20, commands: [] });
assert.equal(run.completedTicks, 20);
assert.equal(run.endTick, 20);
assert.equal(run.ok, true);
passed('Bounded recipes advance the exact requested tick interval');
const resumed = tools.restore(run.checkpoint, { ticks: 10, commands: [] });
assert.equal(resumed.startTick, 20);
assert.equal(resumed.endTick, 30);
passed('Checkpoint continuation retains the authoritative starting tick');
const commands = [{ atTick: 2, command: { kind: 'unknown', faction: 'alliance' } }, { atTick: 3, command: { kind: 'unknown', faction: 'alliance' } }];
const rejected = tools.run({ ticks: 10, commands });
assert.equal(rejected.completedTicks, 2);
assert.equal(rejected.stopReason, 'command-rejected');
assert.equal(rejected.skippedCommands, 1);
assert.equal(rejected.commands.length, 1);
const continued = tools.run({ ticks: 10, commands, stopOnError: false });
assert.equal(continued.completedTicks, 10);
assert.equal(continued.commands.length, 2);
assert.equal(continued.ok, false);
passed('Rejected commands retain explicit stop and continuation receipts');
for (const input of [{ ticks: 20001 }, { ticks: -1 }, { ticks: 1.5 }, { ticks: 1, commands: [{ atTick: 2, command: {} }] }, { ticks: 1, commands: [{ atTick: 1, command: {} }, { atTick: 0, command: {} }] }, { ticks: 1, commands: Array(257).fill({ atTick: 0, command: {} }) }])
    assert.throws(() => tools.run(input));
assert.throws(() => tools.restore(run.checkpoint, { missionId: 'frontier', ticks: 0 }));
passed('Recipe clock, schedule, command-count and saved mission budgets reject before execution');
const exported = tools.catalog();
exported.units[0]!.name = 'Detached test';
assert.notEqual(tools.catalog().units[0]!.name, 'Detached test');
assert.equal(tools.validate({ ...tools.catalog(), units: [] }).ok, false);
passed('Catalog outputs are detached and whole-catalog validation rejects missing archetypes');
const objectiveCatalog = tools.catalog();
const mission = objectiveCatalog.missions[0]!;
const objectiveRun = tools.run({ ticks: 100, commands: [] }, { ...objectiveCatalog, missions: [{ ...mission, objectives: [{ id: 'bounded', name: 'Bounded survival', description: 'Finish the test after three ticks.', type: 'survive', target: 'alliance', amount: .3 }] }] });
assert.equal(objectiveRun.completedTicks, 3);
assert.equal(objectiveRun.stopReason, 'mission-ended');
passed('Mission completion reports actual early-stop tick instead of requested duration');
let accessorReads = 0;
const hostile = { commands: [] };
Object.defineProperty(hostile, 'ticks', { enumerable: true, get() { accessorReads++; return 1; } });
assert.throws(() => tools.run(hostile));
assert.equal(accessorReads, 0);
const cyclic: {
    ticks: number;
    self?: unknown;
} = { ticks: 1 };
cyclic.self = cyclic;
assert.throws(() => tools.run(cyclic));
passed('Hostile accessors and cyclic recipes reject without invoking imported getters');
const portable = JSON.parse(JSON.stringify(run.checkpoint)) as unknown;
assert.deepEqual(tools.restore(portable, { ticks: 10 }).checkpoint, resumed.checkpoint);
passed('JSON checkpoint exchange produces identical deterministic continuation');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'wildlands-rts-tools-'));
try {
    const input = path.join(temporary, 'recipe.json');
    fs.writeFileSync(input, JSON.stringify({ ticks: 0, commands: [] }));
    const invocation = spawnSync(process.execPath, [path.join(__dirname, 'tools/rts-cli.cjs'), 'run', input, input], { encoding: 'utf8' });
    assert.equal(invocation.status, 2);
    assert.match(invocation.stdout, /Output must not overwrite an input file/);
    assert.deepEqual(JSON.parse(fs.readFileSync(input, 'utf8')), { ticks: 0, commands: [] });
}
finally {
    fs.rmSync(temporary, { recursive: true, force: true });
}
passed('CLI refuses output-over-input writes and preserves original input bytes');
fs.writeFileSync(path.join(__dirname, 'rts-tools-results.json'), JSON.stringify({ passed: results.length, total: results.length, results }, null, 2) + '\n');
console.log('PASS RTS tools: bounded clocks, checkpoint continuation, rejection receipts, recipe budgets, detached catalog and CLI input protection');
