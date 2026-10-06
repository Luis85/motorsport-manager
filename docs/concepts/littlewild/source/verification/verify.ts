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
  ["skill-trees", ["node", generated("test-skill-trees.cjs")], generated("skill-tree-results.json"), 120],
  ["rts-mission-editor", ["node", generated("test-rts-mission-editor.cjs")], generated("rts-mission-editor-results.json"), 120],
  ["rts-catalog", ["node", generated("test-rts-catalog.cjs")], generated("rts-catalog-results.json"), 120],
  ["rts-economy", ["node", generated("test-rts-economy.cjs")], generated("rts-economy-results.json"), 120],
  ["rts-production", ["node", generated("test-rts-production.cjs")], generated("rts-production-results.json"), 120],
  ["rts-runtime", ["node", generated("test-rts-runtime.cjs")], generated("rts-runtime-results.json"), 120],
  ["rts-tools", ["node", generated("test-rts-tools.cjs")], generated("rts-tools-results.json"), 120],
  ["rts-application", ["node", generated("test-rts-application.cjs")], generated("rts-application-results.json"), 120],
  ["pet-catalog", ["node", generated("test-pet-catalog.cjs")], generated("pet-catalog-results.json"), 120],
  ["pet-runtime", ["node", generated("test-pet-runtime.cjs")], generated("pet-runtime-results.json"), 180],
  ["pet-application", ["node", generated("test-pet-application.cjs")], generated("pet-application-results.json"), 120],

  ["wildlands-runtime", ["node", generated("test-wildlands-runtime.cjs")], generated("wildlands-runtime-results.json"), 300],
  ["wildlands-project", ["node", generated("test-wildlands-project.cjs")], generated("wildlands-project-results.json"), 120],
  ["wildlands-cli", ["node", generated("test-wildlands-cli.cjs")], generated("wildlands-cli-results.json"), 300],
  ["wildlands-acceptance", ["node", generated("test-wildlands-acceptance.cjs")], generated("wildlands-acceptance-results.json"), 300],
  ["engine-export-cli", ["node", generated("test-engine-export-cli.cjs")], generated("engine-export-cli-results.json"), 240],
  ["engine-export", ["node", generated("test-engine-export.cjs")], generated("engine-export-results.json"), 240],
  ["animations", ["node", generated("test-animations.cjs")], "verification/v15/animations-results.json", 120],
  ["balancing-cli", ["node", generated("test-balancing-cli.cjs")], generated("balancing-cli-results.json"), 240],
  ["cold-balancing", ["node", generated("test-cold-balancing.cjs")], generated("cold-balancing-results.json"), 180],
  ["balancing", ["node", generated("test-balancing.cjs")], generated("balancing-results.json"), 240],
  ["storytelling", ["node", generated("test-storytelling.cjs")], generated("storytelling-results.json"), 180],
  ["external-editor-cli", ["node", generated("test-external-editor-cli.cjs")], generated("external-editor-cli-results.json"), 180],
  ["external-canvas", ["node", generated("test-external-canvas.cjs")], generated("external-canvas-results.json"), 180],
  ["creature-editor", ["node", generated("test-creature-editor.cjs")], generated("creature-editor-results.json"), 240],
  ["external-editors", ["node", generated("test-external-editors.cjs")], generated("external-editors-results.json"), 240],
  ["renderer-scene-2d", ["node", generated("test-renderer-scene-2d.cjs")], generated("renderer-scene-2d-results.json"), 120],
  ["scene-editor", ["node", generated("test-scene-editor.cjs")], generated("scene-editor-results.json"), 120],
  ["scene-navigation", ["node", generated("test-scene-navigation.cjs")], generated("scene-navigation-results.json"), 180],
  ["architecture-extensions", ["node", generated("test-architecture-extensions.cjs")], generated("architecture-extensions-results.json"), 120],
  ["building-interiors", ["node", generated("test-building-interiors.cjs")], generated("building-interiors-results.json"), 120],
  ["construction", ["node", generated("test-construction.cjs")], generated("construction-results.json"), 120],
  ["terraform", ["node", generated("test-terraform.cjs")], generated("terraform-results.json"), 120],
  ["renderers", ["node", generated("test-renderers.cjs")], generated("renderer-results.json"), 120],
  ["canvas-renderer", ["node", generated("test-canvas-renderer.cjs")], generated("canvas-renderer-results.json"), 120],
  ["architecture-policy", ["node", generated("test-architecture-policy.cjs")], generated("architecture-policy-results.json"), 60],
  ["storage-clock", ["node", generated("test-storage-clock.cjs")], generated("storage-clock-results.json"), 60],
  ["gate-integrity", ["node", generated("test-gate-integrity.cjs")], generated("gate-integrity-results.json"), 60],
  ["cli-contracts", ["node", generated("test-cli-contracts.cjs")], generated("cli-contract-results.json"), 120],
  ["typescript-architecture", ["node", generated("tools/architecture-check.cjs")], generated("typescript-architecture-results.json"), 60],
  ["behavior-tree", ["node", generated("test-behavior-tree.cjs")], generated("behavior-tree-results.json"), 60],
  ["content-boundary", ["node", generated("test-content-boundary.cjs")], generated("content-boundary-results.json"), 60],
  ["definition-source", ["node", generated("test-definition-source.cjs")], generated("definition-source-results.json"), 60],
  ["assets", ["node", generated("test-assets.cjs")], generated("asset-catalog-results.json"), 60],
  ["creatures", ["node", generated("test-creatures.cjs")], generated("creature-catalog-results.json"), 60],
  ["ecs-core", ["node", generated("test-ecs.cjs")], generated("ecs-results.json"), 120],
  ["simulation-profile", ["node", generated("test-simulation-profile.cjs")], generated("simulation-profile-results.json"), 120],
  ["simulation-profile-integration", ["node", generated("test-simulation-profile-integration.cjs")], generated("simulation-profile-integration-results.json"), 180],
  ["scene-environment", ["node", generated("test-scene-environment.cjs")], generated("scene-environment-results.json"), 60],
  ["office-scenario", ["node", generated("test-office-scenario.cjs")], generated("office-scenario-results.json"), 120],
  ["game-settings", ["node", generated("test-game-settings.cjs")], generated("game-settings-results.json"), 120],
  ["game-settings-ui", ["node", generated("test-game-settings-ui.cjs")], generated("game-settings-ui-results.json"), 60],
  ["creature-interactions", ["node", generated("test-interactions.cjs")], generated("interaction-results.json"), 120],
  ["interaction-ui", ["node", generated("test-interaction-ui.cjs")], generated("interaction-ui-results.json"), 60],
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
    { name:"skill-tree-browser", command:["node", generated("verification/skill-tree-browser.js")], result:"verification/v15/skill-tree-browser-results.json", timeout:180 },
    { name:"rts-mission-editor-browser", command:["node", generated("verification/rts-mission-editor-browser.js")], result:"verification/v15/rts-mission-editor-browser-results.json", timeout:240 },
    { name:"rts-browser", command:["node", generated("verification/rts-browser.js")], result:"verification/v15/rts-browser-results.json", timeout:240 },
    { name:"pet-browser", command:["node", generated("verification/pet-browser.js")], result:"verification/v15/pet-browser-results.json", timeout:300 },
    { name:"wildlands-browser", command:["node", generated("verification/wildlands-browser.js")], result:"verification/v15/wildlands-browser-results.json", timeout:300 },
    { name:"external-editors-browser", command:["node", generated("verification/external-editors-browser.js")], result:"verification/v15/external-editors-browser-results.json", timeout:240 },
    { name:"external-canvas-browser", command:["node", generated("verification/external-canvas-browser.js")], result:"verification/v15/external-canvas-browser-results.json", timeout:240 },
    { name:"creature-editor-browser", command:["node", generated("verification/creature-editor-browser.js")], result:"verification/v15/creature-editor-browser-results.json", timeout:300 },
    { name:"balancing-defaults-browser", command:["node", generated("verification/balancing-defaults-browser.js")], result:"verification/v15/balancing-defaults-browser-results.json", timeout:300 },
    { name:"balancing-browser", command:["node", generated("verification/balancing-browser.js")], result:"verification/v15/balancing-browser-results.json", timeout:300 },
    { name:"storytelling-browser", command:["node", generated("verification/storytelling-browser.js")], result:"verification/v15/storytelling-browser-results.json", timeout:300 },
    { name:"engine-export-browser", command:["node", generated("verification/engine-export-browser.js")], result:"verification/v15/engine-export-browser-results.json", timeout:300 },
    { name:"renderer-storytelling", command:["node", generated("verification/renderers-storytelling-browser.js")], result:"verification/v15/renderers-storytelling-browser-results.json", timeout:300 },
    { name:"storytelling-player-browser", command:["node", generated("verification/storytelling-player-browser.js")], result:"verification/v15/storytelling-player-browser-results.json", timeout:300 },
    { name:"renderer-libraries", command:["node", generated("verification/renderers-libraries-browser.js")], result:"verification/v15/renderers-libraries-browser-results.json", timeout:240 },
    { name:"scene-editor-browser", command:["node", generated("verification/scene-editor-browser.js")], result:"verification/v15/scene-editor-browser-results.json", timeout:180 },
    { name:"building-interiors-browser", command:["node", generated("verification/building-interiors-browser.js")], result:"verification/v15/building-interiors-browser.json", timeout:180 },
    { name:"construction-editor-browser", command:["node", generated("verification/construction-editor-browser.js")], result:"verification/v15/construction-editor-browser-results.json", timeout:180 },
    { name:"terraform-browser", command:["node", generated("verification/terraform-browser.js")], result:"verification/v15/terraform-browser-results.json", timeout:180 },
    { name:"renderers-browser", command:["node", generated("verification/renderers-browser.js")], result:"verification/v15/renderers-browser-results.json", timeout:180 },
    { name:"office-browser", command:["node", generated("verification/office-browser.js")], result:"verification/v15/office-browser-results.json", timeout:180 },
    { name:"game-settings-browser", command:["node", generated("verification/game-settings-browser.js")], result:"verification/v15/game-settings-browser-results.json", timeout:180 },
    { name:"browser", command:["node", generated("verification/browser.js")], result:"verification/v15/browser-results.json", timeout:300 },
    { name:"interactions-browser", command:["node", generated("verification/interactions-browser.js")], result:"verification/v15/interactions-browser-results.json", timeout:180 },
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
