# Minimal race weekend — current shipping contract

Originated in 0.17.1 and maintained as the authority for the shipping **Minimal** weekend mode. Minimal remains the default; Settings can select the optional Advanced race interface described in the current-state inventory.

## Product decision

The Minimal experience is one toolbar above timing, the circuit and a selected-driver pitwall, with both drivers’ read-only cards below. It mounts its own native controls over the authoritative weekend. Optional Advanced presentation uses that same weekend through its own view handle.

### Interface selection boundary

Settings stages a **Race interface** choice and persists it only on Apply. **Minimal** opens the focused screen specified below. **Advanced** opens the retained Race Director or Engineering workspace over the same authoritative weekend. The Advanced start surface is remembered independently as Race Director or Engineering.

The preference applies when a weekend screen next opens. It is not a race command and does not recreate the simulation, reset the recording, advance time, change pause/speed, claim ownership or consume gameplay randomness. Existing `minimal`, `director` and `engineering` preferences remain valid; the public `advanced` alias maps to Race Director. Unsupported values fall back to Minimal. Explicit command-line overrides remain available for development and verification.

### Visible contract

Toolbar: Menu, session identity, session clock or lap/flag, Pause, Play, speed (1/2/4/8/16), **Strategy**, and a context-specific session button. Strategy is enabled only for a running managed driver during the race. In a live race the session button disappears. Finishing/formation states explain why controls are disabled. Results offer Review weekend, opening the completion screen with Main menu, Review final track and New weekend actions.

Timing: position, three-letter driver code, best time or gap, and compact running state. Practice times come from actual practice samples, not `qual_best`. Qualifying uses actual flying laps. Live race gaps remain the existing distance/speed estimates and are explicitly prefixed `~`; final classification uses actual completion/time. Full names and basic running state are available on hover. Only the player's two rows can select the pitwall driver.

Race: existing TrackCanvas, fitted to the available rectangle, with actual car motion and start lights. Wheel zoom, middle-button pan, F to fit. Circuit labels follow the user's display preference. Engineering surface/racing-line overlays are not exposed in Minimal. Rival car clicks cannot replace the selected managed driver.

Pitwall: two driver selectors, selected full name and running state, Send out, Box this lap, Push/Calm, Save/Standard/Power engine mode. A small receipt reports acceptance/rejection; phase guidance is bounded rather than allowed to push controls offscreen. Full explanatory text remains in tooltips. No graphs, setup editors, editable strategy drawers, or rival inspection. Tyre/fuel/car information is read-only in the bottom cards, not mixed into the controls.

### Read-only bottom row

Both player drivers stay visible. Cards show name, position/state, fitted compound and the lowest tread across four wheels, set identity and average measured surface temperature, fuel in lap-equivalent units, mechanical condition and separate aggregate damage. A puncture or low tread replaces ordinary tyre detail with the limiting wheel. A racing fuel finish margin is labelled `~` and is only a current-engine-rate estimate, not a guarantee. Finished/retired cars show remaining fuel, not an ongoing forecast. Unknown fitted data remains unavailable.

Cards cannot select a driver, pause, issue commands or open another workspace. The selected pitwall driver is indicated on their card. Thin redundant tyre/condition meters disappear in compact windows; all numeric information remains. The layout adapts on live window resize, not only on creation.

## Flow contracts

| State | Primary action | Real model commands / result |
|---|---|---|
| New briefing | Start practice | Claim visible manual channels, then `practice_start` |
| Practice | End practice | `practice_end`; resume playback for physical returns |
| Practice results | Start qualifying | `practice_finish`, manual ownership, `qualify` |
| Legacy/skipped-practice briefing | Start qualifying | Manual ownership, `qualify`; no invented practice evidence |
| Qualifying | End qualifying | `close_qualifying`; resume playback for physical returns |
| Qualifying results | Start formation | `prepare_race`, valid available starting tyre choices, `formation` |
| Race preparation (including loaded saves) | Start formation | Valid starting tyre choices, `formation` |
| Formation | Disabled progress label | Physical formation steps; no automatic start approval |
| Grid ready | Start race | `lights`; real countdown then race |
| Results | Review weekend | Open the factual completion screen; its actions are Main menu, Review final track and New weekend |

