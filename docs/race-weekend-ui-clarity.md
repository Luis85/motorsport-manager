# Race Weekend — UI clarity and interaction polish

Research and implementation brief · 26 September 2026 · application 0.15.1

## Purpose and scope

Make the existing native race weekend easier to operate without reducing its strategic depth. This increment builds on Strategic Duels at `6df361c2bd3d0983746007b262e5d096cd06297b` (tree `b73f953a2b25d06f1dbafa351dbfc9b094794d6b`), not a replacement web prototype. PR #13 was merged during this pass; the new branch is based on main `330e32a7d01194b028607949bbc79f703623124e`, which has that same source tree. The working baseline was recovered from the published source artifact and its Git tree reproduced locally. Native screenshots from that exact revision informed the audit.

The central player task is **understand the situation → choose an intention → compare consequences → explicitly authorize one driver → follow the outcome**. Exploration must not issue orders. A receipt must not look like an unfinished form. Looking at an estimate must not imply accepting its assumptions or giving an engineer execution authority.

Research here means public-source research, a source-code/interaction audit, inspection of native captures, and automated native regression tests. It does **not** mean interviews, representative player playtests, measured enjoyment, or a claim of universal accessibility. The player needs below are hypotheses derived from the task and guidance, to be validated with people.

## Research findings and design implications

### 1. Reduce competing decisions, not available depth

Nielsen Norman Group recommends placing frequent/core choices up front and giving secondary options a clear, shallow route. Its distinction between progressive and staged disclosure is important: interdependent choices should remain together, rather than becoming an elaborate wizard [1].

**Application:** intention, rival, replacement set, timing and authority remain in one editable plan. Reserve editing and contingencies have one disclosure level, with their current values summarized even while collapsed. Only comparison/approval and subsequent follow-up become separate presentation states. Going back reuses the same controls and draft, rather than reconstructing a competing form.

This is not a claim that all scrolling is bad. A narrow pit-wall inspector cannot show every field, both drivers, time controls and the circuit simultaneously at enlarged text. Fixed actions and a clearly named **Full view** are preferable to shrinking controls or hiding critical consent.

### 2. The next action should be unambiguous

GOV.UK recommends descriptive action labels and avoiding competing primary buttons [2]. Xbox's UI-context guidance likewise calls for labels that communicate purpose and consequence before interaction [3].

**Application:** Plan has **Compare options** as its primary action. Review has **Approve MER/MOR · advice only/pit tactic**, with editing and refreshing secondary when the captured comparison is usable. An approved record moves to Follow the outcome and stops presenting duplicate approval. A fixed explanation accompanies the relevant action; it is not available only on hover.

**Keep** becomes **Keep plan** in both compact driver cards and the decision queue. **Expand/Collapse** becomes **Widen/Narrow**; **Focus** becomes **Full view**. These distinguish resizing from a task workspace without changing their underlying routes.

### 3. Understand permission and execution as separate facts

Status visibility, recognition rather than recall, and error prevention are core usability heuristics [4]. Xbox guidance emphasizes review before potentially harmful actions and clear descriptions of errors and remedies [5].

**Application:** advice-only text says existing ownership and orders remain unchanged. Delegation explicitly concerns pit timing for one tactic, not other control channels. Review identifies the named driver and rival, replacement set, window, reserves and contingency choices. Follow-up distinguishes what was approved from the **current** pit owner and retains the authoritative event reason.

Ending a tactic is not cancelling a physical stop. A native confirmation explains that any accepted stop stays valid and directs the player to ordinary pit service before entry when cancellation is still possible. The safe choice has initial focus. Confirmation pins driver, tactical revision, plan identity and the unapplied draft; it cannot silently operate on a newer state. Resetting an unapplied draft receives similar protection and does not rewrite the active record or the teammate's choices.

### 4. Make uncertainty usable without disguising it

The game is a strategy decision system, not an omniscient prediction display. The official Golden Lap material is useful as a genre reference for management and race-day decisions, not evidence that a specific interface improves comprehension [6]. Frontier's F1 Manager strategy-guide search extract describes preparation, alternative strategies and weather considerations; full-page access returned HTTP 403, so it was not treated as a completed competitor usability review [7].

