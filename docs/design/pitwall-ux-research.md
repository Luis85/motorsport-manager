# Pit-wall UX overhaul — research and decision record

Research date: 24 September 2026. Implementation baseline: `edc87bcf3c57aa28e5221c8333bd84a09451a2a3` / native Godot 0.8.0. Scope: native weekend interface, shared visual language and presentation preferences. No replacement simulation or browser runtime.

## Evidence and method

This is desk research plus a source-level and native-screen inspection, not a representative player study. Sources below are the original publishers of the guidance: Microsoft Xbox Accessibility Guidelines, W3C Understanding documents, IBM Carbon, Nielsen Norman Group and Godot documentation. Their patterns are translated into this desktop game's constraints; their websites, components, compliance claims and CSS measurements are not inherited by using similar-looking native widgets.

The supplied Race Weekend GDD §§17–19 requires a circuit-first workspace, both drivers' persistent actions, explicit intent ownership, observational selection, unapplied drafts, recoverable explanations, keyboard access and player-owned time. These are project requirements. The research informs **how** to express them; it does not justify changing physical pit rules or automatically pausing on an alert. The older HTML prototypes are visual context, not the implementation target.

The baseline source archive was matched to Git tree `f73673fdd7988b1f63d580a084def647b0f6612a`. Current-run native captures include `compact-watch.png`, `compact-settings.png` and `compact-scenarios.png` under the separate audit workspace. A long baseline UI run exceeded the local command timeout; its partial captures are not reported as a passing suite.

## Current-flow inspection

1. **Choose a scenario — usable, but visually repetitive.** Launch actions fit at 1100×720; titles, explanatory copy and similar rectangular actions compete for attention. Keep the finite scenario list and explicit launch, rather than adding a mandatory wizard.
2. **Watch both cars — reachable, weak hierarchy.** The map has sufficient room and both command rows are fixed. However, ten peer topic buttons, a disabled phase button and five lines of similarly sized card text flatten the hierarchy. Driver identity and position are less prominent than generic forecast prose. This is an inspection finding, not a measured failure rate.
3. **Read and change settings — clear transaction, missing reading preference.** Apply and Back are visible and edits are staged. Dot size and motion have options, but text has none. Add a narrowly labeled pit-wall text preference with validated persistence; do not claim that it scales the custom-drawn circuit labels or the editor.
4. **Draft, compare and approve — code-inspected risks.** The existing controls retain identity and explicit targets. Comparison alternatives are formatted as a long paragraph; applied and unapplied states are too similar. There is no dedicated warning before leaving user-edited strategy drafts. Native interaction tests and new captures must validate the replacement, not just this code inspection.

## Research synthesis and decisions

### 1. Reveal complexity by task, not by arbitrary widget count

NNG's progressive-disclosure guidance [S01] recommends making common work immediately available and providing recognizable access to secondary work. It also warns that choosing the split matters. This does not mean hiding every control, imposing a universal maximum number of choices, or forcing sequential steps for information that must be compared.

**Application:** Watch, Strategy, Car, Team, Conditions and Review become the primary task groups. Car exposes Driving, Tyres and Setup together; Review exposes Telemetry, Radio and Debrief. A surface laboratory is reachable through Conditions rather than competing with an urgent pit call. Both driver command rows stay outside that hierarchy. Every existing topic remains reachable with at most a group choice and a labeled topic choice. Existing direct driver Compare and Weather shortcuts remain.

### 2. Recognition remains the default; search is an accelerator

NNG's recognition/recall discussion [S02] supports visible context and meaningful choices rather than requiring users to remember commands. Search itself requires a query, so it cannot be the only way to navigate.

**Application:** add a visible Find view control with Ctrl+K, a browsable catalog and plain-language aliases such as fuel, wheels and pit box. It opens views only. It never executes a pit stop, approves a plan, changes delegation or retires a car. Empty results explain how to recover. Arrow/Enter interaction supplements ordinary selection and a labeled Open view action. Closing returns focus to a visible control.

### 3. Different visual roles need different emphasis

Carbon's button guidance [S03] differentiates high-emphasis primary actions from secondary and low-emphasis work. Its tabs guidance [S04] treats tabs as related categories in a context, with short labels and clear selection; it specifically cautions against splitting comparison work between tabs.

**Application:** task navigation uses a selected underline and contextual grouping, not the same filled styling as a binding command. Green filled controls identify execution within each separate driver task or approval area. Neutral controls navigate, inspect or retain a plan. The three forecast alternatives stay together as comparable rows. No inaccessible icon-only primary rail is introduced. Active, hover, focus and disabled are separate states; active is not inferred from color alone.

