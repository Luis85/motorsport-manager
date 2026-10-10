import path from 'node:path';
import { fail, canonical, sha256Hex, Id, SEED_MAX, type ModelDocument } from '../kernel/index.js';
import { MAX_GENERATED_DOCUMENTS } from '../domain/generate.js';
import { documentStateHash } from '../application/document.js';
import {
  buildDocument,
  findGenerator,
  recipeHash,
  resolveRecipe,
} from '../application/generate.js';
import { numberedId } from '../application/variants.js';
import { round4 } from '../application/generators/kit.js';
import {
  checkNewDirectory,
  checkPlanned,
  writePlanned,
  type PlannedDocument,
} from './generated.js';
import { reviewLineup } from './lineup.js';

export interface GenerateRun {
  generator: string;
  /** A new `<id>.model.json`, or a new directory with `count`. */
  out: string;
  /** A generator recipe (`--file`/`--data`). */
  recipe?: unknown;
  seed?: number;
  preset?: string;
  set?: Record<string, unknown>;
  id?: string;
  name?: string;
  count?: number;
  /** A new directory for the lineup review. */
  review?: string;
  dryRun?: boolean;
  /** The executable name for nextCommands. */
  tool: string;
}

/** A narrowed `--vary` example for a model's first ranged, non-integer parameter. */
export function varyExample(model: ModelDocument) {
  for (const [name, spec] of Object.entries(model.parameters)) {
    if (spec.integer || spec.min === undefined || spec.max === undefined) continue;
    const low = round4(Math.max(spec.min, spec.default * 0.8)),
      high = round4(Math.min(spec.max, spec.default * 1.2));
    if (low < high) return `${name}=${low}..${high}`;
  }
  return undefined;
}

/** Next steps for a written document: review, variants, export and Scene Forge import. */
export function documentNextCommands(tool: string, file: string, model: ModelDocument) {
  const stem = file.replace(/\.model(-bundle)?\.json$/, '');
  const vary = varyExample(model);
  return [
    [tool, '-d', file, 'review', '--out', '<new directory>'],
    ...(vary
      ? [
          [
            tool,
            '-d',
            file,
            'variants',
            '--count',
            '8',
            '--seed',
            '1',
            '--vary',
            vary,
            '--out',
            '<new directory>',
            '--review',
          ],
        ]
      : []),
    [tool, '-d', file, 'export', '--format', 'glb', '--validate', '--out', `${stem}.glb`],
    ['scene-forge', '-p', '<project>', 'model', 'import', '--file', file, '--dry-run'],
  ];
}

const validId = (text: string) => Id.safeParse(text).success;

/**
 * Generate one document (or `count` documents with consecutive seeds) plus a replayable
 * `<id>.generate.json` recipe beside each. Every path is checked before anything is written;
 * nothing is replaced. With `review`, one lineup review session renders every document.
 */
export async function runGenerate(run: GenerateRun) {
  const generator = findGenerator(run.generator);
  const multiple = run.count !== undefined;
  if (multiple && (run.count! < 1 || run.count! > MAX_GENERATED_DOCUMENTS))
    fail('INVALID_OPTION', `--count must be from 1 to ${MAX_GENERATED_DOCUMENTS}.`, {
      count: run.count,
    });
  if (multiple === run.out.endsWith('.json'))
    fail(
      'INVALID_OPTION',
      multiple
        ? 'With --count, --out names a new directory for the documents.'
        : '--out must name a new <id>.model.json document (or a new directory with --count).',
      { out: run.out },
    );
  if (run.review && path.resolve(run.review) === path.resolve(run.out))
    fail('INVALID_OPTION', '--review needs a directory other than --out.');
  const stem = path.basename(run.out).replace(/\.model\.json$/, '');
  const { recipe: base, warnings } = resolveRecipe(generator, {
    recipe: run.recipe,
    seed: run.seed,
    preset: run.preset,
    set: run.set,
    id: run.id,
    name: run.name,
    defaultId: validId(stem) ? stem : generator.id,
  });
  const count = run.count ?? 1;
  if (base.seed + count - 1 > SEED_MAX)
    fail('INVALID_OPTION', `Seeds ${base.seed}..${base.seed + count - 1} exceed ${SEED_MAX}.`);
  const recipes = multiple
    ? Array.from({ length: count }, (_, i) => ({
        ...base,
        seed: base.seed + i,
        id: numberedId(base.id!, i + 1, count),
        name: `${base.name} ${i + 1}`.slice(0, 120),
      }))
    : [base];
  const planned: (PlannedDocument & { recipeHash: string; stats: unknown })[] = recipes.map(
    (recipe) => {
      const { document, stats } = buildDocument(generator, recipe);
      const file = multiple ? path.join(run.out, `${recipe.id}.model.json`) : run.out;
      const sidecar = path.join(path.dirname(file), `${multiple ? recipe.id : stem}.generate.json`);
      return {
        path: file,
        document,
        sidecar: { path: sidecar, data: recipe },
        recipeHash: recipeHash(recipe),
        stats,
      };
    },
  );
  if (multiple) await checkNewDirectory(run.out, '--out');
  if (run.review) await checkNewDirectory(run.review, '--review');
  await checkPlanned(planned);
  if (!run.dryRun) await writePlanned(planned);
  const review =
    run.review && !run.dryRun
      ? await reviewLineup(
          planned.map((entry) => ({ id: entry.document.model.id, document: entry.document })),
          run.review,
          { target: { generator: generator.id, documents: planned.map((entry) => entry.path) } },
        )
      : undefined;
  const first = planned[0];
  return {
    generator: generator.id,
    version: generator.version,
    preset: base.preset,
    seed: base.seed,
    count,
    recipeHash: multiple ? sha256Hex(canonical(recipes)) : first.recipeHash,
    parameters: base.parameters,
    dryRun: !!run.dryRun,
    written: !run.dryRun,
    documents: planned.map((entry, i) => ({
      path: entry.path,
      id: entry.document.model.id,
      seed: recipes[i].seed,
      stateHash: documentStateHash(entry.document),
      recipe: entry.sidecar!.path,
      recipeHash: entry.recipeHash,
      parameters: entry.document.model.parameters,
      stats: entry.stats,
    })),
    ...(review
      ? {
          review: {
            directory: review.directory,
            contactSheet: review.contactSheet,
            manifest: review.manifest,
            frames: review.frames.length,
          },
        }
      : run.review
        ? { review: { skipped: 'dry run: nothing was rendered' } }
        : {}),
    ...(warnings.length ? { warnings } : {}),
    ...(run.dryRun
      ? {}
      : {
          nextCommands: [
            ...documentNextCommands(run.tool, first.path, first.document.model),
            [
              run.tool,
              'generate',
              generator.id,
              '--file',
              first.sidecar!.path,
              '--out',
              '<new document>.model.json',
            ],
          ],
        }),
  };
}
