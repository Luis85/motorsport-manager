# Track B: process prototype (deliveries, queues, journeys)

For ideas that are a flow of cases through steps and shared resources (a courier shift, a kitchen
line, an onboarding journey). Uses `bin/wildlands process` and a one-definition `process` game
folder. Set up `$W/env.sh` as in SKILL.md section 0 first. The `process-demo` skill and
`docs/how-to/business-process-authoring.md` have the full edit operation set.

## B1. Author the definition with a guarded recipe

```sh
W=<abs>; . "$W/env.sh"; mkdir -p "$W/process" "$W/game/courier/content"
r pr-create bin/wildlands process create --id courier-run --name "Courier run" --output "$W/process/p0.json"
r pr-inspect bin/wildlands process inspect --input "$W/process/p0.json"
REV=$(j "$W/logs/pr-inspect.json" revision); FPR=$(j "$W/logs/pr-inspect.json" fingerprint)
cat > "$W/process/r1.json" <<EOF
{"expectedRevision": $REV, "expectedFingerprint": "$FPR",
 "operations": [
  {"op": "removeFlow", "id": "start-work"}, {"op": "removeFlow", "id": "work-end"}, {"op": "removeStep", "id": "work"},
  {"op": "putResource", "value": {"id": "riders", "name": "Riders", "capacity": 2, "costPerMinute": 1}},
  {"op": "putStep", "value": {"id": "pickup", "name": "Pick up parcel", "kind": "task", "duration": 10, "resources": {"riders": 1}, "phase": "Run", "scene": {"id": "scene-pickup", "position": [14, 0], "color": "#ffbb73"}}},
  {"op": "putStep", "value": {"id": "ride", "name": "Ride across town", "kind": "task", "duration": 25, "resources": {"riders": 1}, "phase": "Run", "scene": {"id": "scene-ride", "position": [28, 0], "color": "#ffbb73"}}},
  {"op": "putStep", "value": {"id": "end", "name": "Delivered", "kind": "end", "phase": "Run", "scene": {"id": "scene-end", "position": [42, 0], "color": "#77b5a0"}}},
  {"op": "putFlow", "value": {"id": "start-pickup", "from": "start", "to": "pickup"}},
  {"op": "putFlow", "value": {"id": "pickup-ride", "from": "pickup", "to": "ride"}},
  {"op": "putFlow", "value": {"id": "ride-end", "from": "ride", "to": "end"}},
  {"op": "setArrivals", "value": [{"at": 0, "count": 6, "interval": 15, "data": {}}]},
  {"op": "setDescription", "value": "A tiny courier shift: parcels arrive every 15 minutes and two riders deliver them. All values are synthetic."},
  {"op": "setSeed", "value": 7}
 ]}
EOF
r pr-edit-dry bin/wildlands process edit --input "$W/process/p0.json" --recipe "$W/process/r1.json" --dry-run
r pr-edit bin/wildlands process edit --input "$W/process/p0.json" --recipe "$W/process/r1.json" --output "$W/process/p1.json"
r pr-validate bin/wildlands process validate --input "$W/process/p1.json"
r pr-run bin/wildlands process run --input "$W/process/p1.json" --minutes 240 --output "$W/process/run-240.json"
r pr-slides bin/wildlands process slides --input "$W/process/p1.json" --format md --minutes 240 --output "$W/process/slides.md"
```

The `create` starter has steps `start` -> `work` -> `end` (flows `start-work`, `work-end`). Every
step needs `phase` and `scene {id, position, color}`; keep synthetic values and say so.
`process run` reports `status`, `advancedMinutes` and `metrics` (arrived, completed, cost,
meanCycleMinutes); a seeded run is a deterministic fact, not a forecast.

## B2. Game folder, build and screenshots

```sh
W=<abs>; . "$W/env.sh"
cp "$W/process/p1.json" "$W/game/courier/content/courier-run.process.json"
cat > "$W/game/courier/game.json" <<'EOF'
{"format":"wildlands-game","schemaVersion":1,"id":"courier","name":"Courier run","version":"0.1.0","template":"process","engine":{"api":1},
 "content":{"definition":"content/courier-run.process.json"},
 "presentation":{"title":"Courier run","description":"Prototype: two riders deliver a morning of parcels. Synthetic values.","accent":"#ffbb73"},
 "storage":{"namespace":"wildlands.courier"},
 "targets":{"html":{"output":"demos/courier.html","budgetBytes":4194304}}}
EOF
r pr-validate-game bin/wildlands validate-game --game "$W/game/courier"
r pr-build bin/wildlands build-game --game "$W/game/courier" --output "$W/build/courier.html"
r pr-shots env PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH" npm --silent --prefix source/wildlands run process:shots -- --game "$W/game/courier" --process 1 --minute 60 --out "$W/captures/process" --cli bin/wildlands
```

`process:shots` runs from `source/wildlands` and needs its `node_modules` (`npm ci` there once if
missing; that touches no checked-in file). It writes `desktop-2d.png`, `desktop-3d.png`,
`desktop-lens.png`, Present captures and `shots.json`; check `consoleErrors: []` and
`overflowing: []`. Without it, use `capture-html.mjs` from SKILL.md A7 on `build/courier.html`
(no `--click`).

## B3. Storyboard cards for a process prototype

Use the SKILL.md section 3 shape with these cards: the definition (`process/p1.json`, recognized
as generic JSON facts), the run (`process/run-240.json`), the build receipt (`logs/pr-build.json`),
the captures (`captures/process/desktop-3d.png`, `desktop-2d.png`, `phone-present-step.png`) and an
intent card for the pitch and beats. Character Studio and the Forge tools are optional here. A
Scene Forge asset can be attached to a step with `bin/wildlands process attach` (guarded by
`--expected-revision`/`--expected-fingerprint`; see `bin/wildlands process discover`); that step
was not exercised in the validated run, so dry-run it first.
