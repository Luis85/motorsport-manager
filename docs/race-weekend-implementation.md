# Race-weekend strategy — 0.5 implementation and handoff

Design basis: **Motorsport Manager — Race Weekend GDD v1.0**, supplied 23 September 2026. Inspected and preserved baseline: `e340eb4959922ed86dc6ff72628e856334102466` (native Godot 0.4.0).

**Delivery status:** a playable first implementation of the GDD's Stage A strategy-and-consequence loop, plus initial qualifying-release and interaction improvements. **This is not completion of the entire GDD, nor completion of its human-playtest definition of done.** No claim is made that every strategy is balanced, forecasts are calibrated probabilities, or the full P1/P2 roadmap exists.

## Play the implementation

Open `project.godot` in Godot 4.7.2 Standard and press F5. Choose **Strategy Scenarios → Two routes to the finish** for an explicitly configured dry, calm 24-lap weekend. The four recipes also cover overlapping pit windows, track-position protection and a potentially uneconomic late stop. They begin at briefing, not an outcome-scripted mid-race scene.

Normal Grand Prix setup now starts at 24 laps / dry and retains 12-lap and custom choices. These change distance only: no undisclosed tyre or fuel compression is applied. Neither option is claimed to have completed format-wide balance calibration.

Use **Compare MER/MOR** on the persistent bottom cards. The right-hand topic selector retains the original telemetry, tyre, setup, surface and radio tools and adds **Strategy desk** and **Decision debrief**.

- **Compare:** read the current issue, supporting evidence, default if ignored, net pit-loss and possible rejoin traffic. The three bounded options are current plan, next safe stop and a two-lap extension when feasible. Box names the driver and actual replacement set; stale assumptions reject the click rather than silently issuing a changed command.
- **Plan:** choose a starting set, zero to three stop windows, objective, reserves and emergency consent. Edits are local drafts until **Approve**. Approval delegates only pit-window execution, not all driving controls. Overlapping teammate windows warn about shared-box exposure without inventing an exact queue before arrival is known. **Clear approved plan** returns pits to manual ownership.
- **Control:** independently assign pace, engine, pits, racecraft and qualifying. Temporary push/save commands last two laps in the UI (one to five supported by the domain), then return to the prior owner/manual value. The engine does not lose its owner because pace is overridden.

Qualifying remains physical out/hot/in running with valid timing. The release estimate includes pit transit, an out-lap and a five-second margin; a too-late release is rejected. Approve race preparation, formation and lights separately. The scenario's starting-set plan is restored for preparation and fitted physically at formation.

The circuit remains the main workspace. The rejoin overlay marks uncertainty around a **fixed physical pit exit**, not a predicted teleport destination. Both cars retain their own Compare / Box / Keep plan / Save fuel controls even while inspecting a rival. Space and the existing time controls remain player-owned; notices, guides and forecasts never pause or change speed.

## Implementation map

| GDD package | Implemented in this milestone | Remaining acceptance/depth |
|---|---|---|
| RW-01 Journal | Stable decision IDs, ticks, explicit drivers, command/order/entry/exit links, persistent warnings and observed results; JSON export | Complete replay records, broader causal events and once-only external settlement |
| RW-02 Strategy plans | Versioned per-driver objectives, finite-set sequences, ordered windows, reserve targets and one avoid-traffic branch | More branch types; richer context-specific objective evaluation |
| RW-03 Forecast | Immutable snapshots, retained four-wheel damage, bounded lap-wise tyre/fuel approximation, geometry-based pit transit/service/queue costs | Held-out calibration and more model sharing with live thermal/traffic effects |
| RW-04 Comparison/rejoin | Up to three candidates, current-plan baseline, rejoin position band, nearby public traffic, material-change/age invalidation | Explicit rival-response scenario trees; more precise traffic and warm-up integration |
| RW-05 Pit wall | Fixed two-car decision slots, live ownership, local drafts, stable focus, recoverable evidence/defaults, simulated/real deadlines | Wider attention/workload study and full text-scaling/accessibility validation |
| RW-06 Delegation | Independent channels, distance-bounded resource overrides, visible handback, compatible legacy migration | Additional targeted racecraft/team-order intents |
| RW-07 Rivals | Same legal inventory/pit rules and own-private/public-rival candidate model; contextual stop evaluation replaces threshold-only choice | Explicit undercut-cover/overcut responses and differentiated rival personalities |
| RW-08 Debrief/content | Measured pit visits versus decision-time ranges, actual team result, four playable dry recipes and full-race regression branches | Broader strategy crossover matrix and exploratory player validation |
| RW-11 / RW-16 foundations | Feasible qualifying-release estimate, six-step resumable guide, native interaction/compact-window tests | Full qualifying run planning, accessibility studies and broader input support |

## Ownership and persistence contracts

`StrategyRaceSim` extends the existing `RaceSim`; it does not replace fixed-step movement, classification, finite stock, physical pits or the 96 × 7 `RaceSurface`. `StrategyWeekendView` extends the existing native `WeekendView`. The editor/compiler and original test suites are unchanged. All new domain helpers remain `RefCounted`, independent of widgets and `App`.

`App` creates/restores the strategy-aware class for normal play. The base classes remain available to legacy regression fixtures. A legacy `auto` field is retained as a compatibility summary, not the authoritative source for independent control. The policy's owners/overrides govern behavior.

**Checkpoint v5** adds journal, plan revision/status, domain owners, pending intents, intended pit forecast, in-progress visit and warning acknowledgements. `StrategyRaceSim.restore_weekend` first uses the complete base continuation validator, then validates the added state. Native v1–v4 saves migrate with compatible owner defaults and an empty new journal; missing history is not fabricated. Existing wheel/setup/surface migrations remain in the base validator. Native v5 JSON numeric driver/tick values are normalized before UI membership filters use them. Loading cannot reroll the live random stream.

