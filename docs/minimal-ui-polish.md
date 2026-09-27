# Minimal UI foundations — 0.17.1

## Scope

Continue PR #16 from `d0ac9eac30eac352e43f359d73890e2f4f653a9d` (tree `3f7374068e2bc28848ada408e50048f482044c39`). This is a native Godot presentation pass. The five driver actions and the existing session flow are unchanged. No simulation/domain/service file is changed by this pass.

The toolbar separates session identity/clock from playback and the single phase action. The timing tower, race and pitwall remain fixed regions. Read-only driver cards occupy a bottom row; actions stay in the right rail. Advanced workspaces are not reintroduced.

## Data and interaction contracts

- Timing uses the actual practice samples, qualifying bests, starting grid, or race standings according to phase. Millisecond rounding carries correctly over a minute. A valid timed lap remains visible if its driver later retires. Empty times stay `—`; final gaps use measured finish timestamps and completed laps. Live second gaps retain `~`.
- Tower items belong to drivers, not ranking slots. Reordering moves existing items, retains selected identity and waits during a held pointer. Rivals cannot retarget commands. Full two-digit positions fit.
- Both cards read the actual fitted set, never the planned replacement. Tread is the minimum across the four wheels, not a potentially misleading average. Temperature is labelled as an average. Punctures and low tread identify the affected wheel. No synchronization, fitting, repair, forecast service or random draw occurs during presentation.
- Fuel remains lap-equivalent units. The small race finish margin is a current-rate estimate, labelled `~`, excluding future mode changes, incidents and traffic. It stops projecting after finish/retirement. Mechanical condition and aggregate damage stay separate; no invented component diagnosis, litres, kilograms or driver psychology.
- Cards are information only. Clicking them performs no selection, action or navigation. The pitwall selection is reflected visually; changing a selected driver does not change their teammate's data.
- Engine popup choices retain keyboard focus across refresh and are pinned to the opening driver/phase. Changing either closes the stale popup. No accidental command is transferred to the newly selected driver.

## Visual foundation

Isolated graphite/mint tokens cover normal, hover, selected, focus and disabled native controls. Tree hover no longer inherits a pale legacy background. The phase action has the only filled primary treatment. Cards use restrained identity badges, explicit selected text and redundant tread/condition meters. Compact windows omit only the decorative meters; all values and units remain.

Desktop profiles are 1440×900 and 1100×720, each with 100%, 115% and 130% text. Compact density changes spacing rather than reducing the chosen text scale. Long command acknowledgements are bounded to one line in compact mode, with full text in their tooltip; essential current state remains in the tower/cards. Phase guidance is shortened and shares the same space rather than stacking below receipts. Live resize updates density and preserves controls, item identities and selection.

## Verification

The existing required minimal suites are extended, not bypassed. Their runner registration is unchanged, so full CI still executes all prior domain, native, scenario, replay and performance suites. The precise executed results for the shipped tree are recorded in the handoff and PR; do not treat the earlier 0.17.0 counts as 0.17.1 results.

Development reproductions found clipped two-digit positions, overflow of the bottom row at enlarged text, a full-field fit failure, inconsistent primary-button disabled padding and queued resize refresh after a view left the scene tree. The repairs retain complete labels and all twelve rows. New checks cover all cards/units/notes at every profile, every compact phase, native timing click and reorder, a held pointer, popup driver/phase changes, live values, read-only card clicks and same-instance resizing.

The separate physical weekend journey starts a new Pinecrest weekend with six race laps, dry conditions, calm incidents and seed 7314. It issues real native session/driver commands and checks card values through practice, qualifying, formation, lights, an actual pit stop, final classification and production archive restore. Synthetic boundary fixtures are explicitly separated from that lifecycle evidence.

## Executed clean-copy checks

The final targeted run passed all eight suites after a fresh import, with isolated user data and the existing runner's script-error guard. **1,313 behavioral assertions** passed, plus **125 production script loads**. The minimal subsets are **394 checks and 27 actual PNG captures** (18 layout/input, nine physical-journey). These are not additional counts on top of the total.

| Suite | Passed checks | Native captures |
|---|---:|---:|
| Minimal commands, readouts and timing | 80 | — |
| Minimal layout and native input | 232 | 18 |
| Full native weekend journey | 82 | 9 |
| Retained general domain | 706 | — |
| Retained practice / Director / replay | 78 / 76 / 59 | — |
| Production script loads (separate) | 125 | — |

The journey executed **14,609 production fixed steps**, including actual practice/qualifying measurements, physical returns, formation, lights, fitting/service/exit, both drivers finishing and production archive restore. No script/parse/runtime error markers occurred in the final logs. Xvfb's unsupported VSync warning is an environment limitation, not a game exception.

Environment: Godot 4.7.2 Standard (`ed1daf0bf`), Linux, GL Compatibility, Mesa llvmpipe, Xvfb, Dummy audio, `LP_NUM_THREADS=2`. Clean-copy run elapsed time was 322.5 seconds; this is verification duration, not a player-device frame-rate measurement. Runtime and test files were frozen for this run; subsequent changes only record these results in documentation.

**The full historical corpus was not rerun locally.** The unchanged complete runner remains the hosted merge gate. Baseline PR run #302 passed on 0.17.0; it is not evidence that the new head passed. The current PR reports the new head's hosted status separately.

## Implementation references

Godot's native TreeItem identity/reordering and OptionButton popup contracts informed the implementation. Microsoft's text/contrast guidance informed the review of text scaling, state distinction and redundant numeric labels; this is not an accessibility certification or a claim to meet every guideline.

- https://docs.godotengine.org/en/stable/classes/class_treeitem.html
- https://docs.godotengine.org/en/stable/classes/class_tree.html
- https://docs.godotengine.org/en/stable/classes/class_optionbutton.html
- https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101
- https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/102

## Remaining acceptance

Automated native checks establish exercised wiring/layout behavior, not human approachability or enjoyment. Windows/exported launch, actual DPI, controller/screen-reader use, translations, text above 130%, broader circuits/weather/endurance and representative-device performance still require validation. No full physics recalibration or universal frame-rate claim is made.
