/**
 * Build the self-contained Littlewild HTML from TypeScript-authored source.
 * JavaScript under .generated/ is disposable compiler output and is never authoritative.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { creatureDefinitions, assetDefinitions, creatureConfig } from "./tools/bundled-assets.cjs";

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
  ["CREATURE_CATALOG", "creature-catalog.js", "script"],
  ["ASSET_CATALOG", "asset-catalog.js", "script"],
  ["WORLD_PROFILE", "world-profile.js", "script"],
  ["SCENE_ENVIRONMENT", "scene-environment.js", "script"],
  ["GEOGRAPHY", "island-geometry.js", "script"],
  ["NAVIGATION", "navigation.js", "script"],
  ["ENGINE_TASK_PLANNING", "engine-task-planning.js", "script"],
  ["ENGINE_TASK_COMPLETION", "engine-task-completion.js", "script"],
  ["ENGINE_COMPANION", "engine-companion.js", "script"],
  ["ENGINE", "engine.js", "script"],
  ["ENGINE_COMPOSITION", "engine-composition.js", "script"],
  ["ACTOR_STATE_VIEW", "actor-state-view.js", "script"],
  ["SYSTEMS", "systems.js", "script"],
  ["RPG", "rpg.js", "script"],
  ["BEHAVIOR", "behavior-tree.js", "script"],
  ["ADVENTURE", "adventure-content.js", "script"],
  ["CREATURE_FACTORY", "creature-factory.js", "script"],
  ["POLICIES", "colony-policies.js", "script"],
  ["ECS", "ecs.js", "script"],
  ["ACTOR_ECS", "actor-ecs.js", "script"],
  ["WORLD_ECS", "world-ecs.js", "script"],
  ["ECONOMY_ECS", "economy-ecs.js", "script"],
  ["SIMULATION_PIPELINE", "simulation-pipeline.js", "script"],
  ["SIMULATION_PROFILE", "simulation-profile.js", "script"],
  ["COLONY_ADVENTURES", "colony-adventures.js", "script"],
  ["COLONY_ACTIVITY", "colony-activity.js", "script"],
  ["COLONY_LOGISTICS", "colony-logistics.js", "script"],
  ["COLONY_TASK_COMPLETION", "colony-task-completion.js", "script"],
  ["COLONY", "colony.js", "script"],
  ["WORLD_CONTENT", "world-content.js", "script"],
  ["WORLD_INTEGRITY", "world-integrity.js", "script"],
  ["WORLD_TASKS", "world-tasks.js", "script"],
  ["WORLD_PRODUCTION", "world-production.js", "script"],
  ["WORLD_STATE_VALIDATION", "world-state-validation.js", "script"],
  ["WORLD_SIMULATION", "world-simulation.js", "script"],
  ["GROWTH_CONTENT", "growth-content.js", "script"],
  ["VILLAGE_SYSTEMS", "village-systems.js", "script"],
  ["VILLAGE_VALIDATION", "validation-village.js", "script"],
  ["PLANNER", "planner.js", "script"],
  ["CARTOGRAPHY", "cartography.js", "script"],
  ["INTERACTION_CATALOG", "interaction-catalog.js", "script"],
  ["INTERACTION_DUEL_RULES", "interaction-duel-rules.js", "script"],
  ["INTERACTION_STATE", "interaction-state.js", "script"],
  ["INTERACTION_RUNTIME", "interaction-runtime.js", "script"],
  ["INTERACTION_TRIGGERS", "interaction-triggers.js", "script"],
  ["GAME_SETTINGS", "game-settings.js", "script"],
  ["SCENARIO_RESOURCES", "scenario-resources.js", "script"],
  ["SCENARIO_WORKFLOW", "scenario-workflow.js", "script"],
  ["INTERACTION_INTEGRATION", "interaction-integration.js", "script"],
  ["COMMAND_ROUTER", "command-router.js", "script"],
  ["ENGINE_COMPOSITION_ROOT", "engine-composition-root.js", "script"],
  ["WORLD_EXPLORER", "world-explorer.js", "script"],
  ["WORLD_EXPLORER_CSS", "world-explorer.css", "style"],
  ["STORY", "story-codec.js", "script"],
  ["SCENARIO_SHAPE", "scenario-shape.js", "script"],
  ["SCENARIOS", "scenario-runtime.js", "script"],
  ["SCENARIO_STORY", "scenario-story.js", "script"],
  ["DEVELOPER_DATA", "developer-data.js", "script"],
  ["DEVELOPER_COMMANDS", "developer-commands.js", "script"],
  ["DEVELOPER_SESSION", "developer-session.js", "script"],
  ["STORAGE", "story-storage.js", "script"],
  ["FILES", "file-io.js", "script"],
  ["CANVAS_ART", "canvas-art.js", "script"],
  ["CANVAS_BUILDINGS", "canvas-buildings.js", "script"],
  ["CANVAS_GROUND", "canvas-ground.js", "script"],
  ["CANVAS_ASSETS", "canvas-assets.js", "script"],
  ["CANVAS_SCENE", "canvas-scene.js", "script"],
  ["WORLD", "world.js", "script"],
  ["PROGRESSION_UI", "progression-ui.js", "script"],
  ["CONTENT_UI", "content-ui.js", "script"],
  ["COLONY_HUD", "colony-hud.js", "script"],
  ["COLONY_UI", "colony-ui.js", "script"],
  ["CLOCK", "simulation-clock.js", "script"],
  ["INTERFACE_PAUSE", "interface-pause.js", "script"],
  ["V13_CSS", "v13.css", "style"],
  ["WORLD_LAYOUT", "world-layout.js", "script"],
  ["WORLD_UI", "world-ui.js", "script"],
  ["QUALITY_CSS", "quality.css", "style"],
  ["THREE", "../vendor/three.js", "script"],
  ["DEVELOPER_TOOLBOX", "developer-toolbox.js", "script"],
  ["ASSET_RENDERER", "asset-renderer.js", "script"],
  ["SOFTWARE_3D", "software-3d.js", "script"],
  ["WORLD_INPUT", "world-input.js", "script"],
  ["FIDELITY", "world-fidelity.js", "script"],
  ["PRESENTATION", "world-presentation.js", "script"],
  ["WORLD_3D", "world-3d.js", "script"],
  ["TILE_CONTEXT", "tile-context.js", "script"],
  ["V12_CSS", "v12.css", "style"],
  ["VILLAGE_CSS", "village.css", "style"],
  ["CARTOGRAPHY_CSS", "cartography.css", "style"],
  ["INTERACTION_UI", "interaction-ui.js", "script"],
  ["INTERACTIONS_CSS", "interactions.css", "style"],
  ["VILLAGE_UI", "village-ui.js", "script"],
  ["V14_CSS", "v14.css", "style"],
  ["BUILD_PANEL", "build-panel.js", "script"],
  ["GUIDE_PANEL", "guide-panel.js", "script"],
  ["SCENARIO_UI", "scenario-ui.js", "script"],
  ["V15_CSS", "v15.css", "style"],
  ["UI_STATUS", "ui-status.js", "script"],
  ["UI_STORY_PANELS", "ui-story-panels.js", "script"],
  ["UI_MODAL_CONTENT", "ui-modal-content.js", "script"],
  ["UI_MODAL", "ui-modal.js", "script"],
  ["UI_ACTIONS", "ui-actions.js", "script"],
  ["UI_INPUT", "ui-input.js", "script"],
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
    stdio: "inherit", timeout: 120000, killSignal: "SIGKILL"
  });
  if (result.error || result.status !== 0) throw new Error("TypeScript compilation failed." + (result.error ? " " + result.error.message : ""));
  const sdkTypes = spawnSync(process.execPath, [TSC, "-p", path.join(PROJECT, "tsconfig.sdk.json")], {
    cwd: PROJECT, stdio: "inherit", timeout: 30000, killSignal: "SIGKILL"
  });
  if (sdkTypes.error || sdkTypes.status !== 0) throw new Error("Developer SDK declaration generation failed.");
  fs.copyFileSync(path.join(ROOT, "developer-contracts.d.ts"), path.join(GENERATED, "developer-contracts.d.ts"));
  const declaration = path.join(GENERATED, "developer-sdk.d.cts");
  fs.writeFileSync(declaration, fs.readFileSync(declaration, "utf8").replace(
    /<reference path="[^"]*developer-contracts\.d\.ts"/, '<reference path="./developer-contracts.d.ts"'));
  for (const directory of ["content", "fixtures"]) {
    fs.cpSync(path.join(ROOT, directory), path.join(GENERATED, directory), { recursive: true });
  }
  for (const fixture of ["scenario-v3-grown.json"]) {
    fs.copyFileSync(path.join(ROOT, fixture), path.join(GENERATED, fixture));
  }
  fs.copyFileSync(path.join(ROOT, "assets", "interactions", "catalog.json"), path.join(GENERATED, "interaction-library.json"));
  fs.writeFileSync(path.join(GENERATED, "creature-definitions.json"), JSON.stringify(creatureDefinitions(ROOT)));
  fs.writeFileSync(path.join(GENERATED, "creature-config.json"), JSON.stringify(creatureConfig(ROOT)));
  fs.writeFileSync(path.join(GENERATED, "asset-definitions.json"), JSON.stringify(assetDefinitions(ROOT)));
}

function json(file: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "content", file), "utf8"));
}

function inlineData(packPath: string | null): string {
  const declarations: Array<[string, unknown]> = [
    ["LWDefaultLibrary", json("default-library.json")],
    ["LWContentSchema", json("library.schema.json")],
    ["LWInteractionLibrary", JSON.parse(fs.readFileSync(path.join(ROOT,"assets","interactions","catalog.json"),"utf8"))],
    ["LWCreatureDefinitions", creatureDefinitions(ROOT)],
    ["LWCreatureConfig", creatureConfig(ROOT)],
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
    ["LWScenarioSchema", json("scenario.schema.json")],
    ["LWAssetDefinitions", assetDefinitions(ROOT)]
  ];
  const packs = packPath
    ? [JSON.parse(fs.readFileSync(packPath, "utf8"))]
    : [json("littlewild.pack.json"), json("emberworks.pack.json"), json("office.pack.json")];
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
  const seen = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--pack" || arg === "--output") {
      if (seen.has(arg)) throw new Error(`Duplicate build argument: ${arg}`);
      seen.add(arg);
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}.`);
      if (arg === "--pack") packPath = path.resolve(PROJECT, value);
      else outputPath = path.resolve(PROJECT, value);
    } else {
      throw new Error(`Unknown build argument: ${arg}`);
    }
  }
  return { packPath, outputPath };
}

/** Resolve existing ancestors, including symlinked parents, before checking output ownership. */
function canonicalDestination(destination: string): string {
  let ancestor = path.resolve(destination);
  const suffix: string[] = [];
  while (true) {
    try { fs.lstatSync(ancestor); }
    catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      suffix.unshift(path.basename(ancestor));ancestor = parent;
      continue;
    }
    // Existing dangling symlinks fail here rather than being treated as missing directories.
    return path.join(fs.realpathSync(ancestor), ...suffix);
  }
}

