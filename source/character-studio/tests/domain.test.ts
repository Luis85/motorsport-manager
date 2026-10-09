import test from "node:test";
import assert from "node:assert/strict";
import {
  createCharacter,
  validateCharacter,
  applyPreset,
  randomizeCharacter,
} from "../src/domain/character.js";
import {
  compilePackage,
  compileDefinition,
  compileVisual,
  importCharacter,
} from "../src/application/compiler.js";
import {
  validateAsset,
  validateCreature,
} from "../src/domain/engine-validation.js";
import { baseDefinition, catalog } from "../src/domain/catalog.js";

test("valid recipes are detached; invalid values report field paths", () => {
  const character = createCharacter();
  assert.equal(validateCharacter(character).ok, true);
  const result = validateCharacter(character);
  result.value!.identity.name = "Changed";
  assert.equal(character.identity.name, "Pip");
  for (const bad of [
    null,
    [],
    { ...character, extra: true },
    { ...character, id: "../pip" },
    { ...character, personality: "invented" },
  ])
    assert.equal(validateCharacter(bad).ok, false);
  character.appearance.headSize = NaN;
  assert.equal(validateCharacter(character).ok, false);
});
test("JSON validation rejects accessors without executing and prototype pollution", () => {
  let invoked = false;
  const input = {
    get name() {
      invoked = true;
      return "Pip";
    },
  };
  assert.equal(validateCharacter(input).ok, false);
  assert.equal(invoked, false);
  assert.equal(validateCharacter(JSON.parse('{"__proto__":{}}')).ok, false);
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.equal(validateCharacter(cyclic).ok, false);
  const malformed = createCharacter();
  const sparse = Object.assign(new Array(1), { extra: "appearance" });
  malformed.locks = sparse;
  assert.equal(validateCharacter(malformed).ok, false);
});
test("skills use native IDs, integer allocations and bounded total", () => {
  const character = createCharacter();
  character.skills = { woodcraft: 6, stonework: 5 };
  assert.equal(validateCharacter(character).ok, false);
  character.skills = { woodcraft: 2.5 };
  assert.equal(validateCharacter(character).ok, false);
  character.skills = { nonexistent: 1 };
  assert.equal(validateCharacter(character).ok, false);
  character.skills = { woodcraft: 4, stonework: 6 };
  const exported = compilePackage(character).gameplayDefinition.state.defaults;
  assert.deepEqual(exported.skills, { woodcraft: true, stonework: true });
  assert.deepEqual(exported.rpg.points, character.skills);
});
test("identity and personality never change the authored appearance", () => {
  const character = createCharacter();
  const before = compileVisual(character);
  character.identity = {
    name: "Moon",
    pronouns: "she/her",
    gender: "Girl",
    voice: "Deep",
  };
  character.personality = "maker";
  const after = compileVisual(character);
  assert.deepEqual(after.models, before.models);
  assert.deepEqual(after.materials, before.materials);
  assert.deepEqual(after.behaviors, before.behaviors);
  const applied = applyPreset(character, "fern");
  assert.deepEqual(applied.identity, character.identity);
  assert.equal(applied.personality, character.personality);
});
test("deterministic variation and presets respect locks", () => {
  const character = createCharacter();
  character.locks = ["appearance.coat", "appearance.headSize", "identity"];
  const next = randomizeCharacter(character, 42);
  assert.deepEqual(next, randomizeCharacter(character, 42));
  assert.equal(next.appearance.coat, character.appearance.coat);
  assert.equal(next.appearance.headSize, character.appearance.headSize);
  assert.deepEqual(next.identity, character.identity);
});
test("every preset, personality and clothing item compiles through actual engine validators", () => {
  for (const preset of catalog.presets)
    for (const personality of catalog.personalities) {
      const character = createCharacter(
        `test-${preset.id}`,
        preset.name,
        preset.id,
      );
      character.personality = personality.id;
      for (const item of catalog.outfits) {
        character.outfits[item.slot as keyof typeof character.outfits] =
          item.id;
        const output = compilePackage(character);
        assert.doesNotThrow(() => validateAsset(output.appearanceManifest));
        assert.doesNotThrow(() => validateCreature(output.gameplayDefinition));
        assert.equal(
          output.gameplayDefinition.visualAsset,
          output.appearanceManifest.id,
        );
        assert.deepEqual(
          output.gameplayDefinition.state.defaults.equipment,
          baseDefinition.creature.state.defaults.equipment,
        );
        assert.deepEqual(
          output.gameplayDefinition.state.defaults.inventory,
          baseDefinition.creature.state.defaults.inventory,
        );
        assert.deepEqual(
          output.appearanceManifest.rig,
          baseDefinition.visual.rig,
        );
        assert.equal("selectedInstance" in output, false);
      }
    }
});
test("exports roundtrip recipe and reject advanced edits rather than silently discarding them", () => {
  const character = createCharacter("clover", "Clover");
  character.identity.pronouns = "any";
  for (const output of [
    character,
    compilePackage(character),
    compileDefinition(character),
    compileVisual(character),
  ])
    assert.deepEqual(importCharacter(output), character);
  const changed = compilePackage(character);
  changed.gameplayDefinition.movement.baseSpeed = 2;
  assert.throws(() => importCharacter(changed), /advanced gameplay/);
  assert.equal(validateCharacter(character, { commit: true }).ok, false);
  character.status = "ready";
  assert.equal(validateCharacter(character, { commit: true }).ok, true);
});

test("unnamed drafts remain editable but cannot be marked ready or exported as gameplay", () => {
  const character = createCharacter("new-companion", "");
  assert.equal(validateCharacter(character).ok, true);
  assert.equal(compileVisual(character).name, "Untitled companion");
  assert.throws(() => compilePackage(character), /name before exporting/);
  character.status = "ready";
  assert.equal(validateCharacter(character).ok, false);
});
test("import is insensitive to JSON object key order", () => {
  const character = createCharacter();
  const output = compilePackage(character);
  const reordered = Object.fromEntries(Object.entries(output).reverse());
  assert.deepEqual(importCharacter(reordered), character);
});
