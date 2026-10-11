# Process Studio review and improvement pass

## Review scope

This pass reviewed the Wildlands **Process Studio** (the business-process editor and simulator in
`source/wildlands/source/process-*.ts` and `process*.css`, about 10,000 lines), its browser suites
`source/verification/process-*-browser.ts` and Node checks `source/test-process*.cts`, the process
documentation and the [agency delivery lab](../../docs/concepts/agency-delivery/README.md) with its
seven synthetic processes, and then fixed most of what it found.

**Method.**

- **Six read-only reviews at `01bc133`** (`01bc13385e550cd96f2b5827e0477fb3e92dc6e0`, the merge of
  Present mode on `feature/process-present-mode`), one per perspective:
  - end-user UX and interaction (UX);
  - accessibility (WCAG 2.2 AA), visual design and responsive layout (A11Y);
  - authoring workflow (AUTH);
  - domain value, simulation correctness and BPMN/BPSim interchange (DOM);
  - engineering quality, security, performance and testability (ENG);
  - presenter/stakeholder use and documentation (PR, DOC).
- **The demo page as the subject.** Each reviewer drove the prebuilt `demos/agency-delivery.html` from
  `file://` in Playwright Chromium (SwiftShader), at widths from 320 to 1440 px, with keyboard walks,
  ARIA and accessible-name reads, contrast and colour-vision simulation, larger default font sizes,
  forced colours, reduced motion, hostile-input injection, generated large BPMN files and Node
  scripts against the compiled modules and `bin/wildlands`. Nothing in the repository was changed
  during the reviews. Every finding carries evidence (file and line, screenshot, script or
  observed state) and unverified claims were marked as such.
- **Six parallel implementation packages, A to F**, each in its own worktree with file ownership,
  then merged by a coordinator:
  - **A** run feedback, work protection and an accessible studio shell;
  - **B** 2D map state encoding, readable labels and Present framing;
  - **C** authoring editors (paths, diagnostics, undo, the ENG-2 fix);
  - **D** honest metrics, case-based lenses, slides and Present wording;
  - **E** BPMN import bounds, one 3D renderer, `process diff` detail and BPSim fidelity;
  - **F** documentation, onboarding and journey step descriptions.
- **Coordinator integration** merged the packages (`8cedace`, `34a43a0`, `1a6b7d5`, `3ae81a6`,
  `6c8ddc1`, `7aa4ce4`), rebuilt the CLI bundle and demos after the package merges available at the
  time, reconciled the shell and map packages (`bd8e70e`: a forced-colours rule for the SVG legend
  samples, a marker-size check that zooms through the **Zoom in** button, and a caption that ends a
  hover when the pointer moves outside the map), and a final documentation pass synchronised the
  reference, how-to, tutorial, CLI handbook, current-state page, agency README and the
  `process-demo` skill with the merged behaviour.

The reviews raised about 112 findings: UX 20, A11Y 19, AUTH 17, DOM 17, ENG 18, PR 12 and DOC 9.
Screenshots and bounded runs of synthetic processes are review material; they are not human
usability, accessibility or balance validation, and a seeded run is not a forecast.

## Verdict

**Engine: sound.** A hand-computed queue model (three arrivals, a five-minute task, capacity 1, 2
and 3) matched the engine's cycle, wait, cost, utilisation and throughput exactly. Keyed random
streams made chunked and single advances identical in all seven demos, the sampled distributions
had the expected moments, and every demo round-tripped through BPMN with and without BPSim to the
same fingerprint (14 of 14 exports conformed to the built-in BPMN 2.0 / BPSim 1.0 rules). 276
hostile strings in every free-text field, plus a crafted foreign BPMN file, executed nowhere. The
custom XML reader, the command/query layering and the accessible chrome (every measured text node
at or above 4.5:1, modal dialogs, focus restoration, a batched live region) were judged strong.

