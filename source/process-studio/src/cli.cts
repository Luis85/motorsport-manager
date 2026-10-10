#!/usr/bin/env node
/**
 * Process Studio command line: `process-studio <command> [options]`, the `wildlands process` tool family as its own
 * executable. One JSON object per invocation on stdout; no prompts, colours or hidden state.
 *
 * Exit codes are those of `wildlands process`: 0 success; 1 a rejected definition (`validate`, or `import-bpmn` with graph
 * diagnostics); 2 every failure (`process-operation-failed`), a rejected BPMN import (`process-import-rejected`) or a
 * nonconforming BPMN file (`process-bpmn-nonconforming`). Usage errors exit 2 before any file is read.
 * `doctor` exits 1 when a check fails.
 *
 * Global options: `--compact` (anywhere) prints one-line JSON; `--version` alone is `version`; no arguments, `--help`
 * or `-h` is `discover`.
 */
import {parseInvocation, UsageError} from './options.cjs';
import {context, failure, type Context} from './io.cjs';
import {discover} from './discover.cjs';
import {version} from './version.cjs';
import {doctor} from './doctor.cjs';
import {create, inspect, schema, validate} from './commands/definition.cjs';
import {attach, edit} from './commands/edit.cjs';
import {exportBpmn, importBpmn, validateBpmn} from './commands/bpmn.cjs';
import {compare, diff, replicate, run, slides} from './commands/analysis.cjs';
import {build, forge} from './commands/artifacts.cjs';

type Handler = (ctx: Context) => void;
/** One handler per `wildlands process` subcommand (src/options.cts holds their options). */
export const HANDLERS: Readonly<Record<string, Handler>> = {
 discover, schema, create, validate, inspect, edit, run, build, forge, 'export-bpmn': exportBpmn, 'validate-bpmn': validateBpmn,
 'import-bpmn': importBpmn, attach, slides, diff, replicate, compare
};
/** Process Studio's own commands; they take no options. */
const TOOL_COMMANDS: Readonly<Record<string, Handler>> = {version, doctor};

/** Remove the global `--compact` flag (at most once, anywhere). */
function globals(args: readonly string[]): {compact: boolean; rest: string[]} {
 const count = args.filter(arg => arg === '--compact').length;
 if (count > 1) throw new UsageError('Unknown or duplicate option: --compact');
 return {compact: count === 1, rest: args.filter(arg => arg !== '--compact')};
}

export function main(argv: readonly string[]): void {
 let compact = argv.includes('--compact');
 try {
  const parsed = globals(argv), args = parsed.rest;
  compact = parsed.compact;
  const tool = args[0] === '--version' ? 'version' : args[0];
  if (tool !== undefined && Object.hasOwn(TOOL_COMMANDS, tool)) {
   if (args.length > 1) throw new UsageError(`${tool} takes no options: ${args[1]}`);
   TOOL_COMMANDS[tool]!(context(tool, new Map(), compact));
   return;
  }
  const invocation = parseInvocation(args), handler = HANDLERS[invocation.command];
  if (!handler) throw Error('No handler for ' + invocation.command + '. Rebuild bin/process-studio.');
  handler(context(invocation.command, invocation.values, compact));
 } catch (error) { failure(error, compact); }
}

if (require.main === module) main(process.argv.slice(2));
