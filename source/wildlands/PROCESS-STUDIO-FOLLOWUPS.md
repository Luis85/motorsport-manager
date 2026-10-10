# Process Studio follow-up pass

> **Dated record, 10 October 2026.** This record describes the follow-up pass that resolved the
> deferred, open and partial findings of the [Process Studio review](PROCESS-STUDIO-REVIEW.md) and
> added the per-process Dashboard. The current contract is the
> [business process reference](../../docs/reference/business-process-engine.md); current
> capability claims live in [current status](../../docs/reference/current-state.md).

## Scope and method

- **Base:** `5c48314` (the end of the review pass on `feature/process-present-mode`). **Head of the
  implementation:** `923676f` ("Rebuild the CLI bundle and demos after the hostile-input and scale
  suites"), followed by documentation-only commits and the coordinator's final integration (see
  [Verification](#verification)).
- **Packages**, each in its own worktree with file ownership, merged by a coordinator with
  `git merge --no-ff`:
  - wave 1: **A** display calendar, rounding advisories and the engine reflow; **B** replications,
    paired comparison, event log and cost breakdown; **C** structural step editing, auto-layout,
    step-editor undo and editor hand-offs; **D** incremental 2D map, roving focus, drag-to-move and
    the compact legend; **E** merged 3D rooms, sized captions, shape-coded markers and the typed
    three.js facade; **F** per-process runs, Run to end, draft recovery, process slots and export
    notes;
  - wave 2: **G** brief deck, shared work-state wording, shared route walk and calendar wording in
    slides; **H** shared HTML escaping, inspector analytics, notes and calendar times; **I** draft
    actions on the map, Add step and Tidy layout, calendar clock and per-slot Activity; **J**
    TypeScript in the advisory quality gate; **DB-E** the Dashboard read model; **DB-UI** the
    Dashboard view;
  - wave 3: **K** one palette and one work-state derivation; **R1**, **R2**, **R3** reflow of the
    BPMN, editor, slide, Tune values, shell, engine and CLI modules onto the line budget and
    `LWProcessHtml`; **M** the loan demo remodelled; **DB-W** the Dashboard on real runs; **L**
    hostile-definition and scale suites.
- Every behaviour below was checked against the code at `923676f` by the documentation pass; the
  reference, how-to guides, tutorial, CLI handbook, current-state page, agency README and the
  `process-demo` skill were synchronised with it.

## Scope decisions

The user decided the open scope questions before the packages started:

| Decision | Outcome |
|---|---|
| ENG-9 draft recovery | **Yes.** The studio keeps a recovery copy of an unapplied draft in `localStorage` (its only storage use) and offers it after a reload, under an explicit storage policy (`process-recovery.ts`). |
| DOM-7 display calendar | **Yes.** An optional, display-only `calendar: {minutesPerDay, daysPerWeek}` joins schema version 1 like `genre`, `track` and `sipoc`: it changes the fingerprint when present and never a run. |
| AUTH-2 scope | **Full scope:** add, duplicate, change kind, delete with reconnect, make start, New process, Import as a new process, auto-layout and drag-to-move. |
| Studio "Run N seeds" | **Yes, inside the Dashboard:** the What-if section is the studio's replication and comparison surface rather than a separate dialog. |
| ENG-10 TypeScript quality gate | **Yes, advisory.** `scripts/quality.py` measures Wildlands and Scene Forge TypeScript with the same budgets; nothing is blocking, there is no baseline and no ratchet ([advisory code quality](../../docs/how-to/code-quality.md)). |

A further request during wave 1 added the **per-process Dashboard** (below).

## Resolutions

Every item that the review left deferred, open or partial, with where it lives now and a check that
pins it (suite and check name, abbreviated where long).

### Authoring and work protection

| ID | Resolution | Where | Pinned by |
|---|---|---|---|
| AUTH-2 | Resolved. Add step (any kind, optional insert into a single path), duplicate, change kind with the dropped fields listed, delete with an optional reconnect, make start; **Add step…** and **Tidy layout** in the header (menu below 1,200 px) and in Tune values; **New process…** and **Import as a new process…** (8 slots). | `process-structure.ts`, `process-step-structure.ts`, `process-draft-actions.ts`, `process-definition-structure.ts`, `process-slots.ts`, `process-application.ts` | `business-process-analysis` "Structure adds a step of every kind …", "Structure deletes a step with its paths, reconnects …"; `process-step-editor-browser` "Step editor adds a step after this one and duplicates it …"; `process-draft-browser` "Add step adds to the draft through a Cancel-first dialog …"; `process-shell-browser` "New process and Import as a new process add a slot …" |
| AUTH-11 | Resolved. Deterministic layered `tidy`, `move` for drags; dragging a card past 4 px or Alt+Arrow writes one undoable draft step ("Moved <step>"). | `process-layout.ts`, `process-map-drag.ts`, `process-draft-actions.ts` | `business-process-analysis` "Layout tidy is deterministic …"; `process-renderers-browser` "2D map cards move by drag or Alt+Arrow …"; `process-draft-browser` "Dragging a 2D card writes one undoable draft step …" |
| AUTH-3 / ENG-9 | Resolved (scope decision). Recovery copy per process, game digest and running fingerprint; offered on load and after a switch with **Not now**, **Discard saved draft**, **Recover draft**; works without storage. | `process-recovery.ts` | `process-shell-browser` "A draft kept in this browser survives a reload …", "Recover draft restores the saved draft without applying it …" |
| AUTH-5 | Resolved for the step editor too: an in-dialog form history (Ctrl/Cmd+Z, Shift+Z, Ctrl+Y outside text fields) and "Removed … Undo"; structural edits are labelled steps of the Definition editor's history. | `process-step-history.ts`, `process-step-rows.ts` | `process-step-editor-browser` "Step editor undoes and redoes form edits outside text fields …" |
| AUTH-9 | Resolved. The Definition editor opened from the step editor shows **Back to <step>**. | `process-definition-editor.ts`, `process-step-editor.ts` | `process-step-editor-browser` "Definition editor opened from the step editor offers Back to the step …" |
| AUTH-15 | Resolved. The apply-over-run confirm offers **Export report first**, which exports and asks again on the same Back-first confirm. | `process-dialog.ts` (`confirmApplyOverRun`) | `process-step-editor-browser` "Apply over a run offers Export report first …" |
| AUTH-16 / UX-9 | Resolved. Each process slot keeps its paused run (minute, snapshot, run seed, selection, run length); switching asks nothing and never ticks. | `process-application.ts`, `process-slots.ts` | `business-process-analysis` "Each process keeps its own paused run across switches …"; `business-process-browser` "Process switch lists each process … keeps each paused run without asking or ticking …" (renamed) |
| AUTH-17 | Resolved. Compact phone sheets: the step editor's three footer actions stay in one row, the Definition editor's secondary actions in one grid; chrome within 30% of 390 x 844, also in DejaVu Sans. | `process-dialogs.css`, `process-dialog.ts` | `process-step-editor-browser` "Step editor and Definition editor sheet chrome stays within about 30% …" |

### Feedback, wayfinding, map and accessibility

| ID | Resolution | Where | Pinned by |
|---|---|---|---|
| UX-12 | Resolved. **Run to end**: one bounded clock command, disabled with its reason without a run length or after the run stopped. | `process-application.ts` (`runToEnd`), `process-run-bar.ts` | `business-process-analysis` "Run to end is one bounded clock command …"; `process-shell-browser` "Run to end is one clock command …" |
| UX-15 | Resolved. "Steps", "Fit to view", step subtitles name the kind in plain words without scene ids, the seed shows once. | `process-shell-markup.ts`, `process-ui.ts`, `process-inspector.ts` | `process-shell-browser` "Studio copy reads Steps and Fit to view …" |
| UX-4 / A11Y-11 | Resolved. The 2D cards are one roving tab stop with spatial Arrow keys, Home/End and Enter/Space. | `process-map-focus.ts` | `process-renderers-browser` "2D map step cards are one roving tab stop …" |
| A11Y-10 (legend) | Resolved. Below a 38rem legend row the key folds behind a **Legend** disclosure; the map keeps a 17rem minimum height. | `process-map-legend.ts` | `process-readability-browser` "At a 24px root font the legend folds into a Legend disclosure …" |
| PR-11 (wording) | Resolved for the wording: "working"/"running", "waiting" (queued minus held) and "blocked" (held) on the 2D cards, 3D captions, step list, SIPOC, journey funnel and slides. Full screen and a wider slide column remain deferred (below). | `process-work-state.ts`, `process-slides-text.ts` | `business-process-analysis` "Work-state words follow the studio in slides and SIPOC stages …"; `process-draft-browser` "The step list counts held work as blocked …" |
| PR-6 | Resolved. Brief deck: `{brief: true}`, `process slides --brief`, Present's **Section slides only**. | `process-slides.ts`, `process-present.ts`, `tools/process-cli.cts` | `business-process-analysis` "Brief slides keep the title, overview, resources, one section slide per section …"; `process-present-brief-browser` "Present switches to section slides only and back in place …" |
| DOM-11 (studio) | Resolved. BPMN exports name the count of fidelity notes; **Show export notes…** lists them. | `process-io.ts` | `process-shell-browser` "BPMN exports say how many notes …" |

### Analytics and interchange

| ID | Resolution | Where | Pinned by |
|---|---|---|---|
| DOM-2 | Resolved. `LWProcessReplicate` replications with n, mean, sample sd, Student t 95% interval and nearest-rank p10/p50/p90; `process replicate`; the Dashboard's What-if. | `process-replicate.ts`, `tools/process-cli-analytics.cts`, `process-dashboard-whatif*.ts` | `business-process-analysis` "Replication statistics use the sample sd, Student t intervals …", "CLI process replicate and compare …"; `process-dashboard-browser` "What-if runs seeds in slices …" |
| DOM-3 | Resolved. `RunOptions.onEvent` and `process run --event-log FILE --format csv\|xes`. | `process-kernel.ts`, `tools/process-event-log.cts` | `business-process-analysis` "The event sink streams every engine event …", "CLI process run streams every engine event to a CSV or XES event log …" |
| DOM-4 (warm-up) | Resolved. `warmup` in replications and `--warmup`; the Dashboard's **Measure from minute W**. | `process-replicate.ts`, `process-dashboard-window.ts` | `business-process-analysis` "Replication warm-up adds windowed KPIs …", "Dashboard window: offered at grid minutes only …" |
| DOM-5 (blocked time) | Resolved. Blocked time is a metric: `steps[].minutesBy.blocked` and `metrics.leadTime.blocked`. | `process-ledger.ts`, `process-ledger-cases.ts` | `business-process-analysis` "Read model pins minutes by status, dominant-state lead time …" |
| DOM-7 | Resolved (scope decision). Display calendar with `setCalendar`, BPMN extension, `process diff` paths, Tune values group and calendar wording in the clock, inspector, KPI strip, SIPOC, slides, random-view sentences and Dashboard. | `process-schema.ts`, `process-time.ts`, `process-tuning-calendar.ts`, `process-run-bar.ts` | `business-process-analysis` "Display calendar is optional and additive …", "Calendar wording glosses business days and weeks …"; `process-draft-browser` "With a display calendar the clock and Run until lengths …"; `process-definition-browser` "Tune values sets, checks and clears the display calendar …" |
| DOM-13 | Resolved. `compare` runs two definitions on the same seeds and reports the paired difference; `process compare`; What-if's **Applied design versus draft**. | `process-replicate.ts`, `process-dashboard-whatif.ts` | `business-process-analysis` "Paired comparisons share seeds …", "What-if comparisons word the paired difference from the draft side …" |
| DOM-14 | Resolved. Per-step starts, mean wait, fixed and work cost; per-pool work and capacity cost; throughput per hour (null at minute 0); cycle histogram; inspector analytics. | `process-ledger.ts`, `process-session.ts`, `process-inspector.ts` | `business-process-analysis` "Run ledger reports mean wait, throughput, per-pool and per-step cost …"; `process-definition-browser` "The inspector shows mean wait, work cost, idle cost and throughput …" |
| DOM-15 | Resolved. `LWProcessAdvice.advise` and `advisories` in `process validate`/`inspect`; notes in the inspector and step editor. | `process-advice.ts`, `process-random-view.ts` | `business-process-analysis` "Advisories list rounding bias by path …"; `process-definition-browser` "The inspector lists modelling notes …" |
| DOM-16 | Resolved. One route walker with an explicit fork option (`'expand'` or `'first-branch'`) for the SIPOC view, the slides and the journey map. | `process-route.ts` | `business-process-analysis` "Shared route walk keeps every demo deck byte-identical …" |
| DOM-17 | Resolved (content change). The loan applicant is the case: **Submit application** and **Sign contract** are pool-free touchpoints, the Customer pool is gone, the ends declare goal and lost outcomes (revision 0 to 2, fingerprint `221bcc4d80ed5e55`); no simulated value changed. | `docs/concepts/agency-delivery/content/loan-application.process.json` and its README section | `business-process` loan check in `test-process-steps.cts` (re-pinned) |
| PR-12 | Resolved. `--minutes`, `--runs`, `--warmup` and `--format` errors name the flag, before any work. | `tools/process-cli-analytics.cts` | `business-process-analysis` "Process commands name --minutes, --runs and --format in their errors …" |

### Scale, lifecycle, security and maintainability

| ID | Resolution | Where | Pinned by |
|---|---|---|---|
| ENG-4 (remainder) | Resolved. Fixed furniture merged per material class, flow arrows merged, a shadow rule; a 128-step overview drew 1,174 calls and 436 casters (7,473 and 7,045 before), budget 1,500 and 500. | `process-3d-kit.ts`, `process-3d-bake.ts`, `process-3d-stations.ts` | `process-renderers-browser` "3D draws a generated 128-step process within its draw-call budget …"; `process-scale-browser` "3D draws the 128-step process within the renderer draw-call budget …" |
| ENG-5 | Resolved. Keyed incremental SVG update; the structure is rebuilt only when the definition, drawn steps, positions or layout key change. | `process-map-patch.ts`, `process-renderer-2d.ts` | `process-renderers-browser` "2D map refreshes in place …" |
| ENG-10 | Resolved for the gate and the process source modules: TypeScript is measured by the advisory quality gate, and every `source/wildlands/source/process-*.ts` module and the process CLI modules are within 400 code lines, split into owned modules where needed. Older test and browser-suite files still carry long lines (below). | `scripts/quality_loc.py`, `quality-policy.json`; the module splits listed in the reference | `tests/test_quality_typescript.py` (Python unittest) |
| ENG-11 | Resolved. `LWProcessHtml` is the one escaping module; the inventory of local escapers is empty. | `process-html.ts` | `business-process-analysis` "LWProcessHtml html escapes every interpolation …", "Tune values and the inspector carry no local escaper; the remaining escapers are listed" |
| ENG-13 | Resolved. One palette (`LWProcessPalette`) checked against the `process.css` token block, and one work-state derivation (`LWProcessWorkState`) for every surface. | `process-palette.ts`, `process-work-state.ts` | `business-process-analysis` "Studio palette: every token role equals its process.css declaration …", "One work-state derivation: counts, card and dot states and progress agree …" |
| ENG-14 | Resolved. Caption canvases sized to their text; the agency process holds 720,384 caption pixels instead of 1,966,080. | `process-3d-captions.ts` | `process-renderers-browser` "3D caption canvases fit their text …" |
| ENG-16 | Resolved. Hostile definitions in every free-text field are visited in every view, editor, dialog and export under a report-only CSP probe; the suite found and fixed formula injection in the Dashboard CSV. | `verification/process-hostile-*.ts`, `process-dashboard-html.ts` | `process-hostile-browser`, `process-hostile-editors-browser` (18 checks) |
| ENG-17 | Resolved. A typed three.js facade (`process-three.d.ts`) and checked element lookups (`LWProcessDom.must`). | `process-three.d.ts`, `process-dom.ts` | `npm run typecheck` (strict) |

## The Dashboard

The Dashboard is a fourth stage view, per process, that answers a process owner's questions about
the active run without ever ticking it: a run identity and honesty strip, KPI tiles, flow over time,
where time goes, lead time and predictability, quality, cost, journey outcomes, a step focus,
What-if replications and a CSV export. Its contract is the
[Dashboard reference](../../docs/reference/business-process-engine.md#dashboard), and the task guide
is [Read a process dashboard](../../docs/how-to/read-a-process-dashboard.md).

**Research basis.** A design study on 10 October 2026 (web research plus a read of the engine at
`562fe17`) mapped the questions a process manager asks, in order, to studio data: is work flowing
(work in progress, arrivals against finishes, throughput, tied together by Little's law as an exact
identity over a window); how long a case takes and how predictable that is (lead-time percentiles
rather than the mean, the age of open work as the leading indicator, and censoring of open cases,
following Kanban and process-mining practice); where time is lost (lead time by work state, flow
efficiency, waiting ranked by step, as process-mining and BPM simulation tools overlay it); whether
capacity is right (utilisation against waiting, with Kingman's steep growth near full use); quality,
cost and journey outcomes; and how sure we are (replications with confidence intervals and a paired
comparison on common random numbers). Dashboard guidance (Few's pitfalls and bullet graphs, Tufte's
sparklines), WCAG 2.2 and Chartability shaped the layout: overview first, a data table for every
chart, keyboard-reachable marks, colour never alone, and the same honesty wording as the engine
documentation. It also specified the read-model additions (`wipArea`, minutes by state, per-case
books, fine distributions, a sampled series, recent cases and replication warm-up) that the DB-E
package implemented.

**Delivered** by DB-E (read model), DB-UI (view, charts, model, What-if) and DB-W (wiring to real
runs, the measuring window, the lead-time target, conversion over time, phone folds and per-pulse
cost: the app-onboarding journey drew in about 25 ms instead of 140 ms at 350 samples, measured on
a loaded machine). Its Node checks run in `business-process-analysis` and `business-process-readmodel`
and its browser checks in `process-dashboard-browser`.

## Integration fixes by the coordinator

- **DejaVu Sans phone footers** (`201a3a9`): hosted CI renders in DejaVu Sans, where the step
  editor's third footer button wrapped and the Definition editor's secondary actions took three
  lines; the step editor's actions never wrap as a row and the Definition editor's long labels get
  proportional columns, and the phone chrome check measures both fonts.
- **Slide checks registered twice** (`d863619`): the route, work-state and brief-deck checks imported
  their fixtures from `test-process-slides.cts`, so loading them in `business-process-analysis`
  registered the six slide checks again; the fixtures moved to `test-process-slides-fixtures.cts`,
  which registers no checks.
- **The business-process suite split** (`cabcd24`): `business-process` reached 108 s of its 120 s
  budget under load, so every Node check added in this pass runs in the new fast-tier
  `business-process-analysis` suite with the same names and assertions.
- **The Dashboard's dual-path checks** (`d863619`): two Dashboard model checks were written before
  the read model existed; each keeps its original assertion on a copy of the view without the new
  fields and adds the exact wording the merged data produces.
- **Escaping across waves** (`1367623`): the Add step dialog, written in the same wave as
  `LWProcessHtml`, moved onto it so the escaper inventory stays empty.
- **2D map framing under DejaVu Sans:** TODO(coordinator): state whether the fix for the check "2D
  map refreshes in place …" (the viewBox drift seen in hosted CI on `5c98627`) was merged, with its
  commit, or remove this line.

## Deliberate expectation changes, suites and timeouts

- **Checks:** `totalChecks` grew from 2,097 to 2,265 through 168 reviewed additions; one check was
  renamed with a `renames` entry (the process switch check now expects kept runs instead of a
  question); nothing was retired.
- **New suites (9):** `business-process-analysis` (Node, fast, 120 s), `business-process-readmodel`
  (Node, full, 180 s), `process-shell-browser`, `process-draft-browser`, `process-dashboard-browser`,
  `process-hostile-browser`, `process-hostile-editors-browser`, `process-scale-browser` (browser,
  300 s each) and `process-present-brief-browser` (browser, 120 s). Each was added so an existing
  suite stays within its time budget.
- **Timeout:** `process-step-editor-browser` went from 420 to 600 s (cost 76 to 100) when package C
  added its eight structure, undo and hand-off checks; it was measured at up to about 400 s under
  load afterwards. No other timeout changed.
- **Re-pinned on purpose:** the loan demo's fingerprint, run values, SIPOC hash and deck hash
  (`SIPOC_SHA`, `DECKS_SHA`) for DOM-17; the `discover` operation list (`setCalendar`, `replicate`,
  `compare`, `--brief`, `--warmup`); the blocked-work accessible name ("0 waiting, 2 blocked" instead
  of "(2 blocked)" inside the waiting count); the slide and SIPOC wording of work states; the
  planning-duration note; the KPI strip's Mean cycle wording; the stage control order with the
  Dashboard button; the phone menu items; and the studio map's card drag (it moves cards into the
  draft instead of panning). Each is explained in its commit message.

## What remains deferred

- **PR-11 presenter ergonomics:** full-screen Present and a wider slide column. The deck reads well at
  the current widths and nothing in this pass needed it; it is a presentation change of its own.
- **ENG-10 test files:** older Node and browser-suite files (for example `process-definition-browser.ts`,
  `process-step-editor-browser.ts`, `test-process-bpmn.cts`, `test-process-steps.cts`) still pack
  statements into lines over 160 characters. They are within the 450-line budget and the advisory
  gate reports them; reflowing them without changing a check is a separate, mechanical change.
- **Calendars that change a run:** working hours, shifts and dated timers stay out of the engine;
  the display calendar is wording only, by the DOM-7 decision.
- **Statistical limits:** the 95% intervals use a t-table to 30 degrees of freedom and 1.96 beyond,
  slightly narrow between about 31 and 120 runs; percentiles in the Dashboard are bin brackets. Both
  are stated where the numbers appear.
- **Not in scope:** process checkpoints and saved-run restoration (only an unapplied draft is
  recovered), a light theme and Godot process export.
- **Not validated:** no human usability test, screen-reader session or real Windows High Contrast
  run; screenshots and bounded runs of synthetic processes are review material, not usability,
  accessibility or balance validation, and a seeded run or a replication is not a forecast.

## Verification

- **Source identity:** TODO(coordinator): the branch, the head SHA the complete gate ran on, and
  whether the documentation commits and regenerated `bin/` and `demos/` came before or after it.
- **Complete registered gate:** TODO(coordinator): `npm run verify -- --jobs 3 --browser-jobs 2`
  result (checks passed of 2,265 or the final `totalChecks`, suites passed of 124, duration, machine
  and Chromium version).
- **Fast checks:** TODO(coordinator): `npm run typecheck`, `npm run architecture` (rules passed),
  `npm test` (fast tier count).
- **Generated artifacts:** TODO(coordinator): `npm run check:cli` and `npm run check:demos` results.
- **Repository checks:** `python3 scripts/check_docs.py` passed during the documentation pass (2,939
  local links). TODO(coordinator): the final `check_docs.py`, `python3 scripts/check_architecture.py`
  and `python3 -m unittest discover -s tests -p 'test_*.py'` results.
- **Native visual evidence:** TODO(coordinator): `npm run process:shots` for processes 1 and 7 (the
  minute, the number of captures, `overflowing` and `consoleErrors` from `shots.json`, and what the
  captures showed). The Dashboard is not captured by `process:shots`; say whether it was reviewed by
  hand.
- **Not run:** the Godot `scripts/verify.py` gate, which this standalone project does not touch.
  TODO(coordinator): add anything else that was skipped and why.
