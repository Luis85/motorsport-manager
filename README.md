# Motorsport Manager — Godot

A native, local-first motorsport game: **author a circuit, qualify your drivers, manage the race from the pit wall**. Current implementation **0.6.0 — living racecraft and team coordination**.

## Open and play

Use **Godot 4.7.2 Standard**. Clone the repository, import the root `project.godot`, let Godot import the scripts, then press **F5**. No npm, .NET, browser, external asset service or Godot plugin is required.

Start with **Grand Prix Weekend → Pinecrest Motor Park → Formula → Dry → 3 laps**. Engineers can handle qualifying releases. Approve race preparation, formation and the starting lights when ready. Manage **Mercer (08)** and **Moreau (09)** from the pit wall. Space pauses; 1–5 selects 1×–16×. The main menu also offers Track Editor, Settings and Continue Weekend.

## Iteration 0.6.0 — living racecraft and team coordination

The live pit wall now includes **Team & battles → Cooperate / Battles / Shared pit box**. Persistent contest targets and phases develop through the existing physical corridor solver. Completed passes require measured overlap and clearance, with paired visual feedback and a player-controlled Watch action.

Name both teammates to hold relative position, allow a safe pass or grant bounded pit priority. Yielding has a real time cost. Priority can stagger an uncommitted delegated stop inside its approved window; it cannot take over manual pits or reorder existing orders. Rivals can cover or extend after publicly observed stops without reading private player plans or future weather.

Checkpoint **v6** preserves battle, team and rival-response state; native v1–v5 saves migrate explicitly. The debrief links commands to actual cooperation, pass and pit outcomes. Both car cards and primary controls remain reachable at the tested desktop sizes. The guide now includes team coordination.

See the [0.6 implementation and verification handoff](docs/race-weekend-living-racecraft.md). This is a playable **Stage B slice**, not completion of every GDD acceptance gate. Broad balance, calibrated forecast coverage and human playtesting remain open. Weather, reliability, deeper neutralization, practice and replay retain their documented later-stage scope.

## Preserved 0.5.0 milestone — strategy and consequence

Start **Strategy Scenarios → Two routes to the finish** to exercise the dry 24-lap slice. The native pit wall adds persistent two-car decision cards, **Compare / Plan / Control**, editable multi-stop windows, independent ownership and temporary push/save handback. Pit-rejoin estimates include geometry, finite sets, retained wheel damage, possible traffic and shared-box waiting. Forecasts remain observational and explicitly uncertain; physical execution produces measured debrief evidence.

Four scenario recipes are playable from briefing through results. The resumable guide explains real controls without auto-pausing. The strategy checkpoint extension persists owners, intents, plans, pit evidence and warnings without fabricated history; 0.6 extends it to v6. Normal setup defaults to 24 dry laps and retains 12-lap/custom choices without hidden format compression.

See the [historical 0.5 handoff](docs/race-weekend-implementation.md) for retained strategy controls and model assumptions. Its then-outstanding battle/team work and v5-current statements are superseded by the 0.6 handoff above.

## Preserved 0.4.0 foundation — racecraft and authoring parity

**Weekend:** individual FL/FR/RL/RR tyre condition, finite retained stock, staged five-field setup with Apply/Revert, live front brake bias, patient/balanced/assertive racecraft, a seven-strip surface field and clickable laboratory. Topic selectors, tyre subpages, expandable details and resumable guides improve access without moving the primary pit/release actions into scrolling content.

**Designer:** road/scenery multi-selection and marquee, group drag, planar transforms, alignment/distribution, flat scenery groups and duplication. Connected Freehand/Pen trace keeps the old circuit intact through Close → Preview → confirmed Replace. Invalid or stale previews cannot be applied; unfinished traces block testing/runtime export. Trace strokes are temporary, not saved editor-workspace documents.

**Protected foundation:** warm paper/green/brass UI, cached stylized scenery and **dot-only cars**; eight bundled circuits; Bezier editing, references, pit lanes and annotated features; measured out/hot/in qualifying; formation/grid/lights/race; finite tyre plans and physical pit service; live timing/telemetry; atomic storage and validated checkpoints.

See [release notes](docs/iteration-4.md), [feature parity](docs/feature-parity.md) and [interaction design](docs/interaction-design.md). This is a native adaptation, **not complete parity with every prototype subsystem**. Component engineering, people/stress, advanced sporting rules and constructed 3D tunnels/bridges remain outside this milestone. Company/dynasty management is deliberately excluded.

## Verify

```sh
python3 scripts/verify.py --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

Alternatively put `godot` on PATH or set `GODOT_BINARY`. Linux rendered UI tests need a display or `xvfb` plus `xauth`. `--headless-only` explicitly skips native UI verification. The verifier imports a clean copy, isolates user data, rejects script errors, and writes reports/screen captures under `reports/`. CI runs the suite and uploads evidence. The **Source project** workflow also archives tracked source into a downloadable project ZIP.

The generated verification report is authoritative for assertion counts and timing. See [verification](docs/verification.md) for scope and limitations. New application checkpoints are v6; supported native v1–v5 saves migrate explicitly. Browser saves are not compatible.

## Documentation and provenance

[Documentation index](docs/README.md) covers setup, architecture, systems, formats, controls and remaining boundaries. The seven geographic outlines derive from Tomislav Bacinger's MIT-licensed `f1-circuits` through the supplied prototype; Pinecrest is fictional. Existing data and attribution are preserved. See [third-party notices](THIRD_PARTY_NOTICES.md).

These are unofficial reconstructions, **not laser scans or certified circuit/vehicle simulations**. Widths, intermediate elevations, pit routes and scenery contain authored estimates. No official championship branding, car models or driver likenesses are used. Project code retains the repository's [MIT license](LICENSE), copyright Luis Mendez.
