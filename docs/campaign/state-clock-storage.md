# Campaign state, clock and storage foundation

Status: implemented campaign state/persistence authority, introduced in PR #27 and retained by PR #28/#29. The bounded playable route is [Director Desk and first Team Principal loop](director-desk-first-loop.md); this guide describes its underlying contracts, not a complete specialist headquarters interface.

## Purpose

This foundation establishes the authoritative campaign shell required before broad management screens can be added. It is deliberately separate from `RaceSim`: campaign time advances in dated fifteen-minute slots, while the race weekend retains its fixed-step simulation and independent pause/speed controls.

The foundation consists of five responsibilities:

1. `CampaignIdentity` validates bounded inert campaign, organization, person, car and event identifiers.
2. `CampaignClock` owns a deterministic civil date and fifteen-minute slot without consulting the OS or wall clock.
3. `CampaignState` owns identity, clock, daily principal energy, committed intervention occupancy and an accepted command history.
4. `CampaignCheckpoint` binds one state snapshot to factual weekend receipts, the optional active weekend and every campaign projection.
5. `CampaignStorage` publishes and restores that checkpoint through the repository's existing recoverable atomic JSON policy.

## Clock contract

`CampaignClock` records its start date/slot, current date/slot and elapsed slots. The supported civil-calendar range is bounded and leap years follow Gregorian rules. Advancing a batch of slots and advancing the same slots individually produce the same date. Rendering cadence, OS time, timezone and UI inspection are not inputs.

The clock does not run automatically in this slice. Time changes only through an accepted `advance_slots` command. Future schedulers may supply those explicit commands, but may not mutate the clock directly or reuse the race step clock.

## Campaign state and commands

A campaign starts with stable `campaign_id`, `organization_id` and `principal_id`, an initial clock point and a bounded daily intervention-energy capacity. The legacy default is six points; new careers receive validated authored campaign configuration. This is a versioned game value, not a real-world claim.

The first command set is intentionally narrow:

- `advance_slots` advances a positive bounded number of fifteen-minute slots. Crossing at least one day boundary replenishes energy to the daily capacity without carryover.
- `intervention` commits a unique intervention ID, one or two energy points and a bounded duration. Energy is deducted only after all identity, availability and capacity checks pass. The principal cannot start an overlapping intervention.

Rejected, stale, malformed, duplicate, unaffordable and calendar-overflow commands change only `last_error`; they do not change time, energy, intervention records, revision or accepted history. The application-facing `CampaignCommands` holds a weak reference, so retaining an obsolete controller cannot keep discarded campaign state alive.

The accepted command journal is authoritative evidence. A snapshot restores by recreating the initial state and replaying every accepted command in order. Sequence numbers, before/after slots, resulting state and integrity digest must all agree. Recomputing an outer digest cannot conceal a history that no longer reproduces the saved state.

## Current checkpoint version 6

`CampaignCheckpoint` version 6 contains:

- campaign identity;
- the complete replay-validated `CampaignState` snapshot;
- the versioned `CampaignWeekendSettlement` ledger;
- an optional immutable `CampaignWeekendManifest` for an active event;
- `CampaignCompetition` series, seasons, event awards and standings;
- `CampaignEconomy` accounts, commitments, reserve policy and postings;
- `CampaignInventory` dated exact returned-resource records;
- `CampaignPersonnel` people, contracts, role assignments and availability;
- `CampaignOperations` facilities, work orders and capacity reservations;
- `CampaignEngineering` designs, projects and physical part inventory;
- `CampaignManagement` commercial, delegation, rivals, people, season-plan, supply and founder-group authorities plus the frozen authored campaign closure; and
- an integrity digest over the complete envelope.

Competition, economy and returned-inventory consequence projections belong to the same campaign and contain the same complete settled-event set. Their result and policy digests must agree with the factual receipt. An event cannot be both active and settled.

The checkpoint also validates cross-projection time and authority:

- financial and personnel history cannot be dated after campaign time;
- the organization's cash and payroll accounts must exist;
- employment payroll must match its immutable contract schedule;
- terminated employment cannot retain future open payroll; and
- personnel and operations belong to the same campaign and organization;
- internal work orders own matching personnel reservations; and
- rented service orders own matching dated facility commitments.

