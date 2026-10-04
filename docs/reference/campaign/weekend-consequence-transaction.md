# Atomic weekend consequence transaction

Implemented atomic consequence contract used by the [Director Desk route](director-desk-first-loop.md). This reference describes settlement over the complete campaign checkpoint.

## Purpose

`CampaignWeekendTransaction` converts one validated weekend receipt into one candidate `CampaignCheckpoint`. The candidate contains the dated campaign-time advance, exact scheduled-event resolution, standings changes, exact returned resources, integer event postings, every binding cash commitment due inside the weekend interval, unchanged personnel authority, and the factual settlement receipt. The caller may then publish that one envelope through `CampaignStorage`.

Nothing is written while the transaction is being calculated. Every projection operates on detached values. If any identity, rule, inventory row, date, commitment, payroll link, balance or digest is invalid, the original checkpoint remains byte-for-byte equivalent.

## Inputs

The transaction requires:

1. A valid versioned campaign checkpoint.
2. The exact immutable `CampaignWeekendManifest` that was active at departure and matches the next event in an active registered season.
3. A valid `WeekendResult`, or a separately validated receipt when recovering an already-created factual receipt.
4. A `CampaignWeekendPolicy` identifying the campaign event, explicit points-eligible people, the season's frozen ordered points table, the organization account, participating people, entry cost, participation amount, and position-bonus table.

The policy is explicit rules input. The race result does not infer championship points or money. Until the result envelope gains an authoritative competition-eligibility field, the campaign policy must name eligible stable people. Retired/classified status is never reconstructed from approximate race distance.

## Atomic sequence

1. Validate and normalize the checkpoint. Legacy campaign checkpoints migrate deterministically without fabricated sporting, inventory, financial or personnel facts.
2. Validate the manifest, receipt and policy identities and integrity digests.
3. Require the exact active manifest for a new receipt and bind it to the next active-season event: date interval, revision, track/rules hashes and complete accepted field must agree.
4. Stage the exactly-once factual settlement receipt.
5. Stage the event awards, resolve the exact calendar round and rebuild driver/team countback standings from the complete event history.
6. Stage the exact returned-resource rows by stable car identity. Missing consumed-resource evidence is not invented.
7. Stage dated integer-minor-unit entry, participation and position-bonus postings. Cash is recalculated from opening balance plus every posting.
8. Settle every existing open commitment due no later than the frozen return slot. Each posts at its own contractual due slot and retains its commitment identity/terms digest. Employment payroll follows the same path.
9. Require campaign time to still equal the frozen departure slot, then advance it to the return slot with one accepted campaign command.
10. Preserve the complete personnel authority from departure. The race transaction does not hire, terminate, assign or reschedule people.
11. Build and validate one version-six checkpoint with every consequence projection, authority timeline and factual receipt consistent.
12. Clear the active manifest only in the complete candidate.

The storage adapter serializes and validates the complete candidate before temporary-file publication, backup preservation, replacement and rollback.

## Exactly-once behavior

- Reapplying the same manifest, receipt and policy after all projections exist returns `already_settled` and the exact same checkpoint.
- Duplicate import cannot pay an event reward, ordinary commitment or payroll installment twice.
- A different result digest returns a conflict and requires a correction workflow.
- A different valid policy digest returns a conflict; standings and money are not silently recalculated in place.
- A legacy receipt without projections can be completed once if campaign time still equals the frozen departure boundary and the required registered-season evidence exists.
- Partial sporting/economy/inventory event sets are invalid in a modern checkpoint.

## Projection contracts

### Competition

`CampaignCompetition` version 2 stores rule packs, ordered season calendars, accepted fields and immutable per-event awards. It rebuilds driver/team points and successive finishing-position countback. Exact unresolved ties remain shared. Live provisional classifications remain excluded. [Final-result correction](result-corrections.md) and [multi-season prizes/promotion](multi-season-progression.md) are explicit implemented transactions over these authorities.

### Economy

`CampaignEconomy` version 2 stores fictional credits in integer minor units. Every posting has one event or settled-commitment source. Weekend entry, participation and position postings are dated at return; due commitments retain their contractual due slots. Open future commitments and reserve policy are persisted separately from cash. Detached forecast assumptions never enter this transaction.

Employment payroll is not a separate weekend reward. It is an already binding commitment generated from an employment contract and cross-validated against `CampaignPersonnel` when the final checkpoint is built.

### Personnel

`CampaignPersonnel` is preserved unchanged through the weekend transaction. Its people, contracts, role assignments and availability remain campaign records. Payroll due inside the interval may change economy status/postings, but the immutable employment schedule remains the evidence for that movement.

[Event readiness and departure](event-readiness-departure.md) validate the required player driver/crew availability and create explicit event-duty reservations before entry. Settlement preserves that personnel authority; it does not fabricate travel or staff work from race results.

### Inventory

`CampaignInventory` records the exact returned car/resource rows from the receipt, including aggregate health, aggregate damage and tyre values. It does not infer missing components, repair diagnoses, consumption, replacement costs or warehouse movements.

## Verification contract

The registered `weekend_launch_tests` suite runs campaign contracts covering:

- complete time/calendar/standings/inventory/economy staging;
- unchanged caller checkpoint during staging;
- exact active-season event and stable person/team/car mapping;
- explicit points eligibility and frozen scoring;
- integer event postings and contractual due-slot commitment postings;
- payroll due during a weekend settling at its contract slot;
- personnel projection preservation through settlement;
- exact returned-resource preservation without invented consumption;
- exact no-op reapplication without duplicate rewards or obligations;
- result and policy conflicts;
- invalid inventory and finance rollback before publication;
- departure-time/calendar drift rejection;
- precise JSON save/load of the complete envelope; and
- deterministic legacy migration without invented commitments or staff.

The tests establish domain/application behavior, not balanced scoring, a viable commercial model, human-readable management UI or a complete season experience.

## Owner boundaries and remaining limits

Ordinary weekend settlement remains final-only and factual: it cannot infer component diagnoses, consumed materials or travel. Correction, season prizes/promotion, facilities, rivals, engineering and the Director Desk are implemented by their explicit campaign owners; [current project status](../current-state.md) maps them. They share this complete publication boundary rather than adding race-side consequences. Live steward/provisional simulation, comprehensive accounting and broader specialist management UI remain separate work.

## Implementation and coverage

Authority and application owners: [weekend_transaction.gd](../../../scripts/application/campaign/weekend_transaction.gd), [weekend_policy.gd](../../../scripts/domain/campaign/weekend_policy.gd).

Contract fixtures: [campaign_weekend_transaction_contracts.gd](../../../tests/support/campaign_weekend_transaction_contracts.gd), [campaign_weekend_finance_contracts.gd](../../../tests/support/campaign_weekend_finance_contracts.gd).

Campaign fixtures run through registered `weekend_launch_tests`, via
`CampaignStateContracts`. The [verification guide](../../how-to/verification.md) defines
complete-suite execution; this reference describes coverage, not a fresh pass.
