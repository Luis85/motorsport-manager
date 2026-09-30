# Campaign state, clock and storage foundation

Status: implemented contract foundation on PR #27. This is not yet a playable company-management campaign, championship, economy or headquarters UI.

## Purpose

This milestone establishes the authoritative campaign shell required before standings, finances, staff, engineering or broad management screens can be added. It is deliberately separate from `RaceSim`: campaign time advances in dated fifteen-minute slots, while the race weekend retains its fixed 0.05-second simulation and independent pause/speed controls.

The foundation consists of five responsibilities:

1. `CampaignIdentity` validates bounded inert campaign, organization, person, car and event identifiers.
2. `CampaignClock` owns a deterministic civil date and fifteen-minute slot without consulting the OS or wall clock.
3. `CampaignState` owns identity, clock, daily principal energy, committed intervention occupancy and an accepted command history.
4. `CampaignCheckpoint` binds one state snapshot to its exactly-once weekend settlement ledger and optional active weekend manifest.
5. `CampaignStorage` publishes and restores that checkpoint through the repository's existing recoverable atomic JSON policy.

## Clock contract

`CampaignClock` records its start date/slot, current date/slot and elapsed slots. The supported civil-calendar range is bounded and leap years follow the Gregorian rules. Advancing a batch of slots and advancing the same slots individually produce the same date. Rendering cadence, OS time, timezone and UI inspection are not inputs.

The clock does not run automatically in this slice. Time changes only through an accepted `advance_slots` command. Future schedulers may supply those explicit commands, but may not mutate the clock directly or reuse the race step clock.

## Campaign state and commands

A campaign starts with stable `campaign_id`, `organization_id` and `principal_id`, an initial clock point and a bounded daily intervention-energy capacity. The initial tuning seed is six points; this is a versioned game value, not a real-world claim.

The first command set is intentionally narrow:

- `advance_slots` advances a positive bounded number of fifteen-minute slots. Crossing at least one day boundary replenishes energy to the daily capacity without carryover.
- `intervention` commits a unique intervention ID, one or two energy points and a bounded duration. Energy is deducted only after all identity, availability and capacity checks pass. The principal cannot start an overlapping intervention.

Rejected, stale, malformed, duplicate, unaffordable and calendar-overflow commands change only `last_error`; they do not change time, energy, intervention records, revision or accepted history. The application-facing `CampaignCommands` holds a weak reference, so retaining an obsolete controller cannot keep discarded campaign state alive.

The accepted command journal is authoritative evidence. A snapshot restores by recreating the initial state and replaying every accepted command in order. Sequence numbers, before/after slots, resulting state and integrity digest must all agree. Recomputing an outer digest cannot conceal a history that no longer reproduces the saved state.

## Checkpoint and persistence contract

`CampaignCheckpoint` contains:

- campaign identity;
- the complete replay-validated `CampaignState` snapshot;
- the versioned `CampaignWeekendSettlement` ledger;
- an optional immutable `CampaignWeekendManifest` for an active event;
- an integrity digest over the complete envelope.

A receipt or active manifest belonging to another campaign is rejected. An event cannot be both active and already settled. The checkpoint does not store a second race simulation, calculate rewards or reinterpret a weekend result.

`CampaignStorage` validates the complete envelope before writing. It uses `Storage.write_json`, including temporary-file publication, preservation of the previous file and rollback when replacement fails. Loading constructs a new detached `CampaignState`; an invalid or interrupted candidate never mutates a caller's currently held state. Campaign checkpoints use the precise numeric JSON path so integral slots and command revisions survive round-trip without type drift.

## Deliberate limits

This slice does **not** implement staff work, contracts, finance, standings, event schedules, projects, rivals, facilities, campaign randomness, automatic time flow, management UI or rewards. Daily energy currently governs only explicit principal-intervention reservations; it is not an organization-wide action budget and cannot affect race commands. No campaign consequence is applied to a weekend result yet.

The next layer must add dated competition/economy rules as a transaction over this checkpoint. It must stage state, settlement receipt, returned inventory, standings, ledger postings and elapsed weekend time together before one atomic publication. It must not add those consequences to `RaceSim`, replay, rendering or the standalone result archive.

## Verification

The registered `weekend_launch_tests` suite now also covers:

- stable identity acceptance and rejection;
- leap-day and batch-versus-step clock equivalence;
- rejected-command non-mutation;
- intervention energy, occupancy, duplicate and overlap rules;
- day-boundary energy replenishment without carryover;
- exact restoration and independent replay of the accepted command history;
- command-history tamper detection even after digest recomputation;
- weak command-handle lifetime;
- detached checkpoint values;
- precise JSON round-trip;
- failed atomic replacement retaining the previous checkpoint;
- successful retry publishing the next revision.

These are domain and persistence contracts. They do not establish campaign balance, management usability or player enjoyment.