Every user command is explicit and named. Display refresh, selection, interface preference and preview do not claim control or consume simulation time. Explicit Start/Play hands qualifying, pit, pace and engine channels to the player; racecraft ownership is not broadened. Existing physical pit commitments remain valid. No artificial telemetry benefits, repaired wear, free tyre sets, or forced winners are added.

### Send out and tyre defaults

Practice sends two measured laps on the current setup, preserving the selected pace/engine modes. It uses the normal preview/revision/material/time validation and real run limits. Sound fitted practice stock can be reused. Qualifying sends one real flying-lap attempt with out/in laps and automatic return. Insufficient time or usable stock disables release with a reason. Neither action unpauses a deliberately paused session.

The application adapter chooses only from the driver's real finite inventory using the frozen tyre allocation’s phase/condition preferences. The following choices describe shipped content defaults. Observed wet conditions use suitable intermediate/wet stock. Dry qualifying prefers Soft; practice prefers Medium; race preparation/pits prefer Medium for shorter remaining distance and Hard above 15 laps, falling back to usable dry alternatives. This is a transparent baseline heuristic, **not an optimal strategy solver**. It does not read future weather or another driver's private state. Long-distance and changing-weather balance still need human validation.

### Box this lap

Practice and qualifying map to the existing physical recall: the unfinished measured lap is abandoned, completed laps remain, and the car travels back. Race calls bind a real replacement set and the current reachable gate, material key and timestamp. Past the safe current-lap entry, the button is disabled with an explicit explanation; it cannot secretly become a next-lap request. Duplicates and unavailable stock are rejected. Pit exit remains automatic; no extra Send out is required after race service.

### Pace and engine

Push/Calm toggle back to Normal on a second press. Engine modes are explicit. Practice now routes these commands through the existing validated/recorded parent command boundary. A live change marks the current sample as tainted. The original run baseline is retained; subsequent laps in mismatching modes cannot be counted as clean baseline evidence. The most recent explicit values survive garage return.

An optional validated `active.live_modes` pair records current values without rewriting the run baseline. Older runs without that pair retain the original exact-baseline invariant. Invalid, incomplete or car-mismatched values fail restoration. The optional `manual_modes` run-plan field must be Boolean. New input histories need the new implementation; no backwards-read guarantee is made for 0.16 executables.

### Read-only strategy comparison

During a live race, **Strategy** opens a bounded comparison for the selected running managed driver. The existing `RaceForecaster` evaluates the current plan, the next safe-entry stop when available, and a two-lap extension when available. Each option shows an estimated remaining-time range, relative gain/loss, risk band, minimum projected tread and fuel margin. The panel also states the safe-entry lap, estimated pit-loss/rejoin range, model version, observation timestamp and current-condition assumptions. It predicts neither incidents nor exact finishing position and exposes no rival-private plan.

The comparison is computed only when the player opens the panel or presses **Refresh estimate**. Ordinary 5 Hz screen refreshes never invoke it. The application query returns a detached copy; the popup receives no simulation, car, inventory, command adapter or scheduler reference. Opening, closing or refreshing the panel issues no command, does not claim ownership, does not pause or resume the race, does not change playback speed, and does not consume gameplay randomness. Race shortcuts are suppressed while the popup has focus. There is deliberately no Apply/Approve action.

## Implementation boundaries

