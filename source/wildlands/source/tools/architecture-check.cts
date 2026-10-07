import {definitions} from './definition-source.cjs';
import {petAssetDefinitions} from './bundled-assets.cjs';
import {BUNDLED_GAMES, compileGame, gameDirectory, loadGame} from './game-folder.cjs';
'use strict';
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { ownershipErrors, executableDataErrors, engineDataErrors, DataManifest, EngineDataManifest } from "./architecture-data.cjs";
import { contractErrors, ContractOwner } from "./architecture-contracts.cjs";
import { analyzeRuntime, resolveRuntimeDependency } from "./architecture-analysis.cjs";
import { profileErrors, DATA_GLOBALS } from "./artifact-profiles.cjs";

interface CheckResult { name: string; passed: boolean; error?: string; }

const ROOT = path.resolve(__dirname, "../..");
const SOURCE = path.join(ROOT, "source");
const GENERATED = path.join(ROOT, ".generated");
const DOMAIN_MAP = JSON.parse(fs.readFileSync(path.join(SOURCE, "architecture", "domain-map.json"), "utf8")) as {
  dataOwnership: string;
  contractOwnership: string;
  format: string;
  schemaVersion: number;
  layers: string[];
  contexts: Array<{ id: string; layer: "domain" | "application" | "infrastructure" | "presentation"; files: string[] }>;
  moduleBudgetBytes: number;
  moduleBudgetExceptions: Record<string,string>;
  domainGlobals: string[];
  injectedDataGlobals: string[];
  strictTypingDebt: Record<string,string>;
  strictTypingDebtBudget: number;
};
const results: CheckResult[] = [];

function check(name: string, action: () => void): void {
  try { action(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) }); }
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const ignoredDirectories = new Set([
  path.join(ROOT, "node_modules"),
  path.join(ROOT, ".generated"),
  path.join(ROOT, "verification"),
  path.join(ROOT, "screenshots"),
  path.join(ROOT, "vendor")
]);
function walk(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory() && ignoredDirectories.has(full)) return [];
    return entry.isDirectory() ? walk(full) : [full];
  });
}
function source(name: string): string {
  return fs.readFileSync(path.join(SOURCE, name), "utf8");
}

check("All authored executable Littlewild code is TypeScript", () => {
  const legacy = walk(ROOT).filter(file => /\.(?:js|cjs|mjs|jsx|py)$/i.test(file));
  assert(legacy.length === 0, "Legacy executable source remains: " + legacy.map(file => path.relative(ROOT, file)).join(", "));
});

check("DDD domain map owns every runtime module exactly once", () => {
  assert(DOMAIN_MAP.format === "littlewild-domain-map" && DOMAIN_MAP.schemaVersion === 1, "Invalid domain-map identity.");
  assert(JSON.stringify(DOMAIN_MAP.layers) === JSON.stringify(["domain","application","infrastructure","presentation"]), "Unexpected architecture layers.");
  const contextIds = DOMAIN_MAP.contexts.map(context => context.id);
  assert(new Set(contextIds).size === contextIds.length, "Duplicate bounded-context ID.");
  const owned = DOMAIN_MAP.contexts.flatMap(context => context.files);
  assert(new Set(owned).size === owned.length, "A runtime file is owned by multiple bounded contexts.");
  const runtime = fs.readdirSync(SOURCE, { withFileTypes: true })
    .filter(entry => entry.isFile() && (
      entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts") && entry.name !== "build.ts" ||
      entry.name.endsWith(".cts") && !entry.name.startsWith("test-")
    ))
    .map(entry => entry.name).sort();
  assert(JSON.stringify([...owned].sort()) === JSON.stringify(runtime), "Domain map/runtime mismatch. Owned: " + [...owned].sort().join(", ") + " Runtime: " + runtime.join(", "));
  for (const context of DOMAIN_MAP.contexts) {
    assert(DOMAIN_MAP.layers.includes(context.layer), "Unknown bounded-context layer: " + context.layer);
    for (const file of context.files) {
      assert(/^[a-z0-9-]+\.(?:ts|cts)$/.test(file), "Runtime ownership must name a top-level source module: " + file);
      assert(fs.existsSync(path.join(SOURCE, file)), "Mapped runtime file is missing: " + file);
    }
  }
});