**Application:** the existing forecast calculation is unchanged. A captured summary describes the selected tactic as estimated faster/slower than the current plan; three separate native cards retain remaining-time estimates, ranges and risk. Pit loss, warm-up, queue exposure, conditional rival responses and assumptions remain readable below. No probability, guaranteed position, hidden rival plan or manufactured performance gain is introduced. A stale or unavailable comparison cannot enable approval.

A successful end-of-stop receipt is not automatically a tactical victory. Existing physical pit-cycle evaluation, replay and notebook evidence remain authoritative. This increment does not alter their balance findings.

### 5. Navigation should predict the destination

Xbox navigation guidance supports consistent routes, logical focus order and multiple ways to find complex content [8]. Game Accessibility Guidelines also recommends avoiding unnecessary menu depth on entry [9].

**Application:** Find remains a read-only destination picker, not an executable command palette. It now describes the selected destination before opening, has an explicit Clear action and a helpful empty state. Exact-name matching remains authoritative, including Practice. The Tactical evidence result now opens the promised reading dialog rather than landing on the tactics editor. Closing that reader returns to Find. Existing sidebar/topic routes, driver menus and the guide remain available.

The interface does not automatically pause or change speed when a panel, search result, disclosure, comparison or confirmation opens. Time remains visibly controlled by the existing session header. Automatic interruption would change the established game contract, so it was intentionally not introduced during a UI pass.

### 6. Keyboard focus is interaction state

Xbox focus and navigation guidance treats perceivable, predictable focus as essential [8,10]. W3C's Focus Not Obscured criterion is a useful transferable benchmark for sticky elements, but is a web criterion rather than a native-game certification [11]. Godot provides focus navigation and scroll-to-control APIs, with layout timing constraints for revealing newly shown controls [12,13].

**Application:** Compare moves focus to captured evidence, not to Approve. Page Up/Down, Home and End read the comparison. Editing returns to a real visible field; an invalid window returns to Latest lap. Collapsing reserves moves focus to the disclosure button before hiding children. Confirmation cancellation and full-workspace return restore their invokers.

The audit and first native run also exposed a shared annotation problem: the accessibility pass downgraded deliberately keyboard-focusable labels to accessibility-only focus and could replace a SpinBox editor's explicit name with an empty tooltip. The helper now preserves these explicitly configured behaviors. Focused reading areas have a visible outline. Metadata is not a substitute for actual assistive-technology testing.

### 7. Readability must survive states, scaling and dialogs

Xbox text and contrast guidelines cover more than a font-size preference: they include readable defaults, scaling, spacing, contrast and consistency across overlays [14,15]. Clear language reduces unnecessary interpretation [16]. W3C's target-size guidance provides another transferable web benchmark, not a direct native-pixel compliance claim [17].

**Application:** preserve the game's cream/green/gold design system and established primary, hover, pressed and disabled palettes; use sentence-case task labels and nearby units. New controls use the existing 32-pixel base minimum and 100/115/130% scaling. Confirmations inherit the selected text scale. Fixed actions and field visibility are checked at 1440×900 and 1100×720.

**Remaining gap:** the current game's defaults and 130% upper scale do not establish XAG 101's full recommended text-size and 200% scaling coverage. Actual Windows DPI, exported builds, screen readers, controllers, color-vision scenarios and representative low-spec devices remain separate acceptance gates. This is deliberately not labelled WCAG- or XAG-compliant.

### 8. Corrective feedback must say what to change

GOV.UK's error-message guidance emphasizes clear errors connected to the input [18]. A generic disabled button is insufficient when the player must infer which of several conditions blocked it.

**Application:** malformed tactical windows stay in Plan, retain the entered values and focus the appropriate field with its label. An inverted window explicitly says that the latest lap must be at or after the earliest lap. Review exposes reasons for an unavailable comparison, changed circumstances, retained active tactic or ended session near the fixed controls. The domain still performs its own validation, revision and freshness checks. Interface safeguards supplement that boundary; they do not replace it.

## Audit and disposition

