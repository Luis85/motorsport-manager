import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { runCommand } from "./process-runner";
import { performance } from "node:perf_hooks";
import { acceptedCounts, parseGateArgs, sourceIdentity } from "./gate-integrity";

interface Suite {
  name: string;
  command: string[];
  result: string;
  timeout: number;
}
interface SuiteResult extends Suite {
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
  sourceSha256: string;
  startedAt: string;
  finishedAt?: string;
  environment: { node: string; platform: string; architecture: string; chromium: string };
  htmlSha256?: string;
  htmlBytes?: number;
  error?: string;
}

const ROOT = path.resolve(__dirname, "../..");
const GENERATED = path.join(ROOT, ".generated");
const OUT = path.join(ROOT, "verification", "v15");
let options: ReturnType<typeof parseGateArgs>;
try { options = parseGateArgs(process.argv.slice(2)); }
catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exit(2); }
if (options.help) { console.log("Usage: npm run verify -- [--no-browser | --help]\n--no-browser produces partial evidence only."); process.exit(0); }
const noBrowser = options.noBrowser;
const initialSource = sourceIdentity(ROOT);
fs.rmSync(OUT, { recursive:true, force:true });
fs.mkdirSync(OUT, { recursive: true });
const generated = (name: string): string => path.join(".generated", name);

const suites: Suite[] = [
  ["canvas-renderer", ["node", generated("test-canvas-renderer.cjs")], generated("canvas-renderer-results.json"), 120],
  ["architecture-policy", ["node", generated("test-architecture-policy.cjs")], generated("architecture-policy-results.json"), 60],
  ["storage-clock", ["node", generated("test-storage-clock.cjs")], generated("storage-clock-results.json"), 60],
  ["gate-integrity", ["node", generated("test-gate-integrity.cjs")], generated("gate-integrity-results.json"), 60],
  ["cli-contracts", ["node", generated("test-cli-contracts.cjs")], generated("cli-contract-results.json"), 120],
  ["typescript-architecture", ["node", generated("tools/architecture-check.cjs")], generated("typescript-architecture-results.json"), 60],
  ["behavior-tree", ["node", generated("test-behavior-tree.cjs")], generated("behavior-tree-results.json"), 60],
  ["content-boundary", ["node", generated("test-content-boundary.cjs")], generated("content-boundary-results.json"), 60],
  ["assets", ["node", generated("test-assets.cjs")], generated("asset-catalog-results.json"), 60],
  ["creatures", ["node", generated("test-creatures.cjs")], generated("creature-catalog-results.json"), 60],
  ["ecs-core", ["node", generated("test-ecs.cjs")], generated("ecs-results.json"), 120],
  ["simulation-profile", ["node", generated("test-simulation-profile.cjs")], generated("simulation-profile-results.json"), 120],
  ["simulation-profile-integration", ["node", generated("test-simulation-profile-integration.cjs")], generated("simulation-profile-integration-results.json"), 180],
  ["developer-toolbox", ["node", generated("test-developer-toolbox.cjs")], generated("developer-toolbox-results.json"), 180],
  ["engine-composition", ["node", generated("test-engine-composition.cjs")], generated("engine-composition-results.json"), 180],
  ["ecs-activity", ["node", generated("test-ecs-activity.cjs")], generated("ecs-activity-results.json"), 120],
  ["ecs-world", ["node", generated("test-ecs-world.cjs")], generated("ecs-world-results.json"), 120],
  ["ecs-economy", ["node", generated("test-economy-ecs.cjs")], generated("economy-ecs-results.json"), 120],
  ["ecs-integration", ["node", generated("test-ecs-integration.cjs")], generated("ecs-integration-results.json"), 180],
  ["ecs-world-integration", ["node", generated("test-ecs-world-integration.cjs")], generated("ecs-world-integration-results.json"), 180],
  ["ecs-economy-integration", ["node", generated("test-economy-integration.cjs")], generated("economy-integration-results.json"), 180],
  ["scenario-domain", ["node", generated("test-scenario-domain.cjs")], generated("scenario-domain-results.json"), 120],
  ["presentation", ["node", generated("test-presentation.cjs")], generated("presentation-results.json"), 120],
  ["pause-policy", ["node", generated("test-pause-policy.cjs")], generated("pause-policy-results.json"), 120],
  ["cartography", ["node", generated("test-cartography.cjs")], generated("cartography-results.json"), 180],
  ["domain", ["node", generated("test-domain.cjs")], generated("domain-results.json"), 180],
  ["growth-stress", ["node", generated("test-growth-stress.cjs")], generated("growth-stress-results.json"), 300],
  ["earned-progression", ["node", generated("test-earned-progression.cjs")], generated("earned-progression-results.json"), 300],
  ["scenario-schema-cli", ["node", generated("verification/schema-checks.js")], generated("scenario-schema-results.json"), 90],
  ["release", ["node", generated("test-release.cjs")], generated("release-results.json"), 180]
].map(([name, command, result, timeout]) => ({ name: name as string, command: command as string[], result: result as string, timeout: timeout as number }));