check("Clean Code module budget and decomposition debt are explicit", () => {
  assert(Number.isInteger(DOMAIN_MAP.moduleBudgetBytes) && DOMAIN_MAP.moduleBudgetBytes >= 10000, "Invalid runtime module budget.");
  const ownership = new Map<string, string>();
  for (const context of DOMAIN_MAP.contexts) for (const file of context.files) ownership.set(file, context.layer);
  for (const [file, reason] of Object.entries(DOMAIN_MAP.moduleBudgetExceptions)) {
    assert(ownership.get(file) === "application", "Only application modules may receive a temporary size exception: " + file);
    assert(typeof reason === "string" && reason.trim().length >= 20, "Oversized module needs a concrete decomposition reason: " + file);
  }
  const oversized: string[] = [];
  for (const context of DOMAIN_MAP.contexts.filter(context => context.layer === "domain" || context.layer === "application")) {
    for (const file of context.files) {
      const bytes = Buffer.byteLength(source(file));
      if (bytes > DOMAIN_MAP.moduleBudgetBytes && !Object.hasOwn(DOMAIN_MAP.moduleBudgetExceptions,file))
        oversized.push(file + " (" + bytes + " bytes)");
    }
  }
  assert(oversized.length === 0, "New oversized domain/application module requires decomposition, not a silent exception: " + oversized.join(", "));
});

const analyses = new Map(DOMAIN_MAP.contexts.flatMap(context => context.files)
  .map(file => [file, analyzeRuntime(file, source(file))] as const));

check("Domain runtime globals are explicitly allowlisted", () => {
  assert(Array.isArray(DOMAIN_MAP.domainGlobals) && DOMAIN_MAP.domainGlobals.length > 0, "Domain global allowlist is missing.");
  assert(new Set(DOMAIN_MAP.domainGlobals).size === DOMAIN_MAP.domainGlobals.length, "Domain global allowlist contains duplicates.");
  const allowed = new Set(DOMAIN_MAP.domainGlobals), violations: string[] = [];
  for (const context of DOMAIN_MAP.contexts.filter(context => context.layer === "domain")) for (const file of context.files) {
    for (const global of analyses.get(file)!.globals) if (!allowed.has(global.name)) violations.push(file + ": " + global.name);
  }
  assert(violations.length === 0, "Domain module reaches undeclared runtime global: " + violations.join("; "));
});

check("Portable asset catalog stays a pure inward data boundary", () => {
  const owner=DOMAIN_MAP.contexts.find(context=>context.files.includes("asset-catalog.ts"));
  assert(owner?.layer==="domain", "Asset catalog must remain domain-owned.");
  const catalog=analyses.get("asset-catalog.ts")!;
  assert(catalog.platform.length===0, "Asset catalog must not use DOM or platform APIs.");
  assert(catalog.dependencies.every(request=>request?.endsWith(".json")), "Asset catalog cannot depend on a renderer or other executable adapter.");
  const hostile=analyzeRuntime("asset-catalog.ts", "const bad=document.createElement('canvas'); require('./world-3d.js');");
  assert(hostile.platform.includes("document"), "DOM regression probe must be detected.");
  assert(hostile.dependencies.includes("./world-3d.js"), "Presentation dependency regression probe must be detected.");
});

check("Domain modules do not register application composition hooks", () => {
  const violations: string[] = [];
  for (const context of DOMAIN_MAP.contexts.filter(context => context.layer === "domain")) for (const file of context.files) {
    for (const hook of analyses.get(file)!.composition) violations.push(file + ": " + hook);
  }
  assert(violations.length === 0, "Application composition leaked into domain ownership: " + violations.join("; "));
});

