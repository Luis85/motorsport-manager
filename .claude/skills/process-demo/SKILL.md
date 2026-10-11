---
name: process-demo
description: Add or edit a business-process demo in a Wildlands process game folder (for example docs/concepts/agency-delivery). Use when creating a new *.process.json for the agency delivery lab, changing an existing demo process, its game.json entry, README section, pinned Node check or gate registration, or reviewing a demo with process slides, process diff, BPMN exports or npm run process:shots.
---

# Add or edit a Wildlands process demo

Model change: PR #42 (`1336f48`, "Wildlands process: weekly delivery and release train demo") added
`docs/concepts/agency-delivery/content/delivery-release.process.json`. Follow the same shape. Read
first: `AGENTS.md` ("Standalone CLI projects", "Documentation housekeeping"),
`docs/how-to/business-process-authoring.md`, `docs/reference/wildlands-cli.md#business-processes`,
`docs/reference/business-process-engine.md` ("Presentation limits", "Dashboard", "Verification suites")
and `source/wildlands/PROCESS-STUDIO-FOLLOWUPS.md` (what the studio, the read model and the suites do now).

Run everything from the repository root with the checked-in `bin/wildlands` (Node 22+). When the
branch changes engine or CLI source and `bin/` is not rebuilt yet, run the same commands with
`node source/wildlands/.generated/tools/wildlands-cli.cjs` after `npm run build` in `source/wildlands`.
Work in a scratch directory (`W=/tmp/pd`); never write a draft into the game folder until it validates.

## 1. Author with guarded edits

```sh
mkdir -p $W
bin/wildlands process discover                      # commands, limits, editOperations
bin/wildlands process schema --kind recipe          # exact recipe shape
bin/wildlands process create --id my-demo --name "My demo" --output $W/p0.json
bin/wildlands process inspect --input $W/p0.json    # -> revision, fingerprint (copy both)
bin/wildlands process edit --input $W/p0.json --recipe $W/r1.json --dry-run
bin/wildlands process edit --input $W/p0.json --recipe $W/r1.json --output $W/p1.json
bin/wildlands process validate --input $W/p1.json   # strict
bin/wildlands process diff --input $W/p1.json --against $W/p0.json
# add --draft to edit (and validate) only for intermediate states with graph diagnostics
```

Recipe skeleton for the `create` starter (`start` -> `work` -> `end`, flows `start-work` and
`work-end`): one transaction, so every operation applies and the result is admitted, or nothing
is written. This one validates strictly (no `--draft` needed).

```json
{"expectedRevision": 0, "expectedFingerprint": "<16 hex from inspect>",
 "operations": [
  {"op": "removeFlow", "id": "start-work"}, {"op": "removeFlow", "id": "work-end"}, {"op": "removeStep", "id": "work"},
  {"op": "putResource", "value": {"id": "developers", "name": "Developers", "capacity": 3, "costPerMinute": 2}},
  {"op": "putStep", "value": {"id": "build", "name": "Build", "kind": "task", "duration": 60,
    "resources": {"developers": 1}, "phase": "Build",
    "scene": {"id": "scene-build", "position": [14, 0], "color": "#ffbb73"}}},
  {"op": "putStep", "value": {"id": "end", "name": "Released", "kind": "end", "phase": "Build",
    "scene": {"id": "scene-end", "position": [28, 0], "color": "#77b5a0"}}},
  {"op": "putFlow", "value": {"id": "start-build", "from": "start", "to": "build"}},
  {"op": "putFlow", "value": {"id": "build-end", "from": "build", "to": "end"}},
  {"op": "setArrivals", "value": [{"at": 0, "count": 1, "interval": 0, "data": {}}]},
  {"op": "setDescription", "value": "What the process shows, in plain language. All values are synthetic."},
  {"op": "setSeed", "value": 7},
  {"op": "setSipoc", "value": {"suppliers": [{"name": "Stakeholders", "supplies": "Goals"}],
                               "customers": [{"name": "End users", "receives": "Releases"}]}}
 ]}
```

- `putStep`/`putFlow`/`putResource` replace whole objects; also `removeStep`, `removeFlow`,
  `removeResource` (`{"op": ..., "id": ...}`), `setArrivals`, `setStart`, `rename`.
