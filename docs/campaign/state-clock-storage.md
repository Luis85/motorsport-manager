# Campaign state, clock and storage foundation

Status: implemented contract foundation on PR #27. This is not yet a playable company-management campaign, complete championship, finance forecast or headquarters UI.

## Purpose

This foundation establishes the authoritative campaign shell required before staff, engineering or broad management screens can be added. It is deliberately separate from `RaceSim`: campaign time advances in dated fifteen-minute slots, while the race weekend retains its fixed 0.05-second simulation and independent pause/speed controls.

The foundation consists of five responsibilities:

1. `CampaignIdentity` validates bounded inert campaign, organization, person, car and event identifiers.
2. `CampaignClock` owns a deterministic civil date and fifteen-minute slot without consulting the OS or wall clock.
3. `CampaignState` owns identity, clock, daily principal energy, committed intervention occupancy and an accepted command history.
4. `CampaignCheckpoint` binds one state snapshot to factual weekend receipts, optional active weekend identity and the campaign consequence projections.
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

`CampaignCheckpoint` version 2 contains:

- campaign identity;
- the complete replay-validated `CampaignState` snapshot;
- the versioned `CampaignWeekendSettlement` ledger;
- an optional immutable `CampaignWeekendManifest` for an active event;
- `CampaignCompetition` event awards and derived standings;
- `CampaignEconomy` accounts and dated integer-minor-unit postings;
- `CampaignInventory` dated exact returned-resource records; and
- an integrity digest over the complete envelope.

All consequence projections belong to the same campaign and contain the same complete event set. Their result and policy digests must agree with the factual settlement receipt. An event cannot be both active and settled. A version-one checkpoint is accepted and migrated deterministically with empty projections; migration does not guess missing points, money or inventory consequences.

`CampaignStorage` validates and normalizes the complete envelope before writing. It uses `Storage.write_json`, including temporary-file publication, preservation of the previous file and rollback when replacement fails. Loading constructs a new detached `CampaignState`; an invalid or interrupted candidate never mutates a caller's currently held state. Campaign checkpoints use the precise numeric JSON path so integral slots, command revisions and financial minor units survive round-trip without type drift.

The storage adapter also accepts a complete candidate from `CampaignWeekendTransaction`. It does not calculate campaign rules itself.

## Weekend consequence layer

The implemented transaction is documented in [Atomic weekend consequence transaction](weekend-consequence-transaction.md). It applies the frozen departure-to-return interval, explicit competition awards, exact returned resources and explicit event financial postings together with the factual receipt. It returns one detached version-two candidate; persistence then publishes that candidate atomically.

The consequence transaction remains outside `RaceSim`, replay, rendering and the standalone result archive. Opening a management view or replay cannot advance the campaign or post another settlement.

## Deliberate limits

This foundation does **not** implement staff work, contracts, financial commitments or forecasts, event schedules, complete season rules, projects, rivals, facilities, campaign randomness, automatic time flow, management UI, correction deltas or balanced rewards. Daily energy currently governs only explicit principal-intervention reservations; it is not an organization-wide action budget and cannot affect race commands.

The next layer is a versioned series calendar and season lifecycle using the existing event awards: event entry states, final/provisional classification policy, tie-breaking, season completion and safe transition. Commitments, due dates and minimum-cash forecasting remain a separate finance milestone over the factual cash-posting ledger.

## Verification

The registered `weekend_launch_tests` suite covers:

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
- successful retry publishing the next revision;
- deterministic version-one to version-two migration; and
- complete persistence of time, factual receipt, standings, inventory and cash postings after one weekend transaction.

These are domain and persistence contracts. They do not establish campaign balance, management usability or player enjoyment.
