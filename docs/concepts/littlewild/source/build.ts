/**
 * Build the self-contained Littlewild HTML from TypeScript-authored source.
 * JavaScript under .generated/ is disposable compiler output and is never authoritative.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

type InsertKind = "style" | "script";
type Insert = readonly [marker: string, file: string, kind: InsertKind];

const ROOT = __dirname;
const PROJECT = path.resolve(ROOT, "..");
const GENERATED = path.join(PROJECT, ".generated");
const TSC = path.join(PROJECT, "node_modules", "typescript", "bin", "tsc");

const INSERTS: readonly Insert[] = [
  ["STYLE", "style.css", "style"],
  ["POLISH", "polish.css", "style"],
  ["COLONY_CSS", "colony.css", "style"],
  ["REFINEMENT", "refinement.css", "style"],
  ["WORLD_UI_CSS", "world-ui.css", "style"],
  ["CONTENT_RUNTIME", "content-runtime.js", "script"],
  ["WORLD_PROFILE", "world-profile.js", "script"],
  ["GEOGRAPHY", "island-geometry.js", "script"],
  ["NAVIGATION", "navigation.js", "script"],
  ["ENGINE", "engine.js", "script"],
  ["ENGINE_COMPOSITION", "engine-composition.js", "script"],
  ["ACTOR_STATE_VIEW", "actor-state-view.js", "script"],
  ["SYSTEMS", "systems.js", "script"],
  ["RPG", "rpg.js", "script"],
  ["BEHAVIOR", "behavior-tree.js", "script"],
  ["ADVENTURE", "adventure-content.js", "script"],
  ["POLICIES", "colony-policies.js", "script"],
  ["ECS", "ecs.js", "script"],
  ["ACTOR_ECS", "actor-ecs.js", "script"],
  ["WORLD_ECS", "world-ecs.js", "script"],
  ["ECONOMY_ECS", "economy-ecs.js", "script"],
  ["SIMULATION_PIPELINE", "simulation-pipeline.js", "script"],
  ["SIMULATION_PROFILE", "simulation-profile.js", "script"],
  ["COLONY", "colony.js", "script"],
  ["WORLD_CONTENT", "world-content.js", "script"],
  ["WORLD_INTEGRITY", "world-integrity.js", "script"],
  ["WORLD_SIMULATION", "world-simulation.js", "script"],
  ["GROWTH_CONTENT", "growth-content.js", "script"],
  ["VILLAGE_SYSTEMS", "village-systems.js", "script"],
  ["VILLAGE_VALIDATION", "validation-village.js", "script"],
  ["PLANNER", "planner.js", "script"],
  ["CARTOGRAPHY", "cartography.js", "script"],
  ["COMMAND_ROUTER", "command-router.js", "script"],
  ["ENGINE_COMPOSITION_ROOT", "engine-composition-root.js", "script"],
  ["WORLD_EXPLORER", "world-explorer.js", "script"],
  ["WORLD_EXPLORER_CSS", "world-explorer.css", "style"],
  ["STORY", "story-codec.js", "script"],
  ["SCENARIO_SHAPE", "scenario-shape.js", "script"],
  ["SCENARIO_MIGRATIONS", "scenario-migrations.js", "script"],
  ["SCENARIOS", "scenario-runtime.js", "script"],
  ["SCENARIO_STORY", "scenario-story.js", "script"],
  ["STORAGE", "story-storage.js", "script"],
  ["FILES", "file-io.js", "script"],
  ["WORLD", "world.js", "script"],
  ["PROGRESSION_UI", "progression-ui.js", "script"],
  ["CONTENT_UI", "content-ui.js", "script"],
  ["COLONY_UI", "colony-ui.js", "script"],
  ["CLOCK", "simulation-clock.js", "script"],
  ["INTERFACE_PAUSE", "interface-pause.js", "script"],
  ["V13_CSS", "v13.css", "style"],
  ["WORLD_LAYOUT", "world-layout.js", "script"],
  ["WORLD_UI", "world-ui.js", "script"],
  ["QUALITY_CSS", "quality.css", "style"],
  ["THREE", "../vendor/three.js", "script"],
  ["SOFTWARE_3D", "software-3d.js", "script"],
  ["WORLD_INPUT", "world-input.js", "script"],
  ["FIDELITY", "world-fidelity.js", "script"],
  ["PRESENTATION", "world-presentation.js", "script"],
  ["WORLD_3D", "world-3d.js", "script"],
  ["TILE_CONTEXT", "tile-context.js", "script"],
  ["V12_CSS", "v12.css", "style"],
  ["VILLAGE_CSS", "village.css", "style"],
  ["CARTOGRAPHY_CSS", "cartography.css", "style"],
  ["VILLAGE_UI", "village-ui.js", "script"],
  ["V14_CSS", "v14.css", "style"],
  ["BUILD_PANEL", "build-panel.js", "script"],
  ["GUIDE_PANEL", "guide-panel.js", "script"],
  ["SCENARIO_UI", "scenario-ui.js", "script"],
  ["V15_CSS", "v15.css", "style"],
  ["UI", "ui.js", "script"]
];

function cleanGeneratedExecutables(directory: string): void {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "content" || entry.name === "fixtures") fs.rmSync(full, { recursive: true, force: true });
      else cleanGeneratedExecutables(full);
    } else if (/\.(?:js|cjs|mjs|map)$/.test(entry.name)) {
      fs.rmSync(full, { force: true });
    }
  }
}

function compile(): void {
  if (!fs.existsSync(TSC)) {
    throw new Error("TypeScript dependencies are missing. Run npm install in docs/concepts/littlewild.");
  }
  fs.mkdirSync(GENERATED, { recursive: true });
  cleanGeneratedExecutables(GENERATED);
  const result = spawnSync(process.execPath, [TSC, "-p", path.join(PROJECT, "tsconfig.json")], {
    cwd: PROJECT,
    stdio: "inherit"
  });
  if (result.status !== 0) throw new Error("TypeScript compilation failed.");
  for (const directory of ["content", "fixtures"]) {
    fs.cpSync(path.join(ROOT, directory), path.join(GENERATED, directory), { recursive: true });
  }
}

function json(file: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "content", file), "utf8"));
}

function inlineData(packPath: string | null): string {
  const declarations: Array<[string, unknown]> = [
    ["LWDefaultLibrary", json("default-library.json")],
    ["LWContentSchema", json("library.schema.json")],
    ["LWDefaultAdventure", json("adventure-library.json")],
    ["LWAdventureSchema", json("adventure.schema.json")],
    ["LWDefaultWorld", json("world-library.json")],
    ["LWWorldSchema", json("world.schema.json")],
    ["LWActorRules", json("actor-rules.json")],
    ["LWEconomyRules", json("economy-rules.json")],
    ["LWDefaultSimulationProfile", json("simulation-profile.json")],
    ["LWSimulationSchema", json("simulation.schema.json")],
    ["LWDefaultGrowth", json("growth-library.json")],
    ["LWGrowthSchema", json("growth.schema.json")],
    ["LWDefaultProfile", json("default-profile.json")],
    ["LWScenarioSchema", json("scenario.schema.json")]
  ];
  const packs = packPath
    ? [JSON.parse(fs.readFileSync(packPath, "utf8"))]
    : [json("littlewild.pack.json"), json("emberworks.pack.json")];
  declarations.push(["LWScenarioPacks", packs]);
  return declarations
    .map(([name, value]) => `window.${name} = ${JSON.stringify(value)};`)
    .join("\n")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function sourceFor(file: string, kind: InsertKind): string {
  if (kind === "style") return path.join(ROOT, file);
  if (file.startsWith("../vendor/")) return path.resolve(ROOT, file);
  return path.join(GENERATED, file);
}

function parseArgs(argv: readonly string[]): { packPath: string | null; outputPath: string } {
  let packPath: string | null = null;
  let outputPath = path.join(PROJECT, "littlewild.html");
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--pack" || arg === "--output") {
      const value = argv[++i];
      if (!value) throw new Error(`Missing value for ${arg}.`);
      if (arg === "--pack") packPath = path.resolve(PROJECT, value);
      else outputPath = path.resolve(PROJECT, value);
    } else {
      throw new Error(`Unknown build argument: ${arg}`);
    }
  }
  return { packPath, outputPath };
}

function build(packPath: string | null, outputPath: string): void {
  compile();
  if (packPath) {
    const cli = path.join(GENERATED, "tools", "scenario-cli.cjs");
    const validation = spawnSync(process.execPath, [cli, "validate", packPath], {
      cwd: PROJECT,
      stdio: "inherit"
    });
    if (validation.status !== 0) throw new Error("Scenario pack validation failed.");
  }

  const template = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const replacements = new Map<string,string>();
  replacements.set("CONTENT_DATA", `<script>\n${inlineData(packPath)}\n</script>`);

  for (const [name, file, kind] of INSERTS) {
    const content = fs.readFileSync(sourceFor(file, kind), "utf8");
    if (content.toLowerCase().includes(`</${kind}`)) {
      throw new Error(`${file} contains an unsafe inline closing tag.`);
    }
    if (replacements.has(name)) throw new Error(`Duplicate inline build key: ${name}`);
    replacements.set(name, `<${kind}>\n${content}\n</${kind}>`);
  }

  const actual = [...template.matchAll(/<!-- INLINE_([A-Z0-9_]+) -->/g)].map(match => match[1]!);
  const expected = [...replacements.keys()];
  const duplicates = actual.filter((name,index) => actual.indexOf(name) !== index);
  const missing = expected.filter(name => !actual.includes(name));
  const unknown = actual.filter(name => !replacements.has(name));
  if (duplicates.length || missing.length || unknown.length || actual.length !== expected.length) {
    throw new Error("Inline template contract mismatch: " + JSON.stringify({duplicates:[...new Set(duplicates)],missing,unknown}));
  }

  const html = template.replace(/<!-- INLINE_([A-Z0-9_]+) -->/g, (_marker,name:string) => {
    const replacement = replacements.get(name);
    if (replacement === undefined) throw new Error(`Unknown inline build key: ${name}`);
    return replacement;
  });
  if (html.includes("<!-- INLINE_")) throw new Error("Unresolved inline build marker.");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, "utf8");
  process.stdout.write(`Built ${outputPath} (${fs.statSync(outputPath).size.toLocaleString("en-US")} bytes)\n`);
}

const args = parseArgs(process.argv.slice(2));
build(args.packPath, args.outputPath);
