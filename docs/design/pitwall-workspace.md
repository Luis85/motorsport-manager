# Native pit-wall workspace specification — 0.11

## Purpose and visual authority

Operate the two-car race through Observe → interpret → compare → commit → watch → review. Preserve native Godot, flat dot cars and the established warm paper / racing-green / brass palette. This is a refinement of the merged task-based workspace, not another app shell, web prototype or editor redesign.

## Observed audit and implemented correction

Baseline captures and the revised captures come from the real application. Tests use disclosed fixture states where necessary; they are not human playtests.

| Finding / reproduction | Impact and cause | Correction / verification |
|---|---|---|
| Open Strategy at 1100×720, 130% text (`baseline-compare-1100-130.png`). The top has separate title, file controls and session status; Practice introduces another navigation tier. | Much of the first comparison is below the fold; two alternative summaries are hidden. Duplicate information and nested topic rows consume task space. | One stable status/time header; utilities in Weekend; Compare/Plan/Control/Practice share one row. `rivals-1100x720-text130.png` and real mouse tests require all three complete comparison rows within clipping ancestors. |
| Read a live driver card at baseline (`baseline-race-1440.png`). Ownership emphasized pits but not the current resource instruction. | A player cannot establish pace ownership from the main summary. | Current Conserve/Balanced/Push plus You/Engineer; engine override is explicit; Pits owner appears with the next stop. Details retains both owners and complete issue evidence. |
| Open a long reading dialog, including the new Rival field, with the paper theme. | Native RichTextLabel uses `default_color`, but the shared theme only configured ordinary `font_color`; actual text appeared white on paper. This was observed during native inspection, not inferred from boundary tests. | Set RichTextLabel default/selected text and selection background centrally. Test actual rich-text color against the actual dialog stylebox (4.5:1 design reference). Existing editor/dialog tests remain in the full suite. |
| Click Weekend, then Escape / try keyboard focus. | MenuButton's default accessibility-only focus mode does not supply the intended ordinary keyboard return target. | Explicit FOCUS_ALL, native popup handling and deferred return focus; actual mouse/Escape regression. |
| Select a rival and open Wheels or Drive. | Old diagnostic views expose exact private telemetry. This becomes misleading alongside explicitly limited rival-style information. | New-model public inspection projection; hide private controls while retaining public profile/compound/measured laps. Switching back restores own-car controls and drafts. Legacy presentation stays compatible. |
| Repeatedly refresh mature Practice/Recovery/Debrief without new journal evidence. | Both inherited refresh layers rebuilt entire report prefixes unnecessarily. | Cache evidence text by journal sequence, retain the existing replace-not-append prefix contract, and measure identical before/after populated workloads. |

The initial temporary staging harness reused a 130% user preference across standalone suites; this produced four misleading default-size compact failures. A unique application name per run restored proper isolation. No behavioral assertion was deleted to obtain a pass. The authoritative verifier already uses a fresh copy and isolated application name. The first full revised run also exposed an inherited guide test that assumed Practice was the final step. The test now finds the same named step, preserving its no-speed-change assertion after the rival guide was appended.

## Workspace composition

**Header:** circuit/preset/seed, phase/lap/time, flag/conditions, explicit session approval where applicable, pause, speed, Weekend. The header stays outside scrolling content. Navigation and opening menus never take control of time. In a live race no disabled session-approval button consumes the header.

**Primary navigation:** Watch / Strategy / Car / Team / Conditions / Review. Messages and Find are utility actions on the same stable strip, visually separated from tasks. No permanent new row for rivals. Context remains associated with the inspected player driver; relevant drafts and focus return survive opening/closing details.

**Race area:** dominant circuit, compact timing tower in Watch, native camera controls. At 1100×720 with enlarged text, opening detail temporarily hides the tower, retaining the circuit and both driver cards. This inherited accommodation is explicit, not claimed simultaneous full-width support.

**Persistent driver cards:** identity/position, current intent and owner, fitted tyre/limiting tread, estimated finish fuel in lap-equivalent units, next stop and pit owner, concise issue, named actions. Planned stock is not shown as fitted. Deadline text distinguishes simulated time, selected speed and paused state. The driver's name is a keyboard-accessible Details action for full evidence/secondary issues; hover is supplemental.

**Strategy:** Compare/Plan/Control/Practice share one topic row. Three stable alternatives show current/unapplied draft, stop and extension with estimated bands, relative difference and risk. Commit/draft/cancel areas stay fixed below scrollable explanation/form/history. Compact spacing removes redundant headers rather than shrinking body text. Full assumptions remain available through the existing explanation controls.

