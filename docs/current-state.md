# Current native project status

**Current scope:** Native project after merged PR #24, including the focused technical/documentation maintenance recorded in PR #27. PR #24's merge commit `66ab6f4e8e066f8abac649cd9ac3b98d42760a5c` has the same file tree as its tested source head `a8428c7ede134801acff609b12f20249cecc4054` and remains the evidence anchor for that refactor. This page describes shipped/player-facing behavior separately from optional specialist interfaces, retained developer tools, completed foundations, and unimplemented proposals. It supersedes old “current release” claims in historical guides but does not replace their detailed technical contracts.

## Shipping player experience

- **Native Godot 4.7.2, local-first, standalone desktop application.** The player-facing race interface defaults to **Minimal**. Settings can instead select **Advanced**, starting either in Race Director or directly in Engineering.
- **Weekend:** choose a circuit/configuration or a validated authored scenario; review before replacing an existing entry; practice (real measured runs) → qualifying → physical formation → start lights → race → factual end screen. Session transitions require explicit approval. Existing recorded commands, tyre ownership and saved weekends remain authoritative.
- **Minimal race screen:** timing tower, illustrated circuit with flat dot cars, five core driver actions (Send out, Box this lap, Push, Calm and engine mode), time controls, read-only instruments for both controlled drivers, and an on-demand read-only strategy comparison for the selected running driver. The comparison is an explicit snapshot or refresh of the existing current-condition forecaster; it issues no command, does not pause or change speed, and consumes no gameplay randomness.
- **Advanced race interface:** the retained Race Director and Engineering workspaces expose the broader strategy, telemetry, weather, racecraft, review and specialist toolset over the same live weekend. Race Director is the approachable advanced starting surface; Engineering opens the technical workspace directly. Choosing or reopening an interface does not clone the race, alter playback, issue commands or consume gameplay randomness.
- **Circuit Atelier:** edit/save native circuits with Bézier geometry, elevation/banking, pit routes, scenery, reference-image calibration, layer locks, transactional history, validation and test-weekend snapshots. Editor placement presets and contextual guide *copy* may be authored; rendering kinds and guide actions stay code-owned.
- **Content:** validated, strict external JSON packs with stable IDs, generated schemas, ordered dependencies, hash-pinned overrides, atomic catalog activation and frozen weekend/replay definitions. Supported families include vehicles, teams, drivers, rosters, tyre compounds/allocations/operating profiles, setups, shared tuning, weekends, circuits/styles, scenario briefs, mechanic profiles and editor profiles. A provider profile selects **registered code**; external packs cannot inject executable mechanics or arbitrary editor actions. The authoring CLI supports init, clone, validate, list, inspect, schemas, non-overwriting export, diff, bounded scenario test and ordered multi-pack workflows.

## Interface selection and retained specialist tools

Settings stages a **Minimal / Advanced** preference and saves it only on Apply. Minimal remains the safe default. Advanced remembers whether it should begin in Race Director or Engineering. The selection applies when a weekend screen next opens; it is presentation configuration, not race state. Existing `director` and `engineering` saved preferences remain valid, and the public `advanced` alias normalizes to Race Director. Explicit launch overrides remain available for development and automation.

The Advanced interface makes the retained strategy/rival, weather/recovery, racecraft/team-order, debrief/journal and telemetry workspaces player-selectable. Replay/sandbox, authored scenario, notebook and other specialist utilities retain their existing entry points and evidence boundaries. **Existence in source still does not establish human usability, accessibility completeness or calibration.** Minimal deliberately does not instantiate the advanced panel tree.

Bundled diagnostic scenario collections are trusted file-backed verification resources, not external executable scenario packs. Public authored complete-weekend scenarios can stage existing implemented weekend behavior, but do not add a campaign or arbitrary goal code.

## Implemented campaign integration foundation

- **Deterministic campaign shell:** `CampaignIdentity`, `CampaignClock` and `CampaignState` provide stable identities, a pure Gregorian fifteen-minute campaign clock, bounded daily principal energy, non-overlapping intervention reservations and an accepted command journal. State restores by replaying that journal; rejected commands do not mutate the snapshot.
- **Atomic campaign checkpoint:** `CampaignCheckpoint` binds the state to the exactly-once settlement ledger and an optional active weekend manifest. `CampaignStorage` validates and publishes the envelope through the existing temporary/backup/rollback policy. Failed replacement leaves the previous campaign authoritative.
- **Campaign/weekend boundary:** `CampaignWeekendManifest` freezes the exact race event, model, track, roster, starting resources, rules and stable campaign identity mapping. `CampaignWeekendSettlement` maps a valid completed `WeekendResult` back to stable campaign people/teams/cars and stages an exactly-once receipt ledger. Reapplying the same result is a no-op; a different result requires an explicit correction workflow.
- These foundations deliberately do **not** calculate championship points, cash, XP, repairs, component diagnoses or campaign-time consequences for a weekend. Those require separate versioned competition/economy rules and one atomic transaction over the campaign checkpoint.

