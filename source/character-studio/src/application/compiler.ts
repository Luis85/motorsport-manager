import { sculptPlushModel } from "./plush-model.js";
import {
  baseDefinition,
  clone,
  equipmentDefinitions,
  slots,
} from "../domain/catalog.js";
import {
  assertCharacter,
  CharacterError,
  type Character,
} from "../domain/character.js";
import {
  validateAsset,
  validateCreature,
} from "../domain/engine-validation.js";

export type Data = Record<string, any>;
export interface CreaturePackage {
  format: "littlewild-creature-package";
  schemaVersion: 1;
  gameplayDefinition: Data;
  appearanceManifest: Data;
  assetReferences: Data[];
}
function walk(nodes: Data[], visit: (node: Data) => void): void {
  for (const node of nodes) {
    visit(node);
    if (node.children) walk(node.children, visit);
  }
}
function multiply(node: Data, factors: number[]): void {
  node.scale = (node.scale || [1, 1, 1]).map(
    (v: number, i: number) => v * factors[i],
  );
}
function bakeOutfits(visual: Data, character: Character): void {
  for (const slot of slots) {
    const item = equipmentDefinitions.find(
      (item) => item.id === character.outfits[slot],
    );
    if (!item) continue;
    const prefix = `outfit-${slot}-`;
    for (const [id, material] of Object.entries(item.visual.materials))
      visual.materials[prefix + id] = clone(material);
    const sockets = [visual.behaviors.sockets[slot]].flat();
    for (const model of Object.values(visual.models) as Data[]) {
      walk(model.nodes, (node) => {
        if (!sockets.includes(node.id)) return;
        const children: Data[] = clone(item.visual.models.equipped.nodes);
        walk(children, (child) => {
          if (child.id) child.id = `${prefix}${node.id}-${child.id}`;
          if (child.material) child.material = prefix + child.material;
          if (visual.meshes?.["studio-soft"] && child.primitive === "soft") {
            child.primitive = "mesh";
            child.mesh = "studio-soft";
          }
        });
        node.children = [...(node.children || []), ...children];
      });
    }
  }
}
/** Compile the canonical rig with authored transforms and cosmetic socket attachments. */
export function compileVisual(input: Character): Data {
  return compileVisualRevision(input, 2);
}
/** Revision 1 is retained solely to verify unchanged exports made by the original compiler. */
function compileVisualRevision(input: Character, revision: 1 | 2): Data {
  const character = assertCharacter(input),
    look = character.appearance;
  const visual: Data = clone(baseDefinition.visual);
  visual.id = character.id;
  visual.name = character.identity.name.trim() || "Untitled companion";
  Object.assign(visual.materials, {
    fur: look.coat,
    light: look.belly,
    inner: look.inner,
    pupil: look.eyeColor,
  });
  const modelName = `world-${look.ears}`;
  for (const model of Object.values(visual.models) as Data[]) {
    walk(model.nodes, (node) => {
      if (node.id === "body")
        multiply(
          node,
          look.body === "round"
            ? [1.12, 0.95, 1.12]
            : look.body === "slender"
              ? [0.9, 1.06, 0.92]
              : [1, 1, 1],
        );
      if (node.id === "head")
        multiply(node, [look.headSize, look.headSize, look.headSize]);
      if (visual.rig.ears.includes(node.id))
        multiply(node, [look.earSize, look.earSize, look.earSize]);
      if (visual.rig.eyes.includes(node.id))
        multiply(node, [look.eyeSize, look.eyeSize, look.eyeSize]);
      if (node.id === visual.rig.tail)
        multiply(
          node,
          look.tail === "fluffy"
            ? [1.4, 1.25, 1.4]
            : look.tail === "long"
              ? [1, 1, 1.6]
              : [1, 1, 1],
        );
    });
  }
  // Personality changes behavior, never appearance, identity, or voice.
  for (const appearance of Object.values(
    visual.behaviors.appearances,
  ) as Data[]) {
    appearance.model = modelName;
    appearance.scale = [1, 1, 1];
    appearance.materials = {
      fur: look.coat,
      light: look.belly,
      inner: look.inner,
      pupil: look.eyeColor,
    };
  }
  if (revision === 2) sculptPlushModel(visual);
  bakeOutfits(visual, character);
  visual.metadata.characterStudio = {
    recipe: clone(character),
    outfits: "cosmetic-only",
    identity: "presentation-only",
    ...(revision === 2 ? { compilerRevision: 2 } : {}),
  };
  validateAsset(visual);
  return visual;
}
export function compilePackage(input: Character): CreaturePackage {
  const character = assertCharacter(input);
  if (!character.identity.name.trim())
    throw new CharacterError([
      {
        path: "/identity/name",
        message: "Give this companion a name before exporting to the engine.",
      },
    ]);
  const gameplay: Data = clone(baseDefinition.creature);
  gameplay.id = character.id;
  gameplay.name = character.identity.name;
  gameplay.names = [character.identity.name];
  gameplay.visualAsset = character.id;
  gameplay.defaultPersonality = character.personality;
  gameplay.state.defaults.archetype = character.id;
  gameplay.state.defaults.name = character.identity.name;
  gameplay.state.defaults.personality = character.personality;
  gameplay.state.defaults.skills = {};
  gameplay.state.defaults.researched = {};
  gameplay.state.defaults.rpg.points = {};
  for (const [id, points] of Object.entries(character.skills))
    if (points > 0) {
      gameplay.state.defaults.skills[id] = true;
      gameplay.state.defaults.researched[id] = true;
      gameplay.state.defaults.rpg.points[id] = points;
    }
  // Cosmetic clothing never grants equipment stats, inventory, money or progression.
  validateCreature(gameplay);
  return {
    format: "littlewild-creature-package",
    schemaVersion: 1,
    gameplayDefinition: gameplay,
    appearanceManifest: compileVisual(character),
    assetReferences: [],
  };
}
export function compileDefinition(input: Character): Data {
  const compiled = compilePackage(input);
  return {
    format: "littlewild-definition",
    schemaVersion: 1,
    family: "creatures",
    id: compiled.gameplayDefinition.id,
    creature: compiled.gameplayDefinition,
    visual: compiled.appearanceManifest,
  };
}
function canonical(value: any): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + canonical(value[key]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
/** Imported studio exports recover their recipe without silently discarding advanced edits. */
export function importCharacter(input: unknown): Character {
  if (!input || typeof input !== "object") return assertCharacter(input);
  const value = input as Data;
  if (value.format === "littlewild-character") return assertCharacter(value);
  const visual =
    value.format === "littlewild-definition"
      ? value.visual
      : value.format === "littlewild-creature-package"
        ? value.appearanceManifest
        : value;
  if (visual?.metadata?.characterStudio?.recipe) {
    validateAsset(visual);
    const character = assertCharacter(visual.metadata.characterStudio.recipe);
    const revision = visual.metadata.characterStudio.compilerRevision ?? 1;
    if (revision !== 1 && revision !== 2)
      throw new Error("This export uses an unsupported Character Studio compiler revision.");
    const expectedVisual = compileVisualRevision(character, revision);
    if (canonical(expectedVisual) !== canonical(visual))
      throw new Error(
        "This visual was edited outside Character Studio. Import its original recipe or use Scene Forge to preserve advanced edits.",
      );
    const expectedPackage = value.format === "littlewild-creature-package"
      ? { ...compilePackage(character), appearanceManifest: expectedVisual } : null;
    if (
      expectedPackage &&
      canonical(expectedPackage) !== canonical(value)
    )
      throw new Error(
        "This package has advanced gameplay edits. Import its original recipe to avoid discarding those changes.",
      );
    const expectedDefinition = value.format === "littlewild-definition"
      ? { ...compileDefinition(character), visual: expectedVisual } : null;
    if (
      expectedDefinition &&
      canonical(expectedDefinition) !== canonical(value)
    )
      throw new Error(
        "This definition has advanced edits. Import its original recipe to avoid discarding those changes.",
      );
    return character;
  }
  throw new Error(
    "Import a Character Studio recipe or unmodified studio export. General engine assets can be edited in Scene Forge.",
  );
}
