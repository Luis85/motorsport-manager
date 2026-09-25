# UI-01–UI-10 implementation reconciliation

## Baseline and status

This delivery builds on the repaired PR #12 head `0f450c542efc8864fef2b0dd32c2fad68be25c2e`, not on main and not on a replacement prototype. The earlier repair correctly described component and screen gaps. The current source implements those code gaps. Test outcomes and hardware/manual acceptance are recorded separately in `verification-completion.md`; implementation does not by itself imply certified usability or a successful hosted run.

| Increment | Integrated delivery | Acceptance evidence |
|---|---|---|
| UI-01 — design system | `PitwallDesign` owns race palettes, state styles, typography roles and shared surfaces. `UI.race_*` and colour aliases delegate for compatibility. Badges are used in the drawer/dashboard. The unused snapshot prototype and obsolete fixed layout tokens are removed. | Fresh class loading; actual scene-component assertions; stable style/node checks. |
| UI-02 — header and timing | `RaceSessionHeader` owns the sole real header and menu; `RaceTimingTower` owns classification rows and cached presentation. Existing view fields alias those controls, preserving commands and integrations. | Unique-header/menu, exact Tree ownership, selected-row/focus and stable-refresh tests. |
| UI-03 — cards and decisions | Integrated `RaceDecisionQueue`, immutable `RaceDecisionViewModel` and `RaceDecisionDrawer`. Evidence, explicit confirmation, stale rejection, acknowledgement, execution and observed outcome are distinct. Full battle context remains readable without hover. | Native Enter/A staging, exact-driver commitment, rejection of stale evidence, Keep-plan invariants, legacy battle-detail regression. |
| UI-04 — race overview | Shared `RaceObservationWorkspace`, illustrated circuit, wide two-car rail and compact bottom cards; original vector driver emblems; live radio. Empty queue does not waste compact observation height. | Rendered wide/compact captures, persistent actions, no node/reparent churn during steady refresh. |
| UI-05 — qualifying and practice | `RaceQualifyingWorkspace` provides run state, best lap and feasible-release context alongside the circuit. `RacePracticeWorkspace` displays two real independent programmes; `RacePracticeProgrammeCard` reuses validated drafts/releases/recalls and measured evidence. | Both-programme controls, shared per-driver drafts, actual targeted release, unchanged ownership/time and existing practice/qualifying suites. |
| UI-06 — strategy and weather | `RaceAnalysisWorkspace` reuses the active inspector at full size. `RaceStrategyChart` draws model-supported stop schedules and remaining-time ranges. Weather retains independent same-horizon cases and separate observations, sector conditions and alternatives. | Forecaster data equality, no state mutation, compact three-alternative reachability and native weather regressions. |
| UI-07 — telemetry, tyres, setup | `RaceInspectorPage` supplies scrolling-content/fixed-action composition. `RaceTelemetryInspector` selects recorded speed/tread/fuel/acceleration; current temperatures are labeled current, not histories. `RaceTyreReadout` distinguishes fitted/planned identities. Setup sliders share the actual five-field draft and display model-derived draft effects. | Correct units, private-rival masks, missing values, slider/draft synchronization, explicit application and finite-tyre tests. |
| UI-08 — team and radio | Both team drivers' intent/authority precede actual cooperation/battle/pit-priority controls. `RaceRadioInspector` uses chronological message cards, filters, bounded pages and an explicit history snapshot. | Named-driver authority, observations, history-mode and existing team/radio tests. |
| UI-09 — results and debrief | `RaceResultsWorkspace` supplies full classification, measured laps/sectors, fitted stint history and structured accepted-command/observed-outcome evidence (`RaceJournalView`). It reuses the same stable results table. Next, export, debrief, notebook and replay retain existing semantics. Completion transitions open a session workspace without merging original and sandbox authority. | Results semantics, reparent/restore/selection, lapped/DNF/untimed/practice tests and replay/notebook suites. |
| UI-10 — responsive/accessibility/performance | Layout adapts at supported desktop sizes and 100/115/130% text. Native accessibility metadata/text alternatives, keyboard routing and gamepad buttons are integrated; modal windows block global controller commands. Component caches replace the unused speculative snapshot layer. | Small-window native input, repeat-refresh node/style assertions, synthetic controller events and existing observational performance workloads. |

## Explicit adaptations of generated concepts

These are domain-preserving implementations, not missing decorative variables disguised as data:

- The actual drivers remain Daniel Mercer / Lucas Moreau; original vector emblems replace invented photographic portraits.
- Qualifying remains one physical session, not three unsupported elimination stages.
- Practice offers the four implemented objectives: tyre-life estimate, qualifying preparation, setup comparison and wet-condition learning. Progress is measured samples/runs, not an invented completion bonus.
- Strategy shows supplied stop schedules and uncertainty ranges. It does not synthesize a cumulative race-time or probability curve the model cannot provide.
- Setup exposes wing, balance, suspension, cooling and brake bias. Unsupported front/rear anti-roll, gear or tyre-pressure controls are not added as inert sliders.
- Telemetry uses four actual recorded channels plus labeled current model temperatures. It does not manufacture engine/brake histories or private rival state.
- The track remains authored native illustration and dot cars, consistent with the game's rendering direction. This is not pixel-identical photoreal scenery or licensed broadcast art.

## External acceptance, not hidden completion claims

Physical controller hardware, Windows-specific screen-reader behavior, broad GPU/CPU coverage and human playtesting still require their respective environments. Automated synthetic events and Control metadata establish implemented routes, not complete OS/hardware certification. Text scales above the supported 130% preference are not represented as tested. Hosted CI status must be checked independently of local results and mergeability.

## Safety and compatibility

No file under `scripts/domain/` or `scripts/services/` changes in this delivery. No save schema, sporting rules, tyre identity, pit routing, balance or RNG changes. Existing replay, independent sandbox, notebook, scenario authoring and exact original-result acceptance remain on the same host command boundary. Extraction changes the control ownership/composition, not the race authority.