## Feature-location map

| Capability | Location |
|---|---|
| Pause, speed, session approvals | Fixed header |
| Save checkpoint, export race log, guide, main menu | Weekend native menu; original callback/safety contracts preserved |
| Live circuit, standings, camera | Watch / fixed camera row |
| Driver details, applicable Box/Keep/Fuel/Weather/Recovery | Each persistent named driver card |
| Strategy alternatives, approved plan, independent ownership | Strategy → Compare / Plan / Control |
| Optional run objective/set/setup/laps, Recall/End/notebook | Strategy → Practice; briefing shortcut; both-card session shortcuts |
| Driving modes, tyres/wheels, setup and telemetry | Car topics; rival selection shows public information instead of private fields |
| Cooperation, battle watch, shared pit box | Team topics |
| Public rival profiles and actual entries | Team → Battles → Rival field; Find “rival” |
| Weather, recovery, advanced surface lab | Conditions topics |
| Timing/radio/causal decision debrief | Review topics |
| Command acknowledgements/errors (last 50 for this view) | Messages beside Find |
| Search/browse any destination | Find / Ctrl+K |
| Editor tools and circuit library | Main menu; shared theme fixes only, tools unchanged |

## Interaction-state contracts

Native selected navigation remains different from keyboard focus. Normal, hover, pressed, toggled, focused and disabled theme states stay centralized in `UI` / `PitwallDesign`. Warning text accompanies color. Rich-text dialogs now explicitly use paper/ink colors, including selection. The design references do not constitute native-app accessibility certification.

Opening Weekend/Find/Details/Profile is observation. Ordinary tactical commands use the existing acknowledgements rather than extra confirmation modals. Retirement and leaving edited strategy drafts retain existing confirmations. Menu cancellation returns focus; closing contextual detail restores the invoker when still valid. Native text fields/pickers retain typing and navigation; global tactical/speed keys do not fire while a native picker or editing control owns focus. Existing Space pause semantics and modal routing remain.

No arbitrary timer can reorder a focused action or silently change its target. Rejected stale commands do not apply a replacement. Existing fixed controls are retained rather than rebuilt on each refresh. Driver selection never applies another driver's staged form.

## Text and reduced space

Supported regression targets: 1440×900 and 1100×720 at 100%, 115%, 130%; an additional 1920×1080/130% capture tests wide layout. Native controls and relevant dialogs scale, as before. Custom-drawn circuit labels and the editor do not acquire universal text scaling in this increment. No claim of 200%, mobile, screen-reader or controller completeness.

Long forms, inventories and reports may scroll, with no horizontal scrolling for core actions. All three default strategy comparison summaries are required to be wholly reachable before scrolling at supported sizes. Most short tactical targets remain at least the existing 32 native pixels before text scaling. Messages moved from the taller footer into spare primary-strip space; radio feedback remains a stable footer line.

## Task evidence and remaining human protocol

| Representative task | Baseline → revised effort (scripted paths, not participant times) |
|---|---|
| Read three Strategy alternatives at 1100×720/130% | Open Strategy + scroll the comparison → open Strategy; three complete rows visible. |
| Open Practice from live Watch | Strategy → Practice → same two activations, without the duplicate nested selector row. |
| Inspect current resource owner | Open detail → visible in each card; full owner details remain one named action away. |
| Retrieve an acknowledgement | Messages footer → Messages beside Find; one activation retained. |
| Save checkpoint | Direct Save → Weekend → Save checkpoint; one deliberate extra activation for a secondary utility, freeing permanent header space. |
| Inspect a rival tendency | No equivalent expanded profile → Team → Battles → Rival field, or Ctrl+K then search/Enter and Rival field. |

Automated tests cover real mouse/keyboard paths, explicit recipients, focus return, own/rival transitions, stale commands through existing suites and draft retention. They do not prove discoverability or enjoyment.

Exploratory human gate: recruit newcomers and experienced strategists separately, counterbalance baseline/revised dry and two-car/weather tasks, ask each to identify the next decision, name both owners, compare alternatives, keep a plan deliberately, retrieve a dismissed message, recover a stale proposal and return to Watch without losing a draft. Record activations, scrolls, missed other-car issues and explanations before/after the actual outcome. Include players with access needs. None of these participant sessions has been performed.