if (!noBrowser) {
  suites.push(
    { name:"browser", command:["node", generated("verification/browser.js")], result:"verification/v15/browser-results.json", timeout:300 },
    { name:"browser-contracts", command:["node", generated("verification/browser-contracts.js")], result:"verification/v15/browser-contract-results.json", timeout:240 }
  );
}

const report: GateReport = { status:"running", passed:0, total:0, suites:[], browserIncluded:!noBrowser, sourceSha256:initialSource, startedAt:new Date().toISOString(), environment:{node:process.version,platform:process.platform,architecture:process.arch,chromium:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "playwright-bundled"} };
const reportPath = path.join(OUT, "gate-results.json");
const write = (): void => fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");

const run = (command: readonly string[], timeoutSeconds: number, capture = true) => runCommand(command, ROOT, timeoutSeconds, capture);

write();
try {
  const strict = run(["npm", "run", "typecheck", "--silent"], 120);
  fs.writeFileSync(path.join(OUT, "typecheck.log"), (strict.stdout ?? "") + "\n" + (strict.stderr ?? ""));
  if (strict.error || strict.status !== 0) throw new Error("Strict TypeScript preflight failed; see typecheck.log" + (strict.error ? ": " + strict.error.message : ""));
  const build = run(["npm", "run", "build", "--silent"], 120, false);
  if (build.error || build.status !== 0) throw new Error("TypeScript build failed." + (build.error ? " " + build.error.message : ""));
  const artifact = path.join(ROOT, "littlewild.html");
  const artifactBytes = fs.readFileSync(artifact);
  report.htmlSha256 = crypto.createHash("sha256").update(new Uint8Array(artifactBytes)).digest("hex");
  report.htmlBytes = artifactBytes.length;

  for (const suite of suites) {
    const resultPath = path.join(ROOT, suite.result);
    fs.rmSync(resultPath, { force:true });
    process.stdout.write(`RUN ${suite.name}\n`);
    const start = performance.now();
    const runResult = run(suite.command, suite.timeout);
    fs.writeFileSync(path.join(OUT, suite.name + ".log"), (runResult.stdout ?? "") + "\n" + (runResult.stderr ?? ""));
    const entry: SuiteResult = { ...suite, exitCode:runResult.status ?? 1, seconds:Math.round((performance.now()-start)/10)/100 };
    if (runResult.signal) entry.signal = runResult.signal;
    if (runResult.error) entry.error = runResult.error.message;
    report.suites.push(entry);
    write();
    if (runResult.error || runResult.status !== 0) throw new Error(`${suite.name} failed; see ${suite.name}.log${runResult.error ? ": " + runResult.error.message : ""}${runResult.signal ? " (" + runResult.signal + ")" : ""}`);
    let counts: ReturnType<typeof acceptedCounts>;
    try { counts = acceptedCounts(JSON.parse(fs.readFileSync(resultPath, "utf8"))); }
    catch (error) {
      entry.error = `${suite.name} invalid evidence (${suite.result}): ${error instanceof Error ? error.message : String(error)}`;
      throw new Error(entry.error);
    }
    const { passed, total } = counts;
    entry.passed=passed;entry.total=total;report.passed+=passed;report.total+=total;
    write();
    process.stdout.write(`PASS ${suite.name} ${passed}/${total}\n`);
  }

  const finalHash=crypto.createHash("sha256").update(new Uint8Array(fs.readFileSync(path.join(ROOT,"littlewild.html")))).digest("hex");
  if(finalHash!==report.htmlSha256)throw new Error("The artifact changed during verification");
  if(sourceIdentity(ROOT)!==initialSource)throw new Error("Authored source changed during verification; rerun the gate");
  report.status=noBrowser?"partial-passed":"passed";
} catch (error) {
  report.status="failed";
  report.error=error instanceof Error?error.message:String(error);
  process.stderr.write("FAILED "+report.error+"\n");
} finally {
  report.finishedAt = new Date().toISOString();
  write();
}
process.stdout.write(`${report.status} ${report.passed}/${report.total}\n`);
if(report.status==="failed")process.exitCode=1;
