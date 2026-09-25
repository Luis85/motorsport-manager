# Race-weekend UI: implementation status and repair audit

Reviewed 25 September 2026 against the proposed UI-01–UI-10 plan, the approved visual boards, the actual native inheritance stack, and executable Godot tests.

## Status correction

The earlier statement that the entire UI architecture plan was executed was too broad. The earlier PR added styling, several primitives and a results tab, but did not complete the proposed component extraction or pixel-level screen migration. It also failed clean Godot import. Existing screens are implemented functionality, not evidence that their complete redesign was delivered.

This revision prioritizes a runnable, tested native game and correct information over additional decorative features. The visual boards remain a direction, not a source of sporting rules, new simulation variables, or guaranteed forecasts.

## Plan reconciliation

| Increment | Current state | Remaining work / acceptance gate |
|---|---|---|
| UI-01: design system | Green/cream/brass theme, accessible button states, shared styles, scaling and layout tokens exist. The current design/interaction contracts are documented. | Race helpers remain partly in `UI`; unused tokens and snapshot/badge prototypes must not be presented as a completed design-system migration. |
| UI-02: header and timing | Native header and timing work in the composed production view. Empty inherited chrome and broken utility callbacks are repaired; selected rows and both player identities are readable. | They still use the `WeekendView` / `PitwallWorkspace` composition, not separately extracted SessionHeader/TimingTower components. |
| UI-03: driver cards and decisions | Both real drivers keep independently targeted actions and the existing authoritative DecisionFeed. Duplicate local prompts are hidden. Critical fuel recovery remains directly reachable. | A dedicated reusable decision drawer and independent queue component are not yet extracted. |
| UI-04: race overview | Wide Race view now places the existing two cards in a right rail beside timing and the circuit; compact and analysis views keep both below the circuit. Live radio is available in the rail. | No photographic portraits or licensed broadcast artwork. Visual fidelity remains an authored native illustration, not the photorealistic scenery in the generated boards. |
| UI-05: qualifying and practice | Existing physical out/hot/in laps, release checks, per-driver practice drafts and measured evidence remain accessible. Practice and qualifying results have distinct semantics. | Separate top-level workspace classes and a redesigned simultaneous two-programme practice dashboard remain future extraction/design work. The game still uses one qualifying session. |
| UI-06: strategy and weather | Compare/Plan/Control and weather alternatives remain operative. All three comparison alternatives fit the tested 1100×720 / 130% view. Weather cases are correctly categorical. | No invented probability curves or cumulative strategy timeline. A richer strategy visualization requires actual model-supported series. |
| UI-07: telemetry, tyres, setup | Measured speed chart, bounded sector rows, retained finite tyre allocation and staged five-field setup remain integrated. Missing values are `—`, not zero measurements. | Dedicated chart/inspector architecture and advanced component telemetry are not implemented. Extra setup controls in the board are not supported mechanics. |
| UI-08: team and radio | Existing cooperation, battles, shared-box preview, recoverable radio and explicit authority remain. The overview reports actual box occupation. | Full visual redesign into new top-level components remains incremental. |
| UI-09: results and debrief | Results is routed into Review and the view finder. Qualifying, practice, race/lapped/DNF and live/unavailable states are separated; selection survives refresh. Existing debrief/notebook/replay evidence remains intact. | Results is a native contextual workspace, not an automatically substituted full-screen scene. |
| UI-10: responsive, accessibility, performance | Native tests exercise small windows, 100/115/130% text, focus, commands, unchanged authoritative state and stable UI resources. Charts and result rows avoid unnecessary reconstruction. | Controller/screen-reader completeness, >130% text, broad hardware profiling and human usability testing remain unvalidated. |

## Repaired defects

- **Blocking parser error:** an inline `match` inside a popup lambda ended with a mismatched closure and caused the dependent UI classes to fail parsing. A named callback replaces it.
- **Composed header:** the production host reparented labels but left empty panel wrappers visible. Its utility-menu reconstruction then lost the original callbacks. The host now keeps one real menu and hides the emptied wrappers.
- **Misleading duplicated advice:** a new selected-car heuristic strip duplicated the established two-driver DecisionFeed and mislabeled remaining fuel as finish margin. Production uses the existing feed; legacy copy uses the actual finish-margin estimate.
- **Incorrect result claims:** a live leader was shown as a winner; untimed qualifying implied pole; practice used qualifying/race data; lapped finishes could show a false zero-second deficit. Results now expose the appropriate authoritative session evidence and unavailable states.
- **Index collisions:** Results could be grouped as Recovery in weekend variants. Groups and result destinations are derived per view, and Results is searchable.
- **Misleading forecast graphic:** Now/Drier/Trend/Wetter are independent stress cases, not sequential future observations. The chart now labels and draws them as categories without implying probabilities.
- **Invalid UI ownership:** hidden action Nodes were created without parents. They are now owned by the scene and released with it.
- **State contrast and resource churn:** selected-button hover and selected timing colors were inconsistent; per-refresh style creation conflicted between parent and child cards. Styles now have complete states and shared change-only application.
- **Information boundary:** additional driver fields and traces are masked when inspecting a rival; private fuel and tyre state are not exposed through the new surfaces.
- **Compact comparison clipping:** redundant local strategy status could return after the host hid it. The component now respects its compact host, and spacing preserves all three alternatives without reducing their content.

## Invariants preserved

No production file under `scripts/domain/` changes in this repair. There is no RNG, tyre-identity, pit-routing, save-schema, race-balance, automatic pause, or playback-speed change. Existing notebook, replay and scenario-authoring work from main is included in the integrated source. Import, direct script loading, native interaction, and domain/scenario tests serve different purposes; one passing stage does not imply the others passed.
