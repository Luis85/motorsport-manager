'use strict';
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { analyzeRuntime, resolveRuntimeDependency } from "./architecture-analysis.cjs";

interface CheckResult { name: string; passed: boolean; error?: string; }

const ROOT = path.resolve(__dirname, "../..");
const SOURCE = path.join(ROOT, "source");
const GENERATED = path.join(ROOT, ".generated");
const DOMAIN_MAP = JSON.parse(fs.readFileSync(path.join(SOURCE, "architecture", "domain-map.json"), "utf8")) as {
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

check("External simulation and scenario data contains no executable payload fields", () => {
  const files = ["simulation-profile.json", "littlewild.pack.json", "emberworks.pack.json"];
  const forbidden = new Set(["script", "callback", "execute", "eval", "sourceCode", "modulePath"]);
  const violations: string[] = [];
  const visit = (value: unknown, location: string): void => {
    if (Array.isArray(value)) value.forEach((entry, index) => visit(entry, `${location}/${index}`));
    else if (value && typeof value === "object") {
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (forbidden.has(key)) violations.push(`${location}/${key}`);
        visit(entry, `${location}/${key}`);
      }
    }
  };
  for (const file of files) visit(JSON.parse(fs.readFileSync(path.join(SOURCE, "content", file), "utf8")), file);
  assert(violations.length === 0, "Executable-shaped data field found: " + violations.join("; "));
});

check("Strict TypeScript compiler contract is hardened", () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "tsconfig.strict.json"), "utf8")) as {
    compilerOptions?: Record<string,unknown>;
    files?: string[];
  };
  const options=config.compilerOptions??{};
  for (const [key,value] of Object.entries({
    noCheck:false,strict:true,noEmit:true,noImplicitOverride:true,noUncheckedIndexedAccess:true,
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
  for(const file of [...strictFiles].filter(file=>runtime.has(file)).sort()){
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
