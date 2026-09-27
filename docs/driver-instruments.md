# Pitwall and driver instruments — 0.17.2

## Scope and base

Built on merged PR #16, main `81a4f9bbc05fdbf084292c3ab7c7c710b8252849` (source tree `ae2d06ff1d22e8c6d2d18456969b1c309002b16a`). Native Godot remains the implementation. The existing five driver actions, session flow, time controls, timing tower and TrackCanvas are retained. No new action, automatic decision, sporting modifier, physics change or save-schema migration is introduced.

## Visual and interaction foundation

The pitwall groups driver selection, the selected driver's number/name/state, pit operations, pace and engine mode. Send out and Box this lap share one row. Current pace and engine mode remain explicit. Native dropdown focus and its driver/phase pin are preserved. Selection does not transfer a pending choice or teammate state.

Both read-only cards use the same structure: identity and last measured lap; four inset instrument blocks; nearby race context; current orders, engine heat and speed. Driver identity colors match the cars, while selected text/borders and warning text distinguish selection from condition. There are no card buttons, hidden drawers or click-to-command behavior.

At compact height, spacing and decorative headings compress rather than text scale or actions. The optional engine explanation and expanded stress cause remain available in existing tooltips; current mode, score/band, units and critical warnings stay visible. All twelve timing rows must fit at the six retained desktop profiles. Extra footer height is paid for with padding and timing-row spacing, not a new scrolling control area.

## Driver stress: explicit estimate, not invented telemetry

The native baseline has no driver-stress state. `MinimalDriverContext.stress` therefore supplies a **current-demand estimate**, labeled `STRESS · EST.` and `~N/100`, with Low, Raised or High text. It is not measured emotion, accumulated fatigue, heart rate, confidence, mistake probability or an implemented stress-to-pace mechanic. It has no effect on cars, RNG, orders or outcomes.

This deliberately narrow UI-first contract avoids introducing an unbalanced psychology system behind a new gauge. A future stateful model requires a separately versioned domain/persistence design and balance work. Do not relabel this estimate as authoritative stress without that work.

Authored, uncalibrated weights for `current-demand-v1`:

| Input | Score contribution |
|---|---:|
| Normal baseline | 15 |
| Calm baseline | 7 instead of 15 |
| Push | +20 |
| Nearest live track car within 70 route metres | +24 × (1 − distance/70) |
| Punctured fitted wheel | +30 |
| No puncture, minimum tread below 40% | +20 × (1 − tread/40) |
| Existing aggregate damage | +min(20, damage × 0.6) |
| Existing local surface water above 0.15 | +min(15, water × 15) |
| Existing recovery time-loss state | +15 |

Clamp the sum to 0–100. Low is below 35; Raised is 35–64; High starts at 65. Traffic uses signed along-route proximity modulo a lap, never 2D screen distance, and excludes inactive cars. Formation and neutralization suppress the traffic contribution. The highest contributing input is the wide-card cause; full current inputs are explained in the tooltip and accessibility description. No future weather or rival private state is inspected.

Garage, non-active phases, start lights, stationary pit service, finished and retired states show `— / Not driving`, not a reassuring fabricated zero. Pausing does not decay or reroll the estimate. Restore and repeated observation reproduce it from the same authoritative inputs.

## Instrument data contracts

**Tyres.** Full compound name, lowest four-wheel tread, actual fitted set and average surface temperature. Four small bars follow FL, FR, RL, RR. A puncture is an X rather than a full healthy bar. Multiple punctures use a bounded count with the full wheel list in the tooltip. A planned replacement never becomes fitted data early. Unknown fitted data remains unavailable.

**Fuel.** Existing lap-equivalent units and explicitly approximate current-engine-rate finish margin. No fake tank-capacity gauge, litres, kilograms or guarantee of drivable laps. Terminal cards stop projecting and show remaining fuel.

**Car.** Mechanical condition and separate aggregate damage remain distinct. Actual engine temperature and km/h are shown below. The engine-hot cue uses the existing model's 115°C boundary; it is not driver stress. No component diagnosis is inferred from scalar health or damage.

**Lap timing.** Practice reads measured `seconds` from completed samples, including context-limited observations; qualifying reads valid attempts only. Grid/formation explicitly label the qualifying result. Racing uses actual last/best values and identifies pit laps. Unknown timing is a dash. Viewing a pit lap does not fabricate a clean-pace comparison.

