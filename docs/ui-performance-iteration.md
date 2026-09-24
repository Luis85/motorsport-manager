# 0.8.0 — Compact pit wall and performance

## Scope and integration

This iteration addresses oversized UI, low-readability hover states, scrolling navigation and hard-to-find actions. It implements the race-weekend GDD's compact two-car interface, stable command targets and observational presentation contracts (Chapters 17, 19 and 22), rather than adding another race mechanic.

Work began at 0.6.0 commit `4966c577380e3c80c693d70417a68c525be3070b`. During implementation, the 0.7 weather work was merged into the branch at `e5e849ece8430ead5c9cfb72cd8ddc105b53b6ac`. That merge is preserved. Weather received the same navigation and fixed-action treatment; its simulation, scenarios, checkpoint v7 and migration rules are unchanged. This pass does not claim authorship of the incoming weather domain.

## Information architecture

The live weekend has one compact session header with persistent pause, speed, Save, Export log, Guide and Menu actions. Phase approvals remain explicit. Intermediate phase labels collapse only while the session is live; no panel or notification changes time controls.

The default **Watch** view closes the inspector and leaves the timing tower, circuit and both driver cards visible. Direct task buttons replace the scrolling topic picker: **Drive, Strategy, Tyres, Team, Weather, Setup, Telemetry, Radio, Surface and Debrief**. Weather appears for weather-enabled weekends. Tasks open in the same inspector; **Close**, **Escape** or **Watch** returns to observation. **Expand** temporarily hides the tower and widens the inspector; Collapse reverses it. The circuit and both car cards remain available.

**Drive** separates driving modes from pit-service configuration. **Strategy** keeps Compare / Plan / Control directly visible. **Team** exposes Cooperate / Battles / Pit box rather than another dropdown. **Tyres** keeps Allocation / Wheels / Stop plan. The map's four-option **Layers** menu groups racing line, labels, surface and pit-rejoin estimate. Advanced surface inspection is available but is not the default experience.

The two fixed driver cards own Compare, Box, Keep plan and Save fuel. A pending stop exposes Cancel pit; qualifying exposes per-driver Send and Recall instead. Names are bound to driver IDs, independent of whichever rival is being inspected. Qualifying Send applies the existing feasibility check before offering a new flying attempt.

## Drafts, approvals and feedback

Plan approval/clearing, team cooperation/priority and weather Box/Keep actions sit outside their scrollable details. Setup Apply/Revert remains pinned. A normal one-stop window and ordinary driving/pit-service controls fit without scrolling at 1100×720. Longer three-stop drafts, detailed weather comparisons, radio history and expert inspectors can still scroll; the action required to commit or cancel is not at the bottom of that scroll.

Reserves and contingencies are disclosed on demand. Draft edits remain independent and unapplied until approval; changing drivers, topics or ordinary refreshes does not apply them. As before, race-plan drafts are not saved across application restart. Settings now use two visible groups plus local-data actions and a fixed Apply/Back row. Editing a settings preference does not apply or persist it until Apply. All four dry and three weather scenario launch actions fit without a scrolling menu.

The shared theme defines normal, hover, pressed, focused and disabled text/background states, including PopupMenu, Tooltip, Tree and pre-tree-created weather buttons. Enabled primary actions retain cream text on dark green; secondary actions remain dark on light. Explicit focus outlines and text labels remain. Default text is 13 px, most controls 30–32 px high, with smaller secondary information. This is a desktop density revision, not a new user-configurable text-scaling system.

Hover and keyboard focus expose control explanations in the footer; **F1** opens a persistent explanation, including from SpinBox text fields. Strategy and weather have explicit assumption/detail actions. **Space** pauses/resumes a live session even when Box has keyboard focus; it does not accidentally activate that button. Text fields retain ordinary Space editing, and visible dialogs block background shortcuts. Enter retains normal button activation. **B** targets the selected player driver's displayed pit forecast, **Ctrl+Tab** switches between player drivers, and **F** fits the circuit.

## Performance implementation

Presentation work is reduced without changing the 0.05-second authoritative step, incident sampling, random streams, stock, commands or sporting outcomes:

- Only the visible detail inspector refreshes tyre/setup/history/plot content. Driver-card forecasts are reused until material invalidation or their modest simulated-time cadence; execution still revalidates the displayed forecast.
- Stable timing rows update only changed appearances. Active-state styles are shared and assigned only when state changes; routine refresh does not allocate new controls or style resources.
- Paused car, battle and rejoin overlays retain drawing commands. Camera, selection, movement, state and relevant forecast changes invalidate them. Active interpolation remains independent of simulation.
- The two road passes submit cached triangle arrays instead of four polygons per station. A regression checks every vertex and winding against the original triangles. Camera movement does not rebuild scenery or geometry.
- Surface strip geometry is cached by compiled track identity. Live surface values remain authoritative; changing channels reuses only geometry, never cached grip or water values.

