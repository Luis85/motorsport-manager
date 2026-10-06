/**
 * Build the self-contained Littlewild HTML from TypeScript-authored source.
 * JavaScript under .generated/ is disposable compiler output and is never authoritative.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeSourceBundle } from "./tools/engine-export-bundle.cjs";
import { writeWildlandsBundle } from "./tools/wildlands-bundle.cjs";
import { creatureDefinitions, assetDefinitions, petAssetDefinitions, creatureConfig } from "./tools/bundled-assets.cjs";

import { definitions } from "./tools/definition-source.cjs";
import { writeContent } from "./tools/bundled-content.cjs";

import { INSERTS, type InsertKind } from "./tools/build-inserts.cjs";

const ROOT = __dirname;
const PROJECT = path.resolve(ROOT, "..");
const GENERATED = path.join(PROJECT, ".generated");
const TSC = path.join(PROJECT, "node_modules", "typescript", "bin", "tsc");



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
  // Cleaning compiler output also clears the executable bit used by npm-linked bins.
  fs.chmodSync(path.join(GENERATED, "tools/wildlands-cli.cjs"), 0o755);
  for (const file of ["skill-tree-contracts.d.ts", "developer-contracts.d.ts", "developer-space-contracts.d.ts", "runtime-contracts.d.ts", "developer-scene-contracts.d.ts", "content-contracts.d.ts", "scene-graph-contracts.d.ts", "scene-editor-contracts.d.ts", "external-editor-contracts.d.ts", "animation-data-contracts.d.ts", "engine-export-contracts.d.ts", "balancing-contracts.d.ts", "balancing-tools-contracts.d.ts", "building-interior-data-contracts.d.ts", "interaction-contracts.d.ts", "storytelling-data-contracts.d.ts", "storytelling-contracts.d.ts", "storytelling-render-contracts.d.ts", "scene-navigation-contracts.d.ts", "renderer-contracts.d.ts", "renderer-data-contracts.d.ts", "canvas-authoring-contracts.d.ts", "external-editor-canvas-contracts.d.ts", "creature-editor-contracts.d.ts", "wildlands-project-contracts.d.ts"]) fs.copyFileSync(path.join(ROOT, file), path.join(GENERATED, file));
  const declaration = path.join(GENERATED, "developer-sdk.d.cts");
  fs.writeFileSync(declaration, fs.readFileSync(declaration, "utf8").replace(
    /<reference path="(?:[^"]*\/)?([^/"]+\.d\.ts)"/g, '<reference path="./$1"'));
  for (const directory of ["content", "fixtures"]) {
    fs.cpSync(path.join(ROOT, directory), path.join(GENERATED, directory), { recursive: true });
  }
  const packages = definitions(ROOT);
  writeContent(ROOT, GENERATED, packages);
  for (const fixture of ["scenario-v3-grown.json"]) {
    fs.copyFileSync(path.join(ROOT, fixture), path.join(GENERATED, fixture));
  }
  fs.copyFileSync(path.join(ROOT, "assets", "interactions", "catalog.json"), path.join(GENERATED, "interaction-library.json"));
  fs.writeFileSync(path.join(GENERATED, "creature-definitions.json"), JSON.stringify(creatureDefinitions(ROOT, packages)));
  fs.copyFileSync(path.join(ROOT, "assets/creatures/editor-fields.json"), path.join(GENERATED, "creature-editor-fields.json"));
  fs.writeFileSync(path.join(GENERATED, "creature-config.json"), JSON.stringify(creatureConfig(ROOT, packages)));
  fs.writeFileSync(path.join(GENERATED, "asset-definitions.json"), JSON.stringify(assetDefinitions(ROOT, packages)));
  fs.writeFileSync(path.join(GENERATED, "pet-asset-definitions.json"), JSON.stringify(petAssetDefinitions(ROOT, packages)));
}

function json(file: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(GENERATED, "content", file), "utf8"));
}

function inlineData(packPath: string | null): string {
  const balance = json("balancing.json") as {libraries:{base:unknown;adventure:unknown;world:unknown;growth:unknown};simulation:{rules:{actor:unknown;economy:unknown}};world:unknown;creatures:unknown;interactions:unknown;interiors:unknown};
  const declarations: Array<[string, unknown]> = [
    ["WildlandsGodotRuntimeLoader", JSON.parse(fs.readFileSync(path.join(GENERATED, "wildlands-runtime-loader.json"), "utf8"))],
    ["WildlandsGodotTemplates", JSON.parse(fs.readFileSync(path.join(GENERATED, "wildlands-godot-templates.json"), "utf8"))],
    ["LWEngineSourceLoader", JSON.parse(fs.readFileSync(path.join(GENERATED, "engine-source-loader.json"), "utf8"))],
    ["LWDefaultBalancing", balance],
    ["LWDefaultLibrary", balance.libraries.base],
    ["LWRTSDefinitions", json("rts-demo.json")],
    ["LWPetDefinitions", json("pet-demo.json")],
    ["LWPetAssetDefinitions", JSON.parse(fs.readFileSync(path.join(GENERATED, "pet-asset-definitions.json"), "utf8"))],
    ["LWContentSchema", json("library.schema.json")],
    ["LWInteriorDefinitions", balance.interiors],
    ["LWInteractionLibrary", balance.interactions],
    ["LWCreatureDefinitions", JSON.parse(fs.readFileSync(path.join(GENERATED, "creature-definitions.json"), "utf8"))],
    ["LWCreatureEditorFieldDefinitions", JSON.parse(fs.readFileSync(path.join(ROOT, "assets/creatures/editor-fields.json"), "utf8"))],
    ["LWCreatureConfig", JSON.parse(fs.readFileSync(path.join(GENERATED, "creature-config.json"), "utf8"))],
    ["LWDefaultAdventure", balance.libraries.adventure],
    ["LWAdventureSchema", json("adventure.schema.json")],
    ["LWDefaultWorld", balance.libraries.world],
    ["LWWorldSchema", json("world.schema.json")],
    ["LWActorRules", balance.simulation.rules.actor],
    ["LWEconomyRules", balance.simulation.rules.economy],
    ["LWDefaultSimulationProfile", balance.simulation],
    ["LWSimulationSchema", json("simulation.schema.json")],
    ["LWDefaultGrowth", balance.libraries.growth],
    ["LWGrowthSchema", json("growth.schema.json")],
    ["LWDefaultProfile", balance.world],
    ["LWScenarioSchema", json("scenario.schema.json")],
    ["LWAssetDefinitions", JSON.parse(fs.readFileSync(path.join(GENERATED, "asset-definitions.json"), "utf8"))]
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
  const defaults = spawnSync(process.execPath, [path.join(GENERATED, "tools", "build-validation.cjs")], {
    cwd: PROJECT, stdio: "inherit", timeout: 120000, killSignal: "SIGKILL"
  });
  if (defaults.error || defaults.status !== 0) throw new Error("Bundled default validation failed." + (defaults.error ? " " + defaults.error.message : ""));
  writeSourceBundle(PROJECT, GENERATED);
  writeWildlandsBundle(ROOT, GENERATED);
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