- Process settings PR #42 had to write into the JSON by hand now have guarded operations:
  `setDescription {value: string|null}`, `setSeed {value: int|null}`, `setSipoc {value|null}`,
  `setTrack {value|null}`, `setCalendar {value: {minutesPerDay, daysPerWeek}|null}` (`null` removes
  the field), `setWorkingHours {value: {opensAt, closesAt, daysPerWeek}|null}` and `setGenre {value}`
  with `process`, `customer-journey` or `user-journey` (`process` removes the field; `null` is
  rejected). `process discover` lists all 16 in `editOperations`. Do not hand-edit the definition JSON.
- A display calendar (`setCalendar`, for example 480 minutes per day and 5 days per week) only
  changes how long durations are worded; it changes the fingerprint but never a run. Add one only
  when the process is measured in working days, and say so in the README.
- Working hours (`setWorkingHours`, for example `{opensAt: 540, closesAt: 1020, daysPerWeek: 5}`)
  **change the run**: work and arrivals pause outside them, the clock counts elapsed minutes from
  Monday at the opening, and costs and utilisation count working minutes only. A definition cannot
  hold both a display calendar and working hours. No bundled demo uses them; adding them to a demo
  changes its fingerprint, its run numbers and its deck (the title slide names the hours), so every
  pin and hash below that covers it. Say so in the README, and give the `export-bpmn --bpsim`
  fidelity note about the BPSim calendar in its BPMN results.
- `process validate` and `inspect` print `advisories` (whole-minute rounding bias of a short random
  timing or gap). Treat each as a modelling note: raise the mean, or keep it and mention it in the
  README.
