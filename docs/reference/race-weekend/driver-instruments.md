# Pitwall and driver instruments

The default Minimal interface exposes read-only instrument cards for both managed drivers. This reference explains their data and estimate boundaries; [Minimal race weekend](minimal.md) describes the actions and session flow. The original 0.17.2 source identities and executed checks are retained in the [historical verification record](../../_archive/verification/driver-instruments-0.17.2.md).

## Visual and interaction foundation

The pitwall groups driver selection, the selected driver's number/name/state, pit operations, pace and engine mode. Send out and Box this lap share one row. Current pace and engine mode remain explicit. Native dropdown focus and its driver/phase pin are preserved. Selection does not transfer a pending choice or teammate state.

Both read-only cards use the same structure: identity and last measured lap; four inset instrument blocks; nearby race context; current orders, engine heat and speed. Driver identity colors match the cars, while selected text/borders and warning text distinguish selection from condition. There are no card buttons, hidden drawers or click-to-command behavior.

At compact height, spacing and decorative headings compress rather than text scale or actions. The optional engine explanation and expanded stress cause remain available in existing tooltips; current mode, score/band, units and critical warnings stay visible. Timing rows must remain readable at the supported desktop text scales. Extra footer height is paid for with padding and timing-row spacing, not a new scrolling control area.

## Driver stress: explicit estimate, not invented telemetry

The native baseline has no driver-stress state. `MinimalDriverContext.stress` therefore supplies a **current-demand estimate**, labeled `STRESS · EST.` and `~N/100`, with Low, Raised or High text. It is not measured emotion, accumulated fatigue, heart rate, confidence, mistake probability or an implemented stress-to-pace mechanic. It has no effect on cars, RNG, orders or outcomes.

This deliberately narrow UI-first contract avoids introducing an unbalanced psychology system behind a new gauge. A future stateful model requires a separately versioned domain/persistence design and balance work. Do not relabel this estimate as authoritative stress without that work.

Authored, uncalibrated defaults for `current-demand-v1` follow. The runtime reads `tuning.balance.presentation` from the weekend’s frozen content; the shipped defaults live in `config/race_tuning/default.json` and may differ in a validated external pack. See [Race-tuning content](../../how-to/content/weekends-and-tuning.md).

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

Clamp the sum to 0–100. With the shipped defaults, Low is below 35; Raised is 35–64; High starts at 65. Traffic uses signed along-route proximity modulo a lap, never 2D screen distance, and excludes inactive cars. Formation and neutralization suppress the traffic contribution. The highest contributing input is the wide-card cause; full current inputs are explained in the tooltip and accessibility description. No future weather or rival private state is inspected.

Garage, non-active phases, start lights, stationary pit service, finished and retired states show `— / Not driving`, not a reassuring fabricated zero. Pausing does not decay or reroll the estimate. Restore and repeated observation reproduce it from the same authoritative inputs.

## Instrument data contracts

**Tyres.** Full compound name, lowest four-wheel tread, actual fitted set and average surface temperature. Four small bars follow FL, FR, RL, RR. A puncture is an X rather than a full healthy bar. Multiple punctures use a bounded count with the full wheel list in the tooltip. A planned replacement never becomes fitted data early. Unknown fitted data remains unavailable.

**Fuel.** Existing lap-equivalent units and explicitly approximate current-engine-rate finish margin. No fake tank-capacity gauge, litres, kilograms or guarantee of drivable laps. Terminal cards stop projecting and show remaining fuel.

**Car.** Mechanical condition and separate aggregate damage remain distinct. Actual engine temperature and km/h are shown below. The engine-hot cue uses the frozen `condition.heat_reference_c` threshold (115°C in shipped content); it is separate from driver stress. No component diagnosis is inferred from scalar health or damage.

**Lap timing.** Practice reads measured `seconds` from completed samples, including context-limited observations; qualifying reads valid attempts only. Grid/formation explicitly label the qualifying result. Racing uses actual last/best values and identifies pit laps. Unknown timing is a dash. Viewing a pit lap does not fabricate a clean-pace comparison.

**Race context.** Ahead/Behind identify neighboring classified cars and distance-derived estimates, marked `~`; whole-lap differences stay in laps. Stationary estimates are unavailable rather than a division-by-zero guess. A finished leader remains recognized, so the next running car cannot be falsely labeled Leading. Pit service and terminal state replace obsolete live-neighbor messaging. Long exceptional retirement copy is bounded visually, with its full recorded reason retained in the tooltip/accessibility text.

## Technical seams and verification

`MinimalDriverReadout` and `MinimalDriverContext` live in `scripts/application/minimal/` and produce detached own-car data, current-demand estimates, timing and public race context. `MinimalStatusGauge` caches native drawing and never handles input or advances time. `MinimalDriverCard` retains its nodes and styles. The workspace routes native input through `MinimalRaceHandle`; application command adapters enforce ownership and runners advance time.

Verification commands and the current suite registry are documented in [Verification](../../how-to/verification.md). The [0.17.2 record](../../_archive/verification/driver-instruments-0.17.2.md) preserves that increment’s executed checks, physical journey and platform limitations. Those historical counts do not establish acceptance for a later source tree.

## Implementation references

Native cached drawing and non-interactive Control behavior follow the official Godot documentation. Numeric labels plus non-color cues follow Microsoft's contrast/channel guidance. These references guide implementation; they do not validate the authored stress coefficients.

- https://docs.godotengine.org/en/stable/tutorials/2d/custom_drawing_in_2d.html
- https://docs.godotengine.org/en/stable/classes/class_control.html
- https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/102
