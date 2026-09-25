# Motorsport Manager documentation

Current native implementation: **0.14.0** · **Godot 4.7.2 Standard**.

| Document | Purpose |
|---|---|
| [Race-weekend UI migration](ui/race-weekend/README.md) | Integrated components, decision lifecycle, programme/results workspaces, screen contracts and code-delivery audit |
| [UI migration verification](ui/race-weekend/verification-completion.md) | Executed native input, layout, regression and script-load evidence; explicit platform boundaries |
| [Circuit notebook and challenge history](race-weekend-notebook.md) | Current 0.14 opt-in observations, guarded personal notes, inherited authoring and direct-to-main integration |
| [0.14 verification](notebook-verification.md) | Fresh baseline/final evidence, exact source, native inputs and bounded history cost |
| [Authored replay scenarios](race-weekend-scenario-authoring.md) | Retained 0.13 frozen challenge briefs, observed goals, native authoring and strict result validation |
| [0.13 verification and integration](scenario-authoring-verification.md) | Exact code revisions, full regression, native evidence and matched validation costs |
| [Scenario-authoring workspace](design/scenario-authoring-workspace.md) | Frozen form, fixed actions, sandbox goals, long readers and return/focus behavior |
| [Independent replay and sandbox](race-weekend-replay.md) | Preserved 0.12 captured records, independent experiments, standalone receipts and session v1/native v10 |
| [0.12 verification](replay-verification.md) | Historical replay-core full regression and recorder costs |
| [Contextual rivals and calmer pit wall](race-weekend-rivals.md) | Preserved partial RW-18, native UI refinement, checkpoint v10 and explicit pressure deferral |
| [Workspace specification](design/pitwall-workspace.md) | Observed audit, capability locations, focus, text scaling and human-validation protocol |
| [0.11 verification](rivals-verification.md) | Exact revision, fresh checks, native captures and matched workloads |
| [Optional purposeful practice](race-weekend-practice.md) | Preserved 0.10 physical runs, measured forecast learning, native workflow, checkpoint v9 and verification |
| [PR #3 integration](pr3-integration.md) | Preserved 0.9 combined UX/recovery view, conflict resolution and verification |
| [UX research and decisions](design/pitwall-ux-research.md) | Sixteen primary sources and explicit design/validation boundaries |
| [Recovery and race control](race-weekend-recovery.md) | Staged reliability, repair-only service, virtual neutralization and checkpoint v8 |
| [Compact UI and performance](ui-performance-iteration.md) | Historical compact UI milestone; preserved action safety and rendering optimizations |
| [Uncertain weather handoff](race-weekend-weather.md) | Preserved 0.7 seeded weather, public forecasts, crossover calls, v7 migration, scenarios and verification |
| [Living racecraft and team handoff](race-weekend-living-racecraft.md) | Preserved 0.6 battles, team orders, public rival responses, v6 persistence and verification |
| [Race-weekend strategy handoff](race-weekend-implementation.md) | Historical 0.5 milestone; retained strategy controls, ownership and forecast assumptions |
| [Getting started](getting-started.md) | Open the project and exercise the playable workflows |
| [Iteration 4](iteration-4.md) | Delivered racecraft, editor and interaction changes |
| [Feature parity](feature-parity.md) | Source-to-native status, adaptations and explicit gaps |
| [Interaction design](interaction-design.md) | Observation, drafts, commands, guides and error recovery |
| [Architecture](architecture.md) | Ownership, modules and extension boundaries |
| [Race weekend](race-weekend.md) | Sessions, pit-wall decisions, timing and classification |
| [Simulation](simulation.md) | Fixed step, geometry, traffic, tyres and conditions |
| [Tyres and strategy](tyres-and-strategy.md) | Finite sets, four-wheel condition and physical stop planning |
| [Track editor](track-editor.md) | Authoring, selection, trace, calibration and validation |
| [Track formats](track-format.md) | Editable/native exchange and baked runtime schema |
| [Graphics](graphics.md) | Cozy illustration, dots, preferences and caching |
| [Persistence](persistence.md) | Notebook v1, session/replay v1, scenario v1 and native v10; current storage and validation contracts |
| [Verification](verification.md) | Automated checks, reports and environment boundaries |
| [Port status](port-status.md) | Current acceptance scope and unimplemented systems |

[Iteration 2](iteration-2.md) and [Iteration 3](iteration-3.md) are historical release records. Their old version numbers and then-unimplemented features should not be read as current state. Prototype behavior is the source reference; new native UI/algorithm decisions and simplifications are documented as adaptations, not silently described as source parity.

The 0.11 handoff remains authoritative for contextual rivals and checkpoint v10. The practice handoff remains authoritative for optional preparation, bounded measured learning and the preserved v9 practice payload. The integration record remains authoritative for the combined 0.9 task navigation and recovery view. The research document explains the UX decisions; it is not human validation. The compact UI handoff records the earlier flat topic toolbar and its historical performance measurements, not the merged release's measured performance. The recovery handoff is authoritative for staged recovery, virtual neutralization and checkpoint v8. Older native saves retain their original model semantics.

The 0.7 weather, 0.6 battle/team, 0.5 strategy and 0.4 editor/system documents remain useful for retained behavior except where later handoffs explicitly supersede their UI, model or checkpoint-version statements. No stage is declared human-playtest complete solely because automated checks pass.

The 0.13 authoring handoff governs the optional scenario/brief v1 envelope, observed goals and strengthened validation. The 0.12 handoff remains authoritative for independent replay, native sandbox/save isolation and standalone result receipts; neither implements campaign settlement. The sporting replay model remains `race-weekend-0.12-v1`, with embedded checkpoint v10 and existing legacy semantics. A goal is observed evidence, not an automatic reward.

The 0.14 notebook handoff governs opt-in run history, guarded personal interpretations and remembered challenge outcomes. PR #11 has integrated the 0.12/0.13 work into main; PR #10 is reconciled with that target while retaining both scenario-authoring and notebook verification. Historical handoff counts describe their named revisions, not this combined run. Consult PR #10 and its current `reports/verification.json` for integration evidence.