check("Runtime globals obey bounded-context dependency direction", () => {
  assert(Array.isArray(DOMAIN_MAP.injectedDataGlobals), "Injected data-global allowlist is missing.");
  assert(new Set(DOMAIN_MAP.injectedDataGlobals).size === DOMAIN_MAP.injectedDataGlobals.length,
    "Injected data-global allowlist contains duplicates.");
  const ownership = new Map(DOMAIN_MAP.contexts.flatMap(context => context.files.map(file => [file, context] as const)));
  const rank = new Map([["domain", 0], ["application", 1], ["infrastructure", 2], ["presentation", 3]]);
  const exported = new Map<string, string>(), violations: string[] = [];
  for (const [file, analysis] of analyses) for (const global of analysis.globals.filter(global => global.write)) {
    const prior = exported.get(global.name);
    if (prior && prior !== file) violations.push("duplicate global " + global.name + ": " + prior + " and " + file);
    else exported.set(global.name, file);
  }
  const injected = new Set(DOMAIN_MAP.injectedDataGlobals);
  for (const [file, context] of ownership) {
    const analysis = analyses.get(file)!;
    if (analysis.dynamicGlobals) violations.push(file + ": unresolved computed runtime global");
    for (const global of analysis.globals) {
      const targetFile = exported.get(global.name);
      if (targetFile && targetFile !== file) {
        const target = ownership.get(targetFile)!;
        if (rank.get(target.layer)! > rank.get(context.layer)!) {
          violations.push(file + " (" + context.layer + ") -> " + global.name + " / " + targetFile + " (" + target.layer + ")");
        }
      } else if (!targetFile && !injected.has(global.name)) violations.push(file + " references undeclared runtime global " + global.name);
    }
  }
  assert(violations.length === 0, "Runtime-global dependency violation: " + violations.join("; "));
});

check("Clean Architecture dependency rules hold across mapped runtime layers", () => {
  const ownership = new Map(DOMAIN_MAP.contexts.flatMap(context => context.files.map(file => [file, context.layer] as const)));
  const runtime = new Set(ownership.keys());
  const rank = new Map([["domain", 0], ["application", 1], ["infrastructure", 2], ["presentation", 3]]);
  const violations: string[] = [];
  for (const [file, layer] of ownership) {
    const analysis = analyses.get(file)!;
    if (layer === "domain" || layer === "application") {
      for (const api of analysis.platform) violations.push(file + ": platform/nondeterministic API " + api);
    }
    for (const request of analysis.dependencies) {
      if (request === null) { violations.push(file + ": unresolved dynamic executable dependency"); continue; }
      if (request.endsWith(".json") && request.startsWith(".")) continue;
      const target = resolveRuntimeDependency(file, request, runtime);
      if (!target) {
        if (layer === "domain" || layer === "application") violations.push(file + ": unmapped/platform dependency " + request);
        continue;
      }
      const targetLayer = ownership.get(target)!;
      if (rank.get(targetLayer)! > rank.get(layer)!) violations.push(file + " -> " + target + " (" + targetLayer + ")");
    }
  }
  assert(violations.length === 0, "Architecture dependency violation: " + [...new Set(violations)].join("; "));
});

check("All domain/application modules avoid ambient randomness and wall clock", () => {
  const violations: string[] = [];
  for (const context of DOMAIN_MAP.contexts.filter(context => context.layer === "domain" || context.layer === "application")) {
    for (const file of context.files) for (const api of analyses.get(file)!.platform) {
      if (/^(?:Math\.random|crypto\.|Date|new Date|performance\.now)/.test(api)) violations.push(file + ": " + api);
    }
  }
  assert(violations.length === 0, "Nondeterministic API found: " + [...new Set(violations)].join("; "));
});

/** Engine data files (source/content, source/assets, source/schemas) and bundled game folder files (games/<id>/...). */
function shippedData(): Map<string, string> {
  const shipped = new Map<string, string>();
  for (const directory of ["content", "assets", "schemas"]) for (const file of walk(path.join(SOURCE, directory))) shipped.set(path.relative(SOURCE, file).replace(/\\/g, "/"), file);
  for (const id of BUNDLED_GAMES) { const game = loadGame(gameDirectory(id)); for (const entry of game.files) shipped.set("games/" + id + "/" + entry.path, path.join(game.root, entry.path)); }
  return shipped;
}
check("Shipped definitions and configuration have one declared owner and compiled validator", () => {
  assert(DOMAIN_MAP.dataOwnership === "architecture/data-ownership.json", "Data ownership metadata must be referenced by the domain map.");
  const manifest = JSON.parse(source(DOMAIN_MAP.dataOwnership)) as DataManifest;
  const shipped = [...shippedData()].filter(([file]) => file.endsWith(".json"));
  const errors = ownershipErrors(manifest,shipped.map(([file]) => file),new Set(DOMAIN_MAP.contexts.map(context=>context.id)));
  for(const [file, location] of shipped)errors.push(...executableDataErrors(JSON.parse(fs.readFileSync(location,"utf8")),file));
  const fixtures=walk(path.join(SOURCE,"fixtures")).filter(file=>file.endsWith(".json")).map(file=>path.relative(SOURCE,file).replace(/\\/g,"/"));
  assert(JSON.stringify(fixtures.sort())===JSON.stringify(manifest.historicalFixtures.map(entry=>entry.path).sort()),"Historical JSON fixtures require explicit path and reason exclusions.");
  assert(errors.length===0,errors.join("; "));
});

