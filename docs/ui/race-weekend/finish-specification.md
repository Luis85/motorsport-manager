# Finishing screen/state specification

This is the implementation contract for the native 0.14.0 Race Weekend finishing pass, extending the earlier per-screen summaries. SC00–SC14 map to the handoff's WP00–WP15 and G01–G18. They do not introduce additional sporting or management mechanics.

## Shared invariants

Only the existing validated command boundary changes the race. Selection, chart inspection, filtering, drafts, guide steps and reparenting do not. Confirmation preserves the reviewed driver/evidence and rejects stale assumptions. Time remains under explicit player control. `RaceDecisionViewModel` and the shared per-driver drafts are retained; no global `RaceUISnapshot`, duplicate draft store or second scheduler is introduced.

The fixed header identifies session/time/flag. Observation uses the native map, public timing and two driver cards. Focus reuses the existing inspector with both named targets. Practice retains two independent fixed action areas. Long evidence may scroll; confirmation, Run/Recall, cancellation and continuation must not disappear inside it.

Numeric semantics: **observed/measured**, **estimated**, **unavailable**, **draft**, **accepted**, **executing**, and **recorded outcome** are not interchangeable. The original C01/C02/C03 boards establish hierarchy, not permission to invent portraits, probabilities, DRS, future weather, extra setup fields or Q1/Q2/Q3.

Screens below list executable evidence by filename under `tests/`. Capture stems are under generated `reports/` and the final native comparison bundle; the populated report records viewport, text scale, model seed/time and source snapshot hash. Boundary fixtures are labeled separately from physical model runs.

## SC00 — Event setup, briefing and approvals

**Route:** Main / Grand Prix setup, fixed session header.

**Information:** Circuit and format from the selected track/model; briefing, optional practice, single qualifying, preparation, formation, grid/lights and results are distinct states.

**Interaction:** Continue only through the existing approval. Opening menus or recalling a save does not begin a new phase.

**States and boundaries:** Untimed/new weekends have no invented results. Legacy and original/sandbox continuation retain their existing provenance.

**Regression evidence:** `ui_smoke.gd`, `replay_ui_tests.gd`, `ui_finish_populated_tests.gd`, `ui_finish_details_tests.gd`.

**Capture family:** `briefing, formation, grid`.

## SC01 — Race overview

**Route:** Race view.

**Information:** Illustrated native circuit and flat dot cars dominate; public timing, actual full driver names/emblems, intent/owner, limiting fitted tyre, estimated fuel and next accepted stop are distinct.

**Interaction:** Dot/row selection and opening a driver are observational. Stable per-driver actions remain bound to their owner.

**States and boundaries:** Quiet/no-issue, multiple warnings, accepted stop, retirement and finish use words as well as color. Empty compact queues may collapse; urgent issues may not.

**Regression evidence:** `ui_finish_observation_tests.gd`, `ui_finish_states_tests.gd`, `ui_finish_populated_tests.gd`, `ui_finish_details_tests.gd`.

**Capture family:** `race`.

## SC02 — Decision review, confirmation and receipt

**Route:** Named driver / stable queue slot.

**Information:** The existing capture pins driver, issue, forecast, finite replacement and safe gate. Secondary issue choices belong to that reviewed snapshot.

**Interaction:** Review → Confirm → Submitting → acknowledgement/execution. Stale confirmation is rejected, not silently replaced. Keep plan is a separate acknowledgement.

**States and boundaries:** Completed, Canceled, Superseded, Interrupted, Rejected and Outcome unavailable are action-specific. Journal/run/override/entry-exit identities determine outcomes; reopening retains the receipt.

**Regression evidence:** `ui_finish_tests.gd`, `ui_completion_tests.gd`, `ui_repair_tests.gd`.

**Capture family:** `decision; matrix-*-confirmation; fuel-handback / missing-category boundaries`.

## SC03 — Qualifying

**Route:** Qualifying observation / Run plan.

**Information:** One session only. Best valid lap and signed gap to session fastest are recorded; new-release cost and latest elapsed-session start are estimates. These are not the active lap countdown.

**Interaction:** Release/Recall target the named driver and existing finite plan. End qualifying requires confirmation.

**States and boundaries:** Garage, out/hot/in lap, late release, closed-but-finishing, valid/invalid/untimed and retired states remain explicit. Two-line compact summaries keep timing units readable.

**Regression evidence:** `ui_finish_observation_tests.gd`, `ui_finish_tests.gd`, `ui_finish_populated_tests.gd`, `ui_finish_details_tests.gd`.

**Capture family:** `qualifying-garage, qualifying-hotlap, qualifying-closed, qualifying-results-*`.

## SC04 — Practice

**Route:** Strategy / Practice / Dashboard.

