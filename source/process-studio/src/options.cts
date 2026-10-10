/**
 * The process command surface: every `wildlands process` subcommand with the same options, flags, required options
 * and descriptions, and the usage rules checked before any file is read. Exit 2 with `process-operation-failed`
 * on every usage error, exactly as `wildlands process`.
 *
 * Keep these tables equal to source/wildlands/source/tools/process-cli.cts: tests/parity.test.cts compares this
 * surface with `bin/wildlands process discover` and fails, naming the subcommand, when Wildlands gains one.
 * Process Studio's own commands (`version`, `doctor`) and the global `--compact` are handled in src/cli.cts.
 */
import {checkBounds} from './kernel.cjs';

export const COMMANDS: Readonly<Record<string, readonly string[]>> = {
 discover: [], schema: ['--kind'], create: ['--id', '--name', '--output'], validate: ['--input', '--draft'], inspect: ['--input'],
 edit: ['--input', '--recipe', '--output', '--dry-run', '--draft'], run: ['--input', '--minutes', '--output', '--seed', '--event-log', '--format'],
 build: ['--input', '--output'], forge: ['--input', '--output'], 'export-bpmn': ['--input', '--output', '--bpsim'], 'validate-bpmn': ['--input'],
 'import-bpmn': ['--input', '--output', '--draft', '--default-duration', '--process', '--lanes', '--default-capacity', '--no-auto-system-pool',
  '--system-capacity', '--minutes-per-day', '--minutes-per-hour', '--unsupported', '--no-bpsim', '--scenario', '--report'],
 attach: ['--input', '--asset', '--step', '--expected-revision', '--expected-fingerprint', '--output', '--dry-run'],
 slides: ['--input', '--format', '--minutes', '--seed', '--output', '--brief'], diff: ['--input', '--against'],
 replicate: ['--input', '--minutes', '--runs', '--seed', '--output', '--warmup'],
 compare: ['--input', '--against', '--minutes', '--runs', '--seed', '--output', '--warmup']
};
export const FLAGS: ReadonlySet<string> = new Set(['--draft', '--dry-run', '--bpsim', '--no-auto-system-pool', '--no-bpsim', '--brief']);
/** Options every invocation of a command must carry; checked before any file is read or work is done. */
export const REQUIRED: Readonly<Record<string, readonly string[]>> = {
 create: ['--id', '--output'], validate: ['--input'], inspect: ['--input'], edit: ['--input', '--recipe'], run: ['--input', '--minutes', '--output'],
 build: ['--input', '--output'], forge: ['--input', '--output'], 'export-bpmn': ['--input', '--output'], 'import-bpmn': ['--input', '--output'],
 'validate-bpmn': ['--input'], attach: ['--input', '--asset', '--step', '--expected-revision', '--expected-fingerprint'], slides: ['--input'],
 diff: ['--input', '--against'], replicate: ['--input', '--minutes', '--runs'], compare: ['--input', '--against', '--minutes', '--runs']};
