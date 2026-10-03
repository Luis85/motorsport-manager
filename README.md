# Motorsport Manager — Godot

> **Current capability map:** [docs/current-state.md](docs/current-state.md) distinguishes the default Minimal UI, optional Advanced interface, retained specialist tools, merged data-driven content and unimplemented management proposals. PR #24's validated content refactor is now merged; older feature-parity and port-status snapshots are historical.

Native, local-first circuit authoring, two-car race management and a bounded Team Principal campaign. **0.19.0 — Composed mechanics, owned editing and complete weekend flow** separates domain rules, application scheduling, commands, detached read queries and persistence services. PR #27 adds the read-only Minimal Strategy comparison, a persisted Minimal/Advanced race-interface choice, and the first four-event management loop; all reuse the same authoritative race weekend rather than introducing a second race model.

See [architecture, extension recipes and verification boundaries](docs/architecture-refactor.md).

## Race interface modes

**Minimal** is the default and remains the recommended focused race screen. **Advanced** opens the retained Race Director or Engineering workspace over the same live weekend. Choose the mode in **Settings → Race interface**; Advanced can start in Race Director or directly in Engineering. The staged choice is saved only on Apply and takes effect when a weekend screen next opens.

Interface selection is presentation configuration. It does not clone the simulation, reset the recording, issue a command, advance time, change pause/speed, alter inventory or consume gameplay randomness. Existing saved `director` and `engineering` preferences remain valid; an `advanced` preference maps to Race Director. Unsupported values fall back to Minimal.

## Team Principal Campaign

The main menu now offers a local **Team Principal Campaign** alongside standalone Grand Prix weekends. The first slice is four events and is intentionally focused on proving the complete management loop:

**Director's Desk → review priorities → advance/start event → existing race weekend → exact settlement → factual debrief → next decision.**

The Director Desk keeps cash, committed minimum cash, next-event timing, principal energy and team standing visible. It shows at most three current priorities, organization work, five bounded rival organizations, resumable onboarding and the latest evidence-backed debrief. Event departure uses explicit driver/crew availability, campaign finance and installed car profiles; a blocked readiness check does not partially mutate the career.

Campaign weekends use the existing Minimal practice/qualifying/race flow and ordinary race recording/result envelope. Completed results are applied once to championship standings, returned inventory and cash before control returns to the Director Desk. Rivals have finite cash and reserves, accepted rosters and dated project cycles; they do not receive hidden race bonuses or private player information.

The four-event route remains the player-facing slice, but the underlying roadmap now also includes persistent recruitment/negotiation, people development/morale/trust/promises, multi-season planning/promotion/prizes, supplier/material conservation, engineering uncertainty, physical part wear/repair, distress/financing, founder-business transfers, academy capacity, era profiles, succession and legacy goals. Those later authorities are currently contract/domain foundations rather than dedicated specialist screens.

## Minimal race screen

- **Top:** Menu, session/time or race lap/flag, Pause, Play, speed, an on-demand read-only **Strategy** comparison in a live race, and one next-session action.
- **Left:** a four-column timing tower: position, driver, best time/gap and running state. Your two drivers are marked `*`; live estimated gaps are marked `~`.
- **Centre:** the actual circuit and moving cars, with pan, zoom and fit.
- **Right:** choose MER or MOR, then **Send out**, **Box this lap**, **Push**, **Calm**, or an **engine mode**.
- **Bottom:** both drivers’ fitted tyres (minimum wheel tread), temperature, fuel in lap-equivalent units, mechanical condition and separate damage. Cards also show estimated driver stress, last measured lap, neighboring race gaps, current pace/engine orders, actual speed and engine temperature. Cards are read only.

Minimal has no telemetry dashboards, editable strategy tabs/drawers, two-car decision cards, tool finders, race stories, or review workspaces in its panel tree. Its only forecast surface is the bounded read-only Strategy popup for the selected running driver. Advanced deliberately provides the broader strategy, weather, racecraft, telemetry, review and engineering workspaces instead of loading them invisibly behind Minimal.

## Open and play

For a standalone build, download the matching Linux or Windows artifact from the
**Standalone application** workflow. Extract the artifact ZIP and its inner
`.tar.gz`, keep `Motorsport Manager.pck` beside the executable, and launch the
executable. No Godot editor or source checkout is required. Check the matching
native-smoke evidence before treating a PR build as validated.