## Not implemented or not established

- **No playable company/team-management campaign yet:** no campaign composition/navigation, finances, staff/contracts, engineering portfolio, event calendar, seasons/championship rules, founder workshop, rival organizations or dynasty progression. The implemented clock/energy/intervention records are a deterministic domain and storage foundation, not a management game or a second race engine.
- **Not a comprehensive vehicle-physics or licensed-regulations simulator.** Race damage remains aggregate; additional vehicle presets are not full competition formats. Editor bridge/tunnel annotations do not certify 3D clearances.
- **Human playtesting, comprehensive accessibility, broad device/hardware calibration, wet/endurance balance and same-host comparative performance remain separate validation gates.** Successful automated checks do not establish them. Making Advanced selectable is not a human-usefulness sign-off for every retained workspace.

## Verification: exact-source interpretation

PR #24's final source head `a8428c7` passed all six registered Godot shards and aggregate gate, content/exported-runtime jobs, runtime confidence, Linux/Windows debug/release builds and native standalone smoke journeys. The merge introduced no file changes. The advisory quality job completed **with findings**; its success is not a clean-quality sign-off. Consult that commit's retained GitHub Actions logs/artifacts for exact counts and source provenance instead of copying numbers from historical release notes.

Changes after that baseline, including the maintenance in PR #27, require their own exact-head workflows. A prior green run, an intermediate superseded run, or a successful advisory job is not substituted for final-source verification.

Current checkout verification entry points:
- `python3 scripts/verify.py --godot /path/to/pinned/Godot` — complete registered test gate, including required native UI environment.
- `python3 scripts/check_architecture.py` — dependency/authority contract.
- `python3 scripts/content.py schemas --check --godot /path/to/pinned/Godot` and content CLI tests — exact generated-schema/consumer contracts.
- `python3 scripts/quality.py` — **advisory** complete findings and actionable debt comparisons.

The registration source of truth is `scripts/verification_suites.json`; historical suite counts in release handoffs describe their original revisions only.

## Active maintenance priorities

1. Keep this page, the README and content status synchronized when a feature becomes player-facing, optional, only diagnostic, or deliberately deferred.
2. Reduce active high-churn legacy hotspots **by cohesive responsibility**, not semicolon packing or assertion weakening. At the PR #24 baseline, `race_sim.gd` had 726 counted code lines, retained `weekend.gd` 623 and retained `pitwall_workspace.gd` 419, against the 400-line source budget. This maintenance pass reduces active `track_canvas.gd` from 476 to exactly 400 by extracting read-only overlay responsibilities. Prioritize the remaining files when product work actually touches them; a line count alone is not a defect.
3. Distinguish implementation correctness, human experience, cross-platform support and controlled performance comparisons in all PR evidence.
4. Add one versioned competition/economy transaction over the campaign checkpoint before introducing broad management UI: weekend elapsed time, standings, inventory and ledger deltas must commit together or not at all.

## Where to read next

- **Current architecture and responsibility rules:** `docs/architecture-refactor.md`, `AGENTS.md`.
- **Shipping Minimal weekend:** `docs/race-weekend-minimal.md`, `README.md`.
- **Campaign state, clock and storage:** `docs/campaign/state-clock-storage.md`.
- **Campaign/weekend integration contract:** `docs/campaign/weekend-boundary.md`.
- **Authoritative content contracts:** `docs/content/README.md`, `docs/content/consumer-inventory.md`, `docs/content/version-compatibility.md`.
- **Maintenance work:** `docs/maintenance/tech-doc-debt.md`.
- **Historical implementation details:** `docs/README.md` links the complete prior handoffs. `docs/port-status.md`, `docs/feature-parity.md` and `docs/race-weekend.md` retain period-specific descriptions and are not current capability inventories.

**Change discipline:** no content definition may bypass its production consumer/validation; no UI may own authoritative race or campaign state/ticking; changing an actual sporting rule, campaign rule, save schema or provider state requires explicit versioning, characterization and separate scope.
