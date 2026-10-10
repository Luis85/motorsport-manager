/** Guarded transactions: `edit` applies a recipe; `attach` puts a Scene Forge asset on one step with the same guards. */
import {authoring, catalog} from '../kernel.cjs';
import type {Context} from '../io.cjs';

/** `--dry-run` writes nothing; otherwise the edited definition goes to `--output`, never over the input, recipe or asset. */
function commit(ctx: Context, input: unknown, recipe: unknown, inputs: readonly string[]): void {
 const result = authoring.edit(input, recipe, ctx.has('--draft'));
 ctx.success({...result, dryRun: ctx.has('--dry-run'), ...ctx.has('--dry-run') ? {} : {output: ctx.output(result.definition, inputs)}});
}

export function edit(ctx: Context): void {
 const file = ctx.required('--input'), input = ctx.read(file), recipeFile = ctx.required('--recipe');
 commit(ctx, input, ctx.read(recipeFile), [file, recipeFile]);
}

export function attach(ctx: Context): void {
 const file = ctx.required('--input'), input = ctx.read(file);
 const definition = catalog.admit(input), id = ctx.required('--step'), step = definition.steps.find(s => s.id === id);
 if (!step) throw Error('Unknown step: ' + id);
 const assetFile = ctx.required('--asset'), assetInput = ctx.read(assetFile) as {visual?: unknown};
 // Scene Forge writes a source definition wrapper; the renderer consumes its visual facet.
 const asset = assetInput && typeof assetInput === 'object' && Object.hasOwn(assetInput, 'visual') ? assetInput.visual : assetInput;
 const recipe = {expectedRevision: Number(ctx.required('--expected-revision')), expectedFingerprint: ctx.required('--expected-fingerprint'),
  operations: [{op: 'putStep', value: {...step, scene: {...step.scene, asset}}}]};
 commit(ctx, input, recipe, [file, assetFile]);
}
