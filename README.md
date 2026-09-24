# Motorsport Manager — Godot

A native, local-first motorsport game: **author a circuit, qualify your drivers, and manage two cars from the pit wall**. Current feature-branch implementation: **0.14.0 — circuit notebook and remembered challenges**, retaining authored replay scenarios and validated result evidence.

## Open and play

Use **Godot 4.7.2 Standard**. Import the root `project.godot`, allow script import, then press **F5**. No npm, .NET, browser, external asset service or Godot plugin is required.

Start **Grand Prix Weekend → Pinecrest Motor Park → Formula → Dry**. Optional practice buys information with real resources; skipping remains available. Engineers can handle qualifying releases. Approve preparation, formation and starting lights when ready. Manage **Daniel Mercer (MER)** and **Lucas Moreau (MOR)**. Space pauses; 1–5 selects 1×–16×. Native controls preserve text-editing shortcuts. Track Editor, Settings and Continue Weekend remain available.

**Watch / Strategy / Car / Team / Conditions / Review** organize the pit wall. Both driver cards retain urgent information and primary commands. Find / Ctrl+K navigates without issuing orders. Settings offers staged 100%, 115% and 130% pit-wall text. Alerts and guides do not pause the race or change its speed.

## Circuit notebook

**Weekend → Circuit notebook** or **Find / Ctrl+K → Review / Circuit notebook** lets you remember a completed original or sandbox run. Keep actual finishing distance, pit count, qualifying/practice evidence and authored challenge outcomes, then write a separate personal interpretation. Notes persist without changing car performance, forecasts or rewards. Duplicate recording preserves the note; stale edits and corrupt storage fail without overwriting it.

The main menu's **Replays & experiments** opens saved history. Filter by exact circuit snapshot, export the notebook or explicitly forget an entry. Primary actions stay outside scrolling evidence. Opening history never pauses the live race; pause first for reading time. The notebook is opt-in, bounded to 128 runs and 1,200 note characters, and does not silently import old receipts.

See [0.14 behavior and UI contract](docs/race-weekend-notebook.md) and [verification evidence](docs/notebook-verification.md). PR #11 has now integrated replay and scenario authoring into main. PR #10 targets main directly and retains those changes alongside the notebook; both test suites remain mandatory. The current replay model and native checkpoint v10 remain unchanged.

## Author a situation worth revisiting

Open **Review → Decision debrief → Replay / sandbox**, select a saved state before the finish, and choose **Author scenario…**. Describe a decision, two approaches, a hint and an observed finishing goal. Export to a JSON file. The captured track, field, stock, rules and seed remain fixed; text cannot create commands, forced winners or rewards.

Import through **Replays & experiments → Open recording or scenario…**, then **Try another decision**. Read the scenario brief and use the ordinary native pit wall. A goal remains pending until final classification and never awards campaign points, money or XP. Both return actions and the sandbox's separate save remain available. Long authoring forms scroll while Export and Cancel stay fixed.

The new scenario envelope is **v1**. Existing session/replay **v1**, result/receipt **v1** and embedded native checkpoint **v10** remain. Stronger validation checks frozen identity, final result structure and owned returned tyre sets; malformed evidence cannot silently replace existing receipts. The 16 MB file ceiling counts UTF-8 bytes, not characters.

See [scenario behavior and compatibility](docs/race-weekend-scenario-authoring.md) and [0.13 executed evidence and integration status](docs/scenario-authoring-verification.md). The 0.12 replay and 0.13 authoring capabilities are retained from main; their handoffs keep historical integration and verification records.

## Replay and alternate decisions

At **Review → Decision debrief**, use **Keep checkpoint**, then **Replay / sandbox**. Weekend and Find also open that viewer. Inspect the initial state, a saved checkpoint or endpoint; play the recorded continuation; or **Try another decision** in a separately paused native sandbox. Saved-state inspection and verified re-simulation are labeled differently.

