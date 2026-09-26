# Race Weekend implementation status

The original UI-01–UI-10 architecture is retained. The finishing continuation addresses G01–G18 / WP00–WP15 and documents SC00–SC14 without replacing the native shell or simulation.

## Current authoritative handover

- [Finishing ledger](finish-ledger.md): per-gap implementation, native, visual and platform/manual status.
- [Screen/state contract](finish-specification.md): routes, data, actions, empty/terminal states and executable evidence.
- [Native visual acceptance](finish-visual-acceptance.md): C01/C02/C03 comparison and six separate dimensions for every screen family.
- [Verification](verification-finish.md): executed source boundaries, reproduction, full-run and soak evidence, exact-head publication checks and blocked environments.
- [Player guide](player-guide.md): the actual implemented controls and decision lifecycle.

## Preserved and completed systems

The live `RaceSessionHeader` and `RaceTimingTower`, map-first observation, compact/wide car layouts, shared inspectors and focused analysis remain integrated. The decision queue/drawer now covers all action-specific receipt outcomes and secondary issues with stale-driver/set/gate validation. Practice retains four real objectives and shared two-driver drafts; qualifying remains one physical session with visible new-release timing. Strategy, telemetry, weather, tyres, setup, radio, shared intentions, pit service and results use recorded/model-supported data and explicit missing/draft/estimated states.

The scoped shared timeline inspects existing accepted windows and active bounded overrides only. The service panel inspects real approach/entry/queue/service/exit records and whole-car timing only. Neither adds an execution engine. No `RaceUISnapshot`, duplicate draft authority, per-wheel service choreography, future-weather oracle or unsupported setup/telemetry channel is introduced.

The full runner retains all repair/completion/domain/scenario/native/performance suites and adds the finishing tests. Per-suite user-data isolation repairs the reproduced #268 test-order leak without weakening compact layout assertions. Native populated profiles and scrolled analytical evidence are distinct from disclosed synthetic boundaries.

**Scope of completion:** implementation, Linux native regression and engineering visual acceptance are complete for the finishing candidate. Windows/export/DPI, physical controller, screen-reader, broad hardware and human usability acceptance remain explicit manual gates. Exact final SHA/tree and hosted CI are established by the post-commit publication receipt, not by an old description of PR #12.

The historical [completion report](verification-completion.md) remains available without rewriting its original measurements as current results.