function build(packPath: string | null, outputPath: string): void {
  const canonicalOutput = canonicalDestination(outputPath);
  for (const protectedRoot of [ROOT, path.join(PROJECT, "vendor"), GENERATED]) {
    const relative = path.relative(canonicalDestination(protectedRoot), canonicalOutput);
    if (relative === "" || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative))) {
      throw new Error("Build output must be outside authored and generated source directories.");
    }
  }
  if (packPath && (canonicalOutput === canonicalDestination(packPath) ||
    (fs.existsSync(outputPath) && fs.existsSync(packPath) && fs.statSync(outputPath).dev === fs.statSync(packPath).dev && fs.statSync(outputPath).ino === fs.statSync(packPath).ino))) {
    throw new Error("Build output must not overwrite the input pack.");
  }
  compile();
  if (packPath) {
    const cli = path.join(GENERATED, "tools", "scenario-cli.cjs");
    const validation = spawnSync(process.execPath, [cli, "validate", packPath], {
      cwd: PROJECT,
      stdio: "inherit", timeout: 90000, killSignal: "SIGKILL"
    });
    if (validation.error || validation.status !== 0) throw new Error("Scenario pack validation failed." + (validation.error ? " " + validation.error.message : ""));
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
  const temporary = outputPath + "." + randomUUID() + ".tmp";
  let owned = false;
  try {
    const descriptor = fs.openSync(temporary, "wx"); owned = true;
    try { fs.writeFileSync(descriptor, html, "utf8"); } finally { fs.closeSync(descriptor); }
    fs.renameSync(temporary, outputPath); owned = false;
  } finally { if (owned) fs.rmSync(temporary, {force:true}); }
  process.stdout.write(`Built ${outputPath} (${fs.statSync(outputPath).size.toLocaleString("en-US")} bytes)\n`);
}

const argv = process.argv.slice(2);
if (argv.length === 1 && ["--help", "-h"].includes(argv[0]!)) {
  process.stdout.write("Usage: npm run build -- [--pack pack.json] [--output artifact.html]\n");
} else {
  try { const args = parseArgs(argv); build(args.packPath, args.outputPath); }
  catch (error) { process.stderr.write("Build failed: " + (error instanceof Error ? error.message : String(error)) + "\n"); process.exitCode = 1; }
}
