# Minimal race weekend — 0.17.1

## Product decision

Restart the visible race UI rather than reorganizing the 0.16 Director. The normal experience is one toolbar above timing / race / selected-driver pitwall. No advanced panels are instantiated by this screen. Preserve the underlying model and its data for later increments.

### Visible contract

Toolbar: Menu, session identity, session clock or lap/flag, Pause, Play, speed (1/2/4/8/16), and a context-specific session button. In a live race the session button disappears. Finishing/formation states explain why it is disabled. Results offer New weekend.

Timing: position, three-letter driver code, best time or gap, and compact running state. Practice times come from actual practice samples, not `qual_best`. Qualifying uses actual flying laps. Live race gaps remain the existing distance/speed estimates and are explicitly prefixed `~`; final classification uses actual completion/time. Full names and basic running state are available on hover. Only the player's two rows can select the pitwall driver.

Race: existing TrackCanvas, fitted to the available rectangle, with actual car motion and start lights. Wheel zoom, middle-button pan, F to fit. Circuit labels follow the user's display preference. Engineering surface/racing-line overlays are not exposed. Rival car clicks cannot replace the selected managed driver.

Pitwall: two driver selectors, selected full name and running state, Send out, Box this lap, Push/Calm, Save/Standard/Power engine mode. A small receipt reports acceptance/rejection; phase guidance is bounded rather than allowed to push controls offscreen. Full explanatory text remains in tooltips. No graphs, setup editors, strategy drawers, or rival inspection. Tyre/fuel/car information is read-only in the bottom cards, not mixed into the controls.

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
| Results | New weekend | Return to circuit selection; final classification stays in timing until then |

Every user command is explicit and named. Display refresh, selection and preview do not claim control or consume simulation time. Explicit Start/Play hands qualifying, pit, pace and engine channels to the player; racecraft ownership is not broadened. Existing physical pit commitments remain valid. No artificial telemetry benefits, repaired wear, free tyre sets, or forced winners are added.

### Send out and tyre defaults

Practice sends two measured laps on the current setup, preserving the selected pace/engine modes. It uses the normal preview/revision/material/time validation and real run limits. Sound fitted practice stock can be reused. Qualifying sends one real flying-lap attempt with out/in laps and automatic return. Insufficient time or usable stock disables release with a reason. Neither action unpauses a deliberately paused session.

The adapter chooses only from the driver's real finite inventory. Observed wet conditions use suitable intermediate/wet stock. Dry qualifying prefers Soft; practice prefers Medium; race preparation/pits prefer Medium for shorter remaining distance and Hard above 15 laps, falling back to usable dry alternatives. This is a transparent baseline heuristic, **not an optimal strategy solver**. It does not read future weather or another driver's private state. Long-distance and changing-weather balance still need human validation.

### Box this lap

Practice and qualifying map to the existing physical recall: the unfinished measured lap is abandoned, completed laps remain, and the car travels back. Race calls bind a real replacement set and the current reachable gate, material key and timestamp. Past the safe current-lap entry, the button is disabled with an explicit explanation; it cannot secretly become a next-lap request. Duplicates and unavailable stock are rejected. Pit exit remains automatic; no extra Send out is required after race service.

### Pace and engine

Push/Calm toggle back to Normal on a second press. Engine modes are explicit. Practice now routes these commands through the existing validated/recorded parent command boundary. A live change marks the current sample as tainted. The original run baseline is retained; subsequent laps in mismatching modes cannot be counted as clean baseline evidence. The most recent explicit values survive garage return.

An optional validated `active.live_modes` pair records current values without rewriting the run baseline. Older runs without that pair retain the original exact-baseline invariant. Invalid, incomplete or car-mismatched values fail restoration. The optional `manual_modes` run-plan field must be Boolean. New input histories need the new implementation; no backwards-read guarantee is made for 0.16 executables.

## Implementation boundaries

| Module | Responsibility |
|---|---|
| `scripts/ui/race_weekend/minimal/workspace.gd` | Native composition, focus/input, selection, bounded feedback, phase autosave and 5 Hz text refresh |
| `controls.gd` | Narrow recorded command adapter, availability reasons, stage actions and finite-stock defaults |
| `timing.gd` | Pure public classification and basic state strings |
| `readout.gd` / `driver_card.gd` | Pure player-car projection and persistent read-only condition cards |
| `style.gd` | Isolated native theme; no editor palette migration |
| `PracticeRaceSim` / `PracticeEvidence` | Actual running, practice mode semantics, clean-sample and persistence invariants |
| `main.gd` / `App` | Minimal default, preference migration, simplified setup/menu, existing save/continue |

The workspace directly extends VBoxContainer. It does not inherit the old multi-workspace UI. TrackCanvas observes the same simulation; there is no second simulation or animation-only car state. The 12 timing items have stable driver identities and move on ranking changes; they are not rebound to rank slots. Reordering waits while the pointer is held. The selected driver remains pinned. Text updates only when data changes. Open native dropdown choices are not reset by periodic refresh. Engine choices are pinned to their opening driver/phase; a driver or phase change closes the stale popup. Source modules and historical UI tests remain intact for later deliberate reuse, not as hidden player-facing tabs.

## Explicit exclusions

No strategy plans, forecasts, programme dashboards, component engineering, telemetry charts, radio/event feed, replay browser, scenario authoring, notebook, race-story UI, tutorial overlay, campaign settlement or expanded racing features are added. Underlying data and simulation continue; this increment only changes the specific practice/command/evidence behavior described above. It does **not** claim that every retained simulation subsystem has been comprehensively reworked or calibrated.

Desktop mouse/keyboard and the documented resolutions/text scales are the acceptance target. Actual enjoyment, broad wet/endurance balance, controller/screen-reader behavior, mobile layout, translations, and extreme scaling require separate testing.

## Native implementation references

The implementation uses Godot's standard Control, Tree and OptionButton behavior. In particular, programmatic pressed-state refresh uses `set_pressed_no_signal`, and popup keyboard input must remain independent of race shortcuts.

- Godot 4.7 BaseButton: https://docs.godotengine.org/en/4.7/classes/class_basebutton.html
- Godot 4.7 PopupMenu: https://docs.godotengine.org/en/4.7/classes/class_popupmenu.html
- Godot keyboard/controller UI focus: https://docs.godotengine.org/en/4.5/tutorials/ui/gui_navigation.html

These are implementation references, not evidence of human usability. Executed acceptance is documented separately.
