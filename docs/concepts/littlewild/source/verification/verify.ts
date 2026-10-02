import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";

interface Suite {
  name: string;
  command: string[];
  result: string;
  timeout: number;
}
interface SuiteResult extends Suite {
  exitCode: number;
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
  htmlSha256?: string;
  htmlBytes?: number;
  error?: string;
}

const ROOT = path.resolve(__dirname, "../..");
const GENERATED = path.join(ROOT, ".generated");
const OUT = path.join(ROOT, "verification", "v15");
fs.rmSync(OUT, { recursive:true, force:true });
fs.mkdirSync(OUT, { recursive: true });
const noBrowser = process.argv.includes("--no-browser");
const generated = (name: string): string => path.join(".generated", name);

const suites: Suite[] = [
  ["typescript-architecture", ["node", generated("tools/architecture-check.cjs")], generated("typescript-architecture-results.json"), 60],
  ["behavior-tree", ["node", generated("test-behavior-tree.cjs")], generated("behavior-tree-results.json"), 60],
  ["content-boundary", ["node", generated("test-content-boundary.cjs")], generated("content-boundary-results.json"), 60],
  ["assets", ["node", generated("test-assets.cjs")], generated("asset-catalog-results.json"), 60],
  ["creatures", ["node", generated("test-creatures.cjs")], generated("creature-catalog-results.json"), 60],
  ["ecs-core", ["node", generated("test-ecs.cjs")], generated("ecs-results.json"), 120],
  ["simulation-profile", ["node", generated("test-simulation-profile.cjs")], generated("simulation-profile-results.json"), 120],
  ["simulation-profile-integration", ["node", generated("test-simulation-profile-integration.cjs")], generated("simulation-profile-integration-results.json"), 180],
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

const report: GateReport = { status:"running", passed:0, total:0, suites:[], browserIncluded:!noBrowser };
const reportPath = path.join(OUT, "gate-results.json");
const write = (): void => fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");

function run(command: readonly string[], timeoutSeconds: number, capture = true) {
  const result = spawnSync(command[0]!, command.slice(1), {
    cwd: ROOT,
    encoding: "utf8",
    timeout: timeoutSeconds * 1000,
    stdio: capture ? "pipe" : "inherit",
    env: process.env
  });
  if (result.error) throw result.error;
  return result;
}

write();
try {
  const build = run(["npm", "run", "build", "--silent"], 120, false);
  if (build.status !== 0) throw new Error("TypeScript build failed.");
  const artifact = path.join(ROOT, "littlewild.html");
  const artifactBytes = fs.readFileSync(artifact);
  report.htmlSha256 = crypto.createHash("sha256").update(artifactBytes).digest("hex");
  report.htmlBytes = artifactBytes.length;

  for (const suite of suites) {
    const resultPath = path.join(ROOT, suite.result);
    fs.rmSync(resultPath, { force:true });
    process.stdout.write(`RUN ${suite.name}\n`);
    const start = performance.now();
    const runResult = run(suite.command, suite.timeout);
    fs.writeFileSync(path.join(OUT, suite.name + ".log"), (runResult.stdout ?? "") + "\n" + (runResult.stderr ?? ""));
    const entry: SuiteResult = { ...suite, exitCode:runResult.status ?? 1, seconds:Math.round((performance.now()-start)/10)/100 };
    report.suites.push(entry);
    if (runResult.status !== 0) throw new Error(`${suite.name} failed; see ${suite.name}.log`);
    const data = JSON.parse(fs.readFileSync(resultPath, "utf8")) as {passed:number;total?:number;failed?:number;results?:Array<{passed?:boolean}>};
    const passed = data.passed;
    const total = data.total ?? data.results?.length ?? 0;
    if (!Number.isInteger(passed) || !Number.isInteger(total) || total <= 0 || passed !== total) {
      throw new Error(`${suite.name} returned incomplete counts`);
    }
    if ((data.failed ?? 0) !== 0 || data.results?.some(test => test.passed === false)) {
      throw new Error(`${suite.name} reports failures`);
    }
    entry.passed=passed;entry.total=total;report.passed+=passed;report.total+=total;
    write();
    process.stdout.write(`PASS ${suite.name} ${passed}/${total}\n`);
  }

  const finalHash=crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT,"littlewild.html"))).digest("hex");
  if(finalHash!==report.htmlSha256)throw new Error("The artifact changed during verification");
  report.status=noBrowser?"partial-passed":"passed";
} catch (error) {
  report.status="failed";
  report.error=error instanceof Error?error.message:String(error);
  process.stderr.write("FAILED "+report.error+"\n");
} finally {
  write();
}
process.stdout.write(`${report.status} ${report.passed}/${report.total}\n`);
if(report.status==="failed")process.exitCode=1;
