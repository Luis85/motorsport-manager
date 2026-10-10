import { readJson } from '../kernel/index.js';
import { parseDocument, type EditorDocument } from '../application/document.js';
import type { EditOptions } from '../application/edit.js';
import { planDocumentScatter, recipeFromFlags, type ScatterFlags } from '../application/scatter.js';
import { commitEdit } from './store.js';

export interface ScatterRun extends EditOptions {
  /** A scatter recipe (`--file`/`--data`); otherwise built from `flags`. */
  recipe?: unknown;
  flags: ScatterFlags;
  replace?: boolean;
  allowEmpty?: boolean;
  /** Model or model-bundle files whose models become frozen dependencies first. */
  dependencies?: string[];
  tool: string;
}

/**
 * Scatter instances inside one document as one guarded edit: the plan is made from the
 * document read under its lock, then committed like `apply` (dry run, revision and state
 * guards, history snapshot, atomic replace).
 */
export async function scatterDocument(file: string, run: ScatterRun) {
  const dependencies: EditorDocument[] = [];
  for (const source of run.dependencies ?? [])
    dependencies.push(parseDocument(await readJson(source)));
  let planned: ReturnType<typeof planDocumentScatter> | undefined;
  const result = await commitEdit(
    file,
    (document) => {
      const recipe = run.recipe ?? recipeFromFlags(document, run.flags);
      planned = planDocumentScatter(document, recipe, {
        replace: run.replace,
        allowEmpty: run.allowEmpty,
        dependencies,
      });
      return planned.operations;
    },
    run,
  );
  const placement = planned!.placement;
  return {
    ...result,
    placement,
    seed: placement.seed,
    recipeHash: placement.recipeHash,
    recipe: planned!.recipe,
    nextCommands: result.dryRun
      ? [
          [
            run.tool,
            '-d',
            file,
            'scatter',
            '--file',
            '<recipe.json holding data.recipe>',
            '--expected-revision',
            String(result.revision),
            '--expected-state',
            result.stateHash,
          ],
        ]
      : [
          [run.tool, '-d', file, 'node', 'list', '--parent', placement.group, '--limit', '10'],
          [run.tool, '-d', file, 'review', '--out', '<new directory>'],
          [run.tool, '-d', file, 'export', '--format', 'glb', '--validate', '--out', '<file.glb>'],
        ],
  };
}