**Information:** Both real drivers; four objectives; shared per-driver drafts; actual finite stock and setup on release; measured duration, clean/partial evidence, observed costs and comparability limits.

**Interaction:** Run/Recall are fixed per-driver controls. Shared start/end/return remain outside evidence scrolling.

**States and boundaries:** Available/running/returning/complete/skipped/legacy and rejected preview do not masquerade as a fresh run budget. Completed cards highlight actual latest programme, not a default draft.

**Regression evidence:** `practice_tests.gd`, `practice_ui_smoke.gd`, `ui_completion_tests.gd`, `ui_finish_guide_tests.gd`, `ui_finish_populated_tests.gd`, `ui_finish_details_tests.gd`.

**Capture family:** `practice-progress, practice-results`.

## SC05 — Strategy

**Route:** Strategy / Compare, Plan, Control.

**Information:** Candidate schedules use supplied stops and model ranges. Distance-lap ruler, compound letters, current-distance cursor, selected stop and risk/assumption text are distinct from accepted orders.

**Interaction:** Arrow/pointer inspection is read-only. Approve, Box and ownership changes use their existing validated route. Focus reuses the same draft and actions.

**States and boundaries:** Unavailable/invalid/overlapping/stale/delegated/manual and accepted-window states retain reasons. No comparison creates an order.

**Regression evidence:** `weekend_strategy_tests.gd`, `strategy_ui_smoke.gd`, `ui_finish_analysis_tests.gd`, `ui_finish_populated_tests.gd`, `ui_finish_details_tests.gd`.

**Capture family:** `strategy, plans; strategy-inspection`.

## SC06 — Weather

**Route:** Conditions / Weather.

**Information:** Observed rain/line water and sectors; public uncertain outlook; Now/Drier/Trend/Wetter independent cases at one horizon; feasible alternatives and source assumptions.

**Interaction:** Inspection and sector links never command or consume live RNG. Box/Keep use existing validated action ownership.

**States and boundaries:** Dry/wetting/drying/stale/unavailable alternatives have text. No probabilities, promised crossover time or authoritative future weather is fabricated.

**Regression evidence:** `weather_tests.gd`, `weather_ui_smoke.gd`, `ui_finish_tests.gd`, `ui_finish_populated_tests.gd`, `ui_finish_details_tests.gd`.

**Capture family:** `weather`.

## SC07 — Telemetry and lap inspection

**Route:** Review / Telemetry; Results / Lap evidence.

**Information:** Recorded speed, tread, fuel and acceleration retain elapsed coordinates, unit and missing positions. Own-driver comparison uses exact common timestamps, never interpolation. Current temperatures are separate.

**Interaction:** Pointer/keyboard cursor and retained-range selection are observational. Rival inspection clears private evidence.

**States and boundaries:** Empty, single, flat, zero, negative, nonfinite/missing-middle and categorical gaps are explicit. Isolated finite points remain drawn. Sector selected values have a bounded text alternative.

**Regression evidence:** `ui_finish_tests.gd`, `ui_finish_analysis_tests.gd`, `ui_finish_states_tests.gd`, `ui_finish_populated_tests.gd`, `ui_finish_details_tests.gd`.

**Capture family:** `telemetry-0..3, telemetry-comparison`.

## SC08 — Tyres and allocation

**Route:** Car / Tyres / Wheels.

**Information:** Driver-owned usable/fresh/used/unusable stock, exact fitted/planned identity, minimum and punctured wheel, heat/damage state; selecting is not fitting.

**Interaction:** Stock selection retains existing draft/command boundaries; formation, release or real service determines fitting.

**States and boundaries:** No replacement, same fitted set, damaged/used set and private rival stock are not silently normalized or renewed.

**Regression evidence:** `living_racecraft_tests.gd`, `living_racecraft_ui.gd`, `ui_finish_analysis_tests.gd`, `ui_finish_populated_tests.gd`, `ui_finish_details_tests.gd`.

**Capture family:** `tyres, wheels; limiting-tyre`.

## SC09 — Setup

**Route:** Car / Setup.

**Information:** Exactly five supported axes: wing, balance, suspension, cooling and brake bias. Fitted → draft values and current-surface/model effects use the existing shared state.

**Interaction:** Sliders and numeric fields stage together. Atomic Apply is legal only in garage/preparation; live race bias is separately validated.

**States and boundaries:** Unchanged, edited, applied, reverted, illegal-phase and abandoned drafts preserve reasons and the other driver. Genuine setup-only edits trigger safe exit.

**Regression evidence:** `living_racecraft_ui.gd`, `ui_completion_tests.gd`, `ui_finish_analysis_tests.gd`, `ui_finish_populated_tests.gd`, `ui_finish_details_tests.gd`.

**Capture family:** `setup; setup-delta`.

## SC10 — Team intent and physical pit service

**Route:** Team / Cooperate, Battles, Pit box, Plans; driver More / Open pit service.