The original view and unapplied strategy drafts are retained. Its clock does not advance while the separate replay workspace is open; its pause flag, speed, selection, commands and random streams are not rewritten. Return restores the same view and focus. The sandbox is explicitly labeled and uses a separate save slot, including phase autosaves. **Replays & experiments** in the main menu imports recordings/scenarios or resumes that experiment.

**Accept original result** stores a factual completed result once. Repeated event/hash acceptance is a no-op; conflicting results and sandboxes cannot replace the accepted fact. No campaign points, money or XP are awarded. A future campaign must implement its own entry validation and atomic settlement.

Supported old raw native saves start legacy-labeled partial histories without invented earlier commands. Original continuation requires the saved engine/model. Four retained checkpoints, 4,096 accepted inputs and the shared 16 MB storage ceiling bound recording. This is not video playback, an unlimited timeline or an unrestricted race-state editor.

See [0.12 behavior, migration and native interaction](docs/race-weekend-replay.md) and its [historical verification and measurements](docs/replay-verification.md).

## Retained gameplay and authoring

Finite driver-owned four-wheel tyre sets, actual resource costs, independent command ownership, approved pit windows and temporary intents underpin strategy. Rejoin forecasts expose uncertainty; physical pit routes, a shared box and safe team cooperation determine execution. Seeded weather uses public observations. Staged scalar reliability permits protection and real repair-only stops without inventing itemized components.

Optional practice retains comparable measured evidence, not a hidden setup bonus. Persistent battles and four contextual rival tendencies use the same legal stock and movement rules. Public rival inspection does not disclose exact private condition or future plans. Qualifying, formation, grid, lights, lapped finishes and all-retired classification remain native simulation responsibilities.

**Scenario challenges** contains dry strategy, weather, recovery, practice and rival-style recipes. Their starting resources and assistance are disclosed, and no winner is forced. Historical recipes and migrated saves retain their model semantics. See the [documentation index](docs/README.md) for each retained implementation and its limits.

**Circuit Atelier** retains eight bundled circuits, Bezier editing, background references, pit lanes, annotations, multi-selection, transforms, alignment/distribution, scenery groups and connected freehand/pen tracing. Authoring and live races use separate snapshots. Flat dot cars and the warm paper/green/brass presentation remain. This increment does not redesign the editor or add a campaign.

## Verify

```sh
LP_NUM_THREADS=2 python3 scripts/verify.py --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

Alternatively set `GODOT_BINARY` or put `godot` on PATH. Linux native UI checks need a display or `xvfb` plus `xauth`. `--headless-only` explicitly omits native UI verification. The runner imports a clean copy, isolates user data, preserves the earlier suites and requires replay domain, complete-race, native interaction and observer-cost checks plus the authored-scenario and notebook domain/storage/native interaction suites. It rejects script errors even when a JSON summary claims success.

Reports and native screenshots are produced under `reports/`. CI publishes evidence; the source workflow archives tracked source. `reports/verification.json` is authoritative for its run. Historical release counts are not current integration test results; local verification and hosted CI are separate.

## Scope and provenance

Driver pressure, arbitrary race-state/scenario editing, broader strategy calibration, actual campaign settlement, physical safety cars, red flags, full stewarding and itemized component engineering remain outside this slice. Human comprehension/accessibility testing, controller/screen-reader completeness, text beyond 130%, broad seed/circuit validation and hardware profiling remain open. There is no universal frame-rate guarantee.

The seven geographic outlines derive from Tomislav Bacinger's MIT-licensed `f1-circuits` through the supplied prototype; Pinecrest is fictional. Attribution remains in [third-party notices](THIRD_PARTY_NOTICES.md). These are unofficial reconstructions, not laser scans or certified circuit/vehicle simulations. Widths, elevations, pit routes and scenery include authored estimates. No official championship branding, car models or driver likenesses are used. Code retains the [MIT license](LICENSE), copyright Luis Mendez.
