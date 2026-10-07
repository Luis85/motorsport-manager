/**
 * Build the self-contained Wildlands HTML artifacts from TypeScript-authored source.
 * JavaScript under .generated/ is disposable compiler output and is never authoritative.
 * Compilation happens once; tools/artifact-assembler.cts then assembles every profile from
 * tools/artifact-profiles.cts (showcase, studio and the per-template play artifacts).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { writeSourceBundle } from "./tools/engine-export-bundle.cjs";
import { writeWildlandsBundle } from "./tools/wildlands-bundle.cjs";
import { petAssetDefinitions } from "./tools/bundled-assets.cjs";

import { definitions } from "./tools/definition-source.cjs";
import { writeContent } from "./tools/bundled-content.cjs";
import { compileGame, gameDirectory, type CompiledGame } from "./tools/game-folder.cjs";
import type { ColonyContent } from "./tools/game-manifest.cjs";

import { assembleArtifact, writeArtifact, type AssembledArtifact } from "./tools/artifact-assembler.cjs";
import { PROFILES, profile, type ArtifactProfile } from "./tools/artifact-profiles.cjs";

const ROOT = __dirname;
const PROJECT = path.resolve(ROOT, "..");
const GENERATED = path.join(PROJECT, ".generated");
const ARTIFACTS = path.join(GENERATED, "artifacts");
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
    throw new Error("TypeScript dependencies are missing. Run npm ci in source/wildlands.");
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
  // Littlewild is read from its game folder (docs/concepts/littlewild, or WILDLANDS_GAMES_DIR). The
  // compiled layout under .generated is unchanged: runtime installers and the CLI bundle read it.
  const game = littlewild();
  const content = game.manifest.content as ColonyContent;
  const authored = [...content.packs, content.balancing, ...(content.skillTree ? [content.skillTree] : []), ...(content.adventureExamples ?? [])];
  for (const file of authored) {
    const target = path.join(GENERATED, "content", path.posix.basename(file));
    if (fs.existsSync(path.join(ROOT, "content", path.posix.basename(file)))) throw new Error("Game content shadows engine content: " + file);
    fs.copyFileSync(path.join(game.root, file), target);
  }
  writeContent(GENERATED, game.documents!);
  for (const fixture of ["scenario-v3-grown.json"]) {
    fs.copyFileSync(path.join(ROOT, fixture), path.join(GENERATED, fixture));
  }
  const profile = game.profile, creatures = profile.creatures!;
  fs.copyFileSync(path.join(game.root, content.interactions), path.join(GENERATED, "interaction-library.json"));
  fs.writeFileSync(path.join(GENERATED, "creature-definitions.json"), JSON.stringify(creatures.definitions));
  fs.copyFileSync(path.join(game.root, content.creatures.editorFields), path.join(GENERATED, "creature-editor-fields.json"));
  fs.writeFileSync(path.join(GENERATED, "creature-config.json"), JSON.stringify(creatures.configuration));
  fs.writeFileSync(path.join(GENERATED, "asset-definitions.json"), JSON.stringify(profile.assets));
  // Pending engine data (Phase 3b moves it to docs/concepts/pocket-pet): pet presentation definitions.
  fs.writeFileSync(path.join(GENERATED, "pet-asset-definitions.json"), JSON.stringify(petAssetDefinitions(definitions(path.join(ROOT, "assets")))));
}

let compiledLittlewild: CompiledGame | null = null;
/** The Littlewild game folder, compiled once per build. */
function littlewild(): CompiledGame {
  return compiledLittlewild ??= compileGame(gameDirectory("littlewild"));
}

function json(file: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(GENERATED, "content", file), "utf8"));
}

/**
 * Every injectable data global; profiles select what they declare. Colony globals come from the
 * Littlewild game folder; Emberworks/Office packs and the RTS/pet catalogs are pending engine data
 * until their own game folders exist (Phase 3b).
 */
function bundledData(packPath: string | null): Map<string, unknown> {
  const generated = (file: string): unknown => JSON.parse(fs.readFileSync(path.join(GENERATED, file), "utf8"));
  const colony = littlewild().data;
  const packs = packPath
    ? [JSON.parse(fs.readFileSync(packPath, "utf8"))]
    : [...colony.get("LWScenarioPacks") as unknown[], json("emberworks.pack.json"), json("office.pack.json")];
  return new Map<string, unknown>([
    ["WildlandsGodotRuntimeLoader", generated("wildlands-runtime-loader.json")],
    ["WildlandsGodotTemplates", generated("wildlands-godot-templates.json")],
    ["LWEngineSourceLoader", generated("engine-source-loader.json")],
    ...colony,
    ["LWRTSDefinitions", json("rts-demo.json")],
    ["LWPetDefinitions", json("pet-demo.json")],
    ["LWPetAssetDefinitions", generated("pet-asset-definitions.json")],
    ["LWScenarioPacks", packs]
  ]);
}

