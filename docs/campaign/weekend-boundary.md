# Campaign-to-weekend boundary

Status: implemented contract foundation on PR #27. This is not a persistent campaign, economy, championship or management UI.

## Purpose

The native race weekend already owns physical racing, finite driver tyre inventories, timing, classification, aggregate condition, replay identity and factual result evidence. A future campaign must not duplicate those rules or infer outcomes the race did not measure. The campaign boundary therefore has two immutable records:

1. `CampaignWeekendManifest` freezes the campaign event identity and maps stable campaign people/teams/cars to the race-local integer entrants used by the current simulation.
2. `CampaignWeekendSettlement` validates a completed `WeekendResult`, maps its factual classification and returned resources back to stable campaign identities, and stages one idempotent receipt in a versioned ledger.

Neither record grants points, cash, XP, repairs, component diagnoses or elapsed campaign time. Those consequences require a separate versioned competition/economy rule and atomic campaign storage transaction.

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

A changed classification after settlement requires an explicit correction workflow that posts a reviewed delta. It must never append a second ordinary settlement or pay rewards twice.

## Persistence boundary

The returned ledger is a staged value. A future `CampaignStorage` transaction must atomically persist:

- authoritative campaign state;
- the new settlement ledger/receipt;
- inventory return and dated calendar progression;
- any competition or financial deltas calculated by their own rules.

If persistence fails, the previous campaign and ledger remain authoritative. The standalone `ResultReceipts` archive remains separate evidence and cannot substitute for campaign settlement.

## Verification

The registered `weekend_launch_tests` suite covers:

- complete and detached stable identity mappings;
- manifest/event/result binding;
- factual result validation;
- stable identity projection without race-local IDs;
- absence of invented points, cash or XP;
- same-result idempotence;
- conflict rejection for a different valid result;
- duplicate mapping rejection and ledger integrity.

The suite uses a synthetic terminal classification after a real staged production launch. Full physical race completion remains covered by the existing native full-weekend suites. Human management-game validation is not claimed.

## Next implementation layer

The next campaign slice may build a deterministic campaign state, dated clock and atomic storage around this boundary. It must not add campaign consequences directly to `RaceSim`, `WeekendResult`, `ResultReceipts`, rendering code or replay playback.
