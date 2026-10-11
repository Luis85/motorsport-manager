import { catalog } from "./catalog.js";
const object = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const enumeration = (values: readonly string[]) => ({
  type: "string",
  enum: values,
});
const color = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" };
const factor = { type: "number", minimum: 0.7, maximum: 1.3 };
export const characterSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Littlewild Character Studio recipe",
  description:
    "Skill allocations must total at most 10 points. Domain validation also rejects invalid Unicode, control characters, unknown locks and unsafe JSON.",
  ...object({
    format: { const: "littlewild-character" },
    schemaVersion: { const: 1 },
    id: { type: "string", pattern: "^[a-z][a-z0-9_-]{0,60}$" },
    identity: object({
      name: { type: "string", maxLength: 24 },
      pronouns: { type: "string", maxLength: 80 },
      gender: { type: "string", maxLength: 80 },
      voice: { type: "string", maxLength: 80 },
    }),
    appearance: object({
      preset: enumeration(catalog.presets.map((p) => p.id)),
      body: enumeration(catalog.bodyShapes),
      headSize: factor,
      earSize: factor,
      ears: enumeration(catalog.earShapes),
      eyeSize: factor,
      eyeColor: color,
      coat: color,
      belly: color,
      inner: color,
      tail: enumeration(catalog.tailShapes),
    }),
    personality: enumeration(catalog.personalities.map((p) => p.id)),
    skills: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        catalog.skills.map((skill) => [
          skill.id,
          { type: "integer", minimum: 0, maximum: 10 },
        ]),
      ),
    },
    outfits: object(
      Object.fromEntries(
        catalog.slots.map((slot) => [
          slot,
          {
            enum: [
              null,
              ...catalog.outfits
                .filter((item) => item.slot === slot)
                .map((item) => item.id),
            ],
          },
        ]),
      ),
    ),
    locks: {
      type: "array",
      maxItems: 40,
      uniqueItems: true,
      items: { type: "string" },
    },
    status: enumeration(["draft", "ready"]),
  }),
};
