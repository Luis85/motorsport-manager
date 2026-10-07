/** Phase 1B regression checks for the data-driven, parallel gate. Registered by test-gate-integrity. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import path from "node:path";
import { parseVerifyArgs } from "./gate-integrity";
import { assessChecks, loadExpectations, validateExpectations, type GateExpectations } from "./gate-expectations";
import { isCompleteSelection, loadRegistry, selectSuites, shardSuites, validateRegistry } from "./suite-registry";
import { runPool } from "./worker-pool";
import { runCommandAsync } from "./process-runner";
import { assessSleeps, countSleeps, type SleepAllowList } from "./sleep-policy";
import { mergeShards } from "./merge-gate";

type Check = [name: string, action: () => void | Promise<void>];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const SLEEP_CALL = "waitFor" + "Timeout(";

function fixtureExpectations(): GateExpectations {
  return {
    schemaVersion: 1, historicalBaseline: { suites: 2, checks: 5 }, suites: ["alpha", "beta"], totalChecks: 4,
    reviewedAdditions: [{ suite: "beta", name: "added" }],
    renames: [{ suite: "alpha", from: "old name", to: "new name", reason: "fixture" }],
    retirements: [{ suite: "beta", name: "gone", reason: "fixture" }, { suite: "alpha", name: "also gone", reason: "fixture" }],
    inventory: { alpha: ["new name", "kept"], beta: ["added", "other"] }
  };
}

/** Linux: wait up to one second for a process to disappear or become a zombie, then always clean it up. */
async function assertTerminated(pid: number): Promise<void> {
  assert(Number.isInteger(pid) && pid > 0, "Probe did not report its descendant");
  try {
    const start = Date.now(); let running = true;
    while (running && Date.now() - start < 1000) {
      try { running = !/\) [ZX] /.test(fs.readFileSync(`/proc/${pid}/stat`, "utf8")); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; running = false; }
      if (running) await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(running, false, "Descendant survived process-group cleanup");
  } finally { try { process.kill(pid, "SIGKILL"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; } }
}

export function gateRunnerChecks(root: string, built: boolean): Check[] {
  const registryFile = path.join(root, "source/verification/suites.json");
  const expectationsFile = path.join(root, "source/verification/gate-expectations.json");
  return [
    ["Suite registry and gate expectations agree on the complete ordered gate", () => {
      const registry = loadRegistry(registryFile), expectations = loadExpectations(expectationsFile);
      assert.deepEqual(registry.map(suite => suite.name), expectations.suites);
      assert.equal(expectations.totalChecks, expectations.historicalBaseline.checks + expectations.reviewedAdditions.length - expectations.retirements.length);
      assert(registry.some(suite => suite.tier === "fast") && registry.some(suite => suite.kind === "browser"));
      if (built) for (const suite of registry) assert(fs.existsSync(path.join(root, suite.entry)), "Missing compiled suite entry " + suite.entry);
    }],
    ["Gate expectations reject duplicate, unreviewed, renamed and miscounted declarations", () => {
      assert.doesNotThrow(() => validateExpectations(fixtureExpectations()));
      const broken: Array<[string, (document: GateExpectations) => void]> = [
        ["duplicate check", document => { document.inventory.alpha!.push("kept"); document.totalChecks++; document.historicalBaseline.checks++; }],
        ["unlisted addition", document => { document.reviewedAdditions.push({ suite: "alpha", name: "absent" }); }],
        ["duplicate addition", document => { document.reviewedAdditions.push({ suite: "beta", name: "added" }); }],
        ["count mismatch", document => { document.totalChecks = 5; }],
        ["unexplained inventory growth", document => { document.inventory.beta!.push("silent"); document.totalChecks = 5; }],
        ["rename target missing", document => { document.renames[0]!.to = "absent"; }],
        ["rename source still present", document => { document.renames[0]!.from = "kept"; }],
        ["retired check still present", document => { document.retirements[0]!.name = "other"; }],
        ["suite order", document => { document.suites.reverse(); }],
        ["duplicate suite", document => { document.suites.push("alpha"); }]
      ];
      for (const [label, mutate] of broken) { const document = clone(fixtureExpectations()); mutate(document); assert.throws(() => validateExpectations(document), Error, label); }
    }],
    ["Check assessment fails closed on missing, unexpected, renamed and duplicate checks", () => {
      const expectations = fixtureExpectations();
      const exact = [{ suite: "alpha", names: ["new name", "kept"] }, { suite: "beta", names: ["other", "added"] }];
      assert.deepEqual(assessChecks(expectations, exact, true), []);
      const problems = (alpha: string[]): string => assessChecks(expectations, [{ suite: "alpha", names: alpha }], false).join("\n");
      assert.match(problems(["kept"]), /expected check\(s\) missing: "new name"/);
      assert.match(problems(["new name", "kept", "surprise"]), /unreviewed check\(s\): "surprise"/);
      assert.match(problems(["old name", "kept"]), /retired by a reviewed rename[\s\S]*undeclared rename/);
      assert.match(problems(["also gone", "new name", "kept"]), /retired check reappeared/);
      assert.match(problems(["new name", "kept", "kept"]), /duplicate check names/);
      assert.match(problems(["renamed silently", "kept"]), /undeclared rename/);
    }],
    ["Complete-gate assessment rejects missing suites, reordering, unknown suites and count mismatch", () => {
      const expectations = fixtureExpectations();
      const alpha = { suite: "alpha", names: ["new name", "kept"] }, beta = { suite: "beta", names: ["added", "other"] };
      assert.deepEqual(assessChecks(expectations, [alpha], false), []);
      assert.match(assessChecks(expectations, [alpha], true).join("\n"), /missing "beta"[\s\S]*observed 2 checks; 4 expected/);
      assert.match(assessChecks(expectations, [beta, alpha], true).join("\n"), /suite list differs/);
      assert.match(assessChecks(expectations, [alpha, beta, { suite: "gamma", names: ["x"] }], true).join("\n"), /Unexpected suite: gamma/);
      assert.match(assessChecks(expectations, [alpha, alpha, beta], true).join("\n"), /Suite reported twice/);
    }],
    ["Verify options parse jobs, tier, shard, only and keep-going strictly", () => {
      assert.deepEqual(parseVerifyArgs([]), { noBrowser: false, help: false, tier: "full", keepGoing: false });
      assert.deepEqual(parseVerifyArgs(["--jobs", "4", "--browser-jobs=2", "--tier", "fast", "--shard", "2/3", "--only", "a,b-c", "--keep-going", "--no-browser"]),
        { noBrowser: true, help: false, tier: "fast", keepGoing: true, jobs: 4, browserJobs: 2, shard: { index: 2, count: 3 }, only: ["a", "b-c"] });
      for (const args of [["--jobs"], ["--jobs", "0"], ["--jobs", "1.5"], ["--jobs", "65"], ["--tier", "medium"], ["--shard", "3/2"], ["--shard", "0/2"], ["--shard", "1"],
        ["--only", ""], ["--only", "a,a"], ["--only", "--no-browser"], ["--jobs", "2", "--jobs", "3"], ["--help", "--no-browser"], ["--keep-going=yes"], ["--typo"]])
        assert.throws(() => parseVerifyArgs(args), Error, args.join(" "));
    }],
    ["Suite selection is deterministic for tier, browser exclusion, only and complete shard partitions", () => {
      const registry = loadRegistry(registryFile);
      const full = { tier: "full" as const, noBrowser: false };
      assert.equal(isCompleteSelection(full), true);
      assert.deepEqual(selectSuites(registry, full), registry);
      const fast = selectSuites(registry, { tier: "fast", noBrowser: false });
      assert(fast.length > 0 && fast.every(suite => suite.tier === "fast" && suite.kind === "node"));
      assert(selectSuites(registry, { ...full, noBrowser: true }).every(suite => suite.kind === "node"));
      const names = registry.map(suite => suite.name);
      assert.deepEqual(selectSuites(registry, { ...full, only: [names[2]!, names[0]!] }).map(suite => suite.name), [names[0], names[2]]);
      assert.throws(() => selectSuites(registry, { ...full, only: ["not-registered"] }), /Unknown suite/);
      const browser = registry.find(suite => suite.kind === "browser")!.name;
      assert.throws(() => selectSuites(registry, { ...full, noBrowser: true, only: [browser] }), /excludes/);
      for (const count of [1, 2, 3, 4, 6]) {
        const shards = Array.from({ length: count }, (_, index) => selectSuites(registry, { ...full, shard: { index: index + 1, count } }));
        assert.deepEqual(shards.flat().map(suite => suite.name).sort(), [...names].sort());
        for (const shard of shards) assert.deepEqual(shard.map(suite => suite.name), names.filter(name => shard.some(suite => suite.name === name)));
        assert.deepEqual(shardSuites(registry, count), shardSuites(registry, count));
      }
      const valid = JSON.parse(fs.readFileSync(registryFile, "utf8")) as { suites: Array<Record<string, unknown>> };
      for (const mutate of [(rows: Array<Record<string, unknown>>) => rows.push(clone(rows[0]!)), (rows: Array<Record<string, unknown>>) => { rows[1]!.result = rows[0]!.result; },
        (rows: Array<Record<string, unknown>>) => { rows.find(row => row.kind === "browser")!.tier = "fast"; }, (rows: Array<Record<string, unknown>>) => { rows[0]!.result = "../outside.json"; },
        (rows: Array<Record<string, unknown>>) => { rows[0]!.timeout = 0; }, (rows: Array<Record<string, unknown>>) => { rows[0]!.extra = true; }]) {
        const document = clone(valid); mutate(document.suites); assert.throws(() => validateRegistry(document));
      }
    }],
    ["Parallel pool returns registry-ordered results identical to sequential execution and isolates exclusive suites", async () => {
      const tasks = Array.from({ length: 12 }, (_, index) => ({ id: index, kind: index % 3 === 0 ? "browser" : "node", cost: (index * 7) % 5 + 1, exclusive: index === 7 ? "rebuilds shared output" : undefined }));
      let exclusiveShared = false, exclusiveRunning = false;
      const execute = async (jobs: number) => {
        const active = { all: 0, browser: 0, peak: 0, browserPeak: 0 }, started: number[] = [];
        const results = await runPool(tasks, { jobs, limits: { browser: 2 } }, async task => {
          started.push(task.id); active.all++; if (task.kind === "browser") active.browser++;
          if (active.all > 1 && (task.exclusive || exclusiveRunning)) exclusiveShared = true;
          if (task.exclusive) exclusiveRunning = true;
          active.peak = Math.max(active.peak, active.all); active.browserPeak = Math.max(active.browserPeak, active.browser);
          await new Promise(resolve => setTimeout(resolve, task.cost * 3));
          active.all--; if (task.kind === "browser") active.browser--;
          if (task.exclusive) exclusiveRunning = false;
          return `${task.id}:${task.kind}`;
        });
        return { results, started, peak: active.peak, browserPeak: active.browserPeak };
      };
      const sequential = await execute(1);
      assert.deepEqual(sequential.started, tasks.map(task => task.id));
      assert.equal(sequential.peak, 1);
      for (const jobs of [2, 4, 8]) {
        const parallel = await execute(jobs);
        assert.deepEqual(parallel.results, sequential.results);
        assert(parallel.peak <= jobs && parallel.browserPeak <= 2 && parallel.peak > 1, JSON.stringify(parallel));
        assert.equal(parallel.started[0], 7, "Exclusive task starts first and alone");
      }
      assert.equal(exclusiveShared, false, "An exclusive task shared the pool");
      let calls = 0;
      const stopped = await runPool(tasks, { jobs: 2, stop: () => calls >= 2 }, async task => { calls++; return task.id; });
      assert.equal(stopped.filter(value => value !== undefined).length, 2);
    }],
    ["Asynchronous runner retains output, exit status, environment, timeouts and descendant cleanup", async () => {
      const failure = await runCommandAsync(["node", "-e", "console.log('progress:'+process.env.WILDLANDS_PROBE);console.error('reason');process.exit(7)"], process.cwd(), 5, { env: { ...process.env, WILDLANDS_PROBE: "isolated" } });
      assert.equal(failure.status, 7); assert.match(failure.stdout, /progress:isolated/); assert.match(failure.stderr, /reason/);
      const timeout = await runCommandAsync(["node", "-e", "console.log('started');setInterval(()=>{},1000)"], process.cwd(), 0.5);
      assert.equal(timeout.error?.code, "ETIMEDOUT"); assert.equal(timeout.signal, "SIGKILL"); assert.match(timeout.stdout, /started/);
      const bounded = await runCommandAsync(["node", "-e", "process.stdout.write('x'.repeat(4096))"], process.cwd(), 5, { maxBuffer: 1024 });
      assert.equal(bounded.error?.code, "ENOBUFS"); assert(bounded.stdout.length <= 1024);
      if (process.platform !== "linux") return;
      const timedOut = await runCommandAsync(["node", "-e", "const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});console.log(child.pid);setInterval(()=>{},1000)"], process.cwd(), 0.5);
      const reaped = await runCommandAsync(["node", "-e", "const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});console.log(child.pid);child.unref()"], process.cwd(), 5, { reapGroup: true });
      assert.equal(reaped.status, 0);
      for (const run of [timedOut, reaped]) await assertTerminated(Number(run.stdout.trim()));
    }],
    ["Shard merge requires identical identity, disjoint complete coverage and re-accepted evidence", () => {
      const temp = fs.mkdtempSync(path.join(os.tmpdir(), "wildlands-merge-"));
      try {
        const write = (relative: string, value: unknown): void => { fs.mkdirSync(path.dirname(path.join(temp, relative)), { recursive: true }); fs.writeFileSync(path.join(temp, relative), JSON.stringify(value)); };
        const expectations = fixtureExpectations();
        write("source/verification/gate-expectations.json", expectations);
        write("source/verification/suites.json", { schemaVersion: 1, suites: expectations.suites.map((name, index) => ({ name, kind: "node", tier: "fast", entry: `.generated/test-${name}.cjs`, result: `.generated/${name}-results.json`, timeout: 60, cost: index + 1 })) });
        const evidence = (names: string[]) => ({ passed: names.length, total: names.length, results: names.map(name => ({ name, passed: true })) });
        write(".generated/alpha-results.json", evidence(expectations.inventory.alpha!));
        write(".generated/beta-results.json", evidence(expectations.inventory.beta!));
        const identity = { sourceSha256: "s", htmlSha256: "h", registrySha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(temp, "source/verification/suites.json"))).digest("hex"), expectationsSha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(temp, "source/verification/gate-expectations.json"))).digest("hex") };
        const shard = (index: number, name: string) => ({ ...identity, status: "partial-passed", selection: { shard: `${index}/2`, tier: "full", noBrowser: false, only: null },
          suites: [{ name, result: `.generated/${name}-results.json`, exitCode: 0, passed: 2, total: 2 }] });
        const merged = mergeShards(temp, [shard(2, "beta"), shard(1, "alpha")]);
        assert.equal(merged.status, "passed"); assert.equal(merged.total, 4);
        assert.deepEqual((merged.suites as Array<{ name: string }>).map(suite => suite.name), ["alpha", "beta"]);
        assert.throws(() => mergeShards(temp, [shard(1, "alpha")]), /each shard/);
        assert.throws(() => mergeShards(temp, [shard(1, "alpha"), shard(2, "alpha")]), /more than one shard/);
        assert.throws(() => mergeShards(temp, [shard(1, "alpha"), { ...shard(2, "beta"), htmlSha256: "other" }]), /identity differs/);
        assert.throws(() => mergeShards(temp, [shard(1, "alpha"), { ...shard(2, "beta"), status: "failed" }]), /did not pass/);
        write(".generated/beta-results.json", evidence(["added", "renamed silently"]));
        assert.throws(() => mergeShards(temp, [shard(1, "alpha"), shard(2, "beta")]), /differs from gate-expectations/);
        write(".generated/beta-results.json", evidence(["added"]));
        assert.throws(() => mergeShards(temp, [shard(1, "alpha"), shard(2, "beta")]), /summary differs/);
      } finally { fs.rmSync(temp, { recursive: true, force: true }); }
    }],
    ["Verification sources add no fixed sleeps beyond the reviewed waitForTimeout budget", () => {
      const allowList = JSON.parse(fs.readFileSync(path.join(root, "source/verification/sleep-allowlist.json"), "utf8")) as SleepAllowList;
      assert.deepEqual(assessSleeps(path.join(root, "source"), allowList), []);
      assert.equal(countSleeps(`await page.${SLEEP_CALL}5);page.${SLEEP_CALL} 1)`), 2);
      const temp = fs.mkdtempSync(path.join(os.tmpdir(), "wildlands-sleep-policy-"));
      try {
        fs.mkdirSync(path.join(temp, "verification"));
        fs.writeFileSync(path.join(temp, "verification", "old-browser.ts"), `page.${SLEEP_CALL}1);`);
        fs.writeFileSync(path.join(temp, "test-node.cts"), "export {};");
        const policy: SleepAllowList = { schemaVersion: 1, pattern: "waitForTimeout", files: { "verification/old-browser.ts": 1 } };
        assert.deepEqual(assessSleeps(temp, policy), []);
        fs.writeFileSync(path.join(temp, "verification", "new-browser.ts"), `page.${SLEEP_CALL}1);`);
        assert.match(assessSleeps(temp, policy).join("\n"), /new-browser\.ts: 1 .*budget is 0/);
        fs.rmSync(path.join(temp, "verification", "new-browser.ts"));
        fs.writeFileSync(path.join(temp, "test-node.cts"), `page.${SLEEP_CALL}1);`);
        assert.match(assessSleeps(temp, policy).join("\n"), /test-node\.cts/);
        fs.writeFileSync(path.join(temp, "test-node.cts"), "export {};");
        fs.writeFileSync(path.join(temp, "verification", "old-browser.ts"), `page.${SLEEP_CALL}1);page.${SLEEP_CALL}2);`);
        assert.match(assessSleeps(temp, policy).join("\n"), /2 waitForTimeout/);
        fs.writeFileSync(path.join(temp, "verification", "old-browser.ts"), "await condition();");
        assert.match(assessSleeps(temp, policy).join("\n"), /lower it/);
        assert.match(assessSleeps(temp, { ...policy, files: { ...policy.files, "verification/missing.ts": 1 } }).join("\n"), /no scanned source/);
      } finally { fs.rmSync(temp, { recursive: true, force: true }); }
    }]
  ];
}
