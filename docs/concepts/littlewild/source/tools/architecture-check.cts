'use strict';
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

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
  legacyCompatibilityModules: Record<string,string>;
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

const coreModules = [
  "ecs.ts", "actor-ecs.ts", "world-ecs.ts", "economy-ecs.ts", "engine-composition.ts",
  "command-router.ts", "simulation-pipeline.ts", "simulation-profile.ts",
  "scenario-runtime.ts", "scenario-story.ts"
] as const;
const forbiddenPlatform = [
  "document.", "window.", "localStorage", "sessionStorage", "requestAnimationFrame",
  "setTimeout(", "setInterval(", "fetch(", "XMLHttpRequest", "Date.now(", "new Date(", "performance.now("
];

check("DDD domain map owns every runtime module exactly once", () => {
  assert(DOMAIN_MAP.format === "littlewild-domain-map" && DOMAIN_MAP.schemaVersion === 1, "Invalid domain-map identity.");
  assert(JSON.stringify(DOMAIN_MAP.layers) === JSON.stringify(["domain","application","infrastructure","presentation"]), "Unexpected architecture layers.");
  const contextIds = DOMAIN_MAP.contexts.map(context => context.id);
  assert(new Set(contextIds).size === contextIds.length, "Duplicate bounded-context ID.");
  const owned = DOMAIN_MAP.contexts.flatMap(context => context.files);
  assert(new Set(owned).size === owned.length, "A runtime file is owned by multiple bounded contexts.");
  const runtime = fs.readdirSync(SOURCE, { withFileTypes: true })
    .filter(entry => entry.isFile() && (
      entry.name.endsWith(".ts") && entry.name !== "build.ts" ||
      entry.name.endsWith(".cts") && !entry.name.startsWith("test-")
    ))
    .map(entry => entry.name).sort();
  assert(JSON.stringify([...owned].sort()) === JSON.stringify(runtime), "Domain map/runtime mismatch. Owned: " + [...owned].sort().join(", ") + " Runtime: " + runtime.join(", "));
  for (const file of owned) assert(fs.existsSync(path.join(SOURCE, file)), "Mapped runtime file is missing: " + file);
});

check("Clean Code module budget is explicit and legacy debt is bounded", () => {
  assert(Number.isInteger(DOMAIN_MAP.moduleBudgetBytes) && DOMAIN_MAP.moduleBudgetBytes >= 10000, "Invalid runtime module budget.");
  const ownership = new Map<string, string>();
  for (const context of DOMAIN_MAP.contexts) for (const file of context.files) ownership.set(file, context.layer);
  for (const [file, reason] of Object.entries(DOMAIN_MAP.legacyCompatibilityModules)) {
    assert(ownership.get(file) === "application", "Only application compatibility adapters may be grandfathered: " + file);
    assert(typeof reason === "string" && reason.trim().length >= 20, "Legacy module needs a concrete migration reason: " + file);
  }
  const oversized: string[] = [];
  for (const context of DOMAIN_MAP.contexts.filter(context => context.layer === "domain" || context.layer === "application")) {
    for (const file of context.files) {
      const bytes = Buffer.byteLength(source(file));
      if (bytes > DOMAIN_MAP.moduleBudgetBytes && !Object.hasOwn(DOMAIN_MAP.legacyCompatibilityModules,file))
        oversized.push(file + " (" + bytes + " bytes)");
    }
  }
  assert(oversized.length === 0, "New oversized domain/application module requires decomposition, not a silent exception: " + oversized.join(", "));
});

check("Domain compatibility globals are explicitly allowlisted", () => {
  assert(Array.isArray(DOMAIN_MAP.domainGlobals) && DOMAIN_MAP.domainGlobals.length > 0, "Domain global allowlist is missing.");
  assert(new Set(DOMAIN_MAP.domainGlobals).size === DOMAIN_MAP.domainGlobals.length, "Domain global allowlist contains duplicates.");
  const allowed = new Set(DOMAIN_MAP.domainGlobals);
  const domainFiles = DOMAIN_MAP.contexts.filter(context => context.layer === "domain").flatMap(context => context.files);
  const violations: string[] = [];
  for (const file of domainFiles) {
    const text = source(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const match of text.matchAll(/\b(?:root|global)\.(LW[A-Za-z0-9_]*)/g)) {
      const symbol = match[1]!;
      if (!allowed.has(symbol)) violations.push(file + ": " + symbol);
    }
  }
  assert(violations.length === 0, "Domain module reaches undeclared compatibility global: " + violations.join("; "));
});

check("Domain modules do not register application composition hooks", () => {
  const domainFiles = DOMAIN_MAP.contexts.filter(context => context.layer === "domain").flatMap(context => context.files);
  const violations: string[] = [];
  for (const file of domainFiles) {
    const text = source(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const token of ["EngineComposition", "Composition.register(", "constructThrough(", "installFactories"]) {
      if (text.includes(token)) violations.push(file + ": " + token);
    }
  }
  assert(violations.length === 0, "Application composition leaked into domain ownership: " + violations.join("; "));
});

