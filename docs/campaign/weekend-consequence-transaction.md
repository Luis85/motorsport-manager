# Atomic weekend consequence transaction

Status: implemented foundation in PR #27. This contract extends the deterministic campaign checkpoint and the immutable weekend receipt; it is not a playable season, finance screen, or complete championship.

## Purpose

`CampaignWeekendTransaction` converts one validated weekend receipt into one candidate `CampaignCheckpoint`. The candidate contains the dated campaign-time advance, standings changes, exact returned resources, integer financial postings, and the factual settlement receipt. The caller may then publish that one envelope through `CampaignStorage`.

Nothing is written while the transaction is being calculated. Every projection operates on detached values. If any identity, rule, inventory row, date, balance, or digest is invalid, the original checkpoint remains byte-for-byte equivalent.

## Inputs

The transaction requires:

1. A valid versioned campaign checkpoint.
2. The exact immutable `CampaignWeekendManifest` that was active at departure.
3. A valid `WeekendResult`, or a separately validated receipt when recovering an already-created factual receipt.
4. A `CampaignWeekendPolicy` identifying the campaign event, explicit points-eligible people, the ordered points table, the organization account, participating people, entry cost, participation amount, and position-bonus table.

The policy is an explicit rules input. The race result does not infer championship points or money. Until the result envelope gains an authoritative competition-eligibility field, the campaign policy must name eligible stable people. Retired/classified status is never reconstructed from approximate race distance.

## Atomic sequence

1. Validate and normalize the checkpoint. Version-one campaign checkpoints migrate to version two with empty competition, economy, and inventory projections; no consequences are fabricated.
2. Validate the manifest, receipt, and policy identities and integrity digests.
3. Require the exact active manifest for a new receipt. Recovery may complete an older factual receipt only when no different weekend is active.
4. Stage the exactly-once factual settlement receipt.
5. Stage competition awards and rebuild driver/team standings from the complete event history.
6. Stage the exact returned-resource rows by stable car identity. Missing consumed-resource evidence is not invented.
7. Stage dated integer-minor-unit entry, participation, and position-bonus postings. Cash is recalculated from the opening balance plus every posting.
8. Require campaign time to still equal the frozen departure slot, then advance it to the return slot with one accepted campaign command.
9. Build and validate one version-two checkpoint with all three consequence projections containing the same event set.
10. Clear the active manifest only in the complete candidate.

The storage adapter serializes and validates the complete candidate before temporary-file publication, backup preservation, replacement, and rollback.

## Exactly-once behavior

- Reapplying the same manifest, receipt, and policy after all projections exist returns `already_settled` and the exact same checkpoint.
- A different result digest returns a conflict and requires a correction workflow.
- A different valid policy digest returns a conflict; standings and money are not silently recalculated in place.
- A legacy receipt without projections can be completed once if campaign time still equals the frozen departure boundary.
- Partial sporting/economy/inventory event sets are invalid in a version-two checkpoint.

## Projection contracts

### Competition

`CampaignCompetition` stores immutable per-event awards and rebuilds derived season standings. Driver and team records currently contain points, starts, wins, and best finishing position. Tie-breaking, calendar state, final season classification, cancellations, transfers, and promotion remain later work.

### Economy

`CampaignEconomy` stores fictional credits in integer minor units. Every posting has a stable ID, event ID, return slot, amount, category, and source-result digest. The implemented categories are event entry, participation, and position bonus. Commitments, due dates, receivables, forecasts, reserves, payroll, assets, liabilities, and regulated expenditure remain later work.

### Inventory

`CampaignInventory` records the exact returned car/resource rows from the receipt, including aggregate health, aggregate damage, and tyre values. It does not infer missing components, repair diagnoses, consumption, replacement costs, or warehouse movements.

## Verification contract

The registered `weekend_launch_tests` suite now covers:

- complete time/standings/inventory/economy staging;
- unchanged caller checkpoint during staging;
- explicit points eligibility;
- stable person/team/car mapping;
- integer and dated financial postings;
- exact returned-resource preservation without invented consumption;
- exact no-op reapplication;
- result and policy conflicts;
- invalid inventory rollback before publication;
- departure-time drift rejection;
- precise JSON save/load of the complete envelope; and
- deterministic version-one migration.

The tests establish domain behavior, not a balanced scoring system, viable economy, human-readable management UI, or a complete season.

## Deliberate exclusions and next dependency

This milestone does not implement a series calendar, entry lifecycle, final/provisional classification workflow, tie-breaking, season rollover, correction deltas, financial commitments, cash forecast, contracts, staff, facilities, rivals, engineering, campaign UI, or automatic integration into ordinary standalone weekends.

The next dependency milestone is the smallest **series calendar and season lifecycle** over these records: versioned event schedule, entry states, standings presentation rules, final season classification, and a safe next-season transition. A separate finance milestone must then add commitments, due dates, and minimum-cash forecasting without replacing this factual posting ledger.
