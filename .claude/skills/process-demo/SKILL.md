---
name: process-demo
description: Add or edit a business-process demo in a Wildlands process game folder (for example docs/concepts/agency-delivery). Use when creating a new *.process.json for the agency delivery lab, changing an existing demo process, its game.json entry, README section, pinned Node check or gate registration, or reviewing a demo with process slides, process diff, BPMN exports or npm run process:shots.
---

# Add or edit a Wildlands process demo

Model change: PR #42 (`1336f48`, "Wildlands process: weekly delivery and release train demo") added
`docs/concepts/agency-delivery/content/delivery-release.process.json`. Follow the same shape. Read
first: `AGENTS.md` ("Standalone CLI projects", "Documentation housekeeping"),
`docs/how-to/business-process-authoring.md`, `docs/reference/wildlands-cli.md#business-processes`,
`docs/reference/business-process-engine.md` ("Presentation limits", "Verification suites").

Run everything from the repository root with the checked-in `bin/wildlands` (Node 22+). Work in a
scratch directory (`W=/tmp/pd`), never write a draft into the game folder until it validates.

## 1. Author with guarded edits

```sh
mkdir -p $W
bin/wildlands process discover                      # commands, limits, editOperations
bin/wildlands process schema --kind recipe          # exact recipe shape
bin/wildlands process create --id my-demo --name "My demo" --output $W/p0.json
bin/wildlands process inspect --input $W/p0.json    # -> revision, fingerprint (copy both)
bin/wildlands process edit --input $W/p0.json --recipe $W/r1.json --dry-run --draft
bin/wildlands process edit --input $W/p0.json --recipe $W/r1.json --output $W/p1.json --draft
bin/wildlands process validate --input $W/p1.json   # strict; --draft only for intermediate states
```

Recipe skeleton (one transaction: all operations apply and admit, or nothing is written):

```json
{"expectedRevision": 0, "expectedFingerprint": "<16 hex from inspect>",
 "operations": [
  {"op": "putResource", "value": {"id": "developers", "name": "Developers", "capacity": 3, "costPerMinute": 2}},
  {"op": "putStep", "value": {"id": "build", "name": "Build", "kind": "task", "duration": 60,
    "resources": {"developers": 1}, "phase": "Build",
    "scene": {"id": "scene-build", "position": [14, 0], "color": "#ffbb73"}}},
  {"op": "putFlow", "value": {"id": "start-build", "from": "start", "to": "build"}},
  {"op": "setArrivals", "value": [{"at": 0, "count": 1, "interval": 0, "data": {}}]},
  {"op": "setDescription", "value": "What the process shows, in plain language."},
  {"op": "setSeed", "value": 7},
  {"op": "setSipoc", "value": {"suppliers": [{"name": "Stakeholders", "supplies": "Goals"}],
                               "customers": [{"name": "End users", "receives": "Releases"}]}}
 ]}
```

- `putStep`/`putFlow`/`putResource` replace whole objects; also `removeStep`, `removeFlow`,
  `removeResource` (`{"op": ..., "id": ...}`), `setArrivals`, `setStart`, `rename`.
- Fields PR #42 had to write into the JSON by hand now have guarded operations, added in this same
  change: `setDescription {value: string|null}`, `setSeed {value: int|null}`, `setGenre {value}`
  (omit/`null` for a business process; `customer-journey` or `user-journey`), `setSipoc {value|null}`,
  `setTrack {value|null}` (`null` removes the field). Confirm with `process discover` (`editOperations`).
  Do not hand-edit the definition JSON.
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
   BPMN conformance check exports every `content/*.process.json` automatically.
5. `bin/wildlands validate-game --game docs/concepts/agency-delivery` (exit 0, `errors: []`).

## 3. Pin a Node check

Append a `test(...)` to `source/wildlands/source/test-process-steps.cts`, modelled on "Loan
application demo ..." and "Weekly delivery and release train ..." (~:230 and ~:254):

- `catalog.validate(d)` ok with `diagnostics: []`; `catalog.fingerprint(d)` equals the pinned value
  (`process inspect` prints it); id, seed, genre, every step `scene` without `asset` and a `phase`.
- Structure that matters (instances, deadlines, inclusive forks, chance flows, arrivals).
- `run(d, MINUTES)`: exact `[seed, minute, status, arrived, completed, failed, cost, meanCycleMinutes]`,
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
Quick partial run: `cd source/wildlands && npm run verify -- --only business-process,business-process-bpmn`.

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
bin/wildlands process slides --input $F --format md --minutes 2400 --seed 7 --output $W/slides.md
bin/wildlands process diff --input $W/before.json --against $F   # review every edit
```

Read `slides.md` as a learner: every step/phase slide explains its teaching point, numbers match the
README. (`process slides` and `process diff` are added in this same change; check `process discover`.)

Screenshots (Playwright Chromium; never `waitForTimeout`):

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium \
  npm --prefix source/wildlands run process:shots -- \
  --game docs/concepts/agency-delivery --process 8 --minute 2400 --out /tmp/pd/shots
```

`--process` is the 1-based position in `content.definitions`. The tool builds the game with
`bin/wildlands build-game`, runs to the minute through **Run until**/speed 30/**Run**, and writes
desktop 2D/3D/lens, desktop Present (first and a step slide), phone 390x844 studio and Present, and
DejaVu Sans Present variants plus `shots.json`. Check `minuteReached`, `overflowing: []` (each file's
`overflow.offenders`, and `overflow.dialog` for Present), `consoleErrors: []`, and open the PNGs:
truncated names, clipped controls, empty lenses. Present captures report "Present mode not available
in this build" until that studio mode exists. Exit 0 all available captures written, 1 a failure,
2 bad arguments.

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
change in the game folder needs no demo rebuild.

## 6. Handoff

- Source identity: branch, base and head SHAs, `bin/wildlands` and demo engine identity if rebuilt.
- Gates with results: `check:cli`, `check:demos`, `validate-game`, strict `tsc`, `architecture`,
  full `npm run verify` (suites/checks passed, `totalChecks`), `check_docs.py`, Python unittest,
  `validate-bpmn` x2 and the re-import fingerprints.
- Pinned numbers: fingerprint, seed, minute, status, cost, key counts, second-seed numbers.
- Skipped or unavailable checks and why (a `--only` or `--no-browser` run is partial evidence).
- Screenshots/`shots.json` path. Screenshots of a synthetic run are review material, not human
  usability, accessibility or visual-quality validation, and a seeded run is not a forecast.
- Notice: all durations, costs, capacities and probabilities are synthetic illustrative assumptions.
