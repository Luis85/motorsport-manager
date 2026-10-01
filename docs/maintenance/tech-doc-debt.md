# Technical and documentation debt maintenance

Status: in progress on `chore/tech-doc-debt-maintenance`. Base: `main` at `66ab6f4e8e066f8abac649cd9ac3b98d42760a5c` (merged PR #24).

This branch began as focused technical/documentation maintenance. It now also contains bounded follow-up product foundations requested on the same PR: a read-only Minimal forecast surface, selectable Advanced presentation, deterministic campaign state/storage, atomic weekend consequences, versioned season authority, commitment-aware finance, people/contracts/availability, and facilities/capacity/rented services. None changes race physics, sporting arithmetic or the independently playable standalone weekend.

## Scope and acceptance

1. **Documentation authority.** Keep current capability, historical handoff and proposal documents distinguishable. Preserve exact-source verification boundaries.
2. **Focused technical debt.** Extract cohesive responsibilities without changing public entry points, race behavior, command authority, save semantics or content-provider rules.
3. **Campaign foundations.** Implement dependency-ordered P0 domain/application boundaries without presenting them as a playable management campaign.
4. **Regression evidence.** Require the registered six-shard Godot suite, content/schema/export verification, runtime-confidence checks, standalone build/smoke and advisory quality report on the exact final head.
5. **Debt inventory.** Keep human-playtest, accessibility, platform and performance limitations explicit.

## Publication gate

Keep the PR in draft until the exact final commit has green required CI and synchronized documentation. A successful advisory-quality job is not a clean lint or maintainability sign-off. Human playtesting and same-hardware performance measurement remain separate product-validation work.

## Implemented milestones

### 1. Documentation authority and active UI debt

- Added `docs/current-state.md` as the post-PR24 capability and validation authority.
- Marked `docs/port-status.md`, `docs/feature-parity.md` and `docs/race-weekend.md` as historical rather than current capability inventories.
- Extracted read-only surface sampling, car/label painting and editor-selection painting into `scripts/ui/track_canvas_overlays.gd`.
- Retained `TrackCanvas` cache ownership, public methods, detached frame capture, projection and edit transactions.
- Reduced active `track_canvas.gd` from 476 to 400 counted code lines and registered native overlay/cache regression coverage.

### 2. Immutable campaign/weekend boundary

- Added `CampaignWeekendManifest` to freeze campaign/season/event identity, departure/return slots, race model, track/roster/resource/rules hashes and complete race-local to campaign identity mappings.
- Added `CampaignWeekendSettlement` to validate one factual result, reject sandbox/mismatching evidence and stage an exactly-once receipt.
- Identical evidence is a no-op; different evidence for an applied event requires a correction workflow.
- The receipt itself awards no points, cash, XP, repairs or campaign time.
- Added `docs/campaign/weekend-boundary.md` and focused registered contracts.

### 3. Read-only Minimal strategy comparison

- Added one visible **Strategy** action for the selected running managed driver.
- Reused `RaceForecaster` through detached `MinimalWeekendQuery.strategy_comparison()` output.
- Forecasting runs only on explicit open/refresh and receives no command, scheduler or live-state authority.
- Opening, refreshing and closing do not alter commands, ownership, playback, speed, simulation state or gameplay RNG.
- Added native/domain coverage for detachment, refresh behavior, focus/shortcut isolation and compact 130% layouts.

### 4. Player-selectable Minimal and Advanced interfaces

- Added staged **Settings → Race interface** selection. Minimal remains default; Advanced can begin in Race Director or Engineering.
- Reused the existing `pitwall_layout` seam over the same weekend, recorder, commands and scheduler.
- Preserved `minimal`, `director` and `engineering`; public `advanced` normalizes to Race Director and unsupported values fall back to Minimal.
- Added registered native coverage for persistence, migration, both Advanced entry points and complete weekend/RNG preservation.

### 5. Deterministic campaign state, clock and storage

- Added stable `CampaignIdentity`, pure Gregorian `CampaignClock`, replay-validated `CampaignState`, weak `CampaignCommands`, versioned `CampaignCheckpoint` and recoverable `CampaignStorage`.
- Campaign time uses dated fifteen-minute slots, independent of wall clock, rendering and the race tick.
- Rejected commands do not mutate time, energy, interventions, revision or accepted history.
- Added daily principal intervention energy and exclusive principal occupancy without limiting staff work or race commands.
- Registered date/leap-year, replay, non-mutation, energy/occupancy, tamper, weak-lifetime, precise-JSON and interrupted-write recovery contracts.

### 6. Atomic weekend consequence transaction

- Added explicit `CampaignWeekendPolicy`, immutable competition awards, exact returned inventory and integer event cash postings.
- Added `CampaignWeekendTransaction` to stage receipt, campaign time, competition, inventory, event cash and all due commitments on detached values.
- Complete consequences publish in one checkpoint or the caller value remains unchanged.
- Recovered receipts are checked against the full manifest identity and person/team/car mapping.
- Duplicate result/policy application is an exact no-op; changed evidence conflicts.
- Added `docs/campaign/weekend-consequence-transaction.md` and registered rollback, persistence and migration coverage.

### 7. Series calendar, entries and season lifecycle

- Upgraded `CampaignCompetition` to version 2 and added immutable `CampaignSeriesRules`.
- Added ordered non-overlapping calendars, globally unique event IDs, frozen event dates/revisions/hashes and prefix-only resolution.
- Added submitted/accepted/rejected/withdrawn entries with globally conflict-free person/team/car fields.
- Added `planning → entries_open → preseason → active → final_classification → settled → contract_transition → completed`.
- Bound settlement to the exact next active-season event and frozen scoring table.
- Rebuilt driver/team rankings from immutable awards using points and successive finish-count countback; unresolved ties remain shared.
- Added atomic `CampaignCompetitionTransaction`, cancellation without awards, safe next-season creation, version-one read-only compatibility and `docs/campaign/season-lifecycle.md`.

### 8. Cash commitments, due dates and forecast

- Upgraded `CampaignEconomy` to version 2 while preserving version-one factual cash history.
- Added immutable binding `CampaignCashCommitment`, one-source postings, `CampaignReservePolicy`, `CampaignEconomyTimeline`, pure `CampaignCashForecast` and atomic `CampaignFinanceTransaction`.
- Added committed, conservative and optimistic scenarios; unsigned assumptions remain detached and never become cash.
- Added detached ordinary commitment preview.
- Settled obligations retain their contractual due slot, including obligations due inside a weekend interval.
- Registered the GDD eight-week fixture and exact-once, cancellation, tamper, migration, time-consistency, weekend and storage contracts.
- Added `docs/campaign/finance-commitments-forecast.md`.

### 9. People, roles, contracts and availability

- Upgraded `CampaignCheckpoint` to version 3 and added `CampaignPersonnel` to the complete atomic envelope.
- Added stable people with explicit role eligibility for drivers, engineers, technical/operations/commercial leadership, mechanics, workforce and academy leadership.
- Added immutable dated employment terms with derived `signed_future`, `active`, `renewal_window`, `expired` and `terminated` states.
- Signing or renewing employment generates deterministic payroll commitments in the existing economy; personnel never owns a second cash ledger.
- Added cross-envelope validation so amount, account, source, signing slot and due dates agree with the contract schedule. Binding payroll cannot be generically cancelled or charged again through project summaries.
- Added capacity-based dated role assignments. Compatible part-time roles may coexist, but simultaneous allocation cannot exceed contract capacity and ineligible roles fail closed.
- Added exclusive work/event/travel/training/leave reservations. One person cannot occupy overlapping availability intervals.
- Added atomic registration, signing, renewal, termination, replacement, assignment and reservation transactions. Personnel planning freezes while a weekend is active.
- Termination/replacement settles payroll already due, cancels future installments and releases future reservations in the same checkpoint.
- Added detached roster and contract/payroll forecast queries.
- Version-two checkpoint migration preserves recorded payroll through an explicit legacy index without inventing people or contracts.
- Registered contracts for preview non-mutation, role capacity, exclusive availability, renewal lineage, replacement, weekend payroll, migration, storage and active-weekend freeze.
- Added `docs/campaign/people-contracts-availability.md`.

### 10. Facilities, capacity and rented services

- Upgraded `CampaignCheckpoint` to version 4 and added `CampaignOperations` to the complete atomic envelope.
- Added exactly three first-slice facility families: preparation workshop, design office and test/validation. Resources are explicitly owned or external services and expose bounded schedulable units rather than passive performance bonuses.
- Added dated `CampaignWorkOrder` and `CampaignCapacityReservation` records. Internal orders require matching `factory_work` personnel reservations plus facility capacity; rented service orders require provider capacity and one explicit dated `facility` cash commitment.
- Capacity is conserved across overlapping orders. One person cannot be double-booked across operations because work reservations reuse the TM-05 personnel authority.
- Added detached capacity comparison/query output for owned and rented alternatives. Inspection does not reserve time, create commitments or mutate campaign state.
- Added atomic operations transactions for resource registration, internal work, rented service work and pre-start cancellation. Generic personnel or finance mutations cannot orphan work-order-owned reservations or service commitments.
- Version-three migration preserves existing facility-category commitments in an explicit legacy index without inventing facilities, capacity or work orders.
- Registered contracts cover three facility families, staff/machine double-allocation rejection, rented-service viability/cost, provider-capacity conservation, atomic cancellation, cross-envelope tamper protection, migration and preservation through unrelated transactions.
- Added `docs/campaign/facilities-capacity-services.md`.

## Preserved boundaries

- No race-physics, race-RNG/arithmetic-order, race scoring, race checkpoint, content schema, mechanic provider or existing race-command change.
- Minimal and Advanced mount over the same authoritative weekend.
- Campaign time, competition, economy, personnel and operations remain outside `RaceSim`, replay, rendering and the standalone result archive.
- Cash, commitments, reserve policy and assumptions remain different values.
- People, contracts, assignments, availability, facilities, capacity reservations and work orders remain different records; neither a role title nor facility ownership creates a race-performance bonus.
- No component diagnosis, consumed stock, repair cost, season prize, promotion, person attribute or morale effect is inferred without authoritative evidence.
- Existing sporting fixtures and the complete registered verification floor remain required.

## Verification boundary

GitHub Actions executes independently for PR updates. Judge this branch only by checks attached to the exact final PR head:

- all six registered Godot shards and aggregate gate;
- content/schema/exported-runtime verification;
- runtime confidence;
- Linux/Windows packaged build and native smoke; and
- advisory quality comparison.

A cancelled, superseded or intermediate run is not evidence for the final head. No local Godot runner is available in this maintenance execution environment. Source/tree, bounded static review, documentation consistency and line-budget checks do not replace executable acceptance.

## Deliberately remaining debt

- `scripts/domain/race_sim.gd` and retained `scripts/ui/weekend.gd` / `scripts/ui/pitwall_workspace.gd` remain above the source-size budget. Prioritize them only when product work touches their responsibilities and characterization is available.
- Advisory findings are not a verified bug count. Responsibility extraction can appear as both resolved and new diagnostics; inspect the complete exact-head report.
- Provisional classifications and correction deltas, season prizes/promotion, scouting/negotiation, person attributes/development/workload/morale, engineering designs/physical parts/materials, sponsors, mandates, rivals, operating-result/assets/liabilities views and campaign UI remain unimplemented.
- Human testing of interface modes and management workflows, broad accessibility, same-machine performance and stronger editor clearance/collision diagnostics remain separate validation work.

## Next dependency

The next campaign milestone is **TM-07: small development pipeline and physical part inventory**. It must:

- consume explicit TM-05 personnel and TM-06 facility capacity;
- separate knowledge, design, manufactured instances, validation and installed race configuration;
- conserve materials and unique part identities;
- keep external manufacturing/services explicit rather than free progress;
- bind every advertised car effect to a tested race performance-profile seam; and
- ensure research completion alone never fabricates a fitted part.
