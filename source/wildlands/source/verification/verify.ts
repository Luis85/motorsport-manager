import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import { runCommandAsync, type AsyncCommandResult } from "./process-runner";
import { acceptedCounts, parseVerifyArgs, sourceIdentity, VERIFY_USAGE, type VerifyOptions } from "./gate-integrity";
import { isCompleteSelection, loadRegistry, selectSuites, type RegisteredSuite } from "./suite-registry";
import { assessChecks, loadExpectations, type GateExpectations } from "./gate-expectations";
import { defaultJobs, runPool } from "./worker-pool";

interface SuiteResult {
  name: string;
  command: string[];
  result: string;
  timeout: number;
  kind: RegisteredSuite["kind"];
  exitCode: number;
  signal?: string;
  error?: string;
  seconds: number;
  passed?: number;
  total?: number;
}
interface GateReport {
  status: "running" | "passed" | "partial-passed" | "failed";
  passed: number;
  total: number;
  suites: SuiteResult[];
  browserIncluded: boolean;
  complete: boolean;
  selection: { tier: VerifyOptions["tier"]; noBrowser: boolean; only: string[] | null; shard: string | null; suites: number };
  execution: { jobs: number; browserJobs: number; keepGoing: boolean; wallSeconds?: number };
  registrySha256: string;
  expectationsSha256: string;
  expectationProblems?: string[];
  sourceSha256: string;
  startedAt: string;
  finishedAt?: string;
  environment: { node: string; platform: string; architecture: string; chromium: string; cores: number };
  htmlSha256?: string;
  htmlBytes?: number;
  error?: string;
}

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "verification", "v15");
const REGISTRY = path.join(ROOT, "source", "verification", "suites.json");
const EXPECTATIONS = path.join(ROOT, "source", "verification", "gate-expectations.json");
const sha256 = (file: string): string => crypto.createHash("sha256").update(new Uint8Array(fs.readFileSync(file))).digest("hex");

let options: VerifyOptions, registry: RegisteredSuite[], expectations: GateExpectations, selected: RegisteredSuite[];
try {
  options = parseVerifyArgs(process.argv.slice(2));
  if (options.help) { console.log(VERIFY_USAGE + "\nAny option other than the defaults produces partial evidence only."); process.exit(0); }
  registry = loadRegistry(REGISTRY);
  expectations = loadExpectations(EXPECTATIONS);
  if (JSON.stringify(registry.map(suite => suite.name)) !== JSON.stringify(expectations.suites)) throw new Error("suites.json and gate-expectations.json list different suites or orders");
  selected = selectSuites(registry, options);
  if (!selected.length) throw new Error("The selection contains no suites");
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exit(2); }

const complete = isCompleteSelection(options);
const jobs = options.jobs ?? defaultJobs();
const browserJobs = Math.min(options.browserJobs ?? 2, jobs);
const initialSource = sourceIdentity(ROOT);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const report: GateReport = {
  status: "running", passed: 0, total: 0, suites: [], browserIncluded: selected.some(suite => suite.kind === "browser"), complete,
  selection: { tier: options.tier, noBrowser: options.noBrowser, only: options.only ?? null, shard: options.shard ? `${options.shard.index}/${options.shard.count}` : null, suites: selected.length },
  execution: { jobs, browserJobs, keepGoing: options.keepGoing },
  registrySha256: sha256(REGISTRY), expectationsSha256: sha256(EXPECTATIONS),
  sourceSha256: initialSource, startedAt: new Date().toISOString(),
  environment: { node: process.version, platform: process.platform, architecture: process.arch, chromium: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "playwright-bundled", cores: os.availableParallelism?.() ?? os.cpus().length }
};
const reportPath = path.join(OUT, "gate-results.json");
const progressPath = path.join(OUT, "gate-progress.json");
// gate-results.json changes only at start and finish, so suites that compare it across their own
// run stay valid while other suites finish concurrently; per-suite progress goes to gate-progress.json.
const write = (file = reportPath): void => fs.writeFileSync(file, JSON.stringify(report, null, 2) + "\n");
const logOf = (run: AsyncCommandResult): string => run.stdout + "\n" + run.stderr;

async function preflight(): Promise<void> {
  // Strict type checking emits nothing, so it runs beside the build instead of before it.
  const [strict, build] = await Promise.all([
    runCommandAsync(["npm", "run", "typecheck", "--silent"], ROOT, 180),
    runCommandAsync(["npm", "run", "build", "--silent"], ROOT, 180)
  ]);
  fs.writeFileSync(path.join(OUT, "typecheck.log"), logOf(strict));
  fs.writeFileSync(path.join(OUT, "build.log"), logOf(build));
  if (strict.error || strict.status !== 0) throw new Error("Strict TypeScript preflight failed; see typecheck.log" + (strict.error ? ": " + strict.error.message : ""));
  if (build.error || build.status !== 0) throw new Error("TypeScript build failed; see build.log" + (build.error ? ": " + build.error.message : ""));
}