### 4. Density is not a reason to make important text tiny

XAG101 [S05] calls for readable and configurable text, preserved hierarchy and testing in the actual display context. Its broader recommendation includes scaling to 200%. It also distinguishes actual character height from nominal font size. Merely setting a Godot font size does not prove that guideline is satisfied.

**Application:** offer 100%, 115% and 130% **pit-wall text** as a bounded first implementation, with a visible reading sample and persistence. Increase text rather than globally magnifying the whole map. Native labels and controls reflow; optional analysis can scroll while primary actions remain fixed. The smaller supported range, custom-drawn circuit text and untested platform magnification remain explicit limitations, not hidden claims of full XAG101 coverage.

### 5. Legibility must survive all states

XAG102 [S06] discusses contrast for text and important visual elements, including distinct treatment of inactive UI. W3C hover/focus guidance [S07] calls for additional content to be dismissible, hoverable and persistent where applicable. Neither source makes an ordinary tooltip a sufficient home for critical information.

**Application:** audit configured text against its actual native surface and test normal, hover, selected, pressed, focused and disabled styles. Preserve the dark-green/paper/brass direction while separating muted labels from faint decoration. Put the latest important driver issue in the card itself and provide a labeled Details action. Full command feedback remains retrievable independently of transient footer text. F1 and keyboard focus supplement pointer tooltips. This is selected guidance applied to native UI, not WCAG certification.

### 6. Keyboard focus is a maintained state, not a side effect

XAG112 [S08] recommends consistent navigation; XAG113 [S09] focuses on visible and predictable focus. Godot's own navigation documentation [S10] notes that hidden controls can lose focus and that automatic neighbor inference may be unsuitable for complex layouts.

**Application:** keep stable driver command instances across telemetry updates, set explicit next/previous links within the small primary navigation group, focus the search field when opening Find, restore focus on dismissal, and move focus to a visible destination when changing groups. Background shortcuts must not act through a modal. Space retains the game's pause contract outside text editing and dialogs; Enter activates an explicitly focused command. Navigating must never silently issue a different driver's order.

### 7. Sticky actions are useful only when they do not obscure content

W3C's focus-not-obscured explanation [S11] addresses sticky regions that cover the focused target. Its target-size guidance [S12] defines a CSS-pixel web criterion with spacing exceptions, not a native-game measurement standard.

**Application:** maintain at least 32 logical-pixel primary button heights at the default scale, grow with text, and check actual clipping ancestors in native tests. Use separate content and action containers rather than drawing an action bar over the form. Larger-text inspection can surrender the optional timing tower before sacrificing either driver's primary actions. Do not label this a mobile or controller-complete interface.

### 8. Acknowledgement and error recovery should stay near the decision

Carbon notifications [S13] distinguishes inline task feedback from temporary nonmodal messages and advises making disappearing messages recoverable. XAG115 [S14] covers understandable errors and warnings before destructive consequences.

**Application:** preserve the command validator's actual explanation, keep the last acknowledgement accessible in a bounded local UI history, and distinguish accepted command from achieved race outcome. On leaving genuinely edited strategy drafts, explain that the active race checkpoint is separate from unapplied UI edits. Default to staying. Viewing history or showing a warning cannot pause, resume or mutate the race. Do not add a confirmation to every routine live command; that would increase latency and workload without making its meaning clearer.

### 9. Responsiveness must preserve the race

Godot custom-drawing guidance [S15] explains that drawing commands can be retained until invalidated; optimization guidance [S16] stresses identifying and measuring bottlenecks.

**Application:** reuse existing forecasts and retained controls; build navigation/search catalogs once; update comparison rows only on a new preview; cache visual state resources. Text sizing runs when a view or dialog is created, not in each simulation tick. Keep the prior road batching and paused-overlay invalidation. Compare equivalent fixed-step outcomes and run the existing observational performance diagnostic. Do not turn improved refresh timings into an unsupported whole-game frame-rate claim.

## Verification contracts