check("Bundled assets have one authoring source and canonical catalog projections", () => {
  for (const id of BUNDLED_GAMES) compileGame(gameDirectory(id));
  petAssetDefinitions(definitions(path.join(SOURCE, "assets")));
  for (const name of ['default-library','adventure-library','world-library','growth-library','building-interiors'])
    assert(!fs.existsSync(path.join(SOURCE,'content',name+'.json')), 'Duplicate content source: '+name);
});

check("Engine content directories hold only engine data and declared pending game data", () => {
  const manifest = JSON.parse(source("architecture/engine-data.json")) as EngineDataManifest;
  const files = [...shippedData().keys()].filter(file => !file.startsWith("games/"));
  const errors = engineDataErrors(manifest, files, ["littlewild", "emberworks", "office", "rts-frontier", "pocket-pet"]);
  // Regression probes: a returned game file and a game-shaped engine entry are both rejected.
  assert(engineDataErrors(manifest, [...files, "content/balancing.json"], ["emberworks"]).some(error => error.includes("content/balancing.json has 0")) &&
    engineDataErrors({...manifest, engine: [...manifest.engine, {pattern: "assets/items/*/definition.json", reason: "Probe entry that pretends game definitions are engine data."}]}, files, []).some(error => error.includes("game data shape")),
    "Engine data regression probes must be detected.");
  for (const id of BUNDLED_GAMES) for (const entry of manifest.pending) assert(entry.game !== id, "Pending engine data names a game that already has a folder: " + entry.pattern);
  assert(errors.length === 0, errors.join("; "));
});

/** Game content files: shipped definitions/packs and their build projections. Engine schemas are not game data. */
function gameDataRequest(request: string): boolean {
  return /^\.\.?\/(?:assets\/|content\/(?![^/]+\.schema\.json$))/.test(request) ||
    /^\.\/(?:asset-definitions|pet-asset-definitions|creature-definitions|creature-config|creature-editor-fields|interaction-library)\.json$/.test(request);
}
check("Runtime modules read game content only through the installed content provider", () => {
  const provider = "content-provider.ts";
  const owner = DOMAIN_MAP.contexts.find(context => context.files.includes(provider));
  assert(owner?.layer === "domain", "The content provider must be a domain-owned runtime module.");
  assert(analyses.get(provider)!.globals.some(global => global.name === "LWContentProvider" && global.write), "The content provider must publish LWContentProvider.");
  // Injected game data globals reach engine modules only as an installed profile. Engine-owned
  // schemas and export payloads stay outside the profile; the library schema carries game vocabulary.
  const gameGlobals = new Set(DATA_GLOBALS.filter(([name, group]) => group !== "export-payloads" && (!/Schema$/.test(name) || name === "LWContentSchema")).map(([name]) => name));
  const probe = analyzeRuntime("probe.ts", "const a=require('./content/balancing.json'),b=require('./content/scenario.schema.json'),c=require('./creature-definitions.json');const d=root.LWDefaultBalancing;");
  assert(probe.dependencies.filter(request => request !== null && gameDataRequest(request)).length === 2 && probe.globals.some(global => gameGlobals.has(global.name)),
    "Game content regression probe must be detected.");
  assert(gameDataRequest("../assets/items/wood/definition.json") && !gameDataRequest("./engine-source-bundle.json") && gameGlobals.has("LWScenarioPacks") && !gameGlobals.has("LWScenarioSchema"),
    "Game content classification probe failed.");
  const violations: string[] = [];
  for (const [file, analysis] of analyses) {
    for (const request of analysis.dependencies) if (request !== null && gameDataRequest(request)) violations.push(file + " requires game data " + request);
    if (file !== provider) for (const global of analysis.globals) if (gameGlobals.has(global.name)) violations.push(file + " reads injected game data " + global.name);
  }
  assert(violations.length === 0, "Runtime module bypasses the content provider: " + violations.join("; "));
});