/** Best-effort removal of per-suite scratch; a straggling helper must not turn evidence into a crash. */
function removeScratch(directory: string): void {
  try { fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
  catch (error) { process.stderr.write(`WARN could not remove ${directory}: ${error instanceof Error ? error.message : String(error)}\n`); }
}

async function runSuite(suite: RegisteredSuite, scratch: string, failures: string[]): Promise<{ entry: SuiteResult; names?: string[] }> {
  const command = ["node", suite.entry];
  const entry: SuiteResult = { name: suite.name, command, result: suite.result, timeout: suite.timeout, kind: suite.kind, exitCode: 1, seconds: 0 };
  try { return await executeSuite(suite, scratch, failures, entry); }
  catch (error) {
    // Launcher defects are recorded against the suite instead of discarding all collected evidence.
    entry.error = `${suite.name} launcher error: ${error instanceof Error ? error.message : String(error)}`;
    failures.push(entry.error);
    process.stdout.write(`FAIL ${suite.name}\n`);
    return { entry };
  }
}

async function executeSuite(suite: RegisteredSuite, scratch: string, failures: string[], entry: SuiteResult): Promise<{ entry: SuiteResult; names?: string[] }> {
  const resultPath = path.join(ROOT, suite.result);
  fs.rmSync(resultPath, { force: true });
  // Isolate per-suite temporary files and give each suite a private output directory.
  const temporary = path.join(scratch, suite.name), output = path.join(OUT, "suite-output", suite.name);
  fs.mkdirSync(temporary, { recursive: true });
  fs.mkdirSync(output, { recursive: true });
  const env = { ...process.env, TMPDIR: temporary, TMP: temporary, TEMP: temporary, WILDLANDS_SUITE_NAME: suite.name, WILDLANDS_SUITE_OUT: output };
  process.stdout.write(`RUN ${suite.name}\n`);
  const start = performance.now();
  const run = await runCommandAsync(entry.command, ROOT, suite.timeout, { env, reapGroup: true });
  fs.writeFileSync(path.join(OUT, suite.name + ".log"), logOf(run));
  removeScratch(temporary);
  if (!fs.readdirSync(output).length) fs.rmdirSync(output);
  entry.exitCode = run.status ?? 1;
  entry.seconds = Math.round((performance.now() - start) / 10) / 100;
  if (run.signal) entry.signal = run.signal;
  if (run.error) entry.error = run.error.message;
  if (run.error || run.status !== 0) {
    failures.push(`${suite.name} failed; see ${suite.name}.log${run.error ? ": " + run.error.message : ""}${run.signal ? " (" + run.signal + ")" : ""}`);
    process.stdout.write(`FAIL ${suite.name}\n`);
    return { entry };
  }
  try {
    const data = JSON.parse(fs.readFileSync(resultPath, "utf8")) as { results: Array<{ name: string }> };
    const counts = acceptedCounts(data);
    entry.passed = counts.passed; entry.total = counts.total;
    process.stdout.write(`PASS ${suite.name} ${counts.passed}/${counts.total}\n`);
    return { entry, names: data.results.map(row => row.name) };
  } catch (error) {
    entry.error = `${suite.name} invalid evidence (${suite.result}): ${error instanceof Error ? error.message : String(error)}`;
    failures.push(entry.error);
    process.stdout.write(`FAIL ${suite.name}\n`);
    return { entry };
  }
}

async function main(): Promise<void> {
  const started = performance.now();
  write();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "wildlands-gate-"));
  try {
    await preflight();
    const artifact = path.join(ROOT, ".generated/artifacts/showcase.html");
    const artifactBytes = fs.readFileSync(artifact);
    report.htmlSha256 = crypto.createHash("sha256").update(new Uint8Array(artifactBytes)).digest("hex");
    report.htmlBytes = artifactBytes.length;
    write();
    const failures: string[] = [];
    const outcomes = await runPool(selected, { jobs, limits: { browser: browserJobs }, stop: () => failures.length > 0 && !options.keepGoing }, async suite => {
      const outcome = await runSuite(suite, scratch, failures);
      // Progress is advisory; registry order is restored for the final report below.
      report.suites.push(outcome.entry);
      write(progressPath);
      return outcome;
    });
    report.suites = outcomes.flatMap(outcome => outcome ? [outcome.entry] : []);
    report.passed = report.suites.reduce((sum, suite) => sum + (suite.passed ?? 0), 0);
    report.total = report.suites.reduce((sum, suite) => sum + (suite.total ?? 0), 0);
    if (failures.length) throw new Error(failures.join("\n"));
    const observed = selected.map((suite, index) => ({ suite: suite.name, names: outcomes[index]!.names! }));
    const problems = assessChecks(expectations, observed, complete);
    if (problems.length) { report.expectationProblems = problems; throw new Error("Check inventory differs from gate-expectations.json:\n" + problems.join("\n")); }
    if (sha256(artifact) !== report.htmlSha256) throw new Error("The artifact changed during verification");
    if (sourceIdentity(ROOT) !== initialSource) throw new Error("Authored source changed during verification; rerun the gate");
    report.status = complete ? "passed" : "partial-passed";
  } catch (error) {
    report.status = "failed";
    report.error = error instanceof Error ? error.message : String(error);
    process.stderr.write("FAILED " + report.error + "\n");
  } finally {
    removeScratch(scratch);
    const suiteOutput = path.join(OUT, "suite-output");
    if (fs.existsSync(suiteOutput) && !fs.readdirSync(suiteOutput).length) fs.rmdirSync(suiteOutput);
    report.finishedAt = new Date().toISOString();
    report.execution.wallSeconds = Math.round((performance.now() - started) / 10) / 100;
    write();
    fs.rmSync(progressPath, { force: true });
  }
  process.stdout.write(`${report.status} ${report.passed}/${report.total} (${report.suites.length} suites, ${report.execution.wallSeconds}s, jobs ${jobs})\n`);
  if (report.status === "failed") process.exitCode = 1;
}

void main();
