/// <reference path="../../wildlands/source/process-contracts.d.ts" />
/// <reference path="../../wildlands/source/process-bpmn.ts" />
/// <reference path="../../wildlands/source/process-bpmn-conformance.ts" />
/// <reference path="../../wildlands/source/process-time.ts" />
/// <reference path="../../wildlands/source/process-needs.ts" />
/// <reference path="../../wildlands/source/process-checkpoint.ts" />
/**
 * The bridge: the only Process Studio module that imports code from `../wildlands`.
 *
 * Process Studio owns its command line (dispatcher, usage rules, discovery, version, doctor and the
 * HTML assembly from the embedded engine kit). The business-process engine, the shared atomic CLI I/O and
 * the process tool modules stay in Wildlands until the physical move (P2), and are reached only through
 * the names below. `npm run architecture` fails when another module imports `../wildlands`, and the
 * bundle refuses any Wildlands file outside the explicit closure allowlist in `scripts/bridge.cts`.
 *
 * - process-sdk.cts: the Node ports of the process engine (catalog, runtime, authoring, BPMN, slides...).
 * - tools/cli-io.cts: bounded reads and atomic, alias-guarded writes, byte-identical to `wildlands process`.
 * - tools/process-forge.cts, tools/process-cli-analytics.cts (with tools/process-event-log.cts): the
 *   process CLI's own forge, run, replicate, compare and diff modules, shared rather than copied so outputs
 *   stay byte-identical while Wildlands keeps changing them. `run --checkpoint` and `--checkpoint-out` read and
 *   write run checkpoints through the engine's LWProcessCheckpoint (process-checkpoint.ts, loaded by process-sdk.cts).
 * - The /// <reference> directives above bring the global LWProcess* declarations the bridged modules use into this
 *   strict program: process-needs.ts for the engine kernel, process-time.ts for `inspect`'s working hours and
 *   process-checkpoint.ts (with process-engine-state.ts, process-checkpoint-check.ts and process-hours.ts) for checkpoints.
 * - tools/build-inserts.cts (with tools/build-inserts-process.cts, the `template-process` inserts it appends),
 *   tools/artifact-profiles.cts (with tools/game-manifest.cts) and tools/artifact-placement.cts: the pure
 *   insert order, profile and placement rules of a process play artifact.
 */
export {catalog, runtime, authoring, bpmn, conformance, slides, diff, replicate, advice} from '../../wildlands/source/process-sdk.cjs';
export {readJsonFile, writeJsonFile, writeTextFile} from '../../wildlands/source/tools/cli-io.cjs';
export {writeForgeProject} from '../../wildlands/source/tools/process-forge.cjs';
export {checkBounds, runCommand, replicateCommand, compareCommand, definitionDiff} from '../../wildlands/source/tools/process-cli-analytics.cjs';
export {INSERTS, type Insert} from '../../wildlands/source/tools/build-inserts.cjs';
export {gameProfile, profileBundles, type ArtifactProfile} from '../../wildlands/source/tools/artifact-profiles.cjs';
export {inlineElement, placeArtifact, substituteVariables} from '../../wildlands/source/tools/artifact-placement.cjs';