| Priority | Observed friction / risk | Implemented response | Verification target |
|---|---|---|---|
| High | One long tactical form mixes drafting, evidence and approved status | Plan, Review and Follow-up presentations over the same controls | Draft identity, no duplicate approval, correct receipt |
| High | An end action can be mistaken for physical-stop cancellation | Explicit native confirmation, consequence copy, pinned revision | Default Enter/Escape safety; competing accepted stop survives |
| High | Guidance can overwrite deliberately configured keyboard/semantic behavior | Preserve explicit focus and field names | Real focus owner, Page Down, visible outline, stable names |
| High | Disabled approval requires searching elsewhere for a reason | Fixed explanatory text with stage-appropriate primary action | Reachability and clipping checks at all retained profiles |
| Medium | Advanced limits compete with core choices | Single disclosure and always-present settings summary | Collapse focus, retained values, reachable fields |
| Medium | Search can promise evidence but open an editor | Correct evidence route and preview | Exact result, native reader, return focus, no command |
| High | First Find popup can calculate a wrapped label at one-pixel width and extend below the window | Seed a valid preview width before the first native minimum-size pass | Actual window, preview and footer bounds at all six profiles |
| Medium | Empty search is a dead end unless text is manually removed | Clear action and meaningful empty state | No false result; query recovery and focus |
| Medium | Keep / Expand / Focus require interpretation | Keep plan / Widen / Full view | Existing navigation and full-workspace regression suites |
| Medium | Dense estimate paragraph is hard to compare | Separated option cards, explicit selected tactic and uncertainty | Alternatives and assumptions retained, captured target stable |

The initial review also checked the session/time header, driver cards, decision queue, narrow/full inspector composition, existing guide and results routes. These already have substantial prior implementation. They are retained rather than being unnecessarily redesigned. The broad existing native and domain regression matrix remains required.

## Interaction contract

**Drafting:** opening Tactics, changing drivers or using Full view does not approve a plan. Each driver's unapplied values remain separate. The extension count appears only for an extension; the rival-first contingency is relevant only to an undercut. Displaying a fitted, unusable or wet-weather set labels that condition; the forecast and command boundary still reject an unsuitable choice.

**Reviewing:** Compare validates the form and then captures the same existing forecast. Back edits the same draft; any field change invalidates its captured review. Refresh replaces estimates without issuing a command. Review is not a promise of execution. Ordinary plans, physical pit commitments and engine/pace ownership continue to operate under the existing rules.

**Approving:** the primary button names the driver and authorization type. Only a current, available comparison with a valid draft and permitted record state can approve. Successful approval clears that driver's edited marker, shows its receipt and leaves no repeat-approval affordance. The command boundary remains the final arbiter.

**Following up:** show the authoritative status and reason, original consent and current owner. Plan evidence remains available throughout; the two-car comparison remains observational and does not use unapplied tactical drafts. Ending a tactic requires separate explicit confirmation. Reset changes only unapplied choices.

**Leaving:** existing safe-exit handling includes edited tactical drafts. Disclosure, reading, search and full-view navigation never apply or discard them. Modal safety checks do not give permission to alter time controls.

## Verification and next human acceptance gate

The added `tests/ui_clarity_tests.gd` exercises production native controls and is registered in `scripts/verify.py`; it is not an optional screenshot-only demo. Coverage includes six viewport/text profiles, fixed action geometry with clipping ancestors, Plan/Review/Follow-up transitions, per-field semantic names, focus, disclosure, comparison non-mutation, confirmation safety, invalid windows, stale comparison, first-popup bounds including preview and footer, empty search, exact evidence routing and competing commands. The existing tactical suite retains physical entry/service/exit and full-workspace-return coverage, adapted to deliberate new confirmation and disclosure interactions.

Use the exact-head `reports/verification.json`, `reports/ui-clarity.json` and native PNGs for execution results. The research document defines intent and coverage; it must not be used as evidence that an unrun test passed. Earlier PR13's 4,573 checks and 366 screenshots belong to the baseline, not this increment.

