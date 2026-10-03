# Campaign-to-weekend boundary

Status: implemented immutable campaign/weekend boundary, introduced in PR #27 and used by the [bounded Director Desk first loop](director-desk-first-loop.md). Current campaign checkpoint v6 surrounds the receipt with complete campaign authorities; this record itself owns only frozen entry and factual settlement evidence.

## Purpose

The native race weekend already owns physical racing, finite driver tyre inventories, timing, classification, aggregate condition, replay identity and factual result evidence. A campaign must not duplicate those rules or infer outcomes the race did not measure. The campaign boundary therefore has two immutable records:

1. `CampaignWeekendManifest` freezes the campaign event identity and maps stable campaign people/teams/cars to the race-local integer entrants used by the current simulation.
2. `CampaignWeekendSettlement` validates a completed `WeekendResult`, maps its factual classification and returned resources back to stable campaign identities, and stages one idempotent receipt in a versioned ledger.

Neither record itself grants points, cash, XP, repairs, component diagnoses or elapsed campaign time. Those consequences enter only through `CampaignWeekendTransaction` and an explicit versioned `CampaignWeekendPolicy`.

## Manifest contract

A manifest is created after the race recording receives its stable `race_event_id`, before the weekend result can be accepted by a campaign. It contains:

- campaign, season, campaign-event and entrant IDs;
- event revision and departure/return campaign slots;
- the exact race event ID, model and checkpoint version;
- frozen track, roster, starting-resource and ruleset hashes;
- one complete mapping from each race-local ID to stable `person_id`, `team_id` and `car_id`;
- an integrity digest over the complete record.

The mapping must cover every entrant exactly once. Person and car IDs are unique; a team ID may legitimately appear for both cars. IDs are bounded inert strings, not paths or executable names.

The manifest is not regenerated from a result. A mismatching track, roster, ruleset, event ID or model fails closed.

## Settlement contract

`CampaignWeekendSettlement.stage` accepts a ledger, manifest and factual `WeekendResult` and returns one of three useful statuses:

- `settled`: a new receipt and updated ledger were staged;
- `already_settled`: the same manifest/result digests were already applied and the ledger remains unchanged;
- `conflict` or `rejected`: a different result, malformed record, sandbox result or mismatching frozen contract produced no ledger change.

The receipt retains measured classification, aggregate health/damage, finite tyre identities and measured statistics. Race-local driver IDs are removed and replaced with stable campaign identities. The result's `points_eligibility` remains explicitly undefined by standalone rules.

A changed classification after settlement uses the explicit [final-result correction workflow](result-corrections.md), which atomically replaces the prior receipt and consequence projections under the original manifest/policy and retains correction evidence. It must never append a second ordinary settlement or pay rewards twice.

## Implemented consequence boundary

`CampaignWeekendTransaction` consumes the campaign checkpoint, the exact manifest, the factual result or independently validated receipt, and a strict `CampaignWeekendPolicy`. The policy explicitly identifies points-eligible people, ordered points and position-bonus tables, the organization account, participating people, event entry cost and participation amount. Standalone race facts never invent those rules.

Before returning one candidate checkpoint, the transaction stages:

- the exactly-once factual receipt;
- campaign-time advancement from the frozen departure slot to return slot;
- event awards and rebuilt driver/team standings;
- exact returned aggregate condition and tyre values by stable car identity; and
- dated integer-minor-unit financial postings.

The complete candidate uses `CampaignCheckpoint` version 6. Competition, economy and inventory projections must contain the same event set and agree with the receipt result digest; sporting and financial consequences must use the same policy digest. The active manifest is cleared only in the complete candidate.

A failed rule, identity, time, inventory, account, digest or projection check returns the caller's unchanged checkpoint. Reapplying the same result and policy after complete application is an exact no-op. A different result or policy produces a conflict and requires an explicit correction workflow.

`CampaignStorage.save_checkpoint` validates and normalizes the complete candidate, then publishes it through the existing temporary-file, backup and rollback policy. A failed replacement preserves the previous campaign. The standalone `ResultReceipts` archive remains separate evidence and cannot substitute for campaign settlement.

See [Atomic weekend consequence transaction](weekend-consequence-transaction.md) for the full sequence and current projection limits.

## Verification

The registered `weekend_launch_tests` suite covers:

- complete and detached stable identity mappings;
- manifest/event/result binding;
- factual result validation;
- stable identity projection without race-local IDs;
- absence of invented points, cash or XP at the factual receipt boundary;
- same-result receipt idempotence and changed-result conflict;
- duplicate mapping rejection and ledger integrity;
- deterministic campaign clock/command replay and atomic checkpoint recovery;
- explicit campaign points eligibility and ordered rule tables;
- time, standings, returned inventory and cash posting as one candidate;
- complete rollback for invalid inventory or departure-time drift;
- exact no-op reapplication and policy/result conflict; and
- version-one checkpoint migration without fabricated consequences.

The suite uses a synthetic terminal classification after a real staged production launch. Full physical race completion remains covered by the existing native full-weekend suites. Human management-game validation and reward balance are not claimed.

## Implemented surrounding authorities

[Season lifecycle](season-lifecycle.md) owns the calendar, accepted entries, final classification, countback and controlled transitions. [Finance](finance-commitments-forecast.md) owns cash commitments, due dates and detached forecasts; [multi-season progression](multi-season-progression.md) owns explicit season plans/prizes/promotion choices. [Correction](result-corrections.md) handles reviewed final-result replacement. Live provisional adjudication remains outside this final-only boundary. None belongs in `RaceSim`, `WeekendResult`, rendering or replay playback.