## Migration

Version-one checkpoints remain accepted and migrate deterministically with empty campaign projections. Migration does not guess points, money, inventory or personnel history.

Version-two checkpoints preserve factual competition, cash/obligations and inventory and gain empty personnel authority at the restored campaign slot. A legacy version-one economy is normalized losslessly before later cross-authority validation. Existing payroll commitments are placed in an explicit legacy-payroll index. Version-three checkpoints preserve personnel and gain empty operations authority at the restored campaign slot; existing `facility` commitments are placed in an explicit legacy-facility index. These migrations preserve recorded obligations without inventing people, employment terms, facilities or work orders.

Version-four checkpoints gain empty engineering authority and explicit legacy-development indexes. Version-five checkpoints gain management authority at the restored slot; old management-v1 envelopes remain readable with isolated legacy defaults. Migration does not invent projects, parts, commercial agreements, mandates or authored campaign history. Current management-v2 freezes validated campaign and runtime definitions rather than rereading the live catalog.

The campaign checkpoint schema remains independent from race-weekend checkpoint versions.

## Persistence contract

`CampaignStorage` validates and normalizes the complete envelope before writing. It uses `Storage.write_json`, including temporary-file publication, preservation of the previous file and rollback when replacement fails. Loading constructs a new detached `CampaignState`; an invalid or interrupted candidate never mutates a caller's currently held state.

Campaign checkpoints use the precise numeric JSON path so integral slots, command revisions, minor monetary units, capacity basis points and dated personnel records survive round-trip without type drift.

The storage adapter accepts complete candidates from the campaign transaction layers, including engineering, management and weekend transactions. It does not calculate campaign rules itself.

## Transaction layers

The checkpoint is the publication boundary for:

- `CampaignCompetitionTransaction` — series, season, entry and cancellation administration;
- `CampaignFinanceTransaction` — commitments, reserve policy and due settlement;
- `CampaignPersonnelTransaction` — people, contracts, roles and availability;
- `CampaignOperationsTransaction` — facilities, internal work and rented services;
- `CampaignEngineeringTransaction` — gate work, designs and physical parts;
- management transactions — readiness, commercial, delegation, rivals, people, supply, multi-season and founder-group changes; and
- `CampaignWeekendTransaction` — elapsed weekend time, standings, inventory, event cash, due commitments and factual receipt.

Each transaction restores the whole checkpoint, stages detached values and returns one valid complete candidate or the exact caller checkpoint. No projection is published independently.

## Deliberate limits

The clock and persistence authority do not implement automatic real-time campaign progression, hidden staff productivity or balanced rewards. Daily energy governs explicit principal-intervention reservations; it is not an organization-wide action budget and cannot affect race commands.

Implemented consumers include [engineering and physical parts](engineering-parts-race-profile.md), [rival organizations](rival-organizations.md), [people development/recruitment](people-development-recruitment.md), [operational depth](operational-depth.md), [final-result correction](result-corrections.md) and the [Director Desk](director-desk-first-loop.md). These consume the same complete checkpoint. Dedicated specialist management screens, human usability and balance remain separate work.

## Verification

The registered campaign suite covers:

- stable identity acceptance and rejection;
- leap-day and batch-versus-step clock equivalence;
- rejected-command non-mutation;
- intervention energy, occupancy, duplicate and overlap rules;
- day-boundary energy replenishment without carryover;
- exact restoration and independent replay of accepted command history;
- history tamper detection even after digest recomputation;
- weak command-handle lifetime;
- detached checkpoint values;
- precise JSON round-trip;
- failed atomic replacement retaining the previous checkpoint;
- successful retry publishing the next revision;
- deterministic version-one and version-two migration;
- cross-envelope finance, personnel and operations time validation;
- complete persistence of competition, cash, inventory, personnel, payroll, facilities and work orders; and
- atomic weekend return with due commitments.

These are domain and persistence contracts. They do not establish campaign balance, management usability or player enjoyment.