For source development, import the root `project.godot` in **Godot 4.7.2 Standard**,
allow script import, then press **F5**. No npm, .NET, browser or external Godot
plugin is required.

Choose an interface mode in Settings, then choose **Grand Prix Weekend**, a circuit, weather and race distance. Minimal uses **Review weekend** and a welcome before **Start practice** durably commits the new entry; Back or Cancel preserves the previous weekend. The focused setup leaves vehicle and advanced simulation parameters at their existing defaults. Advanced exposes the broader setup and opens its existing weekend briefing over the same production simulation.

| Session | Minimal player flow |
|---|---|
| Practice | Start practice → select each driver and Send out → two measured laps and an automatic physical return → End practice |
| Qualifying | Start qualifying → send each driver for an out lap, flying lap and in lap → End qualifying |
| Race | Start formation → cars physically take the grid → Start race → actual lights and racing → final timing tower → Weekend complete |

Closing practice or qualifying lets an already-started measured lap finish, waits for physical returns, and resumes playback if paused. The next session still requires your approval. Individual **Box this lap** calls in practice/qualifying abandon an unfinished timed lap; completed times remain.

Push and Calm are persistent alternatives; press the active button again for Normal. Engine modes are Save, Standard and Power. Send out does not unpause a paused session. Play/Pause and speed are separate. Race pit calls use a real available tyre set for observed conditions; a missed current-lap entry is disabled rather than silently promising a later stop. Strategy compares the current plan with available safe-entry/extension options using only current observations; it never issues or applies an order.

**Space** toggles play/pause, **1–5** choose 1×/2×/4×/8×/16×, **F** fits the circuit, and Enter activates a focused control. Minimal race shortcuts are suppressed while the Strategy popup has focus. Native menus retain their own keyboard navigation. Menu pauses and saves; Continue resumes the saved weekend. Settings offers 100%, 115% and 130% interface text plus the persisted Minimal/Advanced choice.

## Simulation retained, interfaces remain bounded

Finite four-wheel tyre stock, wear, fuel, health, setup, telemetry, traffic, overtakes, seeded weather, qualifying timing, physical pit routes and shared-box service continue in the existing simulation. This increment does not replace the physics or fabricate race outcomes.

Practice accepts explicit pace/engine changes, preserves them through garage return, excludes mixed-mode laps from clean calibration evidence, and validates their saved state. Minimal uses real recorded commands and detached read adapters. Its ordinary refresh loop does not run strategy forecasts or rebuild the timing tree; the existing forecaster runs only when Strategy is opened or explicitly refreshed, without commands, playback changes or gameplay RNG consumption.

Advanced mounts the retained `RaceDirectorWorkspace` over the same application-owned session. Race Director provides the approachable advanced surface and can expose the full Engineering tools; choosing Engineering in Settings opens those tools directly. Reopening either mode preserves the authoritative weekend, recording, command boundaries and scheduler. Selectability does not by itself establish human usability or calibration for every specialist workspace.

Explicit launch overrides remain available for development and automated verification:

```sh
godot --path . -- --pitwall-layout=minimal
godot --path . -- --pitwall-layout=advanced
godot --path . -- --pitwall-layout=director
godot --path . -- --pitwall-layout=engineering
```

Existing raw saves and supported session archives still load. New histories containing live practice modes require this implementation; compatibility with older application builds is not promised. Replay/sandbox/scenario/notebook tools retain their existing entry points and evidence boundaries. The circuit editor uses an application-owned document, transactional history and a detached reference preview.

See [the current instrument contracts and stress estimate](docs/driver-instruments.md), [the historical 0.17.1 UI pass and verification](docs/minimal-ui-polish.md), [the Minimal contract and implementation notes](docs/race-weekend-minimal.md), [verification scope](docs/minimal-verification.md), and the [historical documentation index](docs/README.md).

## Verify