interface BuildArgs { packPath: string | null; outputPath: string | null; profile: ArtifactProfile | null; }

function parseArgs(argv: readonly string[]): BuildArgs {
  const args: BuildArgs = { packPath: null, outputPath: null, profile: null };
  const seen = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--pack" || arg === "--output" || arg === "--profile") {
      if (seen.has(arg)) throw new Error(`Duplicate build argument: ${arg}`);
      seen.add(arg);
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}.`);
      if (arg === "--pack") args.packPath = path.resolve(PROJECT, value);
      else if (arg === "--output") args.outputPath = path.resolve(PROJECT, value);
      else args.profile = profile(value);
    } else {
      throw new Error(`Unknown build argument: ${arg}`);
    }
  }
  if (args.packPath && args.profile && !args.profile.data.includes("LWScenarioPacks")) {
    throw new Error(`Profile ${args.profile.id} does not embed scenario packs; --pack is not applicable.`);
  }
  return args;
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

interface Target { profile: ArtifactProfile; outputs: string[]; manifest: string | null; }

/**
 * Without arguments every profile is written to .generated/artifacts/<id>.html with a sidecar
 * manifest, and the showcase is also published as littlewild.html. --profile/--pack/--output
 * build one artifact (default profile showcase, default output littlewild.html for the showcase).
 */
function targets(args: BuildArgs): Target[] {
  const showcase = path.join(PROJECT, "littlewild.html");
  if (!args.packPath && !args.outputPath && !args.profile) {
    return PROFILES.map(entry => ({
      profile: entry,
      outputs: [...(entry.id === "showcase" ? [showcase] : []), path.join(ARTIFACTS, entry.id + ".html")],
      manifest: path.join(ARTIFACTS, entry.id + ".manifest.json")
    }));
  }
  const selected = args.profile ?? profile("showcase");
  const output = args.outputPath ?? (selected.id === "showcase" ? showcase : path.join(ARTIFACTS, selected.id + ".html"));
  return [{ profile: selected, outputs: [output], manifest: null }];
}

function checkOutput(outputPath: string, packPath: string | null): void {
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
}

function build(args: BuildArgs): void {
  if (args.outputPath) checkOutput(args.outputPath, args.packPath);
  else if (args.packPath) checkOutput(path.join(PROJECT, "littlewild.html"), args.packPath);
  compile();
  const defaults = spawnSync(process.execPath, [path.join(GENERATED, "tools", "build-validation.cjs")], {
    cwd: PROJECT, stdio: "inherit", timeout: 120000, killSignal: "SIGKILL"
  });
  if (defaults.error || defaults.status !== 0) throw new Error("Bundled default validation failed." + (defaults.error ? " " + defaults.error.message : ""));
  writeSourceBundle(PROJECT, GENERATED);
  writeWildlandsBundle(ROOT, GENERATED);
  if (args.packPath) {
    const cli = path.join(GENERATED, "tools", "scenario-cli.cjs");
    const validation = spawnSync(process.execPath, [cli, "validate", args.packPath], {
      cwd: PROJECT,
      stdio: "inherit", timeout: 90000, killSignal: "SIGKILL"
    });
    if (validation.error || validation.status !== 0) throw new Error("Scenario pack validation failed." + (validation.error ? " " + validation.error.message : ""));
  }

  // Assemble everything in memory first so a failing profile publishes no artifact at all.
  const input = { source: ROOT, generated: GENERATED, data: bundledData(args.packPath), minified: new Map<string, string>() };
  const assembled: Array<[Target, AssembledArtifact]> = targets(args).map(target => [target, assembleArtifact(target.profile, input)]);
  for (const [target, artifact] of assembled) {
    for (const output of target.outputs) {
      writeArtifact(output, artifact.html);
      process.stdout.write(`Built ${output} (${fs.statSync(output).size.toLocaleString("en-US")} bytes)\n`);
    }
    if (target.manifest) writeArtifact(target.manifest, JSON.stringify(artifact.manifest, null, 2) + "\n");
  }
}

const argv = process.argv.slice(2);
if (argv.length === 1 && ["--help", "-h"].includes(argv[0]!)) {
  process.stdout.write("Usage: npm run build -- [--profile " + PROFILES.map(entry => entry.id).join("|") + "] [--pack pack.json] [--output artifact.html]\n");
} else {
  try { build(parseArgs(argv)); }
  catch (error) { process.stderr.write("Build failed: " + (error instanceof Error ? error.message : String(error)) + "\n"); process.exitCode = 1; }
}