Next, run moderated tasks with both first-time and experienced management-game players: create an advice-only tactic; explain who may pit; compare and revise a tactic; find a blocked approval reason; end a tactic after an order; locate its outcome; return to the live race. Observe wrong-driver actions, unexpected authority, lost drafts, mistaken cancellations, time-to-first-correct-action, and unaided explanations. Treat comprehension and control errors as release blockers. Record enjoyment separately from task speed; easier navigation does not itself prove stronger gameplay.

No production domain/service, race physics, AI behavior, forecast model, save schema or replay model change is intended. Application patch numbering identifies UI polish, not a new simulation model.

## Continuation: compact comparison regression

The first complete hosted pass on head `4d660d5b940667b4c3450fc6c9fa973f3b265d95` reached `rivals-ui` and failed the retained assertion that all three ordinary strategy alternatives fit without scrolling at 1100×720 / 130% text (run `36256853999`). Earlier focused tactical passes did not establish whole-shell correctness.

The recovered native screenshot and a local reproduction showed six ordinary driver actions requiring 532 pixels in a 520-pixel row. The clearer **Keep plan** label tipped Recovery onto a second row. That extra 46 pixels reduced the inspector's reading area, clipping the third alternative. This is the expected wrapping behavior of Godot's HFlowContainer [19], not a forecast or simulation failure.

The compact driver-card builder now clones each action style once and reduces only left/right content padding from eight to four pixels. Text, full labels, focus outlines, state colors, the five-pixel gaps and the scaled minimum target height are preserved. All six ordinary direct actions remain available; Weather and Recovery are not buried in More. Additional or unusually long alert actions may still wrap normally rather than being truncated.

The unchanged three-alternative assertion passes in the focused reproduction. Thirteen extra assertions check complete driver-action labels, retained text size and target height across all six profiles, and reuse of the same style resources during refresh. The focused rivals suite contains 60 checks / 11 captures. Use the final exact-source full-run report for integrated completion; this subsection does not turn a partial or superseded run into a full pass.

The resumed verification also retains receipt keyboard scrolling, safe confirmation, first-popup bounds, guide traversal and the post-service full-view return tests. No domain/service bytes or race models are changed by this repair.

## Sources and evidence limits

Accessed 26 September 2026. Guidance is paraphrased and applied to this product; no source establishes that these particular changes have succeeded with human players.

1. Nielsen Norman Group — [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/).
2. GOV.UK Design System — [Button](https://design-system.service.gov.uk/components/button/).
3. Microsoft — [XAG 114: UI context](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/114).
4. Nielsen Norman Group — [10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/).
5. Microsoft — [XAG 115: Errors and destructive actions](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/115).
6. Funselektor — [Golden Lap](https://www.funselektor.com/goldenlap). Official product positioning only; not a comparative playtest.
7. Frontier — [F1 Manager 2024 Race Strategy Guide](https://www.f1manager.com/2024/news/race-strategy-guide). Search extract consulted; direct page returned 403. The beginner guide also returned 403 and was not relied on for specific interface claims.
8. Microsoft — [XAG 112: UI navigation](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112).
9. Game Accessibility Guidelines — [Avoid unnecessary menu levels](https://gameaccessibilityguidelines.com/allow-the-game-to-be-started-without-the-need-to-navigate-through-multiple-levels-of-menus/).
10. Microsoft — [XAG 113: UI focus](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/113).
11. W3C — [Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).
12. Godot Engine — [Keyboard/controller navigation and focus](https://docs.godotengine.org/en/stable/tutorials/ui/gui_navigation.html).
13. Godot Engine — [ScrollContainer](https://docs.godotengine.org/en/stable/classes/class_scrollcontainer.html).
14. Microsoft — [XAG 101: Text display](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/101).
15. Microsoft — [XAG 102: Contrast](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/102).
16. Game Accessibility Guidelines — [Use simple clear language](https://gameaccessibilityguidelines.com/use-simple-clear-language/).
17. W3C — [Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
18. GOV.UK Design System — [Error message](https://design-system.service.gov.uk/components/error-message/).
19. Godot Engine — [HFlowContainer](https://docs.godotengine.org/en/stable/classes/class_hflowcontainer.html). Native wrapping behavior; the numerical layout measurements above are from this project, not from the documentation.
