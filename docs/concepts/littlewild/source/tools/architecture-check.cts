'use strict';
import fs from "node:fs";
import path from "node:path";

interface CheckResult { name: string; passed: boolean; error?: string; }

const ROOT = path.resolve(__dirname, "../..");
const SOURCE = path.join(ROOT, "source");
const GENERATED = path.join(ROOT, ".generated");
const DOMAIN_MAP = JSON.parse(fs.readFileSync(path.join(SOURCE, "architecture", "domain-map.json"), "utf8")) as {
  format: string;
  schemaVersion: number;
  layers: string[];
  contexts: Array<{ id: string; layer: "domain" | "application" | "infrastructure" | "presentation"; files: string[] }>;
};
const results: CheckResult[] = [];

function check(name: string, action: () => void): void {
  try { action(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) }); }
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function walk(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (["node_modules", ".generated", "verification", "screenshots", "vendor"].includes(entry.name)) return [];
    const full = path.join(directory, entry.name);
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
  "setTimeout(", "setInterval(", "fetch(", "XMLHttpRequest", "Date.now(", "performance.now("
];

check("DDD domain map owns every runtime module exactly once", () => {
  assert(DOMAIN_MAP.format === "littlewild-domain-map" && DOMAIN_MAP.schemaVersion === 1, "Invalid domain-map identity.");
  assert(JSON.stringify(DOMAIN_MAP.layers) === JSON.stringify(["domain","application","infrastructure","presentation"]), "Unexpected architecture layers.");
  const contextIds = DOMAIN_MAP.contexts.map(context => context.id);
  assert(new Set(contextIds).size === contextIds.length, "Duplicate bounded-context ID.");
  const owned = DOMAIN_MAP.contexts.flatMap(context => context.files);
  assert(new Set(owned).size === owned.length, "A runtime file is owned by multiple bounded contexts.");
  const runtime = fs.readdirSync(SOURCE, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(".ts") && entry.name !== "build.ts")
    .map(entry => entry.name).sort();
  assert(JSON.stringify([...owned].sort()) === JSON.stringify(runtime), "Domain map/runtime mismatch. Owned: " + [...owned].sort().join(", ") + " Runtime: " + runtime.join(", "));
  for (const file of owned) assert(fs.existsSync(path.join(SOURCE, file)), "Mapped runtime file is missing: " + file);
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
      if (layer === "domain" && targetLayer !== "domain") violations.push(file + " -> " + target + " (" + targetLayer + ")");
      if (layer === "application" && rank.get(targetLayer)! > rank.get("infrastructure")!) violations.push(file + " -> " + target + " (" + targetLayer + ")");
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

check("Deterministic core does not use ambient randomness or wall clock", () => {
  const violations: string[] = [];
  for (const file of coreModules) {
    const text = source(file);
    for (const token of ["Math.random(", "crypto.random", "randomUUID(", "Date.now(", "performance.now("]) {
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

check("Strict TypeScript gate covers the architecture kernel", () => {
  const config = fs.readFileSync(path.join(ROOT, "tsconfig.strict.json"), "utf8");
  for (const file of ["source/ecs.ts", "source/command-router.ts", "source/build.ts", "source/tools/architecture-check.cts"]) {
    assert(config.includes(`"${file}"`), `Strict gate does not include ${file}`);
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
if (report.failed) process.exitCode = 1;
