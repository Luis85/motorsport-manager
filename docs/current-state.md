# Current native project status

**Authoritative snapshot:** `main` at `66ab6f4e8e066f8abac649cd9ac3b98d42760a5c`, 30 September 2026 (merged PR #24). The merge has the same file tree as PR #24's tested source head `a8428c7ede134801acff609b12f20249cecc4054`. This page describes shipped/player-facing behavior separately from retained developer tools, completed foundations, and unimplemented proposals. It supersedes old “current release” claims in historical guides but does not replace their detailed technical contracts.

## Shipping player experience

- **Native Godot 4.7.2, local-first, standalone desktop application.** The normal player-facing pit wall is **Minimal**, not the historical Director or Engineering layout.
- **Weekend:** choose a circuit/configuration or a validated authored scenario; review before replacing an existing entry; practice (real measured runs) → qualifying → physical formation → start lights → race → factual end screen. Session transitions require explicit approval. Existing recorded commands, tyre ownership and saved weekends remain authoritative.
- **Minimal race screen:** timing tower, illustrated circuit with flat dot cars, five core driver actions (Send out, Box this lap, Push, Calm and engine mode), time controls, and read-only instruments for both controlled drivers. This intentionally does **not** expose the full strategy/telemetry/navigation workspace in ordinary play.
- **Circuit Atelier:** edit/save native circuits with Bézier geometry, elevation/banking, pit routes, scenery, reference-image calibration, layer locks, transactional history, validation and test-weekend snapshots. Editor placement presets and contextual guide *copy* may be authored; rendering kinds and guide actions stay code-owned.
- **Content:** validated, strict external JSON packs with stable IDs, generated schemas, ordered dependencies, hash-pinned overrides, atomic catalog activation and frozen weekend/replay definitions. Supported families include vehicles, teams, drivers, rosters, tyre compounds/allocations/operating profiles, setups, shared tuning, weekends, circuits/styles, scenario briefs, mechanic profiles and editor profiles. A provider profile selects **registered code**; external packs cannot inject executable mechanics or arbitrary editor actions. The authoring CLI supports init, clone, validate, list, inspect, schemas, non-overwriting export, diff, bounded scenario test and ordered multi-pack workflows.

## Implemented but not ordinary player navigation

The codebase retains advanced strategy/rival, weather/recovery, racecraft/team-order, debrief/journal, telemetry, replay/sandbox, scenario/notebook and older Director/Engineering UI components with their compatibility and regression tests. **Existence in source is not discoverability or usability in the shipping Minimal flow.** Selected developer layouts remain accessible only through explicit diagnostic startup (for example `-- --pitwall-layout=director` or `engineering`).

Bundled diagnostic scenario collections are trusted file-backed verification resources, not external executable scenario packs. Public authored complete-weekend scenarios can stage existing implemented weekend behavior, but do not add a campaign or arbitrary goal code.

## Not implemented or not established

- **No persistent company/team-management campaign:** finances, dated management clock, energy, staff/contracts, engineering portfolio, seasons/championship settlement, founder workshop and dynasty progression belong to proposed GDDs. The standalone result receipt is idempotent evidence, **not** campaign points, cash, XP or inventory reconciliation.
- **Not a comprehensive vehicle-physics or licensed-regulations simulator.** Race damage remains aggregate; additional vehicle presets are not full competition formats. Editor bridge/tunnel annotations do not certify 3D clearances.
- **Human playtesting, comprehensive accessibility, broad device/hardware calibration, wet/endurance balance and same-host comparative performance remain separate validation gates.** Successful automated checks do not establish them.

## Verification: exact-source interpretation

PR #24's final source head `a8428c7` passed all six registered Godot shards and aggregate gate, content/exported-runtime jobs, runtime confidence, Linux/Windows debug/release builds and native standalone smoke journeys. The merge introduced no file changes. The advisory quality job completed **with findings**; its success is not a clean-quality sign-off. Consult that commit's retained GitHub Actions logs/artifacts for exact counts and source provenance instead of copying numbers from historical release notes.

Current checkout verification entry points:
- `python3 scripts/verify.py --godot /path/to/pinned/Godot` — complete registered test gate, including required native UI environment.
- `python3 scripts/check_architecture.py` — dependency/authority contract.
- `python3 scripts/content.py schemas --check --godot /path/to/pinned/Godot` and content CLI tests — exact generated-schema/consumer contracts.
- `python3 scripts/quality.py` — **advisory** complete findings and actionable debt comparisons.

The registration source of truth is `scripts/verification_suites.json`; historical suite counts in release handoffs describe their original revisions only.

## Active maintenance priorities

1. Keep this page, the README and content status synchronized when a feature becomes player-facing, only diagnostic, or deliberately deferred.
2. Reduce active high-churn legacy hotspots **by cohesive responsibility**, not semicolon packing or assertion weakening. At this snapshot: `race_sim.gd` (726 counted code lines), historical `weekend.gd` (623), `track_canvas.gd` (476), historical `pitwall_workspace.gd` (419), against the 400-line source budget. Prioritize files touched by actual product work; the count alone is not a defect.
3. Distinguish implementation correctness, human experience, cross-platform support and controlled performance comparisons in all PR evidence.
4. Validate the race-weekend/campaign manifest-and-result boundary before implementing persistent management against standalone receipts.

## Where to read next

- **Current architecture and responsibility rules:** `docs/architecture-refactor.md`, `AGENTS.md`.
- **Shipping minimal weekend:** `docs/race-weekend-minimal.md`, `README.md`.
- **Authoritative content contracts:** `docs/content/README.md`, `docs/content/consumer-inventory.md`, `docs/content/version-compatibility.md`.
- **Maintenance work:** `docs/maintenance/tech-doc-debt.md`.
- **Historical implementation details:** `docs/README.md` links the complete prior handoffs. `docs/port-status.md`, `docs/feature-parity.md` and `docs/race-weekend.md` retain period-specific descriptions and are not current capability inventories.

**Change discipline:** no content definition may bypass its production consumer/validation; no UI may own authoritative race state or ticking; changing an actual sporting rule, save schema or provider state requires explicit versioning, characterization and separate scope.
