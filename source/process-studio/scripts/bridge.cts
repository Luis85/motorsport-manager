/**
 * The explicit closure allowlist of the bridge (src/kernel.cts): every Wildlands file bin/process-studio may contain.
 *
 * `npm run build:cli`, `npm run check:cli` and `npm run architecture` bundle src/cli.cts and require the set of
 * Wildlands inputs to equal this list exactly: a file outside it fails the build ("not in the allowlist"), and an entry
 * the bundle no longer uses fails as stale. Change it only together with the Wildlands change that needs it, in review.
 * Paths are relative to source/wildlands/source.
 */
export const WILDLANDS_SOURCE = 'source/wildlands/source';

/** process-sdk.cts and the engine scripts it loads, in its require order (domain only: no DOM, storage or clock). */
export const ENGINE_CLOSURE = [
 'process-sdk.cts',
 'ecs.ts', 'asset-catalog.ts',
 'process-schema.ts', 'process-random.ts', 'process-needs.ts', 'process-graph-routes.ts', 'process-graph.ts', 'process-catalog.ts',
 'process-xml.ts', 'process-bpmn-expr.ts', 'process-bpmn.ts', 'process-bpmn-bpsim-write.ts', 'process-bpmn-ext.ts', 'process-bpmn-bpsim.ts',
 'process-bpmn-nodes.ts', 'process-bpmn-graph.ts', 'process-bpmn-fold.ts', 'process-bpmn-flow.ts', 'process-bpmn-tail.ts',
 'process-bpmn-pools.ts', 'process-bpmn-layout.ts', 'process-bpmn-steps.ts', 'process-bpmn-assemble.ts', 'process-bpmn-import.ts',
 'process-bpmn-conformance-values.ts', 'process-bpmn-conformance-model.ts', 'process-bpmn-conformance-bpsim.ts', 'process-bpmn-conformance-schema.ts', 'process-bpmn-conformance.ts',
 'process-ledger-cases.ts', 'process-ledger.ts', 'process-kernel.ts', 'process-routing.ts', 'process-systems.ts', 'process-series.ts',
 'process-session.ts', 'process-replicate.ts', 'process-authoring.ts', 'process-diff.ts', 'process-route.ts', 'process-work-state.ts',
 'process-sipoc-model.ts', 'process-time.ts', 'process-random-view.ts', 'process-advice.ts', 'process-terms.ts', 'process-slides-text.ts',
 'process-slides.ts'
] as const;

/** Node tool modules of the process CLI: shared atomic I/O, forge, run/replicate/compare/diff and the event log. */
export const TOOL_CLOSURE = ['tools/cli-io.cts', 'tools/process-forge.cts', 'tools/process-cli-analytics.cts', 'tools/process-event-log.cts'] as const;

/** Pure artifact rules of a process play build: insert table, game profiles (with the manifest's template features), placement. */
export const BUILD_CLOSURE = ['tools/build-inserts.cts', 'tools/artifact-profiles.cts', 'tools/game-manifest.cts', 'tools/artifact-placement.cts'] as const;

export const CLOSURE: readonly string[] = [...ENGINE_CLOSURE, ...TOOL_CLOSURE, ...BUILD_CLOSURE];

/** The one Process Studio module allowed to import Wildlands code. */
export const BRIDGE = 'src/kernel.cts';
