/**
 * Simulation and analysis: `run` (with its streamed `--event-log`), `replicate`, `compare`, `diff` and `slides`.
 * Run, replicate, compare and diff are the process CLI's own modules (bridged: tools/process-cli-analytics.cts),
 * so their reports and written files are byte-identical to `wildlands process`.
 */
import {catalog, runtime, slides as deckApi, writeJsonFile, writeTextFile, runCommand, replicateCommand, compareCommand, definitionDiff} from '../kernel.cjs';
import type {Context} from '../io.cjs';

export function diff(ctx: Context): void {
 const file = ctx.required('--input'), input = ctx.read(file), reference = ctx.required('--against');
 ctx.success(definitionDiff(input, file, ctx.read(reference), reference));
}

export function compare(ctx: Context): void {
 const file = ctx.required('--input'), input = ctx.read(file), reference = ctx.required('--against');
 compareCommand(input, file, ctx.read(reference), reference, ctx.values, ctx.success);
}

export function replicate(ctx: Context): void {
 const file = ctx.required('--input');
 replicateCommand(ctx.read(file), file, ctx.values, ctx.success);
}

export function run(ctx: Context): void {
 const file = ctx.required('--input'), definition = catalog.admit(ctx.read(file));
 runCommand(definition, file, ctx.values, ctx.success);
}

/** JSON envelope with the deck, the Markdown text itself, or with `--output` the written file and its counts. */
export function slides(ctx: Context): void {
 const file = ctx.required('--input'), definition = catalog.admit(ctx.read(file));
 let snapshot: LWProcess.Snapshot | null = null;
 if (ctx.has('--minutes')) {
  // Same bounded, fresh and seeded run as `process run`; the deck only reads the resulting detached snapshot.
  const live = runtime.create(definition, ctx.has('--seed') ? {seed: Number(ctx.get('--seed'))} : {});
  try { snapshot = live.advance(Number(ctx.get('--minutes'))); } finally { live.dispose(); }
 }
 const deck = deckApi.build(definition, snapshot, {brief: ctx.has('--brief')}), format = ctx.get('--format') ?? 'json';
 const text = format === 'md' ? deckApi.markdown(deck) : null;
 if (ctx.has('--output')) {
  const target = text === null ? writeJsonFile(ctx.required('--output'), deck, [file]) : writeTextFile(ctx.required('--output'), text, [file]);
  const counts = {slides: deck.slides.length, sections: deck.sections.length, ...deck.brief ? {brief: true} : {}};
  ctx.success({output: target, format, ...counts, live: deck.live});
  return;
 }
 if (text !== null) { ctx.text(text); return; }
 ctx.success({format, deck});
}