- Every edit: `inspect` for fresh guards, `--dry-run` first, then `--output` to a new file. On a stale
  guard, re-inspect and reconcile; never guess a revision. Keep the final file's revision small and
  explain it in the README provenance (PR #42 ended at revision 2).

### Scene markers and phases (match the existing non-agency processes)

- Every step has `scene: {id: "scene-<step id>", position: [x, y], color}` and **no `asset`**
  (only `agency.process.json` carries Scene Forge assets).
- Grid: main path left to right on `y = 0`, x in steps of 14 (`0, 14, 28, ...`); parallel branches and
  side routes at `y = ±8` to `±12` (deeper detours at 24+, `delivery-release` uses -26..48); keep
  branches between their fork and join columns.
- Colors by kind: start/end `#77b5a0`, task `#ffbb73` (ceremony/milestone `#e8c547`, alert `#d98aa6`),
  fork/join/timer `#91b9d5`, decision `#d6a2ce` (`#ffffff` in the journeys, `#91b9d5` in two older
  processes), system/machine reuse `#77b5a0`, `#91b9d5` or `#ffbb73`, a lost end `#d9777f`.
- `phase` is a **step-level** string on every step (it groups the SIPOC/Journey lens); there is no
  definition-level `phases` field.
- Synthetic values only; say so in the description.

## 2. Register the process in the game folder

1. Copy the validated file to `docs/concepts/agency-delivery/content/<id>.process.json`.
2. `docs/concepts/agency-delivery/game.json`: append it to `content.definitions` (1-8 entries; the
   agency lab holds 7, so one slot is left) and rewrite `presentation.description` (count word and a
   clause for the new process; it is also the `demos/README.md` blurb).
3. `docs/concepts/agency-delivery/README.md`: intro count ("holds N synthetic processes") and a new
   `## <Process name>` section: what it shows, the seeded-run numbers, provenance (how it was authored,
   guarded revisions), "validates strictly", BPMN results, synthetic-values notice.
4. Process counts in prose are manual: `docs/reference/current-state.md` (agency lab paragraph),
   `docs/concepts/README.md` (agency bullet), `source/wildlands/README.md` ("Business process scenes").
   The browser suites derive the count from `game.json` (`process-browser-fixture.ts` `COUNT`), and the
   BPMN conformance check exports every `content/*.process.json` automatically. Several Node suites
   iterate every `content/*.process.json` by themselves (the read-model sweeps of
   `business-process-readmodel`, the calendar wording, work-state and dashboard checks of
   `business-process-analysis`), so a new demo must pass them without a pin. These checks pin each
   deck or route instead, so a new process, or an edit that adds, removes, renames or re-phases steps
   or changes descriptions, must update them (take the numbers from
   `bin/wildlands process slides --input F`, which prints `slides`, and `--brief`):
   - `PINNED` in `source/wildlands/source/verification/process-present-browser.ts`: one slide count
     per process in `content.definitions` order (append the new deck's count);
     `process-present-browser` asserts `COUNT === PINNED.length` and every deck's length.
   - `PINNED` in `source/wildlands/source/test-process-slides.cts`: per file name, the slide count,
     section ids and ordered slide titles (the Node `business-process` suite); that file's demo
     checks also expect the number of bundled demos and that no deck shows "No description
     authored.", and its check "SIPOC model is pinned for every demo, counts cases per stage and
     shares the LWProcessRoute main route with the slides" hashes the SIPOC models of every demo at
     minute 0 and after 1,440 minutes with seed 7 (`SIPOC_LENGTH`, `SIPOC_SHA`): a new demo, or a
     change to phases, the main route, the SIPOC, arrival data or anything that changes those runs,
     changes that hash. Re-pin it and say why in the handoff.
   - `DECKS_LENGTH` and `DECKS_SHA` in `source/wildlands/source/test-process-route.cts`
     (`business-process-analysis`): the JSON of every demo's full deck and Markdown without a
     snapshot, so any change to a step's name, description, kind, pools, phase or path text, or a new
     demo, changes it; `JOURNEY_ROUTES` in the same file pins each demo's journey-map main route by
     file name (append the new demo's route; the check asserts the file list).
   - `BRIEF` in `source/wildlands/source/test-process-slides-brief.cts` (`business-process-analysis`):
     per file name the brief deck's slide count and ordered titles (`process slides --brief`).
   - `process-present-brief-browser` (`process-present-brief-checks.ts`) expects the first process's
     brief deck to have 10 slides; it changes only when the agency pipeline's sections change.
   - `process-shell-browser` ("New process and Import as a new process add a slot …") asserts that the
     agency game holds seven processes, so that New process fills the eighth and last slot. An eighth
     demo leaves no free slot: that check (and the studio's New process and Import as a new process
     in the published demo) then needs a deliberate change, reported in the handoff.
   - `business-process-checkpoint` ("Checkpoint restore equals an uninterrupted run on every demo …",
     `source/wildlands/source/test-process-checkpoint.cts`) restores every `content/*.process.json`
     at several seeds and minutes and asserts that there are seven demo files: a new demo must
     restore exactly, and an eighth file changes that count deliberately (report it).
5. `bin/wildlands validate-game --game docs/concepts/agency-delivery` (exit 0, `errors: []`).

## 3. Pin a Node check

Append a `test(...)` to `source/wildlands/source/test-process-steps.cts`, modelled on "Loan
application demo ..." and "Weekly delivery and release train ..." (~:230 and ~:254):

- `catalog.validate(d)` ok with `diagnostics: []`; `catalog.fingerprint(d)` equals the pinned value
  (`process inspect` prints it); id, seed, genre, every step `scene` without `asset` and a `phase`.
- Structure that matters (instances, deadlines, inclusive forks, chance flows, arrivals).
- `run(d, MINUTES)`: exact `[seed, minute, status, arrived, completed, failed, cost, meanCycleMinutes]`
  (`cost` is the work cost; `capacityCost` and `meanAgeMinutes` are read-model values you may pin too),
  resource `busyMinutes`, step `completed`/`visits`/`items`/`deadlines`, final case data.
  Take the numbers from `bin/wildlands process run --input F --minutes N --output $W/run.json`.
- Chunked-advance identity: one advance equals chunks `[1]`, `[7]`, `[60]`, `[1, 7, 60]`, and capacity
  is never exceeded; `run(copy(d), N)` equals the first run.
- A second seed (`runtime.create(d, {seed: 8})`, cross-check with `process run --seed 8`) with exact
  numbers.

Then register it in `source/wildlands/source/verification/gate-expectations.json` with **targeted
text edits** (never reformat or re-serialize the file): append the exact name to
`inventory["business-process"]` and `{"suite": "business-process", "name": "..."}` to
`reviewedAdditions`, and raise `totalChecks` by one
(`totalChecks = historicalBaseline.checks + reviewedAdditions.length - retirements.length`).
A renamed or removed check needs a `renames`/`retirements` entry. Never weaken an assertion.
Quick partial run: `cd source/wildlands && npm run verify -- --only business-process,business-process-analysis,business-process-bpmn,business-process-checkpoint`.
A partial `--only` run does not compare the check inventory with `gate-expectations.json`; run
`npm test` (the fast tier, which includes `gate-integrity`) before pushing a registration change.

## 4. Review the content

```sh
F=docs/concepts/agency-delivery/content/<id>.process.json
bin/wildlands process export-bpmn --input $F --output $W/p.bpmn
bin/wildlands process export-bpmn --input $F --output $W/p.bpsim.bpmn --bpsim
bin/wildlands process validate-bpmn --input $W/p.bpmn          # exit 0, "conforms": true
bin/wildlands process validate-bpmn --input $W/p.bpsim.bpmn    # exit 0
bin/wildlands process import-bpmn --input $W/p.bpmn --output $W/re1.json
bin/wildlands process import-bpmn --input $W/p.bpsim.bpmn --output $W/re2.json
bin/wildlands process inspect --input $W/re1.json   # fingerprint == the definition's (repeat for re2)
bin/wildlands process diff --input $W/p1.json --against $W/p0.json   # changes from p0 to p1, per edit
bin/wildlands process slides --input $F --format md --output $W/slides.md
bin/wildlands process slides --input $F --format md --minutes 2400 --seed 7 --output $W/slides-live.md
bin/wildlands process slides --input $F --format md --brief --output $W/slides-brief.md
bin/wildlands process validate --input $F                      # advisories: [] or reviewed
bin/wildlands process replicate --input $F --minutes 2400 --runs 20 --output $W/spread.json
```

- `diff --input NEW --against OLD` reports what changed from OLD to NEW (`summary`, `changes`,
  `changedSteps` with names, `changedSettings`, `changedResources`, `changedFlows`,
  `changedArrivals`, both revisions and fingerprints) and `fields`, every changed value as
  `{path, before, after}`. Run it after every guarded edit and before replacing a file in the game
  folder; read `fields` line by line: nothing unintended may appear.
- `export-bpmn` prints `fidelity`: what only the Wildlands extension carries. Check that the
  BPSim list says nothing surprising (for example a second arrival rule a foreign tool would
  drop) and mention notable entries in the README's BPMN results.
- Read `slides.md` as a learner: intro (title, overview/SIPOC, resources), one section per phase in
  main-route order, variants, summary. Every step has exactly one `step-<id>` slide; no step may read
  "No description authored."; phases appear in the intended order (an unphased step joins the phase
  before it); concept explainers match what the step really does. The live version (`--minutes`) must
  agree with the README numbers for that seed and minute. The brief deck names every step once on its
  section slide.
- `replicate` shows how much the README's seeded numbers vary across seeds; for a random process,
  give the README the range (for example p10 to p90 of the mean cycle) or say that other seeds
  differ, and never present one seed as the expected result.

Screenshots (Playwright Chromium; never `waitForTimeout`):

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium \
  npm --prefix source/wildlands run process:shots -- \
  --game docs/concepts/agency-delivery --process N --minute 2400 --out /tmp/pd/shots
```

`--process` is the 1-based position in `content.definitions`: the lab holds 7 processes, so an
existing demo is 1 to 7 and a new eighth one is 8. The tool builds the game with
`--cli FILE`, else `source/wildlands/.generated/tools/wildlands-cli.cjs` when present (run
`npm run build` first so it matches the source), else `bin/wildlands`; `shots.json` names the one used
(`cli`). It runs to the minute through **Run until**/speed 30/**Run** and writes `desktop-2d`,
`desktop-3d`, `desktop-lens`, `desktop-present-first`/`-step`, `phone-present-first`/`-step`,
`phone-studio` and the `-dejavu` variants of the four Present captures (`.png`) plus `shots.json`.
Check `minuteReached`, `overflowing: []` (each file's `overflow.offenders`, and `overflow.dialog`
for Present), `consoleErrors: []`, then open the PNGs: truncated names, clipped controls, empty lenses.
Exit 0 all available captures written, 1 a failure, 2 bad arguments.

Present mode review (in the PNGs, or by hand in the built HTML): the header reads "Slide n of N" and,
past minute 0, "Live facts come from one simulated run at business minute M (seed S, status)."; the
title slide's lead is short and **Key results** follow it; the resources slide lists each pool's
utilisation; the step slide shows that step framed on the map with its direct neighbours;
slide text is not cut off and Previous/Next stay visible (on a phone the map follows the slide, below
it); the DejaVu variants do not overflow; Contents lists every section; Exit returns to the previous
view with the run still paused. By hand, also try **Full screen** (F, then Escape leaves full screen
without closing Present) and **Wide text** on a desktop window, and the deck under **Light theme**
(Export menu; `process:shots` captures the dark default only).

Dashboard review (by hand in the built HTML; `process:shots` does not capture it): choose
**Dashboard** at the review minute. The strip names the seed and minute; **Waiting by step** and
**Capacity: pool utilisation** should point at the bottleneck the README describes; journeys and
processes with outcomes show **Journey outcomes**; **What-if** with 20 runs finishes without
touching the run's minute. Nothing may read "NaN" or show a chart without its data table. The
lead-time note says whether percentiles are exact (they are, below 50,000 finished cases). At phone
width no focused control or heading may hide under the sticky run bar.

Checkpoint review (optional, for a demo whose README quotes a run): `bin/wildlands process run --input
$F --minutes M1 --output $W/a.json --checkpoint-out $W/c.json`, then `--minutes M2 --checkpoint $W/c.json
--output $W/b.json`; `b.json`'s `snapshot` must equal one `--minutes M1+M2` run with the same seed.

## 5. Rebuild and gate

```sh
cd source/wildlands
npm run build:cli && npm run check:cli     # only when engine/CLI sources, package.json or tsconfig changed
npm run build:demos && npm run check:demos # always after a game-folder change (demos/agency-delivery.html,
                                           # demos/manifest.json, demos/README.md are regenerated)
cd ../.. && bin/wildlands validate-game --game docs/concepts/agency-delivery
cd source/wildlands && npx tsc -p tsconfig.strict.json && npm run architecture
mkdir -p /tmp/v && TMPDIR=/tmp/v PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium \
  npm run verify -- --jobs 3 --browser-jobs 2   # ~27 min: run in the background; TMPDIR <= 61 chars
cd ../.. && python3 scripts/check_docs.py && python3 -m unittest discover -s tests -p 'test_*.py'
```

Never hand-edit `bin/` or `demos/`; commit regenerated files with the source change. A README-only
change in the game folder needs no demo rebuild. Build and check the bundle from a clean `npm ci` in
`source/wildlands`: a `node_modules` borrowed from another checkout can differ from the lockfile and
make `check:cli` report a stale `bin/wildlands` even on an unchanged tree.

## 6. Handoff

- Source identity: branch, base and head SHAs, `bin/wildlands` and demo engine identity if rebuilt.
- Gates with results: `check:cli`, `check:demos`, `validate-game`, strict `tsc`, `architecture`,
  full `npm run verify` (suites/checks passed, `totalChecks`), `check_docs.py`, Python unittest,
  `validate-bpmn` x2 and the re-import fingerprints, `process diff` of each edit, `process slides`
  reviewed (slide count, sections, brief slide count), `advisories`, and every re-pinned value
  (`PINNED`, `SIPOC_SHA`, `DECKS_SHA`, `JOURNEY_ROUTES`, `BRIEF`) with the reason.
- Pinned numbers: fingerprint, seed, minute, status, cost, key counts, second-seed numbers.
- Skipped or unavailable checks and why (a `--only` or `--no-browser` run is partial evidence).
- Screenshots/`shots.json` path. Screenshots of a synthetic run are review material, not human
  usability, accessibility or visual-quality validation, and a seeded run is not a forecast.
- Notice: all durations, costs, capacities and probabilities are synthetic illustrative assumptions.
