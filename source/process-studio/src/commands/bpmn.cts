/** BPMN 2.0 interchange: `export-bpmn`, `validate-bpmn` and `import-bpmn` (with the BPSim 1.0 subset the engine reads). */
import {bpmn, conformance, readJsonFile, writeJsonFile, writeTextFile} from '../kernel.cjs';
import {MAX_INPUT_BYTES, type Context} from '../io.cjs';

export function exportBpmn(ctx: Context): void {
 const file = ctx.required('--input'), input = ctx.read(file), target = ctx.required('--output');
 if (!/\.(bpmn|xml)$/.test(target)) throw Error('BPMN output must end in .bpmn or .xml.');
 const options = ctx.has('--bpsim') ? {bpsim: true} : {};
 ctx.success({output: writeTextFile(target, bpmn.export(input, options), [file]), bpsim: ctx.has('--bpsim'), fidelity: bpmn.fidelity(input, options)});
}

/** Exit 0 when the file conforms; exit 2 with `process-bpmn-nonconforming` and the full report when not. */
export function validateBpmn(ctx: Context): void {
 const file = ctx.required('--input'), report = conformance.validate(readJsonFile(file, MAX_INPUT_BYTES));
 ctx.emit({ok: report.conforms, protocolVersion: 1, ...report.conforms ? {} : {code: 'process-bpmn-nonconforming'}, input: file, ...report});
 if (!report.conforms) ctx.exit(2);
}

/** Import options from flags; every option is validated (names, enums, ranges) before the input file is read. */
function importOptions(ctx: Context): LWProcessBpmn.Options {
 const number = (key: string) => ctx.has(key) ? Number(ctx.get(key)) : undefined, text = (key: string) => ctx.get(key);
 const options: LWProcessBpmn.Options = {
  ...number('--default-duration') !== undefined ? {defaultDuration: number('--default-duration')!} : {},
  ...text('--process') ? {process: text('--process')!} : {},
  ...text('--lanes') ? {lanes: text('--lanes') as 'pools' | 'ignore'} : {},
  ...number('--default-capacity') !== undefined ? {defaultCapacity: number('--default-capacity')!} : {},
  ...ctx.has('--no-auto-system-pool') ? {autoSystemPool: false} : {},
  ...number('--system-capacity') !== undefined ? {systemCapacity: number('--system-capacity')!} : {},
  ...number('--minutes-per-day') !== undefined ? {minutesPerDay: number('--minutes-per-day')!} : {},
  ...number('--minutes-per-hour') !== undefined ? {minutesPerHour: number('--minutes-per-hour')!} : {},
  ...text('--unsupported') ? {unsupported: text('--unsupported') as 'reject' | 'drop'} : {},
  ...ctx.has('--no-bpsim') ? {bpsim: false} : {},
  ...text('--scenario') ? {scenario: text('--scenario')!} : {}};
 bpmn.options(options);
 if (ctx.has('--scenario') && ctx.has('--no-bpsim')) throw Error('--scenario cannot be combined with --no-bpsim.');
 return options;
}

/**
 * Rejected constructs exit 2 with `process-import-rejected`; a definition with graph diagnostics exits 1 unless `--draft`;
 * otherwise the definition (and with `--report` the complete mapping) is written and the structured report printed.
 */
export function importBpmn(ctx: Context): void {
 const options = importOptions(ctx), file = ctx.required('--input');
 const imported = bpmn.analyze(readJsonFile(file, MAX_INPUT_BYTES), options), draft = ctx.has('--draft');
 const counts = (keys: string[]) => keys.reduce<Record<string, number>>((acc, k) => { acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});
 const summary = {total: imported.mapping.length, byType: counts(imported.mapping.map(m => m.type)),
  byTarget: counts(imported.mapping.map(m => m.target.split(':')[0]!))};
 const report = {process: imported.info.process, scenario: imported.info.scenario, horizon: imported.info.horizon, options: imported.info.options,
  warnings: imported.warnings, mapping: summary, rejections: imported.rejections};
 if (imported.rejections.length) {
  ctx.emit({ok: false, protocolVersion: 1, code: 'process-import-rejected', ...report, errors: imported.rejections.map(r => r.message)});
  ctx.exit(2);
  return;
 }
 if (!(draft ? imported.acceptable : imported.ok)) {
  ctx.emit({ok: false, protocolVersion: 1, diagnostics: imported.diagnostics, ...report});
  ctx.exit(1);
  return;
 }
 const inputs = [file], target = ctx.output(imported.definition, inputs);
 const full = ctx.has('--report') ? writeJsonFile(ctx.required('--report'),
  {format: 'wildlands-bpmn-import-report', schemaVersion: 1, ...report, mapping: imported.mapping, diagnostics: imported.diagnostics}, inputs) : undefined;
 ctx.success({output: target, ...full ? {report: full} : {}, runnable: imported.ok, diagnostics: imported.diagnostics, ...report});
}
