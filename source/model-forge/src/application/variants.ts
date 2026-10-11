import {
  fail,
  parse,
  canonical,
  sha256Hex,
  checkSeed,
  createRandom,
  Color,
  Id,
} from '../kernel/index.js';
import { MAX_GENERATED_DOCUMENTS } from '../domain/generate.js';
import { type EditorDocument, documentStateHash, withoutRevision } from './document.js';
import { round4 } from './generators/kit.js';

export interface VariantRequest {
  count: number;
  seed: number;
  /** Parameter ranges, `--vary name=min..max`. */
  vary: Record<string, [number, number]>;
  /** Color choices per material, `--materials slot=#a,#b`. */
  materials: Record<string, string[]>;
}

/** `name=min..max` (negative numbers allowed) as [name, [min, max]]. */
export function parseVary(text: string): [string, [number, number]] {
  const match = /^([A-Za-z][A-Za-z0-9_-]*)=(.+)\.\.(.+)$/.exec(text);
  const range = match ? [Number(match[2]), Number(match[3])] : [];
  if (!match || !match[2].trim() || !match[3].trim() || !range.every(Number.isFinite))
    fail('INVALID_OPTION', `Expected --vary <parameter>=<min>..<max>, got ${text}.`, {
      hint: 'Write --vary height=0.6..0.9; inspect lists the parameters and their declared min and max.',
    });
  return [match![1], range as [number, number]];
}
/** `slot=#rrggbb,#rrggbb` as [slot, colors]. */
export function parseMaterialChoices(text: string): [string, string[]] {
  const at = text.indexOf('=');
  const colors = at > 0 ? text.slice(at + 1).split(',') : [];
  if (at <= 0 || !colors.length || colors.some((color) => !Color.safeParse(color).success))
    fail('INVALID_OPTION', `Expected --materials <material>=#rrggbb[,#rrggbb...], got ${text}.`, {
      hint: 'Write --materials stone=#6f6a63,#7d776f; inspect --source lists the materials.',
    });
  return [text.slice(0, at), colors];
}

/** A derived ID `<base>-<nn>` that stays a valid 64-character model ID. */
export const numberedId = (base: string, index: number, total: number) =>
  parse(
    Id,
    `${base.slice(0, 60)}-${String(index).padStart(Math.max(2, String(total).length), '0')}`,
  );

/** Check every range against the declared parameter: it may narrow, never widen. */
function checkRequest(document: EditorDocument, request: VariantRequest) {
  const { model } = document;
  if (
    !Number.isInteger(request.count) ||
    request.count < 1 ||
    request.count > MAX_GENERATED_DOCUMENTS
  )
    fail('INVALID_OPTION', `--count must be from 1 to ${MAX_GENERATED_DOCUMENTS}.`, {
      count: request.count,
    });
  checkSeed(request.seed);
  if (!Object.keys(request.vary).length && !Object.keys(request.materials).length)
    fail(
      'INPUT_REQUIRED',
      'Pass at least one --vary <parameter>=<min>..<max> or --materials <material>=<colors>.',
      {
        parameters: model.parameters,
        materials: Object.keys(model.materials),
      },
    );
  const ranges: Record<string, [number, number]> = {};
  for (const [name, [low, high]] of Object.entries(request.vary)) {
    const declared = model.parameters[name];
    if (!declared)
      fail('UNKNOWN_PARAMETER', `Model ${model.id} has no parameter ${name}.`, {
        parameter: name,
        available: Object.keys(model.parameters),
        hint: 'inspect lists the parameters; variants vary declared model parameters only.',
      });
    const bounds = { min: declared.min, max: declared.max };
    if (
      low > high ||
      (declared.min !== undefined && low < declared.min) ||
      (declared.max !== undefined && high > declared.max)
    )
      fail(
        'VARIANT_RANGE',
        `--vary ${name}=${low}..${high} must lie inside the declared range ${declared.min ?? '-inf'}..${declared.max ?? 'inf'}, with min <= max.`,
        {
          parameter: name,
          requested: [low, high],
          declared: bounds,
          hint: `Narrow the range to ${declared.min ?? low}..${declared.max ?? high} or less.`,
        },
      );
    if (declared.integer && Math.ceil(low) > Math.floor(high))
      fail('VARIANT_RANGE', `Integer parameter ${name} has no whole number in ${low}..${high}.`, {
        parameter: name,
        requested: [low, high],
        declared: bounds,
        hint: 'Include at least one whole number in the range.',
      });
    ranges[name] = declared.integer ? [Math.ceil(low), Math.floor(high)] : [low, high];
  }
  for (const material of Object.keys(request.materials))
    if (!Object.hasOwn(model.materials, material))
      fail('NOT_FOUND', `Model ${model.id} has no material ${material}.`, {
        material,
        available: Object.keys(model.materials),
        hint: 'Use a material of the editable model (inspect --source lists them).',
      });
  return ranges;
}

/**
 * N variant documents of one source document. Variant i draws its parameter defaults and
 * then its material colors, each in name order, from its own stream `variants/v<i>` of the
 * seed: the same request always gives the same documents, and variant i does not depend on
 * the count, so the first N variants of a larger request are the same documents.
 */
export function planVariants(
  document: EditorDocument,
  request: VariantRequest,
  idFor: (index: number) => string,
) {
  const ranges = checkRequest(document, request);
  const integer = (name: string) => !!document.model.parameters[name].integer;
  const recipe = {
    source: documentStateHash(document),
    seed: request.seed,
    count: request.count,
    vary: ranges,
    materials: request.materials,
  };
  const root = createRandom(request.seed, 'variants');
  const variants = Array.from({ length: request.count }, (_, offset) => {
    const index = offset + 1;
    const random = root.fork(`v${index}`);
    const parameters: Record<string, number> = {};
    for (const name of Object.keys(ranges).sort()) {
      const [low, high] = ranges[name];
      parameters[name] = integer(name) ? random.int(low, high) : round4(random.range(low, high));
    }
    const materials: Record<string, string> = {};
    for (const name of Object.keys(request.materials).sort())
      materials[name] = random.pick(request.materials[name]);
    const id = idFor(index);
    if (Object.hasOwn(document.dependencies, id))
      fail('DUPLICATE_ID', `Variant ID ${id} is already a dependency of ${document.model.id}.`);
    const model = withoutRevision(document.model);
    model.id = id;
    model.name = `${document.model.name} ${index}`.slice(0, 120);
    for (const [name, value] of Object.entries(parameters))
      model.parameters[name] = { ...model.parameters[name], default: value };
    for (const [name, color] of Object.entries(materials))
      model.materials[name] = { ...model.materials[name], color };
    const variant: EditorDocument = {
      kind: document.kind,
      model,
      dependencies: document.dependencies,
    };
    return { index, document: variant, parameters, materials };
  });
  return { variants, ranges, recipe, recipeHash: sha256Hex(canonical(recipe)) };
}
