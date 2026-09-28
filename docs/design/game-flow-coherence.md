# Game flow, UI coherence and advisory quality

Research and implementation record · 28 September 2026

## Intent and scope

The shipping game is a native Godot race-weekend game with a circuit editor, not
a web application or a finished season/team-management campaign. This pass uses
main `cfe351b0054f72c3e504c5e9c8c00f3ada82d5b7`, tree
`5c561c906f6620bc5fade1ff9782159b47f2c64f` (merged PR #20).

Review the complete available player journey, not only the race HUD. Keep the
minimal race actions and do not reintroduce Director/Engineering tools into the
shipping menu. Consistency must reduce relearning without making the editor and
pitwall identical: each keeps the spatial work area and controls its task needs.
No sporting rules, physics, tyres, driver demands, RNG, checkpoint schema,
geometry algorithm or recorded outcome should change for a visual refresh.

## Evidence and audit method

Source inspection follows scene composition, configuration drafts, settings,
menu/continue/quit, entry confirmation, the minimal workspace, end view,
editor/session transactions, and the verification registry/workflows. Baseline
native screenshots come from successful hosted run #370 / 36389424323, whose
source tree equals main. The `ui_smoke` suite deliberately runs the retained
Engineering layout; its menu includes developer destinations. It is not evidence
that those destinations appear in the default minimal game. The minimal and
weekend-flow suites distinguish synthetic layout fixtures from physical sessions.

No interviews, competitor playtests, screen-reader sessions, or user-comprehension
study were conducted. The following are inspection findings and engineering
design decisions, not proof that players will enjoy or understand the game more.

| Journey | Baseline finding | Implementation direction / acceptance |
|---|---|---|
| Launch / main menu | Cream/olive serif chrome becomes graphite/mint at entry. The footer says Author → Qualify → Race, omitting practice and implying editing is required. | One native theme, sans-serif hierarchy; correct Configure → Practice → Qualify → Race journey; editing explicitly optional. |
| Continue | Disabled action has no adjacent explanation; keyboard focus is not deliberately assigned at launch. | Explain no checkpoint; give new/returning players a useful initial focus without starting a session. |
| Configure | Strong preview and retained choice; only global menu navigation; long circuit metadata has no wrapping. | Keep preview and draft; add local Back and one right-aligned Review action; wrap metadata, preserve compact layouts. |
| Welcome / replacement | Captured entry and durable commit are strong. Replacement confirmation is unscaled and cancellation does not deliberately return focus. | Shared scaled safe-default confirmation, duplicate-popup guard, focus restoration. Back/cancel/stale/error keep the previous weekend. |
| Practice / qualifying | Minimal commands and measured lap semantics are coherent. Real return-to-garage and explicit next-phase approval must remain. | Preserve five commands and physical lifecycle; common state/focus/theme tokens, not a new decision system. |
| Formation / race | Existing timing/cards already fit compact profiles; large changes risk regressions. | Preserve primary stage action and existing timing/driver identity, fitted tyre/resource facts, pause semantics and map. |
| Results | Actual classification is retained. Table header inherits the light base theme; long title is not wrapped. | Consistent table/selection states, wrapping heading, clear main menu/review/new-weekend paths. |
| Settings | Pitwall-only scaling; long data path; Apply before Back on left differs from entry; staged changes can be silently lost. | Dedicated settings view, shared text scaling for chrome, scroll body with fixed footer, preview, explicit save/error status, safe departure. |
| Editor | Two filled primary buttons compete; field-heavy inspector and toolbar share monolithic controller; text does not scale. | One primary Test action with explanatory save/validation state; scale rebuilt inspectors; separate inspector construction from document transactions. |
| CI | Functional/architecture suite is strong; no common code-size/lint report. | Separate advisory workflow, exact code-line policy, structured reports/raw logs, tool failure visibility; no relaxed existing tests. |

## Research → decisions

### 1. Consistency is behavioral, not only color

Microsoft's [XAG 112: UI navigation](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112)
calls for coherent ordering and interaction across menus, early access to
accessibility settings, predictable focus and keyboard/digital navigation.
[Nielsen Norman Group's heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
add visibility of status, user control, recognition rather than recall, and
error recovery. These support repeated heading/body/footer structure and clear
verbs; they do not prescribe a particular palette or promise conversion/fun.

Apply: one source of native control tokens; current screen named; local Back
where it matters; no menu-navigation side effects on simulation; initial focus
and return focus. Keep editing, configuring and managing distinct tasks. Never
make review itself a destructive action. The illustrated terrain is content,
not chrome, and keeps its independent legible map palette.

### 2. Typography and scale must reach the surrounding journey

[XAG 101: Text display](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/101)
addresses text in menus, gameplay and error dialogs, configurable sizing,
sans-serif alternatives, readable line lengths and avoiding two-axis scrolling
when text enlarges. Its full guidance includes substantially broader requirements
and 200% scaling. This increment's inherited support envelope of 100/115/130%
is **not** XAG compliance. Font point sizes alone are not measured glyph heights.

Apply: carry the existing preference across menu/configuration/settings/editor
chrome and dialogs; do not silently shrink the chosen text at smaller windows.
Wrap long descriptions and metadata; use one-axis scrolling for long settings and
inspector content, not for primary actions. Keep map labels on their independent
geometric scale so changing interface text does not alter track geometry.

### 3. State must remain legible and distinguishable

[W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
provides useful measurable reference ratios (4.5:1 for ordinary text and 3:1 for
large text); web success criteria are not a native-game certification.
[Godot GUI skinning](https://docs.godotengine.org/en/stable/tutorials/ui/gui_skinning.html)
explains theme inheritance, local overrides and control type variations.

Apply: explicit normal, hover, pressed, selected, disabled, focused, popup,
tooltip, input, rich-text and table-header styles. A transparent focus outline
must not paint over the selected state. Warnings include words/reasons rather
than only a red border. Test token contrast and inspect actual native captures;
passing token checks does not prove every composited pixel meets a ratio.

### 4. Safe actions and keyboard focus are part of the flow

[XAG 115: Error messages and accidental activation](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/115)
recommends understandable recovery, error identification, and protection from
unintended destructive choices. [XAG 114: UI context](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/114)
addresses orientation and meaningful action context. [Godot focus navigation](https://docs.godotengine.org/en/stable/tutorials/ui/gui_navigation.html)
requires a focused control before keyboard navigation works and permits explicit
focus neighbors rather than relying entirely on geometric guessing.

Apply: replacing a weekend and discarding unsaved settings use explicit,
cancel-default confirmation; cancel restores the invoker; stale targets do not
silently commit. Saving failures preserve editable settings and are visible.
Navigation never silently sends a driver or approves the next phase. Existing
editor undo/redo/cancel and save-rejection contracts stay in place.

### 5. Centralized styles should not become a new application framework

Godot's theme mechanism already supports cascading and shared resources. Use it
instead of implementing a parallel CSS system or pushing domain state into
widgets. Shared immutable tokens/state resources and small view builders are
sufficient. A theme adapter for the minimal workspace can preserve its public
contract while taking colors and control states from the same source.

Apply: extract responsibilities (settings draft/view, editor inspector rendering)
while retaining the scene shell's orchestration and TrackEditorSession's canonical
revision/history/storage ownership. Do not split at an arbitrary 400th line or
hide logic in dictionaries solely to lower a metric. Do not mass-reformat the
simulation in a UI pass. Required architectural checks remain executable.

### 6. Language-aware quality checks, not physical file-length guesses

[Godot's GDScript style guide](https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_styleguide.html)
provides conventions, not a universal ideal source-file length.
[gdtoolkit](https://pypi.org/project/gdtoolkit/) supplies GDScript linting,
formatting and cyclomatic-complexity analysis; its [linter reference](https://github.com/Scony/godot-gdscript-toolkit/wiki/3.-Linter)
includes `max-file-lines`, which is total file length and does not implement the
requested comment/blank-excluding policy. That check is disabled, not the rest of
the linter. The repository-specific counter owns 400/450 code lines.

[Python tokenize](https://docs.python.org/3/library/tokenize.html) exposes comments
and strings as distinct tokens. Python AST identifies documentation strings.
A GDScript lexical scanner similarly preserves `#` inside runtime strings,
escaped quotes and newline-containing strings. GDScript parsing/type correctness
remains the real Godot gate, not a claim made by the LOC scanner.

The 400-source / 450-test budgets are the user's explicit project policy, not
an empirically proven universal optimum. Runtime string contents count as code;
Python documentation strings do not. Empty/comment lines do not count. Semicolon
packing is not a remediation: prefer responsibility-based decomposition and
readable formatting. Exact boundaries pass; the first extra code line warns.

### 7. Advisory rollout with honest failures

[Ruff configuration](https://docs.astral.sh/ruff/configuration/) supports a selected
rule set and check-only formatting; [C901](https://docs.astral.sh/ruff/rules/complex-structure/)
identifies cyclomatic-complexity review candidates. gdtoolkit 4.5.0 and Ruff 0.16.2
are explicitly pinned from their published package releases, not installed from
an unbounded latest branch. These tools are development-only.

[GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
documents `continue-on-error`; [workflow commands](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands)
document warning annotations and job summaries. Tool output can contain text that
looks like workflow commands, so it is saved as raw artifacts rather than printed
unfiltered. Our own bounded warning annotations escape metadata and messages.

Apply: independent warning-only quality job; JSON file inventory/findings,
Markdown summary, raw logs, code-source digest and revision. Missing tools,
unsupported syntax, timeout, malformed output and runner errors must not be
reported as clean. Keep the current full Godot import/architecture/runtime checks
blocking. Future enforcement is a deliberate decision after triaging debt;
`--strict` is available locally but never used by the advisory workflow.

## Acceptance plan

Automated: unit fixtures for LOC boundaries, strings/comments, malformed input,
warning escaping/limits, missing/time-limited tools and strict/advisory behavior;
architecture guard; all existing native suites and unchanged sporting hashes;
new whole-flow/theme/settings/editor checks at 1440×900, 1280×800 and 1100×720,
100/115/130% text. Each final claim must identify the source actually tested.

Manual native review: menu, setup, welcome and cancel confirmation, practice,
qualifying, formation/race, terminal table, settings/unsaved/error, editor and
inspector, actual hover/focus/disabled states. Test a real complete weekend and
save/resume separately from layout fixtures. Preserve meaningful fixed-step and
native-input tests rather than replacing them with screenshots alone.

Human acceptance remains: novice completes a first weekend without explanation,
identifies next session and selected driver, distinguishes sending from playing,
understands replacement/cancel/save, and can find saved/unsaved editor state.
Record confusion, wrong turns and failures; do not infer success from test counts.
Windows/export, actual DPI, controller, screen-reader, localization, >130% text
and representative-device performance require separate evidence.

## Native follow-through and regression repairs

The first full hosted run on `d2a7a841b027e6432ad8f4392c66f7c1657757d7`
reproduced welcome-footer clipping at 1100×720 / 130%, an overflowing retained
Engineering comparison/form, and guide overlap. These were not waived. The
shared theme now has explicit regular and compact densities. Engineering keeps
its established 13-point base and 32-pixel targets; the player-facing Minimal
pitwall keeps its 14-point base and 36-pixel targets. Both honor the selected
100/115/130% scale. Density is contextual, not an automatic text reduction.
Welcome instructions group each heading with its copy rather than interleaving
extra spacer controls. The original fit and overlap assertions remain.

The former public-profile contrast assertion assumed a light background. It now
uses `(max(luminance(foreground), luminance(background)) + 0.05) /
(min(luminance(foreground), luminance(background)) + 0.05)` with the unchanged
4.5:1 threshold. Native chart labels choose contrasting black/white ink against
their actual opaque tyre color; the underlying compound colors are unchanged.
The actual map and its labels retain their own light-surface palette.

Native internal controls participate in scaling, including file-dialog fields.
Base sizes are captured once; repeated scaling is idempotent. Popup themes are
cached by base size and scale, so the compact and regular contexts cannot borrow
an incorrectly sized popup. This follows Godot's distinction between cascading
theme resources and non-cascading local overrides. Focus styles remain transparent
outlines so they do not conceal normal/selected backgrounds.

The new full-shell regression additionally resizes an already open Settings view
both ways, preserving its draft and fixed footer. Keyboard popup events carry
the popup's real window ID, matching the existing native engine-selector tests;
root-window injection did not exercise the embedded popup. Native dialog
activation uses the dialog's viewport. Tests never emit item-selected or save
signals to pretend a user successfully operated the controls.

An interrupted publication typo was repaired before the recovery checkpoint
reached the PR. A separate temporary tooling branch recovered the exact source
and pinned engine through Actions because direct container networking was
unavailable. That workflow and its branch history are not part of the shipping
PR. Runtime engine files, Python wheels and local saves are not source artifacts.

Verification evidence is recorded against exact source trees in the PR and the
accompanying reports, rather than declaring an earlier failed or partial run a
full pass. New quality findings stay advisory; all retained native/domain checks,
the exact-source aggregate, and the 24 pinned sporting hashes remain required.

The retained developer-menu notebook now carries its actual invoking MenuButton
through the navigation signal. Closing the notebook restores that control,
not the surrounding non-focusable menu container. Its regression opens the
native popup, navigates past the disabled sandbox action, opens the notebook,
and closes it. The old selector follows the intentional sentence-case label
without removing the existing presence or keyboard-focus requirement.
