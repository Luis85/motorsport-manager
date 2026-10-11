# Process Studio follow-up pass

> **Dated record, 10 October 2026.** This record describes the follow-up pass that resolved the
> deferred, open and partial findings of the [Process Studio review](PROCESS-STUDIO-REVIEW.md) and
> added the per-process Dashboard, and the [close-out pass](#close-out-pass) that closed what this
> pass still deferred. The current contract is the
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
- **2D map framing under DejaVu Sans** (`1379586`, `5b5ac00`, merged in `caec93d`; `22f6c33`,
  `aa9163a`, merged in `546ac3a`): hosted CI failed "2D map refreshes in place … matches a fresh
  draw" on `5c98627` and `923676f`. The map was drawn mid-command while the run bar's temporary
  status sentence changed the stage height in DejaVu Sans, so the camera framed for a size that was
  never painted and the ResizeObserver saw no net change. The camera now frames for the size the
  ResizeObserver reports, and an untouched camera re-frames on every draw like a fresh one. A camera
  the reader zoomed or panned keeps its scale and the centre of its clear area across a real resize
  (for example the KPI strip wrapping to a second row when outcome tiles appear). A new check in
  `process-renderers-browser` runs in DejaVu Sans, with ticks, Fit to view, numbered cards and a
  window resize; it fails against the old camera and with the scale rule turned off.
- **Load-order module** (`4bbbf93`): the pass's new studio modules took `build-inserts.cts`
  to 412 code lines; the `template-process` inserts now close `INSERTS` from
  `tools/build-inserts-process.cts` in the same order, so every artifact is unchanged.

## Deliberate expectation changes, suites and timeouts

- **Checks:** `totalChecks` grew from 2,097 to 2,266 through 169 reviewed additions; one check was
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

This list is kept as the follow-up pass left it. The [close-out pass](#close-out-pass) takes up every
item: Godot process export stays out of scope by decision, human and assistive-technology validation
is still not done, and the reflow of older test files is recorded there; see
[Deferred items closed](#deferred-items-closed).

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

- **Source identity:** branch `feature/process-studio-followups` (stacked on
  `feature/process-present-mode`), head `effd8265dd0e1cba98891f3d92a8a2c6fef3e3b4`. That head
  contains the documentation merge (`fa9724d`), both 2D framing merges, the load-order module and
  the regenerated `bin/` and `demos/`. Only this record's Verification text was committed after it.
- **Complete registered gate:** `npm run verify -- --jobs 3 --browser-jobs 2` on `effd826`:
  passed 2,266/2,266 checks in 124/124 suites, 1,891 s (19:26 to 19:57 UTC on 2026-10-10), in the
  Linux cloud container, Node v22.22.0, Playwright 1.63.0, Chromium 141.0.7390.37 (explicit
  override), with nothing else running. The inventory matched `gate-expectations.json`. The same
  gate had passed 2,266/2,266 on `b608752`, before the load-order split, in 1,850 s. Hosted CI
  passed on `b608752` and `d38681a`.
- **Fast checks:** on the merged head before the push, `tsc -p tsconfig.json --noEmit` and
  `tsc -p tsconfig.strict.json --noEmit` were clean and the fast tier (`--tier fast`) passed
  901/901 in 45 suites. The complete gate repeats the typecheck, architecture and fast-tier stages.
  The renderer, readability, Present, draft, lenses and business-process browser suites passed
  85/85, and `process-renderers-browser` passed 25/25 again with Inter blocked through fontconfig
  to emulate hosted CI.
- **Generated artifacts:** after `npm run build:cli` and `npm run build:demos`, `npm run check:cli`
  reported `bin/wildlands` current (14,087,801 bytes) and `npm run check:demos` reported all six demos
  current.
- **Repository checks:** `python3 scripts/check_docs.py` passed during the documentation pass (2,939
  local links). After the complete gates, `check_docs.py` passed again (2,939 links),
  `python3 scripts/check_architecture.py` passed, and `python3 -m unittest discover -s tests -p
  'test_*.py'` ran 355 tests: OK, 19 skipped (on `b608752` and again on `effd826`).
- **Size budget:** `python3 scripts/quality.py --loc-only` reports no file this pass added or
  changed over its budget (400 code lines per source file, 450 per test file).
- **Native visual evidence:** `npm run process:shots -- --game docs/concepts/agency-delivery
  --minute 240` for process 1 (completed at minute 217) and process 7 (run limit at minute 240):
  12 captures each, `overflowing` empty and `consoleErrors` empty in both `shots.json` files. The
  captures showed the following:
  - the 2D map of process 7 at 1440 px: 25 steps, shape-coded states, legend and Fit to view;
  - the 3D scene of process 1, with captions clear of props;
  - the process 7 phone studio, with numbered cards and the Dashboard and Present buttons hidden
    as designed;
  - a process 1 step slide in DejaVu Sans, framed with its direct neighbours.

  `process:shots` does not capture the Dashboard, and it was not reviewed by hand in this final pass.
  The Dashboard browser suite covers it. These are synthetic fixture states, not usability,
  accessibility or balance validation.
- **Not run:**
  - the Godot `scripts/verify.py` gate, which this standalone project does not touch;
  - `python3 scripts/quality.py`: advisory, and run by CI's "Code quality (warnings only)" job;
  - the 1366 x 768 capture of process 7, which `process:shots` does not take. Its label rules are
    covered by `process-readability-browser`.

## Close-out pass

> **Dated record, 10 October 2026.** The user asked to "close the open items" that the follow-up
> pass left in [What remains deferred](#what-remains-deferred) and the known notes of PR #46. This
> section records that pass; the current contract is the
> [business process reference](../../docs/reference/business-process-engine.md).

### Scope and method

- **Base:** `a541e17` (the follow-up pass's final verification record). **Head of the
  implementation:** `5eaf01b` ("Merge package LT: a Light theme toggle for the studio, dark by
  default, never stored"), followed by documentation-only commits and the coordinator's integration
  (see [Close-out verification](#close-out-verification)).
- **Packages**, each in its own worktree and merged by the coordinator with `git merge --no-ff`:
  **P** full-screen Present, Wide text and faster paging; **S** Run to end speed; **V** the
  Dashboard under the phone's sticky run bar and the visual-review fixes; **T** exact Student t
  quantiles and exact lead-time percentiles; **SF** the Scene Forge schema and viewer split; **CK**
  run checkpoints; **RC** opt-in working hours; **LT** the light theme. The CLI bundle and the demos
  were rebuilt in `289acc6` (after S and T) and `783850f` (after RC), before LT merged.
- Five further agents reflowed long lines in older process test files while this record was
  written; the coordinator records their outcome below.
- Every behaviour below was checked against the code at `5eaf01b` by the documentation pass, and the
  reference, the how-to guides (including the new
  [Save and resume a process run](../../docs/how-to/save-and-resume-a-process-run.md)), the CLI
  handbook, current status, the Wildlands README and the `process-demo` skill were synchronised with
  it.

### The user's decisions

| Decision | Outcome |
|---|---|
| Calendars that change a run | **Opt-in working hours.** One weekly window, `workingHours: {opensAt, closesAt, daysPerWeek}`, refused beside a display `calendar`; without it every definition, fingerprint and pinned number is unchanged. |
| Saved runs | **Checkpoints as files.** A run is exported and loaded as a `wildlands-process-checkpoint` JSON file in the studio and the CLI; nothing is written to browser storage. |
| Light theme | **A toggle, dark by default, not stored.** The choice lasts for the page and ends at a reload. |
| Godot process export | **Out of scope.** BPMN 2.0 with BPSim stays the interchange path. |

### Deferred items closed

| Deferred item | Resolution | Where | Pinned by |
|---|---|---|---|
| PR-11 presenter ergonomics: full screen | Resolved. A **Full screen** button and F act on the page root (a `<dialog>` cannot be the fullscreen element); the first Escape while full screen only leaves it; a disabled reason where the API is missing, not permitted or refused. | `process-present-view.ts`, `process-present.ts` | `process-present-screen-browser` "Full screen enters and leaves with its button and F …", "An Escape dated before full screen was left does not close Present …", "Full screen says why it is unavailable …" |
| PR-11 presenter ergonomics: a wider slide column | Resolved. **Wide text** gives the slide about three fifths of a side-by-side window and lasts for the page; a footer key hint names the keys. | `process-present-view.ts`, `process-present.css` | `process-present-screen-browser` "Wide text gives the slide most of a 1440x900 or 1920x1080 window …", "Present fits 1366x768, 1440x1060 and 390x844 …" |
| ENG-10 test files: long lines | TODO(coordinator): record the outcome of the five reflow agents (files, long lines before and after, checks unchanged). | | |
| Calendars that change a run | Resolved for weekly working hours (the user's decision): an elapsed clock from Monday at the opening; work and arrivals pause; timers and deadlines count elapsed minutes; costs and utilisation cover working minutes; a `closed` state; `setWorkingHours` (16 edit operations), `process diff` and `inspect`; BPMN `<wl:workingHours/>` and a BPSim `Calendar` with fidelity notes; Tune values **Working hours**; the run bar clock; inspector, Dashboard and slide notes; checkpoints. Shifts, holidays and dated timers are still not modelled. | `process-hours.ts`, `process-systems.ts`, `process-ledger.ts`, `process-series.ts`, `process-bpmn-bpsim-write.ts`, `process-tuning-hours.ts`, `process-time.ts` | `business-process-analysis` "Working hours pause work overnight …", "Working hours skip weekends …", "Working hours pause arrival streams …", "Timers and deadlines count elapsed minutes across a closed period", "Working-hours runs are deterministic and chunk-invariant …", "BPMN round trip carries working hours exactly, with a BPSim calendar …"; `process-hours-browser`; `business-process-checkpoint` "A working-hours run restored while closed and while open …" |
| Statistical limits: the t-table | Resolved. `t95` is the exact two-sided Student t quantile for every whole df (A&S 26.7.3/26.7.4 up to 1,000 df, Cornish-Fisher beyond); `ci95` uses it, and the 3-decimal table and the 1.96 fallback are gone. | `process-replicate.ts`, `process-dashboard-whatif.ts` | `business-process-analysis` "Student t quantiles are exact to 1e-6 for any whole df …", "Replication intervals use the exact Student t quantile for every df …" |
| Statistical limits: bracket-only percentiles | Resolved within a bound. Exact nearest-rank lead-time percentiles while at most 50,000 cases have completed (whole run and per outcome, `distributions().percentiles`), bin brackets past the bound with the reason stated; step distributions stay brackets. | `process-ledger-exact.ts`, `process-dashboard-panels.ts`, `process-dashboard-tiles.ts` | `business-process-analysis` "Exact lead-time percentiles of a small run …", "… fall back to bin brackets past the bound …", "Kept lead times give the same percentiles under random chunkings …" |
| Process checkpoints and saved-run restoration | Resolved as files (the user's decision). Format `wildlands-process-checkpoint` version 1 with strict validation and a 16 MiB limit; the read model (ledger, series, exact store) is carried, so a restore equals an uninterrupted run. Studio **Export run checkpoint…** and **Load checkpoint…** (Cancel first, fingerprint check, active process only, no storage); CLI `process run --checkpoint` and `--checkpoint-out`. | `process-checkpoint.ts`, `process-checkpoint-check.ts`, `process-engine-state.ts`, `process-application.ts`, `process-io.ts`, `tools/process-cli-analytics.cts` | `business-process-checkpoint` (13 checks); `process-checkpoint-browser` (5 checks); `process-hostile-editors-browser` "A hostile run checkpoint exports, asks with the hostile names as text …" |
| A light theme | Resolved (the user's decision). A **Light theme** `menuitemcheckbox`, dark by default and not stored; a light token block whose 106 meaningful pairs reach WCAG 2.2 AA; `LWProcessPalette` per theme; 3D keeps its dark rooms and changes only its background; forced colours win over either theme. | `process-theme.ts`, `process.css`, `process-palette.ts`, `process-renderer-3d.ts` | `business-process-analysis` "Light theme: every colour token has a light value, and the light pairs reach WCAG 2.2 AA …"; `process-theme-browser` (7 checks) |
| Godot process export | Out of scope by the user's decision; BPMN 2.0 with BPSim is the interchange path. | | |
| Human and assistive-technology validation | Still not done: no human usability test, screen-reader session or real Windows High Contrast run in this pass either. | | |

### Known notes from PR #46

| Note | Outcome |
|---|---|
| Speed: Run to end about 3 s and a Present slide about 220–390 ms at 128 steps | Resolved. Package S indexes live tokens and the join plan instead of rescanning on every settle, steps the clock entity directly, skips empty ECS flushes and groups tokens by step once per snapshot: Run to end over 10,000 minutes of the generated 128-step process fell from 2,257–3,138 ms to 762–1,202 ms (click to the first frame after it, six runs at load average 7 to 16), with identical results. Package P hides the studio behind Present (`content-visibility: hidden`), draws the map once per slide and skips the entrance animation when paging fast: synchronous work per Next fell from about 32 ms to 13 ms, and the mean per slide from 217–391 ms to 85–192 ms. The `process-scale-browser` bounds tightened (Run to end 20,000 to 8,000 ms, the frame after it 2,500 to 2,200 ms, paging 2,000 to 1,000 ms). `business-process-readmodel` pins the fast paths: "The generated 128-step process reproduces its reference run in one advance, in random chunks and through Run to end" compares a SHA-256 recorded with the engine before the fast paths. |
| KPI strip wrapping to a second row | Handled outside this pass (a separate session owns the KPI strip and the stage height). |
| 2D behaviour change (an untouched camera re-frames on every draw) | Unchanged; it remains the intended behaviour. |
| Pre-existing Scene Forge debt: `src/domain/schema.ts` 620 and `src/preview/viewer.ts` 784 code lines | Resolved. `schema.ts` is 150 code lines (schema families in `schema-values.ts`, `-content.ts`, `-documents.ts`, `-operations.ts`, `-littlewild.ts` and `-capture.ts`; public exports unchanged, generated schemas byte-identical) and `viewer.ts` 385 (camera rig, transform gizmo, node commands, scene tree, picking, shortcuts and other preview modules), counted with the repository's code-line rule. Scene Forge's own `docs/CODE_QUALITY.md` and `docs/EDITOR_EXTENSIONS.md` name the new owners, and `tests/schema.test.ts` and `tests/preview.test.ts` pin the seams. No repository document referenced the old files. The advisory TypeScript long-line warnings: TODO(coordinator) with the reflow outcome. |
| Phone run bar covering the Dashboard | Resolved. The Dashboard publishes the sticky run bar's bottom edge as `--db-sticky-top`, used as the page's `scroll-padding-top` while it is shown; Fit to view and tooltips respect it. Pinned by `process-dashboard-browser` "On a phone no dashboard focus stop or scrolled-to heading hides under the sticky run bar …" (390x844, 320x640, a 24 px root font and DejaVu Sans). |
| Run bar status written twice per command | Unchanged by this pass. |
| Escalated colour (new in this pass, with the light theme) | Known limit. The escalated-work colour fails the categorical palette validator's normal-vision floor (ΔE 15) beside the working and timer colours in both themes (dark ΔE 11.1 and 14.0, light ΔE 14.0 and 13.4, measured by the documentation pass with the dataviz `validate_palette.py`). Escalated 2D markers are also drawn 1.3 times larger with an outline, and cards, 3D captions and the inspector count escalations in words, so colour is not their only cue. |

### Visual-review fixes in the Dashboard

Package V captured four processes at 1440x1060, 1366x768 and 390x844, in DejaVu Sans and at a 24 px
root font, and fixed what it found: wide tables that widened their panel and the whole Dashboard (a
figure now has one `minmax(0, 1fr)` column and tables scroll inside it; text columns are no longer
flagged numeric); time axes labelled as offsets from the first sample (now round 1-2-5 minutes);
throughput columns over other minutes' labels (each labels its own interval end, and dense ones draw
as lines); half-case count ticks (whole ticks for whole values); the recent-cases scatter pressed into
the last sliver of a 0..T axis (it starts at the first drawn case, and bands on one edge share a
label); touching percentile labels ("p85p95", now joined); an arrivals chart that ended at the last
sample (it now ends at the run's minute with the snapshot's exact counts); What-if saying "no random
behaviour" for a random design whose seeds agreed (it now says the draws did not change the
measures); and section spacing.

### Deliberate expectation changes, suites and timeouts

- **Checks:** `totalChecks` grew from 2,266 to 2,330 at `5eaf01b` through 64 reviewed additions:
  `business-process-analysis` 86 to 110, `business-process-readmodel` 4 to 6,
  `process-dashboard-browser` 13 to 15, `process-hostile-editors-browser` 9 to 10, and the new suites
  below. No `renames` or `retirements` entry was added (package T renamed its own new check in place
  before it shipped). TODO(coordinator): the final count after the reflow merges.
- **New suites (5):** `business-process-checkpoint` (Node, full tier, 180 s, 13 checks),
  `process-present-screen-browser` (180 s, 7), `process-hours-browser` (180 s, 3),
  `process-checkpoint-browser` (240 s, 5) and `process-theme-browser` (300 s, 7), each added so an
  existing suite stays within its time budget. No existing timeout changed.
- **Re-pinned on purpose:** two replication intervals that came from the 3-decimal t table (7 df:
  `[3.212228, 6.787772]` to `[3.212512, 6.787488]`; 1 df: `[-10.706, 14.706]` to
  `[-10.706205, 14.706205]`); the What-if honesty text ("Intervals use exact Student t quantiles for
  runs − 1 degrees of freedom."); the `discover` lists (`setWorkingHours`, `--checkpoint`,
  `--checkpoint-out`); the menu item lists with the two checkpoint items and the theme toggle last
  (End and ArrowUp-on-open now land on `#theme-item`); the cumulative arrivals chart's extra point at
  the run's minute; `process-present-browser` reading the studio status line as text content while
  the studio is not rendered behind Present; the scale reference SHA, which now covers every field the
  reference engine had while `distributions.percentiles` is checked as exact on its own; and the
  tightened `process-scale-browser` bounds. Each is explained in its commit message.

### Close-out verification

- **Source identity:** TODO(coordinator): branch, final head SHA and the merges it contains
  (documentation, reflow, regenerated `bin/` and `demos/` after LT).
- **Complete registered gate:** TODO(coordinator): the `npm run verify` command, checks passed of
  `totalChecks`, suites, duration, environment (Node, Playwright, Chromium) and load.
- **Check counts:** TODO(coordinator): fast tier, typecheck, architecture, `gate-integrity`, Python
  unittest and `check_docs.py` results on the final head.
- **Generated artifacts:** TODO(coordinator): `npm run check:cli` and `npm run check:demos` on the
  final head (`bin/` and `demos/` were last rebuilt in `783850f`, before LT merged).
- **Screenshots:** TODO(coordinator): the `process:shots` captures reviewed (and any manual captures
  of Present full screen, Wide text, the light theme and the Dashboard), with `overflowing` and
  `consoleErrors`. Screenshots of synthetic fixture states are review material, not usability,
  accessibility or balance validation.
- **Documentation pass:** `python3 scripts/check_docs.py` passed after the documentation commits.