check("Project contracts and erased type dependencies follow inward ownership", () => {
  assert(DOMAIN_MAP.contractOwnership === "architecture/contract-ownership.json", "Contract ownership metadata must be referenced by the domain map.");
  const manifest=JSON.parse(source(DOMAIN_MAP.contractOwnership)) as {format:string;schemaVersion:number;entries:ContractOwner[]};
  assert(manifest.format==="littlewild-contract-ownership"&&manifest.schemaVersion===1,"Invalid contract ownership identity.");
  const files=fs.readdirSync(SOURCE).filter(file=>file.endsWith(".ts")||file.endsWith(".cts"));
  const errors=contractErrors(SOURCE,DOMAIN_MAP.contexts,manifest.entries,files);
  assert(errors.length===0,errors.join("; "));
});

check("Strict TypeScript compiler contract is hardened", () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "tsconfig.strict.json"), "utf8")) as {
    compilerOptions?: Record<string,unknown>;
    files?: string[];
  };
  const options=config.compilerOptions??{};
  for (const [key,value] of Object.entries({
    noCheck:false,strict:true,skipLibCheck:false,noEmit:true,noImplicitOverride:true,noUncheckedIndexedAccess:true,
    exactOptionalPropertyTypes:true,noImplicitReturns:true,noFallthroughCasesInSwitch:true
  })) assert(options[key]===value,`Strict compiler option ${key} must be ${String(value)}.`);
  assert(Array.isArray(config.files)&&config.files.length>0,"Strict TypeScript file list is missing.");
});

check("Strict TypeScript coverage is an explicit domain/application ratchet", () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "tsconfig.strict.json"), "utf8")) as {files?:string[]};
  const listed=config.files??[];
  for (const file of listed) assert(/^source\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\.(?:d\.ts|ts|cts)$/.test(file) && fs.existsSync(path.join(ROOT,file)), "Invalid or missing strict source path: " + file);
  assert(new Set(listed).size===listed.length,"Strict TypeScript file list contains duplicates.");
  const strictFiles=new Set(listed.filter(file=>/^source\/[^/]+$/.test(file)).map(file=>file.slice(7)));
  const owned=new Map<string,string>();
  for(const context of DOMAIN_MAP.contexts)for(const file of context.files)
    if(context.layer==="domain"||context.layer==="application")owned.set(file,context.layer);
  const debt=DOMAIN_MAP.strictTypingDebt;
  assert(debt&&typeof debt==="object"&&!Array.isArray(debt),"Strict typing debt register is missing.");
  assert(Number.isInteger(DOMAIN_MAP.strictTypingDebtBudget)&&DOMAIN_MAP.strictTypingDebtBudget>=0,"Strict typing debt budget is invalid.");
  assert(Object.keys(debt).length<=DOMAIN_MAP.strictTypingDebtBudget,`Strict typing debt exceeded budget ${DOMAIN_MAP.strictTypingDebtBudget}: ${Object.keys(debt).length}`);
  for(const [file,layer] of owned){
    assert(strictFiles.has(file)||Object.hasOwn(debt,file),`${layer} runtime module is neither strict nor registered debt: ${file}`);
  }
  for(const [file,reason] of Object.entries(debt)){
    assert(owned.has(file),"Strict typing debt names a non-domain/application module: "+file);
    assert(!strictFiles.has(file),"Strict module remains in typing debt: "+file);
    assert(typeof reason==="string"&&reason.trim().length>=40,"Typing debt needs a concrete migration reason: "+file);
  }
  const strictRuntime=[...owned.keys()].filter(file=>strictFiles.has(file));
  assert(strictRuntime.length>=30,"Strict runtime coverage regressed below 30 modules: "+strictRuntime.length);
});

