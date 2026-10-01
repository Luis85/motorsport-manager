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
- **Versioned atomic checkpoint:** `CampaignCheckpoint` version 4 binds campaign state, exactly-once factual receipts, an optional active manifest, versioned competition/season state, returned-resource history, commitment-aware integer cash authority, personnel authority and facilities/capacity operations. Earlier checkpoints migrate deterministically; no missing consequence, person, contract, facility, work order or historic obligation is fabricated. `CampaignStorage` validates and publishes the complete envelope through the existing temporary/backup/rollback policy.
- **Campaign/weekend boundary:** `CampaignWeekendManifest` freezes the exact race event, model, track, roster, starting resources, rules and stable campaign identity mapping. `CampaignWeekendSettlement` maps a valid completed `WeekendResult` back to stable campaign people/teams/cars and stages an exactly-once receipt ledger.
- **Atomic weekend consequences:** `CampaignWeekendTransaction` consumes the exact manifest, factual result/receipt and an explicit `CampaignWeekendPolicy`. It stages campaign time from departure to return, per-event awards and derived driver/team standings, exact returned car/tyre values, dated integer-minor-unit event postings and every binding cash commitment due inside the frozen interval. All projections and the receipt publish together or the caller's checkpoint stays unchanged. Reapplying the same result and policy is an exact no-op; changed evidence or rules require an explicit correction workflow.
- **Series and season authority:** `CampaignSeriesRules`, `CampaignSeason` and `CampaignCompetition` version 2 add a bounded ordered calendar, submitted/accepted/rejected/withdrawn entries, exact accepted person/team/car fields, frozen event dates and hashes, final-only classification settlement, driver/team countback rankings, explicit shared positions, event cancellation and the controlled `planning → entries_open → preseason → active → final_classification → settled → contract_transition → completed` lifecycle. A new season cannot open before the prior same-series transition completes.
- **Commitments and cash forecast:** `CampaignEconomy` version 2 separates settled cash from binding dated commitments, current reserve policy and detached forecast assumptions. Every posting has exactly one event or commitment source; cash reconciles to opening balance plus postings. `CampaignFinanceTransaction` publishes commitment, cancellation, reserve-policy and due-settlement changes through complete checkpoints. `CampaignFinanceQuery` provides committed, conservative and optimistic minimum-cash forecasts without mutating time, cash or assumptions. Finance history cannot be dated after the checkpoint campaign clock.
- **People, employment and availability:** `CampaignPersonnel` records stable people, eligible roles, immutable dated employment terms, capacity-based role assignments and exclusive work/event/travel/training/leave reservations. Signing or renewing employment generates exact dated payroll commitments in the existing economy. Termination/replacement settles earned due payroll, cancels future payroll and releases future reservations atomically. One person cannot exceed contracted role capacity or occupy overlapping availability intervals.
- **Facilities, capacity and rented services:** `CampaignOperations` registers preparation workshop, design office and test/validation capacity as owned or external service resources. Internal work orders consume explicit personnel reservations and facility units for the same interval; rented services consume provider capacity and create one dated `facility` commitment in `CampaignEconomy`. Capacity and personnel cannot be double-booked, and detached queries compare owned versus service availability without creating work or cash.
- **Compatibility:** existing version-one competition projections remain valid read-only history. Empty projections can adopt the version-two authority; non-empty sporting history is not assigned a fabricated calendar, entry field or rule pack. Version-one economy postings upgrade losslessly when a version-two mutation is required. Version-two checkpoints gain explicit personnel authority; version-three checkpoints gain explicit operations authority. Existing payroll/facility commitments are indexed as legacy rather than assigned invented employment terms, facilities or work orders.
- This remains an integration foundation. It does **not** establish provisional classification/correction workflows, scouting/negotiation, people attributes, workload/fatigue/morale, engineering designs or physical parts, sponsors, rivals, campaign UI, accrual/operating-result accounting, assets/liabilities, component diagnosis, consumed-resource inference, season prizes or balanced rewards.

## Not implemented or not established

- **No playable company/team-management campaign yet:** no campaign composition/navigation, Director Desk, Team/Person screens, candidate market, engineering portfolio, founder workshop, rival organizations or dynasty progression. The implemented clock, calendar, entries, season lifecycle, commitments, payroll schedules, availability, cash forecast, receipts and consequence projections are deterministic domain/application/storage foundations, not a management game or a second race engine.
- **People remain intentionally bounded:** there is no scouting, negotiation exchange, attributes, role-quality effect, development plan, workload, fatigue, morale, trust, promises, department headcount, staff AI or automatic race-entry staffing. Role eligibility and capacity protect future scheduling; they do not yet alter race pace or work output.
- **Finance remains intentionally bounded:** contract payroll uses explicit dated commitments, but there is no bonus/notice/buyout model, receivable earning lifecycle, budget-envelope UI, operating-result view, lending/distress system, commercial agreement model or autonomous spending mandate. Forecast assumptions are explicit analysis inputs, not spendable money.
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
4. Build TM-07's small development pipeline and physical part inventory on the TM-06 capacity authority. Research/design completion must not fabricate a fitted part or race effect; staff, facility, material, validation and delivery evidence remain explicit.

## Where to read next

- **Current architecture and responsibility rules:** `docs/architecture-refactor.md`, `AGENTS.md`.
- **Shipping Minimal weekend:** `docs/race-weekend-minimal.md`, `README.md`.
- **Campaign state, clock and storage:** `docs/campaign/state-clock-storage.md`.
- **Campaign/weekend integration contract:** `docs/campaign/weekend-boundary.md`.
- **Atomic weekend consequences:** `docs/campaign/weekend-consequence-transaction.md`.
- **Series, entries and season lifecycle:** `docs/campaign/season-lifecycle.md`.
- **Commitments and cash forecast:** `docs/campaign/finance-commitments-forecast.md`.
- **People, contracts and availability:** `docs/campaign/people-contracts-availability.md`.
- **Facilities, capacity and rented services:** `docs/campaign/facilities-capacity-services.md`.
- **Authoritative content contracts:** `docs/content/README.md`, `docs/content/consumer-inventory.md`, `docs/content/version-compatibility.md`.
- **Maintenance work:** `docs/maintenance/tech-doc-debt.md`.
- **Historical implementation details:** `docs/README.md` links the complete prior handoffs. `docs/port-status.md`, `docs/feature-parity.md` and `docs/race-weekend.md` retain period-specific descriptions and are not current capability inventories.

**Change discipline:** no content definition may bypass its production consumer/validation; no UI may own authoritative race or campaign state/ticking; changing an actual sporting rule, campaign rule, save schema, financial/personnel/operations authority or provider state requires explicit versioning, characterization and separate scope.
