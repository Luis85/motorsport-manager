import sproutling from "../../../../docs/concepts/littlewild/assets/creatures/sproutling/definition.json";
import balancing from "../../../../docs/concepts/littlewild/content/balancing.json";
import trail_cap from "../../../../docs/concepts/littlewild/assets/items/trail_cap/definition.json";
import stargazer_hat from "../../../../docs/concepts/littlewild/assets/items/stargazer_hat/definition.json";
import woodland_vest from "../../../../docs/concepts/littlewild/assets/items/woodland_vest/definition.json";
import rain_cape from "../../../../docs/concepts/littlewild/assets/items/rain_cape/definition.json";
import field_satchel from "../../../../docs/concepts/littlewild/assets/items/field_satchel/definition.json";
import walking_boots from "../../../../docs/concepts/littlewild/assets/items/walking_boots/definition.json";
import swift_shoes from "../../../../docs/concepts/littlewild/assets/items/swift_shoes/definition.json";
import walking_staff from "../../../../docs/concepts/littlewild/assets/items/walking_staff/definition.json";
import hand_hammer from "../../../../docs/concepts/littlewild/assets/items/hand_hammer/definition.json";
import gathering_axe from "../../../../docs/concepts/littlewild/assets/items/gathering_axe/definition.json";
import lantern from "../../../../docs/concepts/littlewild/assets/items/lantern/definition.json";
import friendship_charm from "../../../../docs/concepts/littlewild/assets/items/friendship_charm/definition.json";

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
export const baseDefinition = freeze(sproutling);
export const equipmentDefinitions = freeze([
  trail_cap,
  stargazer_hat,
  woodland_vest,
  rain_cape,
  field_satchel,
  walking_boots,
  swift_shoes,
  walking_staff,
  hand_hammer,
  gathering_axe,
  lantern,
  friendship_charm,
]);
export const slots = ["head", "body", "back", "feet", "tool", "charm"] as const;
export const presets = [
  {
    id: "pip",
    name: "Pip",
    description: "Warm woodland explorer",
    appearance: {
      body: "balanced",
      ears: "round",
      coat: "#caa273",
      belly: "#eed8b4",
      inner: "#c98f79",
      tail: "short",
    },
  },
  {
    id: "fern",
    name: "Fern",
    description: "A gentle forest friend",
    appearance: {
      body: "slender",
      ears: "long",
      coat: "#a4ba99",
      belly: "#e3e7c5",
      inner: "#bfab99",
      tail: "long",
    },
  },
  {
    id: "mochi",
    name: "Mochi",
    description: "Soft and sunlit",
    appearance: {
      body: "round",
      ears: "pointed",
      coat: "#e0cbb0",
      belly: "#fbecd1",
      inner: "#dca08e",
      tail: "fluffy",
    },
  },
  {
    id: "bramble",
    name: "Bramble",
    description: "A rosy little wanderer",
    appearance: {
      body: "balanced",
      ears: "round",
      coat: "#b99ba8",
      belly: "#ead5cd",
      inner: "#c08e9b",
      tail: "fluffy",
    },
  },
] as const;
const descriptions: Record<string, string> = {
  curious: "Drawn to discovery and new experiences.",
  maker: "Finds joy in creating useful things.",
  sunny: "Brings warmth to everyday adventures.",
  spirited: "Meets the world with lively energy.",
  thoughtful: "Takes time to notice the little details.",
  steadfast: "A patient and dependable companion.",
};
export const catalog = freeze({
  schemaVersion: 1,
  skillBudget: 10,
  slots,
  presets,
  personalities: sproutling.creature.personalities.map((id) => ({
    id,
    name: id[0].toUpperCase() + id.slice(1),
    description: descriptions[id],
  })),
  skills: balancing.libraries.base.components.skills.map((skill) => ({
    id: skill.id,
    name: skill.short,
    description: skill.desc,
  })),
  outfits: equipmentDefinitions.map((item) => ({
    id: item.id,
    name: item.equipment.name,
    slot: item.equipment.slot,
    description: "Cosmetic only; no equipment bonuses.",
  })),
  bodyShapes: ["balanced", "round", "slender"],
  earShapes: ["round", "long", "pointed"],
  tailShapes: ["short", "long", "fluffy"],
});