Unapproved UI drafts persist through selection and refresh in the current view, **not through application restart**. They are explicitly marked unapplied. Exported decision evidence is an analysis record, not a checkpoint or replay importer. The journal is capped at 50,000 records with an explicit truncation flag; the debrief displays the latest 100 team records and export retains all recorded entries.

The previous 0.4 architecture/controls/checkpoint discussions elsewhere in the documentation describe the preserved base implementation. This document supersedes their all-or-nothing delegation, single-plan-only and v4-as-current statements for the 0.5 application. The original physical one-pending-order/service-freeze contracts still apply underneath multi-window plans.

## Command examples

```gdscript
# Commands always target the intended driver, never the current UI selection.
sim.command("resource_intent", {"id": 3, "channel": "pace", "value": 2, "laps": 2})
sim.command("delegation", {"id": 6, "channel": "pit", "owner": "player"})
var draft = StrategyPlan.draft(sim.cars[3], sim.laps, "balanced")
sim.command("approve_plan", {"id": 3, "revision": sim.policy(3).revision, "plan": draft})
var estimate = sim.forecast(3)
sim.command("pit", {"id": 3, "set_id": estimate.replacement_id,
    "forecast_key": estimate.key, "forecast_time": estimate.time,
    "expected_gate": estimate.gate.distance})
```

Revalidate return values and `last_error`; an accepted command is not a promise of strategic success. A future schedule past its safe gate is rejected. An immediate safe-entry call may defer and says so. Once physically in the pit lane, the existing cancellation and service-freeze rules remain authoritative. A manually owned pit strategy receives warnings, not an automatic emergency takeover. No teammate stock can be borrowed.

## Forecast information and approximation limits

Snapshots copy the driver's own inventory/resources and their teammate's accepted pit state. Rivals expose public position, route, compound, observed stops and measured recent lap history only. Rival hidden inventories, fuel, tyre temperatures, uncommitted plans, RNG and future weather are not copied. Forecast evaluation neither consumes the live random stream nor mutates the race.

Candidates use half-lap integration and at most three default alternatives. Presentation caches forecasts until a material change or modest simulated-time cadence; there is no per-render-frame solver. Five-second-old advice is stale. Public stops, flags, important resource/set changes, owner-plan revision and shared-box state invalidate its key.

Ranges are **uncalibrated model ranges**, not 95% intervals. Current water and resource modes are held constant; future weather, incidents, unknown rival stops, automatic future policy changes and override handback are not predicted. A working-temperature approximation retains each wheel's wear/damage and prices warm-up separately. Fuel mass is coarse. Rejoin uses public recent pace, not an omniscient rival plan. Additional stops always pay their full net pit loss; forecast visit duration and net race-time loss remain distinct values.

The debrief reports measured gate-to-gate pit **visit duration** and its residual against the prior visit estimate. It does not call that residual a proven cause of a finishing position or claim an unrun alternative would certainly have won.

## Verification evidence

Run `python3 scripts/verify.py --godot /path/to/godot`. The existing CI workflow invokes that same runner. It imports a clean project copy with isolated user data, fails on script errors, and executes the original suites plus the new strategy, full-race and native-UI suites.

The implementation run passed **981 assertions/checks**: 706 original domain assertions, 113 original UI checks, 109 strategy assertions, 19 full-race scenario checks and 34 strategy UI checks. It produced **34 native screenshots**, including an actual 1100 × 720 strategy viewport and 1440 × 900 view. Generated `reports/verification.json` is the authoritative per-run count; `strategy-scenarios.json` records hardware, engine, fixed-step workload and actual outcomes.

The end-to-end fixture used Pinecrest, Formula, dry/calm, seed 7314, 24 laps and **43,984 fixed steps** across qualifying and two race branches. Both cars finished in both branches. MER's one-stop route finished in 782.491 seconds (P12); its hard no-stop alternative finished in 779.373 seconds (P11). The three recorded player pit visits were 33.75, 34.15 and 33.25 seconds against prior 32.160–36.660-second ranges. This is one circuit/seed, not proof that either strategy dominates or that forecast intervals have calibrated coverage.

Measured environment: Godot `4.7.2.stable.official.ed1daf0bf`, Linux container, AMD EPYC 9V74, Mesa llvmpipe and Xvfb. Native rendering tests are functional checks, not a hardware-independent FPS benchmark. The test fixtures are not the shipped replay/sandbox feature. No human playtest, controller completeness or screen-reader certification has been performed.

## Outstanding GDD work

**Stage A acceptance still needs** a broader deterministic matrix where different reasonable plans outperform one another on designated tracks; richer explicit opponent responses; reliable forecast error/coverage analysis; and newcomer/experienced-player tests of comprehension, tension and two-car workload. The current single-circuit comparison is evidence, not closure of those gates.

**Stages B–D remain:** persistent battle phase/target identities; safe team orders and pit priority; seeded non-oracular weather and local crossover advice; staged scalar reliability/recovery; a fully specified neutralization procedure; purposeful optional practice; more rival styles/driver pressure; replay branches/scenario authoring; and immutable once-only campaign handoff. Existing weather schedules, scalar damage and simplified safety-car caps remain honestly labeled baseline behavior. No new VSC/SC distinction is implied.

Full red flags, multi-stage qualifying, ERS micromanagement, staff/manufacturing, 3D cars, multiplayer, campaign economy and track-editor redesign remain outside this milestone as directed by the GDD. No daily campaign-energy charge was added to pit-wall decisions.
