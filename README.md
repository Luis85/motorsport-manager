# Motorsport Manager — Godot

A native, local-first motorsport game: **author a circuit, qualify your drivers, manage the race from the pit wall**.

## Open and play

Use **Godot 4.7.2, standard edition**. Clone this repository, import its root `project.godot`, let the editor import the scripts, and press **F5**. No npm, .NET, web browser, external assets, or Godot plugins are required.

The main menu offers **Grand Prix Weekend**, **Track Editor**, **Continue Weekend**, and **Settings**.

For a quick first drive, choose **Pinecrest Motor Park**, **Formula**, **Dry**, and **3 laps**. Start qualifying; delegated engineers run the cars. After qualifying, approve race preparation, the formation lap, and the starting lights. Control **Mercer (08)** and **Moreau (09)** from the right-hand pit wall. Space pauses; keys 1–5 select 1×–16× speed.

## This iteration

- Native Godot Controls and custom 2D rendering, with a shared compiled circuit model. This is not an HTML game wrapped in Godot.
- Circuit Atelier-style Bézier editing, per-point width/elevation/banking, pit-lane editing, track features, reference images, undo/redo, authoring import/export, and compiled racing-line export.
- Eight bundled editable circuits: Monaco, Monza, Spa-Francorchamps, Silverstone, Suzuka, Zandvoort, Interlagos, and fictional Pinecrest Motor Park. Custom tracks enter the same weekend library.
- Full weekend flow: briefing → measured qualifying out/hot/in laps → grid → race preparation → formation lap → start lights → top-down race → classification.
- Twelve drivers, two player-controlled cars, pace/engine commands, delegated strategy, tyre condition/temperature, fuel, pit queues and servicing, weather, rubber/water evolution, overtaking/yielding, incidents, yellow flags, and a simplified safety-car neutralization.
- Atomic local saves, an exact native checkpoint format, settings, race-log export, deterministic headless tests, and rendered native UI smoke tests.

**Scope:** the complete playable weekend loop and the editor's core authoring workflow are implemented. This is a native reimplementation, not a byte-for-byte port of every JavaScript subsystem. Company/dynasty management is deliberately excluded. Advanced editor wizards, the old engineering/tyre-inventory model, and a globally optimized racing-line solver are not included. See the explicit [port status](docs/port-status.md).

## Verify

```sh
python3 scripts/verify.py --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

Alternatively put `godot` on PATH or set `GODOT_BINARY`. Linux UI verification needs a display or `xvfb` plus `xauth`; the verifier uses software rendering and isolated user data. `--headless-only` explicitly skips rendered UI checks. CI runs the full suite and uploads logs, JSON reports, and eleven native screenshots.

## Documentation

Start at [docs/README.md](docs/README.md): getting started, architecture, editor controls, track formats, weekend mechanics, simulation, persistence, verification, and port status.

## License and data

Project code retains the repository's [MIT license](LICENSE), copyright Luis Mendez. Geographic circuit outlines derive from Tomislav Bacinger's MIT-licensed `f1-circuits`, through the Circuit Atelier v0.4 prototype; see [third-party notices](THIRD_PARTY_NOTICES.md). These are unofficial reconstructions, **not laser scans or certified circuit/vehicle simulations**. Local widths, intermediate elevations, banking, pit routes, and scenery contain authored estimates. No official championship branding, car models, or driver likenesses are used.