- All legacy topic routes, finite-stock commands, physical commitment rules and unmodified simulation suites remain.
- Both drivers' Compare/Box/Keep plan/Save fuel or session-appropriate alternatives remain reachable while any inspector scrolls.
- Six task groups expose all topics; Find is an alternative, never the only route. Querying and opening a view leave the authoritative snapshot unchanged.
- No focus or pointer refresh replaces a command's target. Modal dismissal restores a visible target. Enter and Space remain distinct.
- All three supported text settings are checked at the minimum window; normal text is also checked at 1280×720 and 1440×900.
- A user-edited draft is not silently applied or discarded through ordinary navigation; leaving the workspace warns before discarding it.
- Comparison data uses existing bounded estimates. Missing or unavailable alternatives are labeled, not replaced with invented numbers.
- Changes in text size, navigation, help, message history or colors do not consume race RNG or alter authoritative outcomes.

These are automated verification targets. Human task-completion, cognitive workload, screen-reader behavior, controller coverage, enjoyment and full accessibility conformance still require separate testing. A small usability round should ask participants to locate a tyre issue, state which driver an action targets, explain draft versus approved state, find a past rejection and recover after an interrupted plan.

## Source register

All consulted 24 September 2026. Paraphrases above are scoped to the listed guidance; implementation decisions are this project's synthesis.

- **S01** Nielsen Norman Group, *Progressive Disclosure*: https://www.nngroup.com/articles/progressive-disclosure/
- **S02** Nielsen Norman Group, *Memory Recognition and Recall in User Interfaces*: https://www.nngroup.com/articles/recognition-and-recall/
- **S03** IBM Carbon, *Button — Usage*: https://carbondesignsystem.com/components/button/usage/
- **S04** IBM Carbon, *Tabs — Usage*: https://carbondesignsystem.com/components/tabs/usage/
- **S05** Microsoft, *XAG101: Text display*: https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101
- **S06** Microsoft, *XAG102: Contrast*: https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/102
- **S07** W3C, *Understanding SC1.4.13: Content on Hover or Focus*: https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html
- **S08** Microsoft, *XAG112: UI navigation*: https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/112
- **S09** Microsoft, *XAG113: UI focus*: https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/113
- **S10** Godot, *Keyboard/Controller Navigation and Focus*: https://docs.godotengine.org/en/stable/tutorials/ui/gui_navigation.html
- **S11** W3C, *Understanding SC2.4.11: Focus Not Obscured (Minimum)*: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum
- **S12** W3C, *Understanding SC2.5.8: Target Size (Minimum)*: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- **S13** IBM Carbon, *Notification — Usage*: https://carbondesignsystem.com/components/notification/usage/
- **S14** Microsoft, *XAG115: Error messages and destructive actions*: https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/115
- **S15** Godot, *Custom drawing in 2D*: https://docs.godotengine.org/en/stable/tutorials/2d/custom_drawing_in_2d.html
- **S16** Godot, *General optimization tips*: https://docs.godotengine.org/en/stable/tutorials/performance/general_optimization.html

## 0.11 targeted follow-up — 24 September 2026

Existing research above remains the basis. New native observations, not generic competitor imitation, motivated these changes:

- **Godot containers:** [official container guidance](https://docs.godotengine.org/en/stable/tutorials/ui/gui_containers.html) supports reparenting stable controls into containers instead of manual pixel placement. Applied to the consolidated header and shared Strategy/Practice topic row; native clipping tests prove actual supported layouts, not usability.
- **Native focus:** [Godot GUI navigation](https://docs.godotengine.org/en/stable/tutorials/ui/gui_navigation.html) and [MenuButton class reference](https://docs.godotengine.org/en/stable/classes/class_menubutton.html) distinguish focus behavior. The observed Escape-return defect was fixed with explicit FOCUS_ALL and deferred focus restoration. [XAG 113](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/113) informs predictable focus as a design objective; actual mouse and keyboard events are tested.
- **Rendered text color:** [RichTextLabel reference](https://docs.godotengine.org/en/stable/classes/class_richtextlabel.html) identifies `default_color` as rich text's default foreground. Inspection found white-on-paper dialog text despite ordinary Label colors being correct. The theme now sets the actual rich-text property and tests it against the rendered dialog stylebox. [XAG 102](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/102) is a contrast design reference, not a certification claim.
- **Enlarged text:** [XAG 101](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/101) motivates readable text and accommodation rather than merely shrinking controls. Redundant header/topic rows and vertical gaps were removed; all three strategy alternatives are checked at 130%. Testing only to 130% does not establish the guideline's broader accessibility coverage.

See [workspace specification](pitwall-workspace.md) for observed screen/state/reproduction, capability mapping, task costs and still-open human-validation gates. No public player complaints or new player interviews were used as measured evidence for this iteration.