| Module | Responsibility |
|---|---|
| `scripts/ui/race_weekend/minimal/workspace.gd` | Native Minimal composition, focus/input, selection, bounded feedback, displayed save status, 5 Hz ordinary refresh and explicit strategy-popup lifecycle |
| `scripts/application/minimal/weekend_query.gd` | Detached Minimal read models and the player/race-only on-demand strategy comparison query |
| `scripts/ui/race_weekend/minimal/strategy_comparison.gd` | Stable native read-only rendering of one detached forecaster result; no command or simulation reference |
| `scripts/application/minimal/controls.gd` and `lifecycle.gd` | Narrow recorded command adapter, availability reasons, stage actions and finite-stock defaults |
| `scripts/application/minimal/timing.gd` | Pure public classification and basic state strings |
| `scripts/application/minimal/readout.gd` and `context.gd` | Detached player-car projection and derived read-only context |
| `scripts/ui/race_weekend/minimal/driver_card.gd` | Persistent read-only native condition cards |
| `scripts/ui/race_weekend/minimal/style.gd` | Adapter to shared `GameTheme` chrome; `CircuitPalette` retains illustrated-map ink |
| `PracticeRaceSim` / `PracticeEvidence` | Actual running, practice mode semantics, clean-sample and persistence invariants |
| `RaceSessionRunner` and application lifecycle | Authoritative scheduling and phase autosaves independent of widget refresh |
| `main.gd` / `App` / `SettingsView` | Minimal default, validated/persisted interface preference, composition routing, simplified setup/menu and existing save/continue |

The Minimal workspace directly extends VBoxContainer. It does not inherit or hide the Advanced panel tree. TrackCanvas observes detached visual frames from the same session; there is no second simulation or animation-only car state. The ordinary refresh path captures timing/cards only; forecast computation stays behind explicit Strategy open/refresh intent. Timing items follow the frozen entry field (twelve cars in the shipped default roster), retain stable driver identities and move on ranking changes; they are not rebound to rank slots. Reordering waits while the pointer is held. The selected driver remains pinned. Text updates only when data changes. Open native dropdown choices are not reset by periodic refresh. Engine choices are pinned to their opening driver/phase; a driver or phase change closes the stale popup.

Advanced composition is separate and mounts its own view handle over the same application-owned live session. Changing the saved preference does not hot-swap widgets beneath a focused command; it takes effect on the next weekend-screen composition. Native architecture tests verify that mounting Engineering and Race Director preserves the complete weekend/RNG fingerprint.

## Explicit exclusions

Minimal adds no strategy-plan editing/approval, automatic recommendations, programme dashboards, component engineering, telemetry charts, radio/event feed, replay browser, scenario authoring, notebook, race-story UI, tutorial overlay, campaign settlement or expanded racing features. Those are not silently instantiated by this mode. The optional Advanced interface exposes retained specialist workspaces through their existing contracts; this preference milestone does not redesign, rebalance or certify them. The only Minimal strategy surface is the bounded read-only current-condition comparison described above. Underlying data and simulation continue; interface selection adds no sporting behavior or persistence state to the weekend checkpoint.

Desktop mouse/keyboard and the documented resolutions/text scales are the acceptance target. Actual enjoyment, broad wet/endurance balance, controller/screen-reader behavior, mobile layout, translations, extreme scaling and human comparison of Minimal versus Advanced require separate testing.

## Native implementation references

The implementation uses Godot's standard Control, Tree and OptionButton behavior. In particular, programmatic pressed-state refresh uses `set_pressed_no_signal`, staged settings use native OptionButton focus/navigation, and popup keyboard input must remain independent of race shortcuts.

- Godot 4.7 BaseButton: https://docs.godotengine.org/en/4.7/classes/class_basebutton.html
- Godot 4.7 OptionButton: https://docs.godotengine.org/en/4.7/classes/class_optionbutton.html
- Godot 4.7 PopupMenu: https://docs.godotengine.org/en/4.7/classes/class_popupmenu.html
- Godot keyboard/controller UI focus: https://docs.godotengine.org/en/4.5/tutorials/ui/gui_navigation.html

These are implementation references, not evidence of human usability. Executed acceptance is documented separately.
