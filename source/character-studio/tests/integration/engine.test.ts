/** Explicit integration tier: first run `npm ci && npm run build` in source/wildlands. */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, writeFile, rm, cp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createCharacter } from "../../src/domain/character.js";
import {
  compilePackage,
  compileDefinition,
  importCharacter,
} from "../../src/application/compiler.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const repository = path.resolve(root, "..");
const require = createRequire(import.meta.url);
const { toolbox } = require(
  path.join(root, "wildlands/.generated/developer-sdk.cjs"),
);
const scenarios = require(
  path.join(root, "wildlands/.generated/scenario-runtime.js"),
);
const editorApi = require(
  path.join(root, "wildlands/.generated/creature-editor.js"),
);
const globals = globalThis as any;
const game = path.join(repository, "docs/concepts/littlewild");
function cli(args: string[]) {
  const result = spawnSync(
    process.execPath,
    [path.join(repository, "bin/wildlands"), ...args],
    { encoding: "utf8", timeout: 120000, maxBuffer: 8 * 1024 * 1024 },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true, JSON.stringify(output));
  return output;
}

test("studio package survives actual engine editor import, scenario validation and portable-project intake", async () => {
  const character = createCharacter("clover-studio", "Clover", "fern");
  character.skills = { woodcraft: 4, stonework: 3, gardening: 3 };
  character.outfits.head = "trail_cap";
  character.outfits.back = "field_satchel";
  character.personality = "thoughtful";
  character.status = "ready";
  const packaged = compilePackage(character);
  const original = structuredClone(
    scenarios.builtins().find((pack: any) => pack.id === "littlewild"),
  );
  const selection = { sceneId: "first-morning", archetypeId: "sproutling" };
  const globalBefore = JSON.stringify([
    globals.LWAssets.all(),
    globals.LWCreatures.all(),
    globals.LWWorldProfile.current,
  ]);
  const check = toolbox.validateCreaturePackage(packaged, {
    pack: original,
    selection,
  });
  assert.equal(check.ok, true, check.errors.join("\n"));
  const session = toolbox.createCreatureEditor(original, selection);
  session.importPackage(packaged);
  assert.deepEqual(session.exportPackage(), packaged);
  assert.deepEqual(importCharacter(session.exportPackage()), character);
  const authored = session.exportScenario();
  const validated = scenarios.validate(authored);
  assert.equal(validated.ok, true, validated.errors.join("\n"));
  assert.deepEqual(
    authored.scenes,
    original.scenes,
    "Creating an archetype must preserve live scenario companion state.",
  );
  assert.equal(
    JSON.stringify([
      globals.LWAssets.all(),
      globals.LWCreatures.all(),
      globals.LWWorldProfile.current,
    ]),
    globalBefore,
  );
  const importedSelection = { ...selection, archetypeId: character.id };
  assert.equal(
    editorApi.validatePackage(packaged, {
      pack: authored,
      selection: importedSelection,
    }).ok,
    true,
  );
  const temporary = await mkdtemp(
    path.join(tmpdir(), "character-studio-engine-"),
  );
  try {
    const packFile = path.join(temporary, "authored.pack.json"),
      project = path.join(temporary, "project.json");
    await writeFile(packFile, JSON.stringify(authored));
    cli(["create", "--game", game, "--pack", packFile, "--output", project]);
    cli(["validate", "--project", project]);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("compiled definition is accepted by the real data-only Littlewild game-folder validator", async () => {
  const temporary = await mkdtemp(
    path.join(tmpdir(), "character-studio-game-"),
  );
  try {
    const copy = path.join(temporary, "littlewild");
    await cp(game, copy, { recursive: true });
    const character = createCharacter(
      "studio-companion",
      "Studio Companion",
      "mochi",
    );
    character.outfits.feet = "walking_boots";
    const directory = path.join(copy, "assets/creatures", character.id);
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "definition.json"),
      JSON.stringify(compileDefinition(character)),
    );
    cli(["validate-game", "--game", copy]);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
