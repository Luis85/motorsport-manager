# Motorsport Manager — Godot

Native, local-first circuit authoring and two-car race management. **0.19.0 — Composed mechanics, owned editing and complete weekend flow** separates domain rules, application scheduling, commands, detached read queries and persistence services while retaining the minimal pitwall and driver instruments. No new actions, sporting rules or stress mechanics.

See [architecture, extension recipes and verification boundaries](docs/architecture-refactor.md).

## One race screen

- **Top:** Menu, session/time or race lap/flag, Pause, Play, speed, and one next-session action.
- **Left:** a four-column timing tower: position, driver, best time/gap and running state. Your two drivers are marked `*`; live estimated gaps are marked `~`.
- **Centre:** the actual circuit and moving cars, with pan, zoom and fit.
- **Right:** choose MER or MOR, then **Send out**, **Box this lap**, **Push**, **Calm**, or an **engine mode**.
- **Bottom:** both drivers’ fitted tyres (minimum wheel tread), temperature, fuel in lap-equivalent units, mechanical condition and separate damage. Cards also show estimated driver stress, last measured lap, neighboring race gaps, current pace/engine orders, actual speed and engine temperature. Cards are read only.

There are no telemetry dashboards, strategy tabs, drawers, two-car decision cards, tool finders, forecast panels, race stories, or review workspaces in the normal race screen. This is a deliberately reduced foundation, not another progressive-disclosure layer.

## Open and play

Import the root `project.godot` in **Godot 4.7.2 Standard**, allow script import, then press **F5**. No npm, .NET, browser or external Godot plugin is required.

Choose **Grand Prix Weekend**, a circuit, weather and race distance, then **Review weekend**. The welcome previews the circuit and session flow. **Start practice** durably commits the new entry; Back or Cancel preserves the previous weekend. The minimal setup leaves vehicle and advanced simulation parameters at their existing defaults.

| Session | Player flow |
|---|---|
| Practice | Start practice → select each driver and Send out → two measured laps and an automatic physical return → End practice |
| Qualifying | Start qualifying → send each driver for an out lap, flying lap and in lap → End qualifying |
| Race | Start formation → cars physically take the grid → Start race → actual lights and racing → final timing tower → Weekend complete |

Closing practice or qualifying lets an already-started measured lap finish, waits for physical returns, and resumes playback if paused. The next session still requires your approval. Individual **Box this lap** calls in practice/qualifying abandon an unfinished timed lap; completed times remain.

Push and Calm are persistent alternatives; press the active button again for Normal. Engine modes are Save, Standard and Power. Send out does not unpause a paused session. Play/Pause and speed are separate. Race pit calls use a real available tyre set for observed conditions; a missed current-lap entry is disabled rather than silently promising a later stop.

**Space** toggles play/pause, **1–5** choose 1×/2×/4×/8×/16×, **F** fits the circuit, and Enter activates a focused control. Native menus retain their own keyboard navigation. Menu pauses and saves; Continue resumes the saved weekend. Settings offers 100%, 115% and 130% pit-wall text.

## Simulation retained, advanced UI removed

Finite four-wheel tyre stock, wear, fuel, health, setup, telemetry, traffic, overtakes, seeded weather, qualifying timing, physical pit routes and shared-box service continue in the existing simulation. This increment does not replace the physics or fabricate race outcomes.

Practice now accepts explicit pace/engine changes, preserves them through garage return, excludes mixed-mode laps from clean calibration evidence, and validates their saved state. The minimal screen uses real recorded commands and a separate, read-only timing adapter. Its refresh loop does not run strategy forecasts or rebuild the timing tree.

The previous Director and Engineering implementations remain in source for regression and development only. They are **not selectable in the normal UI**, and old saved layout preferences migrate to Minimal. An explicit diagnostic launch can still use:

```sh
godot --path . -- --pitwall-layout=director
godot --path . -- --pitwall-layout=engineering
```

Existing raw saves and supported session archives still load. New histories containing live practice modes require this implementation; compatibility with older application builds is not promised. Replay/sandbox/scenario/notebook tools are retained but are not normal-menu features in this iteration. The circuit editor now uses an application-owned document, transactional history and a detached reference preview.

