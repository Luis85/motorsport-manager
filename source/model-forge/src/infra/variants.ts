import path from 'node:path';
import { fail, parse } from '../kernel/index.js';
import { documentSuffixes } from '../domain/document.js';
import { MAX_REVIEW_FRAMES, ModelVariantsSchema } from '../domain/generate.js';
import { documentStateHash, revisionOf, validateEditorDocument } from '../application/document.js';
import { numberedId, planVariants, type VariantRequest } from '../application/variants.js';
import { checkNewDirectory, checkPlanned, writePlanned } from './generated.js';
import { reviewLineup } from './lineup.js';
import { documentNextCommands } from './generate.js';
import type { LoadedDocument } from './store.js';

export interface VariantsRun extends VariantRequest {
  out: string;
  /** A new directory for the lineup review. */
  review?: string;
  dryRun?: boolean;
  tool: string;
}

/**
 * Write `count` variants of a document into a new directory: `<id>-<nn>` documents of the
 * same kind (bundles keep their frozen dependencies), `variants.json` (kind
 * `model-variants`) and, with `review`, a lineup review in that new directory.
 */
export async function runVariants(loaded: LoadedDocument, run: VariantsRun) {
  const source = loaded.document;
  const plan = planVariants(source, run, (index) => numberedId(source.model.id, index, run.count));
  if (run.review && run.count > MAX_REVIEW_FRAMES)
    fail(
      'INVALID_OPTION',
      `--review renders at most ${MAX_REVIEW_FRAMES} variants in one session.`,
      {
        count: run.count,
        hint: `Lower --count to ${MAX_REVIEW_FRAMES}, or omit --review and review chosen variants with -d <variant> review.`,
      },
    );
  // Every variant must compile at its own defaults before anything is written.
  const stats = plan.variants.map((variant) => validateEditorDocument(variant.document).stats);
  const suffix = documentSuffixes[source.kind];
  const planned = plan.variants.map((variant) => ({
    path: path.join(run.out, `${variant.document.model.id}${suffix}`),
    document: variant.document,
  }));
  const manifestPath = path.join(run.out, 'variants.json');
  if (run.review && path.resolve(run.review) === path.resolve(run.out))
    fail('INVALID_OPTION', '--review needs a directory other than --out.', {
      hint: `Pass --review ${run.out}-review (any new or empty directory).`,
    });
  await checkNewDirectory(run.out, '--out');
  if (run.review) await checkNewDirectory(run.review, '--review');
  await checkPlanned(planned, [manifestPath]);
  const manifest = parse(ModelVariantsSchema, {
    schemaVersion: 1,
    kind: 'model-variants',
    source: { id: source.model.id, revision: revisionOf(source), stateHash: loaded.stateHash },
    seed: run.seed,
    count: run.count,
    vary: plan.ranges,
    materials: run.materials,
    recipeHash: plan.recipeHash,
    variants: plan.variants.map((variant, i) => ({
      id: variant.document.model.id,
      file: path.basename(planned[i].path),
      parameters: variant.parameters,
      materials: variant.materials,
      stateHash: documentStateHash(variant.document),
    })),
  });
  // Render the in-memory variants first: a missing browser or a failed render writes nothing.
  const review =
    run.review && !run.dryRun
      ? await reviewLineup(
          plan.variants.map((variant) => ({
            id: variant.document.model.id,
            document: variant.document,
          })),
          run.review,
          { target: { variantsOf: loaded.path, documents: planned.map((entry) => entry.path) } },
        )
      : undefined;
  if (!run.dryRun)
    await writePlanned(planned, {
      files: [{ path: manifestPath, data: manifest }],
      written: review ? [review.directory] : [],
    });
  return {
    source: { path: loaded.path, ...manifest.source },
    seed: run.seed,
    count: run.count,
    vary: plan.ranges,
    materials: run.materials,
    recipeHash: plan.recipeHash,
    dryRun: !!run.dryRun,
    written: !run.dryRun,
    manifest: manifestPath,
    documents: manifest.variants.map((variant, i) => ({
      path: planned[i].path,
      id: variant.id,
      stateHash: variant.stateHash,
      parameters: variant.parameters,
      materials: variant.materials,
      stats: stats[i],
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
    nextCommands: run.dryRun
      ? [
          [
            run.tool,
            '-d',
            loaded.path,
            'variants',
            '--count',
            String(run.count),
            '--seed',
            String(run.seed),
            ...Object.entries(run.vary).flatMap(([name, [low, high]]) => [
              '--vary',
              `${name}=${low}..${high}`,
            ]),
            ...Object.entries(run.materials).flatMap(([name, colors]) => [
              '--materials',
              `${name}=${colors.join(',')}`,
            ]),
            '--out',
            run.out,
            ...(run.review ? ['--review', run.review] : []),
          ],
        ]
      : documentNextCommands(run.tool, planned[0].path, planned[0].document.model),
  };
}