```sh
LP_NUM_THREADS=2 python3 scripts/verify.py --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

Alternatively set `GODOT_BINARY` or put `godot` on PATH. Linux native UI checks need a display or `xvfb` plus `xauth`. `--headless-only` explicitly skips native UI verification. The runner imports a clean copy, isolates user data, requires the Minimal domain/native/full-journey suites, exercises interface-mode composition through the registered architecture UI suite, and retains the previous advanced corpus under its explicit layouts. Script errors fail verification even when a JSON summary reports success.

Reports and native screenshots go to `reports/`; CI publishes evidence. `reports/verification.json` describes its own complete run. Targeted local checks, historical counts and hosted CI are not interchangeable.

## Scope and provenance

This is not a comprehensive tyre/vehicle physics rewrite, a fully presented dynasty/ERP-scale management simulation, a telemetry redesign or a calibrated racing simulator. The Team Principal campaign remains a bounded four-event player-facing slice even though TM-13–TM-16 foundations are now persisted behind it. Human playtesting of campaign comprehension and both race-interface modes, controller/screen-reader completeness, text beyond 130%, broader wet/endurance balance and hardware profiling remain validation work. There is no universal frame-rate guarantee.

Seven geographic outlines derive from Tomislav Bacinger's MIT-licensed `f1-circuits` through the supplied prototype; Pinecrest is fictional. [Third-party notices](THIRD_PARTY_NOTICES.md) retain attribution. These are unofficial reconstructions with authored estimates, not laser scans or certified circuit/vehicle models. No official championship branding, car models or driver likenesses are used. Code retains the [MIT license](LICENSE), copyright Luis Mendez.

## Refactor continuation (0.19.0)

The shipping Minimal flow stages configuration and a welcome before starting
practice, and opens a factual end screen after the physical race. New entry is
persisted before replacing a prior weekend. The track editor owns a separate
application session with transactional history and a reference-only preview.

Architecture guides: [composed mechanics](docs/composable-mechanics.md) and
[editor / weekend boundaries](docs/editor-and-weekend-boundaries.md).
Minimal and Advanced controllers use detached read/command boundaries over the same application-owned scheduler.
Authoritative entrants are typed `RaceCar` entities; saves and display queries
receive copied records. Race, replay and editor views do not receive schedulers.

All required test suites are registered in `scripts/verification_suites.json`.
Run `python3 scripts/verify.py --godot /path/to/godot` for complete local coverage.
CI uses six independent shards and a fail-closed aggregate `verify` gate; a
headless-only or partial run is not accepted as complete verification.

## Systems and mechanics development

Shipped game parameters live in [`config/`](config/README.md). Use
`python3 scripts/balance.py inspect race_tuning/default.json /balance` to inspect
the tuning surface, and the [balancing guide](docs/balancing.md) for validated
edits, dry runs and configuration comparisons.

Use `python3 scripts/mechanics.py list` to inspect providers and `python3 scripts/mechanics.py hooks` to inspect extension signatures. The [developer guide](docs/developing-mechanics.md) covers inactive scaffolding, explicit profile registration, state compatibility, typed-car records and scheduler-free view handles.

The [developer toolbox](docs/developer-toolbox.md) exposes real weekend, campaign
and track operations through a native Godot API and JSON/Python interface.
Discover supported actions, run explicit bounded steps, inspect detached state
and export snapshots in isolated tool sessions. Both interfaces use the same
application owners; tools do not launch `App` or write player saves. The
[adoption study](docs/design/developer-toolbox-adoption.md) explains the game model
and the Excalibur documentation, source and tests used to inform the design.

## Coherent interface and advisory quality

Menus, configuration, Settings, the editor, weekend entry, both race interfaces and final classification share `GameTheme`. The illustrated circuit keeps its own readable map palette. Settings preview changes before Apply, protect unsaved departures, preserve edits on save failure, and expose advanced-only preferences only when Advanced is staged. Interface text scaling also reaches the editor and native dialogs; the Minimal five driver actions are unchanged and Strategy remains read only.

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
debug/release artifacts. Extract the matching artifact ZIP, then its inner
`standalone-<platform>-<mode>.tar.gz` (which preserves Linux executable permissions).
Keep the executable and
`Motorsport Manager.pck` together, and launch the executable without the source
editor. A successful export is not runtime acceptance: inspect the corresponding
`standalone-evidence-<platform>-<mode>` artifact for executed native smoke and
restart/recovery results. [Build contract and verification scope](docs/standalone-validation.md).