check("Compatibility globals obey bounded-context dependency direction", () => {
  assert(Array.isArray(DOMAIN_MAP.injectedDataGlobals), "Injected data-global allowlist is missing.");
  assert(new Set(DOMAIN_MAP.injectedDataGlobals).size === DOMAIN_MAP.injectedDataGlobals.length,
    "Injected data-global allowlist contains duplicates.");
  const contextByFile = new Map<string, { id:string; layer:"domain"|"application"|"infrastructure"|"presentation" }>();
  for (const context of DOMAIN_MAP.contexts)
    for (const file of context.files) contextByFile.set(file,{id:context.id,layer:context.layer});
  const rank = new Map([["domain",0],["application",1],["infrastructure",2],["presentation",3]]);
  const exported = new Map<string,string>();
  const violations: string[] = [];
  const withoutComments = (text:string):string => text.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/.*$/gm,"");
  for (const file of contextByFile.keys()) {
    const text=withoutComments(source(file));
    for (const match of text.matchAll(/\broot\.(LW[A-Za-z0-9_]*)\s*=/g)) {
      const symbol=match[1]!;
      const prior=exported.get(symbol);
      if (prior && prior!==file) violations.push("duplicate global "+symbol+": "+prior+" and "+file);
      else exported.set(symbol,file);
    }
  }
  const injected=new Set(DOMAIN_MAP.injectedDataGlobals);
  for (const [file,context] of contextByFile) {
    const text=withoutComments(source(file));
    for (const match of text.matchAll(/\b(?:root|global)\.(LW[A-Za-z0-9_]*)/g)) {
      const symbol=match[1]!;
      const targetFile=exported.get(symbol);
      if (targetFile) {
        if (targetFile===file) continue;
        const target=contextByFile.get(targetFile)!;
        if (rank.get(target.layer)! > rank.get(context.layer)!)
          violations.push(file+" ("+context.layer+") -> "+symbol+" / "+targetFile+" ("+target.layer+")");
      } else if (!injected.has(symbol)) {
        violations.push(file+" references undeclared compatibility global "+symbol);
      }
    }
  }
  assert(violations.length===0,"Compatibility-global dependency violation: "+violations.join("; "));
});

check("Clean Architecture dependency rules hold across mapped runtime layers", () => {
  const ownership = new Map<string, "domain" | "application" | "infrastructure" | "presentation">();
  for (const context of DOMAIN_MAP.contexts) for (const file of context.files) ownership.set(file, context.layer);
  const rank = new Map([["domain",0],["application",1],["infrastructure",2],["presentation",3]]);
  const violations: string[] = [];
  const withoutComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const targetFile = (request: string): string | null => {
    const base = path.basename(request);
    if (base.endsWith(".js")) return base.slice(0,-3) + ".ts";
    if (base.endsWith(".cjs")) return base.slice(0,-4) + ".cts";
    return null;
  };
  for (const [file, layer] of ownership) {
    const text = withoutComments(source(file));
    if (layer === "domain" || layer === "application") {
      for (const token of forbiddenPlatform) if (text.includes(token)) violations.push(file + ": platform token " + token);
    }
    for (const match of text.matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
      const target = targetFile(match[1] ?? "");
      if (!target || !ownership.has(target)) continue;
      const targetLayer = ownership.get(target)!;
      if (rank.get(targetLayer)! > rank.get(layer)!) violations.push(file + " -> " + target + " (" + targetLayer + ")");
    }
  }
  assert(violations.length === 0, "Architecture dependency violation: " + violations.join("; "));
});

check("Domain and application core is platform independent", () => {
  const violations: string[] = [];
  for (const file of coreModules) {
    const text = source(file);
    for (const token of forbiddenPlatform) if (text.includes(token)) violations.push(`${file}: ${token}`);
  }
  assert(violations.length === 0, "Platform dependency leaked into core: " + violations.join("; "));
});

check("All domain/application modules avoid ambient randomness and wall clock", () => {
  const violations: string[] = [];
  const deterministicFiles = DOMAIN_MAP.contexts
    .filter(context => context.layer === "domain" || context.layer === "application")
    .flatMap(context => context.files);
  const withoutComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const file of deterministicFiles) {
    const text = withoutComments(source(file));
    for (const token of ["Math.random(", "crypto.random", "randomUUID(", "Date.now(", "new Date(", "performance.now("]) {
      if (text.includes(token)) violations.push(`${file}: ${token}`);
    }
  }
  assert(violations.length === 0, "Nondeterministic API found: " + violations.join("; "));
});

check("Core dependency direction excludes presentation and IO adapters", () => {
  const forbidden = /(?:ui|panel|presentation|world-3d|world-input|file-io|story-storage)\.(?:js|cjs)$/;
  const violations: string[] = [];
  for (const file of coreModules) {
    for (const match of source(file).matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
      const dependency = match[1] ?? "";
      if (forbidden.test(dependency)) violations.push(`${file} -> ${dependency}`);
    }
  }
  assert(violations.length === 0, "Dependency inversion violation: " + violations.join("; "));
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
  assert(new Set(listed).size===listed.length,"Strict TypeScript file list contains duplicates.");
  const strictFiles=new Set(listed.filter(file=>file.startsWith("source/")).map(file=>path.basename(file)));
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
  assert(strictRuntime.length>=15,"Strict runtime coverage regressed below 15 modules: "+strictRuntime.length);
});

check("Strict runtime modules contain no explicit any or TypeScript suppression", () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "tsconfig.strict.json"), "utf8")) as {files?:string[]};
  const strictFiles=new Set((config.files??[]).filter(file=>file.startsWith("source/")).map(file=>path.basename(file)));
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
