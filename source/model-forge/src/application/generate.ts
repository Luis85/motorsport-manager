import { z } from 'zod';
import {
  fail,
  parse,
  canonical,
  sha256Hex,
  checkSeed,
  createRandom,
  ForgeError,
  DEFAULT_SEED,
  SEED_MAX,
} from '../kernel/index.js';
import {
  GeneratorRecipeSchema,
  MAX_GENERATED_DOCUMENTS,
  MAX_REVIEW_FRAMES,
  type GeneratorRecipe,
} from '../domain/generate.js';
import { type EditorDocument, validateEditorDocument } from './document.js';
import { generators } from './generators/index.js';
import type { Generator } from './generators/types.js';

type Issue = { path: string; message: string };

/** The generator with this ID, or GENERATOR_NOT_FOUND naming the catalog. */
export function findGenerator(id: string): Generator {
  const generator = generators.find((entry) => entry.id === id);
  if (!generator)
    fail('GENERATOR_NOT_FOUND', `There is no generator named ${id}.`, {
      generator: id,
      available: generators.map((entry) => entry.id),
      hint: `Use one of ${generators.map((entry) => entry.id).join(', ')}; run generate list.`,
    });
  return generator;
}

/** One catalog line: identity, presets and limits. */
export const generatorSummary = (generator: Generator) => ({
  id: generator.id,
  version: generator.version,
  category: generator.category,
  description: generator.description,
  presets: Object.entries(generator.presets).map(([name, preset]) => ({
    name,
    description: preset.description,
  })),
  defaultPreset: generator.defaultPreset,
  limits: generator.limits,
  example: exampleCommand(generator.id, generator.defaultPreset),
});
const exampleCommand = (id: string, preset: string) =>
  `generate ${id} --preset ${preset} --seed 7 --out ${id}.model.json`;

/** Parameter defaults: every generator parameter has one. */
export const parameterDefaults = (generator: Generator) =>
  parse(generator.parameters, {}) as Record<string, unknown>;

/** Everything an agent needs to call a generator: schema, defaults, presets and limits. */
export function generatorDetails(generator: Generator) {
  const defaults = parameterDefaults(generator);
  return {
    ...generatorSummary(generator),
    parameterSchema: z.toJSONSchema(generator.parameters, {
      target: 'draft-2020-12',
      io: 'input',
    }),
    defaults,
    presets: Object.entries(generator.presets).map(([name, preset]) => ({
      name,
      description: preset.description,
      parameters: { ...defaults, ...preset.parameters },
    })),
    seeds: { min: 0, max: SEED_MAX, default: DEFAULT_SEED },
    examples: [
      exampleCommand(generator.id, generator.defaultPreset),
      `generate ${generator.id} --set ${Object.keys(defaults)[0]}=${JSON.stringify(defaults[Object.keys(defaults)[0]])} --count 6 --seed 1 --out ${generator.id}-set --review ${generator.id}-review`,
      `generate ${generator.id} --file ${generator.id}.generate.json --out ${generator.id}-copy.model.json`,
    ],
  };
}

/** Parse one `--set key=value`: JSON when it parses (numbers, booleans), else the text. */
export function parseSetting(text: string): [string, unknown] {
  const at = text.indexOf('=');
  if (at <= 0)
    fail('INVALID_OPTION', `Expected --set <parameter>=<value>, got ${text}.`, {
      hint: 'Write --set height=6 or --set kind=palm; run generate show <generator> for names.',
    });
  const raw = text.slice(at + 1);
  try {
    return [text.slice(0, at), JSON.parse(raw)];
  } catch {
    return [text.slice(0, at), raw];
  }
}

export interface GenerateRequest {
  /** A generator recipe (kind generator-recipe) to start from, as JSON. */
  recipe?: unknown;
  seed?: number;
  preset?: string;
  /** Parameter values over the recipe and preset (from --set). */
  set?: Record<string, unknown>;
  id?: string;
  name?: string;
  /** ID when neither the request nor the recipe names one (the --out file stem). */
  defaultId: string;
}

const title = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Resolve a request into a complete recipe: defaults, then the preset, then recipe
 * parameters, then `--set` values. The result spells out every parameter, so replaying it
 * never depends on defaults or presets that a later version might change.
 */