**Product: a careful property tuner and simulator, not yet a process modeller.** Feedback and
wayfinding lagged behind the engine: the status line went stale, a stopped run still advertised
**Run simulation**, and phones hid the way forward and back. The 2D map's colours contradicted its
legend. Several analyst-facing numbers carried more authority than they deserved: cost ignored idle
capacity, "Mean cycle 0 min" showed before anything finished, SIPOC counted visits as cases and the
journey funnel counted an alternative route as drop-off. Work protection had gaps (reload, JSON
import and process switching silently dropped drafts or runs, and there was no undo), BPMN import
analysis was quadratic and every 3D rebuild leaked a WebGL renderer.

**After the pass.** Feedback, work protection, the map encoding, the analytical wording, BPMN import
scale, the 3D renderer lifecycle, the one injection sink and the presenter deck were fixed and pinned
by browser or Node checks. The studio still cannot add, delete or duplicate steps or create a
process, it still reports one seeded run without replications, and draft recovery after a reload,
event-log export and several maintainability items remain deliberate follow-ups (see
[Deferred follow-ups](#deferred-follow-ups)).

## Cross-cutting themes

Ranked by the synthesis of the six reviews:

1. Authoring stops at values: no way to add, delete or reconnect a step or path, or to create a process.
2. Work protection: reload, JSON import and process switching dropped drafts or runs; no undo.
3. Feedback and wayfinding: a stale status line, the wrong primary action after a stop, phone dead
   ends and a noisy Activity badge.
4. Map encoding: borders and dots in theme colours that collided with the legend's states,
   colour-only tokens and edges, labels cut mid-word and controls over cards.
5. Analytical honesty: cost without idle capacity, one seed, a "0 min" mean cycle, invisible blocked
   time, "planned = average", SIPOC counting visits, the funnel counting alternatives, raw minutes.
6. Scale and lifecycle: quadratic BPMN analysis (a 60-second freeze), a WebGL renderer leaked per
   rebuild, and a full 2D/3D redraw on every tick.
7. Security: one self-XSS sink in **Tune values**.
8. Presenter story: undescribed journey steps, no utilisation or bottleneck slide, single-card
   framing and long title slides.
9. Documentation: no tutorial, a buried Present how-to and stale claims.
10. Maintainability: Wildlands TypeScript outside the 400-line quality gate, a budget met by line
    packing, and twelve copies of an HTML escaper.

## Findings and resolutions

Status words: **resolved** (fixed and pinned), **partial** (the named part fixed, the rest
deferred), **deferred** (see [Deferred follow-ups](#deferred-follow-ups)) and **open** (not
addressed in this pass and not in the deferred list of the integration record).

### 1. Authoring

| ID | Finding | Resolution |
|---|---|---|
| AUTH-1 | The step editor could not add, remove or retarget an outgoing path. | Resolved (C). **Where work goes next** has **Go to**, **Remove path** (disabled with the kind's reason) and **Add path to…**; the deadline help links to **Add path to…** (`process-step-flows.ts`). |
| AUTH-2 | No way to add, delete or duplicate a step, change its kind or start a process except raw JSON or a file. | Deferred. |
| AUTH-6 | Removing a pool that steps used gave no warning, and the diagnostic named the wrong cause. | Resolved (C). The engine says `Uses pool "x", which is not defined.`; resource rows say "Used by …"; removal asks first (Cancel default) and clears the demands. |
| AUTH-7 | One bad flow target cascaded into 14 problems; the flow-count message was jargon. | Resolved (C). Reachability checks are skipped while a flow has a missing endpoint; counts read "A task needs exactly 1 outgoing flow; this one has 0." |
| AUTH-8 | The step editor leaked schema text, and Apply refusals were unlabelled and unlinked. | Resolved (C). Plain problems, linked refusals, Apply disabled with its reason. |
| AUTH-9 | Handing off from a dirty step editor forced Discard; the deadline workflow was a round trip. | Partial (C). **Save to draft and open**; deadline help points at **Add path to…**. A "Back to <step>" return is not done. |
| AUTH-10 | Case-field names were free text with no suggestions. | Resolved (C). Datalists of earlier, usable and all field names. |
| AUTH-11 | Step placement was hand-typed coordinates. | Deferred. |
| AUTH-12 | Labels mixed "Edit process…", "Definition editor" and a bare "Edit" on phones. | Resolved (A). The phone button's accessible name is "Edit process"; the terms table maps the remaining words. |
| AUTH-14 | Apply with no changes reset the run and bumped the revision. | Resolved (C). Apply is disabled while the draft holds the running definition, ignoring format and key order. |
| AUTH-17 | No step-to-step navigation inside the editors; phone chrome took about 45% of the sheet. | Partial (C). **Previous step** and **Next step** behind the dirty guard; the phone sheet chrome was not changed. |
| DOC-1 | No path for a newcomer to create a process, and no page said the UI cannot. | Resolved (F). [Tutorial](../../docs/tutorials/first-business-process.md) and a "What the studio can and cannot edit" box. |

### 2. Work protection

| ID | Finding | Resolution |
|---|---|---|
| AUTH-3 / ENG-9 | An unapplied draft was lost on reload or tab close without warning. | Partial (A). `beforeunload` asks while any process holds an unapplied draft; nothing is stored, so recovery is deferred. |
| AUTH-4 | JSON import replaced the process, draft and run without asking. | Resolved (A). Rejections change nothing; a valid file over a run past minute 0 or a draft asks first, starting on Cancel. |
| AUTH-5 | No undo or redo. | Resolved for the Definition editor (C): an in-memory history of 100 steps, Ctrl/Cmd+Z, Shift+Z and Ctrl+Y, "Removed … Undo". The step editor has no undo beyond Cancel. |
| AUTH-13 / UX-16 | Export JSON silently exported the running definition; confirmations were inconsistent. | Resolved (A). Exports name what they saved; with a draft the menu says it is not included and offers **Export draft JSON**. |
| AUTH-15 | The apply-over-run confirm said "Export the run report first" but offered no button. | Open. |
| AUTH-16 / UX-9 | Switching process discarded a run and the chosen seed without asking. | Partial (A). Past minute 0 a Cancel-first question; Cancel restores the selector and focus; the dropped seed is named. Per-process run memory is deferred. |
| UX-10 | Applying an edit dropped the seed and selection, breaking before/after comparison. | Resolved (A, C). A new revision of the same process keeps a typed seed (while the definition seed is unchanged) and the selected step. |
| ENG-8 | `pagehide` disposed the studio for good, so a back/forward-cache restore was dead. | Resolved (A). A persisted `pagehide` only suspends; `pageshow` resumes. |

### 3. Feedback and wayfinding

| ID | Finding | Resolution |
|---|---|---|
| UX-1 | The status line went stale. | Resolved (A). Notes give way at the next state change; errors stay until the next successful command (`process-run-bar.ts`). |
| UX-2, UX-3, A11Y-19 | After a stop, **Run simulation** still looked primary; on a phone Reset was hidden and focus lost. | Resolved (A). Reset becomes primary, stays visible on phones and takes focus. |
| UX-4, A11Y-11 | No visible way back to the whole process on a phone; Escape differed across views. | Partial (A). **← Whole process** at every width and Escape on the 2D map and 3D scene. A roving tabindex for map cards is deferred. |
| UX-11 | Import errors were developer stack text. | Resolved (A). Plain rejections with line and column or a problem count; the status is clamped to two lines. |
| UX-12, UX-19, UX-20 | Speeds and run lengths did not fit week-scale processes; raw-minute clock; Advance could overstate. | Partial (A). Speeds 2 h and 24 h, run lengths with hours, an hours line on the clock, Advance names the minutes left. "Run to end" is deferred. |
| UX-13 | The default 3D view was hard to read on a phone. | Resolved (A). Business processes open in 2D at 650 px and below. |
| UX-14 | The Activity badge was always "new" noise. | Resolved (A). It counts only failed work, blocked work and dropped arrivals, in the danger tone. |
| UX-15 | First-run orientation relied on jargon. | Partial (D). "—" before the first finished case and named costs; "Step scenes", "Frame view", the scene-id subtitle and the repeated seed are unchanged (open). |

### 4. Map encoding and accessibility

| ID | Finding | Resolution |
|---|---|---|
| A11Y-1, UX-8, A11Y-18 | Card borders and step-list dots reused legend state colours for other meanings; 2D colours bypassed the tokens. | Resolved (A, B). Borders and dots show work state only, through `data-status` rules shared with the legend. |
| A11Y-4 | Token state was a 4.9 px colour dot, ambiguous under colour-vision deficiency. | Resolved (B). Shape-coded markers (disc, ring, hourglass, square, cross) of at least 8 px; blocked and backlog counts in accessible names. |
| A11Y-5 | Conditional and deadline edges were colour-only and missing from the legend. | Resolved (B). Long-dashed and dotted, both in the legend. |
| UX-5 | The zoomed-out map could not show the process and its numbers together. | Resolved (B). Per-state count chips under each name. |
| UX-6, A11Y-8 | Labels cut mid-word; full names mouse-only. | Resolved (B). Up to three lines, hyphen breaks, ellipsis only after a whole word, and a hover or focus caption. |
| UX-7, A11Y-7 | Phone zoom controls covered a card. | Resolved (B). Fitting reserves the dock. |
| UX-17, A11Y-15 | Markers painted over card titles. | Resolved (B). |
| UX-18 | The amber "Zoom in for details" hint did nothing. | Resolved (B). A real button. |
| A11Y-16 | Idle cards were almost invisible. | Resolved (B). Idle border at least 3:1. |
| A11Y-2 | At 400% zoom the sticky run bar hid 21 of 59 focus stops (WCAG 2.4.11). | Resolved (A). |
| A11Y-3 | Forced colours erased legend swatches, utilisation bars and pressed state. | Resolved (A, coordinator). |
| A11Y-6 | The journey map's ARIA table had mismatched columns. | Resolved (D). `aria-colindex`, `aria-colspan`, `aria-colcount`. |
| A11Y-9 | The toolbar wrapped badly with a custom run length. | Resolved (A). |
| A11Y-10 | A larger default text size broke the side columns and left map text at 11 px. | Resolved (A, B). `rem` columns; map minimums scale with the root font. The legend row grows tall at large sizes (deferred). |
| A11Y-12, A11Y-13, A11Y-14, A11Y-17 | Glyphs in accessible names; unstructured metrics and a duplicate heading; legend in lens views; clipped canvas focus and no role. | Resolved (A). |

### 5. Analytical honesty and interchange

| ID | Finding | Resolution |
|---|---|---|
| DOM-1 | Cost ignored idle capacity, so capacity what-ifs looked free. | Resolved (D). "Simulated cost" became **Work cost**, plus read-model `metrics.capacityCost` (**Capacity cost**). |
| DOM-2 | One seeded run was presented as the result. | Deferred. |
| DOM-3 | No event log or per-case export for process mining. | Deferred. |
| DOM-4 | Mean cycle was censored and read "0 min" before anything finished. | Resolved (D). "—" until a case finishes and `meanAgeMinutes` (**Mean age in progress**). A warm-up option is not done. |
| DOM-5 | Blocked time was in no metric and held cases showed as waiting. | Partial (D). `steps[].held` and **Blocked after finishing**; blocked time is still not a metric. |
| DOM-6 | "Planned N min (the average …)" was false for skewed distributions. | Resolved (D). "Planned 720 min; draws average about 920 min" from `LWProcessRandomView.meanOf`. |
| DOM-7, PR-2 | Raw minutes everywhere; day and week meant different things in different places. | Partial (D). "Business minutes" named and an hours gloss (`process-time.ts`); a display calendar is deferred. |
| DOM-8 | SIPOC stage "completed" counted step completions. | Resolved (D). Distinct cases that left the stage. |
| DOM-9 | SIPOC input labels from tested needs inverted their meaning; counters showed as inputs. | Resolved (D). |
| DOM-10 | The journey funnel showed an alternative route as drop-off. | Resolved (D). Drop-off counts lost ends only; "split, rejoins at …" and "n in progress". |
| DOM-11 | BPSim export dropped later arrival rules, case data, draws and the seed silently. | Resolved (E). The first rule's constants and whole-number draws and the seed travel in BPSim; `fidelity` names the rest. Showing the notes in the studio is deferred. |
| DOM-12 | The pool meter mixed a cumulative percentage with "busy now". | Resolved (D). "Average since minute 0 · b/c busy now". |
| DOM-13, PR-10 | `process diff` counted changes without values. | Partial (E). `changedResources`, `changedFlows`, `changedArrivals` and `fields`; a result comparison of two scenarios is deferred. |
| DOM-14, DOM-15, DOM-17 | No throughput or cost breakdown; rounding notes; loan demo modelling. | Deferred. |
| DOM-16 | The journey map reimplemented the main-route walk. | Partial (D). It uses `LWProcessRoute.next`. |
| ENG-18 | The DOCTYPE guard was a substring test. | Resolved (E). Declarations are refused as markup tokens. |
| PR-12 | `process slides --minutes 0` reported engine wording, not the flag. | Open. |

### 6. Scale and lifecycle

| ID | Finding | Resolution |
|---|---|---|
| ENG-1 | BPMN import analysis was super-linear; a 4.7 MiB file froze the tab for over 60 s. | Resolved (E). Early plain rejection above 512 flow nodes or 1,024 flows, indexed edges, preview groups capped at 200 rows, Import reuses the preview analysis. Package E measured a 40,000-task file going from 54 s of analysis to a rejection in under 5 s on the shared review machine. |
| ENG-3 | Every 3D rebuild leaked a WebGL renderer, context and canvas. | Resolved (E). One renderer per page (`LWProcess3D.stage`, `live()` counters). |
| ENG-4 | 3D redrew continuously with many draw calls. | Partial (E). On-demand frames, at most about 30 a second while animating, and `PCFShadowMap` without a console warning; geometry merging and fewer shadow casters are deferred. |
| ENG-5 | The 2D map rebuilt its SVG on every refresh. | Partial (B, the cheap part only); a keyed incremental update is deferred. |
| ENG-6, ENG-7 | A synchronous layout per refresh; the closed I/O panel rebuilt every tick. | Resolved (A). |
| ENG-12 | Each pulse built and copied the snapshot up to four times. | Resolved (E). The pulse reuses the snapshot `advance` returns. |
| ENG-14 | 3D captions used two 640 x 128 canvases per step. | Deferred. |
| ENG-15 | Over-limit definitions read "Array length is out of range". | Resolved (E). "A process holds at most 128 steps; this one has 150." |

### 7. Security

| ID | Finding | Resolution |
|---|---|---|
| ENG-2 | **Tune values** wrote raw draft numbers into `value="…"` (a self-XSS sink). | Resolved (C). Only finite numbers reach `value`, `min` and `max`, also in the step editor's pool fields; diagnostic selectors use `CSS.escape`. Pinned by "A poisoned draft opened in Tune values or the step editor creates no element and runs no handler". |
| ENG-11, ENG-16 | String HTML with duplicated escapers; escaping only partly pinned. | Deferred, with Tune values and the step editor now pinned (partial ENG-16). |

### 8. Presenter story

| ID | Finding | Resolution |
|---|---|---|
| PR-1 | Journey demos showed "No description authored." on almost every step slide. | Resolved (F). 52 journey step descriptions, guarded edits, a Node check. |
| PR-3 | No slide showed utilisation or the bottleneck. | Resolved (D). Live pool use on the resources slide; the summary and **Key results** name the most utilised pool. |
| PR-4 | Present's numbered map had no key. | Resolved (B). The key lives in the map dock. |
| PR-5 | Step slides framed a single card. | Resolved (B). The step and its direct neighbours. |
| PR-6 | The deck was long and structural, with no executive cut. | Partial (D). A lead of at most about 60 words, a **Process description** block and **Key results**; a brief mode is deferred. |
| PR-7, PR-8, PR-9 | No hint of an unapplied draft; the header hid the run status; inconsistent step counts. | Resolved (D). |
| PR-11 | Presenter ergonomics. | Partial (D). Space, ArrowDown, `n`, Shift+Space, ArrowUp and `p` page from the slide; full screen, a wider slide column and aligned card wording are deferred. |

### 9. Documentation

| ID | Finding | Resolution |
|---|---|---|
| DOC-2 to DOC-9 | Stale agency README and skill claims, two `bin/README.md` errors, BPMN commands missing from `--help`, a buried Present how-to, reference material in the how-to, a stale kind list, varying terms. | Resolved (F). [Present a process to stakeholders](../../docs/how-to/present-a-process.md), a terms table in the [reference](../../docs/reference/business-process-engine.md), corrected skill, README and CLI usage. The final documentation pass then synchronised every process page with packages A to E. |

### 10. Maintainability

| ID | Finding | Resolution |
|---|---|---|
| ENG-10 | The size budget was met by packing lines; the quality gate does not see Wildlands TypeScript. | Deferred. New modules (`process-run-bar.ts`, `process-step-list.ts`, `process-io.ts`, `process-guard.ts`, `process-map-marks.ts`, `process-map-card.ts`, `process-step-flows.ts`, `process-time.ts`) were extracted with explicit ownership instead of growing the shell and the 2D renderer. |
| ENG-13, ENG-17 | Duplicated per-step derivations and palettes; `any` in the three.js adapter and unchecked DOM lookups. | Deferred. |

## Separation of concerns after the pass

| Concern | Owner |
|---|---|
| Run toolbar and the status line rules | `process-run-bar.ts` |
| Step list markup and keeping the selection in sight | `process-step-list.ts` |
| Exports, file picker, JSON import checks, BPMN dialog hand-off | `process-io.ts` |
| Cancel-first questions, leave-page guard, back/forward-cache lifecycle | `process-guard.ts` |
| 2D drawing vocabulary and the legend | `process-map-marks.ts` |
| One 2D step card | `process-map-card.ts` |
| Step editor paths | `process-step-flows.ts` |
| Business-minute wording | `process-time.ts` |
| Undo and redo history | `process-draft.ts` (in memory only) |
| Capacity cost, mean age, held work | `process-session.ts` read model (never fed back into the engine) |

Navigation, dialogs, lenses and Present still never tick the clock, and every new surface emits
commands through the application controller.

## Deferred follow-ups

- **AUTH-2 structural step editing and New process.** Needs an editor surface over the existing
  `LWProcessAuthoring` `putStep`/`removeStep`/`putFlow` operations and an `add` command for a new
  process slot; large enough to be its own change.
- **AUTH-11 automatic layout and drag.** Placement for new steps and a "Tidy layout" action belong
  with AUTH-2; drag-to-move on the 2D map is a later modeller feature.
- **DOM-2 replications and confidence intervals.** A bounded runner over `Runtime.create(def, {seed})`
  reporting mean, spread and percentiles per KPI keeps determinism; it needs its own report format.
- **DOM-3 event-log export.** A CLI log sink (CSV or XES) outside the snapshot, so simulated output can
  feed process mining; the snapshot's bounded histories cannot carry it.
- **DOM-7 display calendar.** An opt-in, display-only minutes-per-day setting changes the fingerprint,
  so it needs a schema decision before views can say days and weeks.
- **DOM-13 scenario comparison.** Paired results of two definitions under the same seeds; it builds on
  DOM-2 and the itemised `process diff`.
- **DOM-14 throughput and cost breakdown.** Mean wait per visit, throughput per period and per-pool and
  per-step cost; per-period throughput depends on DOM-7.
- **DOM-15 rounding notes.** Whole-minute rounding biases short distributions; document it and warn on
  small exponential means, since fractional minutes are out of scope for v1.
- **DOM-17 loan demo modelling.** The applicant as a 50-slot pool and ends without outcomes; changing
  them changes the pinned demo run, so it is a separate content change.
- **ENG-4 remainder.** Merge static room geometry and reduce shadow casters to cut draw calls at the
  128-step maximum; needs a draw-call budget check.
- **ENG-5 incremental SVG.** Update the 2D map by keyed elements instead of rebuilding it on refresh.
- **ENG-9 draft recovery.** Only the leave-page guard landed; recovery needs a storage policy, since the
  studio deliberately writes nothing to browser storage today.
- **ENG-10, ENG-11, ENG-13, ENG-14, ENG-17 maintainability.** Bring Wildlands TypeScript under the
  quality gate, share one escape/HTML helper, one palette module, a 3D caption atlas and a typed three.js
  facade; each is an incremental refactor with its own regression checks.
- **ENG-16 hostile-definition suite.** Extend the poisoned-draft check from Tune values and the step
  editor to every view.
- **A11Y-11 roving tabindex.** Make the 2D map one tab stop with arrow-key movement between cards, as the
  journey lens already does.
- **UX-9 per-process run memory.** Keeping a detached run per process slot is an application-contract
  change; switching now asks first instead.
- **UX-12 Run to end.** An explicit clock command that advances to the end in one step without
  animation, kept behind the command boundary.
- **PR-6 brief mode.** A short executive deck variant of the slide model.
- **PR-11 card and slide wording.** Align the map's "working / waiting" with the slides' "Now in
  progress / now waiting"; full screen and a wider slide column with it.
- **Legend height at large text.** At a 24 px root font the legend row is about 128 px tall and pushes the
  map into numbered cards; the legend needs a compact or collapsible form.
- **Also not done in the packages:** a "Back to <step>" return from the Definition editor (AUTH-9),
  step-editor undo (AUTH-5), an "Export report first" choice in the apply confirm (AUTH-15), the
  studio display of BPSim fidelity notes (DOM-11), the remaining UX-15 copy, and a flag-named
  `--minutes` error (PR-12).

## Verification

Source identity: the complete gate ran on the integrated branch at commit `bd8e70e` (all six packages
merged plus the coordinator's integration fix), before the documentation-only merge and the regenerated
`bin/` and `demos/` that follow it.

- **Complete registered gate:** `npm run verify -- --jobs 3 --browser-jobs 2` passed 2,097/2,097 checks
  in 115 suites (1,667 s) on a 4-core container with Chromium 141 (SwiftShader). The registry grew from
  2,079 to 2,097 checks through reviewed additions; two checks were renamed with `renames` entries.
- **Fast checks:** `npm run typecheck` clean; `npm run architecture` 21/21; `npm test` 815/815 on an
  intermediate merge.
- **Integration repeats:** process-readability, process-layout, process-renderers and
  business-process-browser passed three consecutive runs at four concurrent suites after the
  coordinator's caption fix. Before that fix, the hover-caption check failed in one of two loaded runs.
- **Generated artifacts:** `npm run check:cli` and `npm run check:demos` report `bin/wildlands` and
  every `demos/` page current after regeneration.
- **Repository checks:** `python3 scripts/check_docs.py` passed (2,922 local links),
  `python3 scripts/check_architecture.py` reported no violations, and
  `python3 -m unittest discover -s tests -p 'test_*.py'` passed (19 skipped).
- **Hosted CI follow-up:** the first hosted run of the integrated branch (Chromium 153; no Inter, so text
  falls back to DejaVu Sans) failed one readability assertion. The focused card's full-name caption was
  clipped because it shared its row with the long camera hint. On desktop the caption now takes a fixed
  row of its own, still without resizing the map. The six layout-sensitive process suites were re-run
  (76/76), and in DejaVu Sans the caption measures 927 px with no clipping.
- **Native visual evidence:** `npm run process:shots` for processes 1 and 7 at minute 240 wrote 24
  captures: desktop 2D, 3D and lens, Present, the phone studio and Present, and DejaVu Sans variants.
  None had horizontal overflow, and the console logged no errors.
- **Not run:** the Godot `scripts/verify.py` gate, which this standalone project does not touch, and
  `scripts/quality.py`, whose policy does not cover TypeScript (ENG-10). There was no human usability
  test or screen-reader session, and real back/forward-cache restore and Windows High Contrast were not
  exercised (both are emulated in the suites). These are synthetic fixture runs, not validation of
  physical processes, balance or human usability.
