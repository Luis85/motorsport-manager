/**
 * `discover` (also no arguments, `--help` and `-h`): the `wildlands process discover` document, unchanged, plus three
 * Process Studio fields: `tool` (name, version, handbook), `toolOperations` (`version`, `doctor`) and `globalOptions`
 * (`--compact`). Every other field is equal to Wildlands' (tests/parity.test.cts).
 */
import {runtime} from './kernel.cjs';
import {COMMANDS, DESCRIPTIONS} from './options.cjs';
import {editOperations} from './commands/definition.cjs';
import {TOOL} from './version.cjs';
import type {Context} from './io.cjs';

export const TOOL_OPERATIONS = [
 {id: 'version', options: [], description: 'Report the tool version, protocol, process format, engine identity and source identity (also --version).'},
 {id: 'doctor', options: [], description: 'Check Node.js, the process engine, the embedded engine kit and an in-memory build; exit 1 when a check fails.'}
] as const;
export const GLOBAL_OPTIONS = [{id: '--compact', description: 'Print the JSON result on one line.'}] as const;

export function discover(ctx: Context): void {
 ctx.success({format: 'wildlands-process', schemaVersion: 1, handbook: 'docs/reference/business-process-engine.md', limits: runtime.limits,
  operations: Object.entries(COMMANDS).map(([id, options]) => ({id, options, description: DESCRIPTIONS[id]})),
  editOperations: editOperations(),
  workflow: ['create', 'inspect', 'edit --dry-run', 'edit', 'validate', 'diff', 'slides', 'forge', 'attach', 'run', 'replicate', 'compare', 'build'],
  interchange: {bpmn: 'BPMN 2.0 XML via export-bpmn and import-bpmn; validate-bpmn checks a file against the BPMN 2.0 and BPSim 1.0 conformance rules'},
  recipe: {expectedRevision: 0, expectedFingerprint: '<inspect.fingerprint>', operations: [{op: 'rename', value: 'My process'}]},
  notes: ['put operations replace full definitions', 'dry runs write nothing',
   'setDescription, setSeed, setSipoc and setTrack remove the field with value null; setGenre with process removes genre',
   'draft graph diagnostics must be resolved before run or build', 'fingerprint is a change guard, not a cryptographic signature'],
  tool: TOOL, toolOperations: TOOL_OPERATIONS, globalOptions: GLOBAL_OPTIONS});
}