export function resolveRecipe(generator: Generator, request: GenerateRequest) {
  const recipe: GeneratorRecipe | undefined =
    request.recipe === undefined ? undefined : parse(GeneratorRecipeSchema, request.recipe);
  if (recipe && recipe.generator !== generator.id)
    fail(
      'INVALID_OPTION',
      `The recipe is for generator ${recipe.generator}, not ${generator.id}.`,
      {
        hint: `Run generate ${recipe.generator} --file <recipe> --out <new document>.`,
      },
    );
  const warnings =
    recipe?.version !== undefined && recipe.version !== generator.version
      ? [
          `The recipe was written by ${generator.id} version ${recipe.version}; this build has version ${generator.version}, so the output may differ.`,
        ]
      : [];
  const preset = request.preset ?? recipe?.preset ?? generator.defaultPreset;
  if (!Object.hasOwn(generator.presets, preset))
    fail('NOT_FOUND', `Generator ${generator.id} has no preset ${preset}.`, {
      available: Object.keys(generator.presets),
      hint: `Use --preset ${Object.keys(generator.presets).join('|')}.`,
    });
  const known = Object.keys(generator.parameters.shape);
  const supplied = { ...recipe?.parameters, ...request.set };
  for (const key of Object.keys(supplied))
    if (!known.includes(key))
      fail('UNKNOWN_PARAMETER', `Generator ${generator.id} has no parameter ${key}.`, {
        parameter: key,
        available: known,
        hint: `Use one of ${known.join(', ')}; generate show ${generator.id} lists ranges.`,
      });
  let parameters: Record<string, unknown>;
  try {
    parameters = parse(generator.parameters, {
      ...parameterDefaults(generator),
      ...generator.presets[preset].parameters,
      ...supplied,
    }) as Record<string, unknown>;
  } catch (error) {
    if (!(error instanceof ForgeError)) throw error;
    // Keep the schema issues as the array every SCHEMA_INVALID reports; the remedy names
    // the generator's own parameter description rather than the generic schema command.
    const issues = Array.isArray(error.details) ? (error.details as Issue[]) : [];
    const listed = issues.map((issue) => `${issue.path || '(parameters)'}: ${issue.message}`);
    throw Object.assign(
      new ForgeError(
        error.code,
        `Generator ${generator.id} parameters are invalid${listed.length ? ` (${listed.join('; ')})` : ''}.`,
        error.details,
      ),
      { hint: `Run generate show ${generator.id} for parameter ranges and choices.` },
    );
  }
  const seed = checkSeed(request.seed ?? recipe?.seed ?? DEFAULT_SEED);
  const resolved: GeneratorRecipe = {
    schemaVersion: 1,
    kind: 'generator-recipe',
    generator: generator.id,
    version: generator.version,
    seed,
    preset,
    parameters,
    id: request.id ?? recipe?.id ?? request.defaultId,
    name: request.name ?? recipe?.name ?? `${title(preset)} ${generator.id}`,
  };
  return { recipe: parse(GeneratorRecipeSchema, resolved), warnings };
}

/** The recipe hash reported for a generated document: sha256 of its canonical recipe. */
export const recipeHash = (recipe: GeneratorRecipe) => sha256Hex(canonical(recipe));

/**
 * Build one document from a resolved recipe and enforce the generator's triangle budget.
 * Pure and deterministic: equal recipes give equal documents.
 */
export function buildDocument(generator: Generator, recipe: GeneratorRecipe) {
  const model = generator.build({
    id: recipe.id!,
    name: recipe.name!,
    params: recipe.parameters,
    random: createRandom(recipe.seed, `generate/${generator.id}`),
  });
  model.description = `Generated by model-forge generate ${generator.id} v${generator.version}, preset ${recipe.preset}, seed ${recipe.seed}.`;
  const document: EditorDocument = { kind: 'model', model, dependencies: {} };
  const { stats } = validateEditorDocument(document);
  if (stats.triangles > generator.limits.maxTriangles)
    fail(
      'PROCEDURAL_BUDGET',
      `Generator ${generator.id} produced ${stats.triangles} triangles; its limit is ${generator.limits.maxTriangles}.`,
      {
        limit: generator.limits.maxTriangles,
        triangles: stats.triangles,
        hint: 'Lower the detail, resolution or count parameters (generate show <generator> lists them).',
      },
    );
  return { document, stats };
}

/** The `procedural` section of discover: generators, presets, commands and limits. */
export function proceduralCatalog() {
  return {
    generators: generators.map((generator) => ({
      id: generator.id,
      version: generator.version,
      category: generator.category,
      presets: Object.keys(generator.presets),
      defaultPreset: generator.defaultPreset,
      maxTriangles: generator.limits.maxTriangles,
      example: exampleCommand(generator.id, generator.defaultPreset),
    })),
    commands: {
      list: 'generate list',
      show: 'generate show <generator>',
      generate:
        'generate <generator> --out <new.model.json> [--preset <name>] [--seed <n>] [--set <name=value>]... [--file|--data <generator recipe>] [--count <n> (--out is then a new directory)] [--review <new directory>] [--dry-run]',
      variants:
        '-d <doc> variants --count <n> [--seed <n>] --vary <parameter=min..max>... [--materials <material=#a,#b>]... --out <new directory> [--review <new directory>] [--dry-run]',
      scatter:
        '-d <doc> scatter (--file|--data <scatter recipe> | --node|--model <ids> --spacing <m>|--grid <CxR> --step <m>|--count <n> ... [--area] [--on <terrain node>]) [--dependency <file>]... [--replace] --dry-run | --expected-revision <n> --expected-state <hash>',
    },
    outputs: {
      document:
        'An ordinary kind "model" document: editable with every other command; its main dimensions are model parameters ($param).',
      'generator-recipe':
        '<id>.generate.json beside each generated document, every parameter resolved; generate <generator> --file <it> --out <new document> rebuilds the same bytes with the same generator version.',
      'model-variants':
        "variants.json beside the variant documents: source stateHash, seed, ranges, colors and each variant's values.",
      scatter:
        'A guarded edit: a group node tagged scatter and scatter:<recipeHash8> plus <group>-<n> placements.',
    },
    determinism:
      'Forge keyed PRNG v1 (cyrb128 + sfc32): the same seed and inputs give the same bytes; no clock or ambient randomness. Numbers are rounded to 1e-4.',
    examples: [
      'generate list',
      'generate show tree',
      'generate tree --preset palm --seed 3 --out palm.model.json --review palm-review',
      'generate rock --preset boulder --count 6 --out boulders --review boulders-review',
      '-d palm.model.json variants --count 6 --vary height=5..9 --materials leaf=#5f9a3c,#4f8a3a --out palms --review palms-review',
      '-d field.model-bundle.json scatter --model rock --dependency rock.model.json --spacing 3 --on terrain --dry-run',
    ],
    limits: {
      documentsPerCall: MAX_GENERATED_DOCUMENTS,
      reviewFrames: MAX_REVIEW_FRAMES,
      placements: 2000,
      candidates: 20000,
      terrainVertices: '256 x 256',
    },
  };
}