**Information:** Both accepted plans/active bounded overrides share a distance axis. Service shows actual approach, entry, queue, frozen whole-car timer, exit and correlated recorded visit.

**Interaction:** Read-only timeline delegates editing to existing controls. Cancellation ends at entry. Existing priority/cooperation obey physical order and named drivers.

**States and boundaries:** No stop, deferred approach, cancellation, interrupted/retired, queue, repair-only, completion and non-race Not applicable are distinct. No arbitrary future-command scheduler or per-wheel timer exists.

**Regression evidence:** `ui_finish_execution_tests.gd`, `recovery_ui_smoke.gd`, `ui_finish_states_tests.gd`, `ui_finish_populated_tests.gd`, `ui_finish_details_tests.gd`.

**Capture family:** `team, plans, pit-service, pit-rejoined; service-queue / service-retired-approach`.

## SC11 — Radio and command feedback

**Route:** Review / Radio; Messages.

**Information:** Eight stable event cards per page; 2000 retained-event cap and earliest retained time disclosed. Separate local acknowledgement/error history is capped at 50.

**Interaction:** History freezes evidence; Live resumes newest. Filtering/paging never changes commands, time or reading focus.

**States and boundaries:** No matching events, long text, retention rollover, rejection and simultaneous feedback remain recoverable; UI feedback is not a race journal substitute.

**Regression evidence:** `ui_finish_states_tests.gd`, `ui_finish_populated_tests.gd`, `ui_repair_tests.gd`.

**Capture family:** `radio-live, radio-history`.

## SC12 — Results and debrief

**Route:** Session results / Classification, Lap evidence, Stints & pit stops, Decisions.

**Information:** Real classification, valid/invalid/pit lap flags, measured lap/run IDs and ranges, finite fitted stints, correlated visits and historical forecasts; practice uses lap seconds.

**Interaction:** Select own driver, compatible comparison, stint/visit or journal entry without mutation. Next, export, notebook, replay and original-result acceptance remain explicit.

**States and boundaries:** Untimed, lapped, DNF, empty/truncated evidence, unmatched laps and sandbox authority preserve provenance. Completion is not proof of causality or strategic success.

**Regression evidence:** `ui_finish_analysis_tests.gd`, `ui_finish_execution_tests.gd`, `ui_finish_populated_tests.gd`, `replay_tests.gd`, `notebook_ui_tests.gd`.

**Capture family:** `qualifying-results-0..3, results-0..3`.

## SC13 — Recovery and surface

**Route:** Conditions / Recovery / Surface.

**Information:** Existing supported flags, aggregate condition, repair/retire choices and native surface field/location context. Model limits remain visible.

**Interaction:** Surface selection/overlay is observation. Protection, repair or retirement goes through the existing action/confirmation boundary.

**States and boundaries:** Unsupported fine-grained component diagnoses are never inferred from scalar damage. Finished/retired/legal-phase constraints remain authoritative.

**Regression evidence:** `recovery_tests.gd`, `recovery_ui_smoke.gd`, `weather_ui_smoke.gd`, `ui_finish_populated_tests.gd`, `ui_finish_details_tests.gd`.

**Capture family:** `recovery, surface`.

## SC14 — Navigation, help, settings and exit

**Route:** Find / Weekend / Guide / Focus / Back.

**Information:** One task-navigation model across reparented inspectors. Existing view indices remain per-instance. Guide persists only help progress.

**Interaction:** Find, selection, scaling and transitions do not command or change time. Modal inputs cannot reach the race. Genuine shared drafts receive explicit discard/retain choices.

**States and boundaries:** Missing/legacy destinations, canceled/failed saves, original/sandbox restores, modal close and invalid focus targets retain safe fallbacks. Hardware/OS accessibility remains a separate gate.

**Regression evidence:** `ui_finish_guide_tests.gd`, `ui_completion_tests.gd`, `pitwall_ux_tests.gd`, `replay_ui_tests.gd`, `test_verify_runner.py`.

**Capture family:** `guide-*, ux-find, ux-leave-warning; matrix-*-results resize`.

## Acceptance profiles and delivery evidence

All populated screens use A: 1440×900/100%, B: 1280×800/115%, C: 1100×720/130%. Race, confirmation, focused strategy, practice and results additionally sweep all three scales on those sizes, and 1920×1080 at 100/130%. The native tests check control and clipping-ancestor bounds, stable hit targets, exact input routing and unchanged authoritative snapshots. Results additionally retain selected chart evidence/focus through live resizing. These checks do not certify touch input or text above 130%.

See [visual acceptance](finish-visual-acceptance.md) for engineering review in six dimensions and [verification](verification-finish.md) for exact execution evidence and blocked platform gates. The [player guide](player-guide.md) follows the same routes without implying additional mechanics.