The hierarchy contains 805 nodes in the benchmark instead of 748: stable controls trade a small node increase for lower repeated work. This is not a claim of reduced total memory. The uncached strategy model is not faster; redundant evaluations were removed from presentation.

## Measured before/after

Reference: **AMD EPYC 9V74, Godot 4.7.2 Standard (`ed1daf0bf`), Linux X11/Xvfb, Mesa 25.0.7 llvmpipe / LLVM 19.1.7**, 1100×720, Monaco, 12 cars, 24-lap dry configuration, calm incidents, seed 7314. The same `tests/ux_performance.gd` was run in two alternating baseline/current pairs with isolated user data. Both revisions explicitly use StrategyRaceSim, so the separately merged weather model is not a benchmark confounder.

Ranges below are **the medians from two runs**, not confidence intervals. UI workloads use ten warmups plus 100 samples; the uncached forecast uses 30 samples. The old build has no Watch mode, so its Watch comparison uses the former Commands view, while 0.8 closes the inspector. These are the intended player-facing workloads, not a controlled isolation of every individual optimization.

| Workload / metric | 0.6 baseline | 0.8 implementation |
|---|---:|---:|
| Watch-mode UI refresh | 2.49–2.50 ms | 0.80–0.81 ms |
| Team-panel UI refresh | 2.95–3.02 ms | 1.24–1.30 ms |
| Strategy-panel UI refresh | 2.55–2.61 ms | 1.10–1.15 ms |
| Driving-controls UI refresh | 2.33–2.66 ms | 0.80 ms |
| Uncached one-driver forecast | 2.12–2.36 ms | 2.19–2.25 ms |
| Paused native frame | 38.07–41.72 ms | 34.03–34.90 ms |
| Controlled 1× native frame | 38.81–42.42 ms | 36.99–37.78 ms |
| Controlled 16× native frame | 53.91–55.31 ms | 48.58–50.49 ms |
| Paused frame draw calls | 5,724 | 2,413 |
| Car/battle/rejoin redraw callbacks, each over 60 unchanged paused frames | 60 | 0 |

The active workloads feed 120 identical 1/60-second input frames at each speed: **40 fixed steps at 1× and 640 at 16×**. They are not claims that the software-rendered machine achieves a 16× wall-time multiplier. Each run matches a headless replay; the before/after authoritative outcome hashes also match exactly. Raw medians, p95 values, hashes and environment are in `reports/ux-performance-comparison.json` in the delivered evidence archive. The normal verifier writes its current-build measurement to `reports/ux-performance-current.json`.

No universal FPS guarantee or statistically established speedup is claimed. The unchanged model still incurs simulation cost at acceleration, and software rendering remains slow. Larger fields, prolonged sessions, GPU rendering and hardware-specific tuning need separate measurement.

## Verification and source identity

The complete clean local verifier passed **1,388 checks** and captured **53 native screenshots**. Counts include repeated invariants, not 1,388 independent user scenarios.

| Suite | Checks |
|---|---:|
| Original domain | 706 |
| Original native UI | 113 |
| Strategy domain / scenarios / UI | 109 / 19 / 34 |
| Living racecraft domain / UI | 113 / 31 |
| Retained weather domain / full scenario / UI | 97 / 10 / 33 |
| New compact UI / interaction / rendering contracts | 123 |

The new suite checks 1100×720, 1280×720 and 1440×900 task layouts, both drivers' fixed actions, pinned approvals through scrolling, one-stop editing, settings transactions, all scenario choices, stable control identity/focus, configured enabled text contrast of at least 4.5:1, actual Space/F1 input, late qualifying release, hidden detail work, paused redraw suppression, geometry reuse and exact road triangles. Existing editor, finite tyre, physical pit, save/load, weather fairness and full-weekend regressions remain mandatory. Two weather UI assertions specifically cover reopening a closed topic and the correct pre-tree button palette.

```sh
python3 scripts/verify.py --godot /path/to/godot
# Standalone diagnostic (software rendering or a native display):
godot --path . --script res://tests/ux_performance.gd -- label=current
```

The tested 164-file source tree is **`baa6ae6afc6fa29393e869cbc9ae78b36d5097ed`**, pushed as code commit **`fd4db90cc68d6aa50d4a288598772d7cc878d78a`**. Subsequent handoff/documentation changes do not modify the tested implementation. GitHub-hosted verification is a separate result and must be checked on the PR before merging.

## Remaining boundaries

This is not a track-editor redesign; its shared theme and rendering benefit while editor interaction tests remain intact. It does not add staged reliability, coherent neutralization, practice or replay. The weather slice already merged is preserved, not relabeled as all of Stage C. Strategy balance/calibration and extended cross-circuit profiling remain open. No player-comprehension study, screen-reader/controller certification or configurable-text-size acceptance is claimed. Long-form technical detail may still need scrolling; primary task navigation and critical actions do not.
