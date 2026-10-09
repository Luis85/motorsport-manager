import { catalog, clone, presets, slots } from "./catalog.js";

export interface Appearance {
  preset: string;
  body: "balanced" | "round" | "slender";
  headSize: number;
  earSize: number;
  ears: "round" | "long" | "pointed";
  eyeSize: number;
  eyeColor: string;
  coat: string;
  belly: string;
  inner: string;
  tail: "short" | "long" | "fluffy";
}
export interface Character {
  format: "littlewild-character";
  schemaVersion: 1;
  id: string;
  identity: { name: string; pronouns: string; gender: string; voice: string };
  appearance: Appearance;
  personality: string;
  skills: Record<string, number>;
  outfits: Record<(typeof slots)[number], string | null>;
  locks: string[];
  status: "draft" | "ready";
}
export interface Issue {
  path: string;
  message: string;
}
export interface Validation {
  ok: boolean;
  errors: Issue[];
  warnings: string[];
  value?: Character;
}
export class CharacterError extends Error {
  code = "VALIDATION";
  constructor(public errors: Issue[]) {
    super(errors.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
    this.name = "CharacterError";
  }
}
const plain = (v: unknown): v is Record<string, unknown> =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.getPrototypeOf(v) === Object.prototype;
/** Reject executable/accessor values before reading fields, including nested JSON pollution. */
export function isJsonData(
  value: unknown,
  ancestors = new Set<object>(),
  depth = 0,
): boolean {
  if (depth > 24) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (!Array.isArray(value) && !plain(value)) return false;
  if (ancestors.has(value) || Object.getOwnPropertySymbols(value).length)
    return false;
  ancestors.add(value);
  const names = Object.getOwnPropertyNames(value);
  if (Array.isArray(value)) {
    if (names.length !== value.length + 1) return false;
    for (let index = 0; index < value.length; index++)
      if (!Object.hasOwn(value, String(index))) return false;
  }
  for (const key of names) {
    if (Array.isArray(value) && key === "length") continue;
    if (["__proto__", "prototype", "constructor"].includes(key)) return false;
    const d = Object.getOwnPropertyDescriptor(value, key)!;
    if (
      !d.enumerable ||
      d.get ||
      d.set ||
      !isJsonData(d.value, ancestors, depth + 1)
    )
      return false;
  }
  ancestors.delete(value);
  return true;
}
export function validateCharacter(
  input: unknown,
  options: { commit?: boolean } = {},
): Validation {
  const errors: Issue[] = [],
    warnings: string[] = [];
  const add = (path: string, message: string) => errors.push({ path, message });
  if (!isJsonData(input) || !plain(input))
    return {
      ok: false,
      errors: [{ path: "/", message: "Expected plain, finite JSON data." }],
      warnings,
    };
  const exact = (value: unknown, path: string, keys: string[]) => {
    if (!plain(value)) {
      add(path, "Expected an object.");
      return {} as Record<string, unknown>;
    }
    for (const key of keys)
      if (!Object.hasOwn(value, key)) add(`${path}/${key}`, "Required field.");
    for (const key of Object.keys(value))
      if (!keys.includes(key)) add(`${path}/${key}`, "Unknown field.");
    return value;
  };
  const text = (
    value: unknown,
    path: string,
    max: number,
    required = false,
  ) => {
    if (
      typeof value !== "string" ||
      [...value].length > max ||
      (required && !value.trim()) ||
      (typeof value === "string" &&
        (!value.isWellFormed() || /[\u0000-\u001f\u007f]/.test(value)))
    )
      add(path, `Use ${required ? "1" : "0"}–${max} printable characters.`);
  };
  exact(input, "", [
    "format",
    "schemaVersion",
    "id",
    "identity",
    "appearance",
    "personality",
    "skills",
    "outfits",
    "locks",
    "status",
  ]);
  if (input.format !== "littlewild-character" || input.schemaVersion !== 1)
    add("/format", "Expected littlewild-character schemaVersion 1.");
  if (typeof input.id !== "string" || !/^[a-z][a-z0-9_-]{0,60}$/.test(input.id))
    add(
      "/id",
      "Use 1–61 lowercase letters, digits, underscores or hyphens, beginning with a letter.",
    );
  const identity = exact(input.identity, "/identity", [
    "name",
    "pronouns",
    "gender",
    "voice",
  ]);
  text(
    identity.name,
    "/identity/name",
    24,
    options.commit || input.status === "ready",
  );
  for (const key of ["pronouns", "gender", "voice"])
    text(identity[key], `/identity/${key}`, 80);
  const appearance = exact(input.appearance, "/appearance", [
    "preset",
    "body",
    "headSize",
    "earSize",
    "ears",
    "eyeSize",
    "eyeColor",
    "coat",
    "belly",
    "inner",
    "tail",
  ]);
  const member = (value: unknown, path: string, allowed: readonly string[]) => {
    if (typeof value !== "string" || !allowed.includes(value))
      add(path, `Choose one of: ${allowed.join(", ")}.`);
  };
  member(
    appearance.preset,
    "/appearance/preset",
    presets.map((p) => p.id),
  );
  member(appearance.body, "/appearance/body", catalog.bodyShapes);
  member(appearance.ears, "/appearance/ears", catalog.earShapes);
  member(appearance.tail, "/appearance/tail", catalog.tailShapes);
  for (const key of ["headSize", "earSize", "eyeSize"])
    if (
      typeof appearance[key] !== "number" ||
      appearance[key] < 0.7 ||
      appearance[key] > 1.3
    )
      add(`/appearance/${key}`, "Use a number from 0.7 to 1.3.");
  for (const key of ["coat", "belly", "inner", "eyeColor"])
    if (
      typeof appearance[key] !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(appearance[key])
    )
      add(`/appearance/${key}`, "Use a six-digit hex color.");
  member(
    input.personality,
    "/personality",
    catalog.personalities.map((p) => p.id),
  );
  let spent = 0;
  if (!plain(input.skills))
    add("/skills", "Expected skill IDs mapped to integer points.");
  else
    for (const [id, n] of Object.entries(input.skills)) {
      if (!catalog.skills.some((skill) => skill.id === id))
        add(`/skills/${id}`, "Unknown Littlewild skill.");
      if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0 || n > 10)
        add(`/skills/${id}`, "Use 0–10 whole points.");
      else spent += n;
    }
  if (spent > catalog.skillBudget)
    add(
      "/skills",
      `Starting skills exceed the ${catalog.skillBudget}-point budget by ${spent - catalog.skillBudget}.`,
    );
  else if (spent < catalog.skillBudget)
    warnings.push(
      `${catalog.skillBudget - spent} starting skill points are unassigned.`,
    );
  const outfits = exact(input.outfits, "/outfits", [...slots]);
  for (const slot of slots)
    if (
      outfits[slot] !== null &&
      !catalog.outfits.some(
        (item) => item.id === outfits[slot] && item.slot === slot,
      )
    )
      add(`/outfits/${slot}`, "Choose an item for this slot or null.");
  const lockPaths = [
    "identity",
    "appearance",
    "personality",
    "skills",
    "outfits",
    ...Object.keys(identity).map((k) => `identity.${k}`),
    ...Object.keys(appearance).map((k) => `appearance.${k}`),
    ...slots.map((k) => `outfits.${k}`),
  ];
  if (
    !Array.isArray(input.locks) ||
    input.locks.length > 40 ||
    input.locks.some((p) => typeof p !== "string" || !lockPaths.includes(p)) ||
    new Set(input.locks).size !== input.locks.length
  )
    add(
      "/locks",
      "Use unique field paths such as appearance.coat or identity.",
    );
  member(input.status, "/status", ["draft", "ready"]);
  if (options.commit && input.status !== "ready")
    add(
      "/status",
      "Mark the reviewed character ready before committing it to a game folder.",
    );
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    ...(errors.length ? {} : { value: clone(input) as unknown as Character }),
  };
}
export function assertCharacter(
  value: unknown,
  options: { commit?: boolean } = {},
): Character {
  const result = validateCharacter(value, options);
  if (!result.ok) throw new CharacterError(result.errors);
  return result.value!;
}
export function createCharacter(
  id = "pip",
  name = "Pip",
  preset = "pip",
): Character {
  const chosen = presets.find((p) => p.id === preset);
  if (!chosen)
    throw new CharacterError([
      { path: "/appearance/preset", message: "Unknown preset." },
    ]);
  return assertCharacter({
    format: "littlewild-character",
    schemaVersion: 1,
    id,
    identity: { name, pronouns: "they/them", gender: "", voice: "Soft" },
    appearance: {
      preset,
      ...chosen.appearance,
      headSize: 1,
      earSize: 1,
      eyeSize: 1,
      eyeColor: "#303f37",
    },
    personality: "curious",
    skills: {},
    outfits: Object.fromEntries(slots.map((slot) => [slot, null])),
    locks: [],
    status: "draft",
  });
}
export function isLocked(character: Character, path: string): boolean {
  return character.locks.some(
    (lock) => lock === path || path.startsWith(lock + "."),
  );
}
/** Staging helpers only transform detached data; the transaction validates its final value. */
export function stagePreset(input: Character, preset: string): Character {
  const chosen = presets.find((p) => p.id === preset);
  if (!chosen)
    throw new CharacterError([
      { path: "/appearance/preset", message: "Unknown preset." },
    ]);
  const value = clone(input);
  const appearance = {
    preset,
    ...chosen.appearance,
    headSize: 1,
    earSize: 1,
    eyeSize: 1,
    eyeColor: "#303f37",
  };
  const previous =
    value.appearance && typeof value.appearance === "object"
      ? value.appearance
      : {};
  const locks = Array.isArray(value.locks)
    ? value.locks.filter((lock) => typeof lock === "string")
    : [];
  value.appearance = { ...appearance };
  for (const key of Object.keys(appearance) as (keyof Appearance)[]) {
    if (
      locks.some(
        (lock) => lock === "appearance" || lock === `appearance.${key}`,
      ) &&
      Object.hasOwn(previous, key)
    ) {
      (value.appearance as unknown as Record<string, unknown>)[key] = (
        previous as Record<string, unknown>
      )[key];
    }
  }
  value.status = "draft";
  return value;
}
/** Presets change appearance only; identity and gameplay choices are independent. */
export function applyPreset(input: Character, preset: string): Character {
  return assertCharacter(stagePreset(assertCharacter(input), preset));
}
export function stageRandomize(input: Character, seed: number = 1): Character {
  if (!Number.isSafeInteger(seed))
    throw new CharacterError([
      { path: "/seed", message: "Use a safe integer seed." },
    ]);
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const chosen = presets[Math.floor(random() * presets.length)];
  const result = stagePreset(input, chosen.id);
  const locks = Array.isArray(input.locks)
    ? input.locks.filter((lock) => typeof lock === "string")
    : [];
  for (const key of ["headSize", "earSize", "eyeSize"] as const) {
    if (
      !locks.some(
        (lock) => lock === "appearance" || lock === `appearance.${key}`,
      )
    )
      result.appearance[key] = Math.round((0.85 + random() * 0.3) * 100) / 100;
  }
  return result;
}
/** Seeded appearance randomization supports reproducible agent edits and field locks. */
export function randomizeCharacter(
  input: Character,
  seed: number = 1,
): Character {
  return assertCharacter(stageRandomize(assertCharacter(input), seed));
}
