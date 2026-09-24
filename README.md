# Motorsport Manager — Godot

A native, local-first motorsport game: **author a circuit, qualify your drivers, and manage two cars from the pit wall**. Current feature-branch implementation: **0.12.0 — independent replay and sandbox experiments**.

## Open and play

Use **Godot 4.7.2 Standard**. Import the root `project.godot`, allow script import, then press **F5**. No npm, .NET, browser, external asset service or Godot plugin is required.

Start **Grand Prix Weekend → Pinecrest Motor Park → Formula → Dry**. Optional practice buys information with real resources; skipping remains available. Engineers can handle qualifying releases. Approve preparation, formation and starting lights when ready. Manage **Daniel Mercer (MER)** and **Lucas Moreau (MOR)**. Space pauses; 1–5 selects 1×–16×. Native controls preserve text-editing shortcuts. Track Editor, Settings and Continue Weekend remain available.

**Watch / Strategy / Car / Team / Conditions / Review** organize the pit wall. Both driver cards retain urgent information and primary commands. Find / Ctrl+K navigates without issuing orders. Settings offers staged 100%, 115% and 130% pit-wall text. Alerts and guides do not pause the race or change its speed.

## Replay and alternate decisions

At **Review → Decision debrief**, use **Keep checkpoint**, then **Replay / sandbox**. Weekend and Find also open that viewer. Inspect the initial state, a saved checkpoint or endpoint; play the recorded continuation; or **Try another decision** in a separately paused native sandbox. Saved-state inspection and verified re-simulation are labeled differently.

The original view and unapplied strategy drafts are retained. Its clock does not advance while the separate replay workspace is open; its pause flag, speed, selection, commands and random streams are not rewritten. Return restores the same view and focus. The sandbox is explicitly labeled and uses a separate save slot, including phase autosaves. **Replays & experiments** in the main menu imports captured recordings/scenarios or resumes that experiment.

**Accept original result** stores a factual completed result once. Repeated event/hash acceptance is a no-op; conflicting results and sandboxes cannot replace the accepted fact. No campaign points, money or XP are awarded. A future campaign must implement its own entry validation and atomic settlement.

Session/replay envelope **v1** retains native checkpoint **v10**. Supported old raw native saves start legacy-labeled partial histories without invented earlier commands. Original continuation requires the saved engine/model. Four retained checkpoints, 4,096 accepted inputs and the shared 16 MB storage ceiling bound recording. This is not video playback, an unlimited timeline or a complete scenario editor.

See [0.12 behavior, migration and native interaction](docs/race-weekend-replay.md) and [executed verification and measurements](docs/replay-verification.md). PR #8 is stacked on unmerged PR #6; these are feature-branch capabilities, not a claim that main already contains them.

## Retained gameplay and authoring

Finite driver-owned four-wheel tyre sets, actual resource costs, independent command ownership, approved pit windows and temporary intents underpin strategy. Rejoin forecasts expose uncertainty; physical pit routes, a shared box and safe team cooperation determine execution. Seeded weather uses public observations. Staged scalar reliability permits protection and real repair-only stops without inventing itemized components.

Optional practice retains comparable measured evidence, not a hidden setup bonus. Persistent battles and four contextual rival tendencies use the same legal stock and movement rules. Public rival inspection does not disclose exact private condition or future plans. Qualifying, formation, grid, lights, lapped finishes and all-retired classification remain native simulation responsibilities.

**Scenario challenges** contains dry strategy, weather, recovery, practice and rival-style recipes. Their starting resources and assistance are disclosed, and no winner is forced. Historical recipes and migrated saves retain their model semantics. See the [documentation index](docs/README.md) for each retained implementation and its limits.

**Circuit Atelier** retains eight bundled circuits, Bezier editing, background references, pit lanes, annotations, multi-selection, transforms, alignment/distribution, scenery groups and connected freehand/pen tracing. Authoring and live races use separate snapshots. Flat dot cars and the warm paper/green/brass presentation remain. This increment does not redesign the editor or add a campaign.

## Verify

```sh
python3 scripts/verify.py --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

Alternatively set `GODOT_BINARY` or put `godot` on PATH. Linux native UI checks need a display or `xvfb` plus `xauth`. `--headless-only` explicitly omits native UI verification. The runner imports a clean copy, isolates user data, preserves the earlier suites and now requires replay domain, full-race, native interaction and observer-cost checks. It rejects script errors and failed assertions.

Reports and native screenshots are produced under `reports/`. CI publishes evidence; the source workflow archives tracked source. `reports/verification.json` is authoritative for its run. Historical release counts are not current test results; local verification and hosted CI are separate.

## Scope and provenance

Driver pressure, richer replay/scenario authoring, broader strategy calibration, actual campaign settlement, physical safety cars, red flags, full stewarding and itemized component engineering remain outside this slice. Human comprehension/accessibility testing, controller/screen-reader completeness, text beyond 130%, broad seed/circuit validation and hardware profiling remain open. There is no universal frame-rate guarantee.

The seven geographic outlines derive from Tomislav Bacinger's MIT-licensed `f1-circuits` through the supplied prototype; Pinecrest is fictional. Attribution remains in [third-party notices](THIRD_PARTY_NOTICES.md). These are unofficial reconstructions, not laser scans or certified circuit/vehicle simulations. Widths, elevations, pit routes and scenery include authored estimates. No official championship branding, car models or driver likenesses are used. Code retains the [MIT license](LICENSE), copyright Luis Mendez.