See [the current instrument contracts and stress estimate](docs/driver-instruments.md), [the historical 0.17.1 UI pass and verification](docs/minimal-ui-polish.md), [the minimal contract and implementation notes](docs/race-weekend-minimal.md), [verification scope](docs/minimal-verification.md), and the [historical documentation index](docs/README.md).

## Verify

```sh
LP_NUM_THREADS=2 python3 scripts/verify.py --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

Alternatively set `GODOT_BINARY` or put `godot` on PATH. Linux native UI checks need a display or `xvfb` plus `xauth`. `--headless-only` explicitly skips native UI verification. The runner imports a clean copy, isolates user data, requires the new minimal domain/native/full-journey suites, and retains the entire previous corpus behind its diagnostic layouts. Script errors fail verification even when a JSON summary reports success.

Reports and native screenshots go to `reports/`; CI publishes evidence. `reports/verification.json` describes its own complete run. Targeted local checks, historical counts and hosted CI are not interchangeable.

## Scope and provenance

This is not a comprehensive tyre/vehicle physics rewrite, a new campaign, a telemetry redesign or a calibrated racing simulator. Human playtesting, controller/screen-reader completeness, text beyond 130%, broader wet/endurance balance and hardware profiling remain validation work. There is no universal frame-rate guarantee.

Seven geographic outlines derive from Tomislav Bacinger's MIT-licensed `f1-circuits` through the supplied prototype; Pinecrest is fictional. [Third-party notices](THIRD_PARTY_NOTICES.md) retain attribution. These are unofficial reconstructions with authored estimates, not laser scans or certified circuit/vehicle models. No official championship branding, car models or driver likenesses are used. Code retains the [MIT license](LICENSE), copyright Luis Mendez.


## Refactor continuation (0.19.0)

The shipping minimal flow now stages configuration and a welcome before starting
practice, and opens a factual end screen after the physical race. New entry is
persisted before replacing a prior weekend. The track editor owns a separate
application session with transactional history and a reference-only preview.

Architecture guides: [composed mechanics](docs/composable-mechanics.md) and
[editor / weekend boundaries](docs/editor-and-weekend-boundaries.md).
Legacy diagnostic controllers use the same detached boundary as the minimal UI.
Authoritative entrants are typed `RaceCar` entities; saves and display queries
receive copied records. Race, replay and editor views do not receive schedulers.

All required test suites are registered in `scripts/verification_suites.json`.
Run `python3 scripts/verify.py --godot /path/to/godot` for complete local coverage.
CI uses six independent shards and a fail-closed aggregate `verify` gate; a
headless-only or partial run is not accepted as complete verification.

## Systems and mechanics development

Use `python3 scripts/mechanics.py list` to inspect providers and `python3 scripts/mechanics.py hooks` to inspect extension signatures. The [developer guide](docs/developing-mechanics.md) covers inactive scaffolding, explicit profile registration, state compatibility, typed-car records and scheduler-free view handles.

## Coherent interface and advisory quality

Menus, configuration, Settings, the editor, weekend entry, pitwall and final
classification share `GameTheme`. The illustrated circuit keeps its own readable
map palette. Settings preview changes before Apply, protect unsaved departures,
and preserve edits on save failure. Interface text scaling also reaches the editor
and native dialogs; the minimal five driver actions are unchanged.

The separate quality workflow produces warnings and downloadable reports without
blocking CI. Budgets are 400 source / 450 test **code** lines, excluding blank and
comment lines. Existing functional and architectural checks stay required.
See the [quality guide](docs/code-quality.md), [flow audit and research](docs/design/game-flow-coherence.md),
and [contributor rules](AGENTS.md). Run locally with:

```sh
python3 -m pip install -r requirements-quality.txt
python3 scripts/quality.py
```

## Standalone desktop builds

The **Standalone application** workflow publishes separate Linux and Windows
debug/release artifacts. Extract the matching archive, keep the executable and
`Motorsport Manager.pck` together, and launch the executable without the source
editor. A successful export is not runtime acceptance: inspect the corresponding
`standalone-evidence-<platform>-<mode>` artifact for executed native smoke and
restart/recovery results. [Build contract and verification scope](docs/standalone-validation.md).