check("Strict runtime modules contain no explicit any or TypeScript suppression", () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "tsconfig.strict.json"), "utf8")) as {files?:string[]};
  const strictFiles=new Set((config.files??[]).filter(file=>/^source\/[^/]+$/.test(file)).map(file=>file.slice(7)));
  const runtime=new Set(DOMAIN_MAP.contexts
    .filter(context=>context.layer==="domain"||context.layer==="application")
    .flatMap(context=>context.files));
  const violations:string[]=[];
  for(const file of [...new Set([...strictFiles].filter(file=>runtime.has(file)).concat(fs.readdirSync(SOURCE).filter(file=>file.endsWith(".d.ts"))))].sort()){
    const text=source(file);
    if(/@ts-(?:ignore|nocheck|expect-error)/.test(text))violations.push(file+": TypeScript suppression");
    const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith(".cts")?ts.ScriptKind.TS:ts.ScriptKind.TS);
    const visit=(node:ts.Node):void=>{
      if(node.kind===ts.SyntaxKind.AnyKeyword)violations.push(file+": explicit any");
      ts.forEachChild(node,visit);
    };
    visit(ast);
  }
  assert(violations.length===0,"Strict runtime typing escape hatch found: "+[...new Set(violations)].join("; "));
});

check("Obsolete story and migration artifacts stay removed", () => {
  const obsolete = [
    "scenario-migrations.ts",
    "test-v10-regression-v5.cts",
    "test-v10-regression-v6.cts",
    "test-v10-regression-v8.cts",
    "test-v10-regression-quality-v9.cts",
    "test-v10-regression-foundation-v9.cts",
    "verification/schema-checks-v10.ts",
    "fixtures/actual-v9-fresh.json",
    "fixtures/actual-v9-community.json",
    "fixtures/actual-v9-workplace.json",
    "fixtures/actual-v14-story.json",
    "fixtures/v14-retained-contracts.json",
    "fixtures/ecs-migration.json",
    "fixtures/actual-v11-workplace.json",
    "fixtures/actual-v12-story.json",
    "fixtures/actual-v13-story.json",
    "fixtures/v14-island-geometry.cts"
  ];
  const remaining=obsolete.filter(file=>fs.existsSync(path.join(SOURCE,file)));
  if(fs.existsSync(path.join(ROOT,"examples","migration","v10-world-story.json")))remaining.push("../examples/migration/v10-world-story.json");
  assert(remaining.length===0,"Obsolete story/migration artifacts returned: "+remaining.join(", "));
  for(const [file,token] of [
    ["scenario-runtime.ts","migrateContext"],
    ["scenario-story.ts","version===9"],
    ["scenario-story.ts","version!==8"],
    ["story-codec.ts","native story format (v8)"],
    ["cartography.ts","raw.version = 7"],
    ["cartography.ts","super.import(raw)"],
    ["village-systems.ts","grandfathered"]
  ] as const){
    assert(!source(file).includes(token),file+" still contains obsolete compatibility token "+token);
  }
});

check("ECS persistence remains plain-data owned by domain records", () => {
  const actor = source("actor-ecs.ts");
  const world = source("world-ecs.ts");
  const economy = source("economy-ecs.ts");
  assert(actor.includes("Components bind by reference"), "Actor ECS no longer documents authoritative record binding.");
  assert(world.includes("no ECS state is") && world.includes("serialized"), "World ECS persistence boundary is unclear.");
  assert(economy.includes("Existing save records remain authoritative"), "Economy ECS persistence boundary is unclear.");
});

check("Artifact bundles tag every insert and profiles keep the canonical load order", () => {
  const errors = profileErrors(SOURCE);
  assert(errors.length === 0, errors.join("; "));
});

check("Generated JavaScript is outside authored source", () => {
  assert(!fs.existsSync(path.join(SOURCE, ".generated")), "Generated output must not live under source/.");
});

const report = { passed: results.filter(result => result.passed).length, total: results.length, failed: results.filter(result => !result.passed).length, results };
fs.mkdirSync(GENERATED, { recursive: true });
fs.writeFileSync(path.join(GENERATED, "typescript-architecture-results.json"), JSON.stringify(report, null, 2) + "\n");
process.stdout.write(`${report.passed}/${report.total} TypeScript architecture checks passed\n`);
for (const result of report.results) {
  if (!result.passed) process.stderr.write(`FAIL ${result.name}: ${result.error || "unknown architecture failure"}\n`);
}
if (report.failed) process.exitCode = 1;