export const DESCRIPTIONS: Readonly<Record<string, string>> = {
 discover: 'Discover commands, limits and guarded edit operations.', schema: 'Get the authoritative process JSON Schema.',
 create: 'Create a runnable starter definition.', validate: 'Validate shape, references and graph semantics; --draft permits graph diagnostics.',
 inspect: 'Read identity, scene graph and starting snapshot without advancing time.',
 edit: 'Apply a revision/fingerprint guarded transaction; --draft allows intermediate graph diagnostics.',
 run: 'Run a fresh deterministic session for a bounded number of business minutes; --seed N replaces the definition seed; '
  + '--event-log FILE streams every engine event to a CSV (default) or XES (--format xes) file while it runs.',
 build: 'Build one self-contained offline HTML file.',
 'validate-bpmn': 'Check a BPMN 2.0 XML file (and its BPSim 1.0 data) against the built-in conformance rules (no schema files); '
  + 'prints the report (errors with line, path, code and message; elements not covered; unchecked extension content); exit 0 when it conforms, 2 when not.',
 'export-bpmn': 'Export a BPMN 2.0 XML file (with Wildlands extension values and diagram layout); '
  + '--bpsim adds a BPSim scenario (processing times, probabilities, arrivals, pool quantities and costs); '
  + 'fidelity lists what only the Wildlands extension carries.',
 'import-bpmn': 'Import a BPMN 2.0 XML file into a simulatable definition (lanes, sub-processes, call activities, gateways, loops, boundary timers, '
  + 'expressions and BPSim parameters are mapped); prints the structured report (warnings, mapping counts, rejections); '
  + 'unsupported elements are rejected (exit 2) or, with --unsupported drop, dropped with warnings.',
 forge: 'Create an editable Scene Forge project with one scene per step.', attach: 'Attach a Scene Forge Wildlands asset to a step using edit guards.',
 slides: 'Explain the process as a slide deck (title, overview, resources, main route by phase, variants, summary); '
  + '--format json (default) or md (Markdown printed as plain text without --output); '
  + '--minutes N [--seed S] adds read-only facts from one fresh bounded run; '
  + '--brief keeps the section slides only (title, overview, resources, one slide per section, summary).',
 replicate: 'Run the definition for --minutes over --runs consecutive seeds (from --seed, else the definition seed, else 1); '
  + 'report n, mean, sample sd, t-based 95% interval and p10/p50/p90 per KPI with per-seed rows; --output writes the report file; '
  + '--warmup W adds windowed KPIs after minute W.',
 compare: 'Run --input (A) and --against (B) over the same --runs seeds for --minutes; report per KPI the statistics of A and B and '
  + 'the paired difference A - B with its sd and t-based 95% interval, per-seed rows and the process diff of the two files; '
  + '--warmup W adds windowed KPIs after minute W.',
 diff: 'Report what changed from --against (the reference) to --input: counts of changed steps, flows, resources, arrival rules and process settings; '
  + 'the changed steps, resources, flows, arrival rules and settings; every changed value with its path, before and after; '
  + 'and both revisions and fingerprints.'};

/** A usage error: reported like every process failure, before any file is read. */
export class UsageError extends Error {}

/** Parsed options of one process command (flags have the value `true`). */
export interface Invocation {readonly command: string; readonly values: ReadonlyMap<string, string>;}

const WHOLE_NUMBERS = ['--expected-revision', '--default-duration', '--seed', '--default-capacity', '--system-capacity', '--minutes-per-day',
 '--minutes-per-hour'];

/**
 * Parse and check one invocation in the order `wildlands process` does: command, options, required options,
 * dry-run/output pairing, whole numbers and ranges, enumerations, then the run/replicate bounds.
 * `args` are the process arguments without global options; none or a lone --help/-h is `discover`.
 */
export function parseInvocation(args: readonly string[]): Invocation {
 const help = args.length === 1 && ['--help', '-h'].includes(args[0]!);
 const command = help ? 'discover' : args[0] ?? 'discover';
 if (!Object.hasOwn(COMMANDS, command)) throw new UsageError('Unknown process command; use process-studio discover.');
 const values = new Map<string, string>();
 for (let i = help ? args.length : 1; i < args.length; i++) {
  const key = args[i]!;
  if (!COMMANDS[command]!.includes(key) || values.has(key)) throw new UsageError('Unknown or duplicate option: ' + key);
  if (FLAGS.has(key)) { values.set(key, 'true'); continue; }
  const value = args[++i];
  if (!value || value.startsWith('--')) throw new UsageError('Missing value for ' + key);
  values.set(key, value);
 }
 for (const key of REQUIRED[command] ?? []) if (!values.has(key)) throw new UsageError('Missing ' + key);
 if (['edit', 'attach'].includes(command)) {
  if (values.has('--dry-run') && values.has('--output')) throw new UsageError('Dry run does not accept --output.');
  if (!values.has('--dry-run') && !values.has('--output')) throw new UsageError('Missing --output (or use --dry-run).');
 }
 for (const key of WHOLE_NUMBERS) {
  if (values.has(key) && !/^\d+$/.test(values.get(key)!)) throw new UsageError(key + ' must be a whole number.');
 }
 if (values.has('--seed') && Number(values.get('--seed')) > 2147483647) throw new UsageError('--seed must be from 0 to 2147483647.');
 if (values.has('--kind') && !['definition', 'recipe'].includes(values.get('--kind')!)) {
  throw new UsageError('--kind must be definition or recipe.');
 }
 if (command !== 'run' && values.has('--format') && !['json', 'md'].includes(values.get('--format')!)) {
  throw new UsageError('--format must be json or md.');
 }
 try { checkBounds(command, values); } catch (error) { throw new UsageError(error instanceof Error ? error.message : String(error)); }
 if (command === 'slides' && values.has('--seed') && !values.has('--minutes')) {
  throw new UsageError('--seed needs --minutes (live facts come from one bounded run).');
 }
 return {command, values};
}