**Race context.** Ahead/Behind identify neighboring classified cars and distance-derived estimates, marked `~`; whole-lap differences stay in laps. Stationary estimates are unavailable rather than a division-by-zero guess. A finished leader remains recognized, so the next running car cannot be falsely labeled Leading. Pit service and terminal state replace obsolete live-neighbor messaging. Long exceptional retirement copy is bounded visually, with its full recorded reason retained in the tooltip/accessibility text.

## Technical seams and verification

`MinimalDriverReadout` assembles actual own-car data. `MinimalDriverContext` supplies derived read-only stress, timing and public race context. `MinimalStatusGauge` caches native drawing and never handles input or advances time. `MinimalDriverCard` retains its nodes and styles. The workspace retains command ownership and native input routing.

All domain/service files and `minimal/controls.gd` are unchanged from the merged baseline. Existing required minimal suites are extended in place; the full verification-runner registration is unchanged. New checks cover independent stress, observation/RNG parity, save continuation, phase-correct laps, finished-leader context, four punctures, heat/fuel/damage separation, compact scaling, live resizing and existing native commands. The full physical weekend checks new bindings at every milestone. Synthetic boundary fixtures are labeled separately from actual physical execution.

Exact executed counts and source identity belong to the accompanying verification record and PR. A historical green CI run is not evidence for this head. Automated checks are not human comprehension or accessibility certification. Windows exports, physical DPI/controllers, screen readers, text above 130%, wider weather/endurance coverage and representative-device profiling remain unverified in this pass.

## Executed clean-copy verification

The frozen runtime/test tree passed **1,414 behavioral assertions**, plus **127 production script loads**, after fresh import in an isolated clean copy. The minimal suites are an included subset: **495 checks and 29 native PNG captures**. Five verification-runner isolation tests also passed with the pinned native engine, including the real user-directory probe. Repeated development runs are not added to these totals.

| Suite | Passed checks | Native captures |
|---|---:|---:|
| Minimal commands, readouts and timing | 107 | — |
| Minimal layout and native input | 270 | 20 |
| Complete native weekend journey | 118 | 9 |
| Retained general domain | 706 | — |
| Retained practice / Director / replay | 78 / 76 / 59 | — |
| Production script loads, counted separately | 127 | — |

The physical journey executed **14,609 production fixed steps**, from a new six-lap Pinecrest weekend (dry, calm incidents, seed 7314). Both drivers completed measured practice and qualifying, physical returns, formation/lights and the race; a real pit entry/service/fitting/exit and production session save/restore were exercised. Card bindings were checked at nine physical milestones. Synthetic warning and layout fixtures remain explicitly distinct from that journey.

Native profiles: **1440×900 and 1100×720 at 100%, 115% and 130% text**. Environment: Godot 4.7.2 Standard (`ed1daf0bf`), GL Compatibility, Linux/Xvfb, Mesa llvmpipe, Dummy audio and `LP_NUM_THREADS=2`. Clean-copy execution took 513.54 seconds; this is test duration, not a gameplay performance claim. No script/parse/runtime error markers occurred in final logs. The unsupported VSync warning is an environment limitation.

A SHA-256 comparison confirmed all **388 runtime/test/scene/data files** stayed unchanged after the final run began. All **103 domain/service/command-adapter files** remain byte-identical to the merged baseline. Python compilation and staged `git diff --check` passed. Only documentation was subsequently updated with these results.

Development checks reproduced footer overflow and a clipped last timing row at compact enlarged text. These were repaired with layout spacing, preserving numeric values, labels, actions and the selected text scale. Actual final race, compact warning, qualifying and results captures were visually inspected.

**The full historical corpus was not rerun locally.** Its existing registration in `scripts/verify.py` is unchanged and remains the hosted CI merge gate. Publication-time hosted status belongs to the current PR, not the earlier 0.17.1 run. Human approachability, platform exports and representative-device performance are not established by these automated passes.

## Implementation references

Native cached drawing and non-interactive Control behavior follow the official Godot documentation. Numeric labels plus non-color cues follow Microsoft's contrast/channel guidance. These references guide implementation; they do not validate the authored stress coefficients.

- https://docs.godotengine.org/en/stable/tutorials/2d/custom_drawing_in_2d.html
- https://docs.godotengine.org/en/stable/classes/class_control.html
- https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/102
