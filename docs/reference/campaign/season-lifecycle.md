# Campaign series, entries and season lifecycle

Implemented sporting authority used by the [Director Desk first loop](director-desk-first-loop.md). Comprehensive and balanced championship regulations remain separate work.

## Authority and scope

`CampaignCompetition` is the single sporting projection for the campaign. Version 2 adds registered `CampaignSeriesRules`, versioned `CampaignSeason` records, immutable event awards, countback standings and controlled lifecycle transitions. It does not create another race simulation or decide classification from race distance.

The first supported series policy is intentionally narrow:

- a bounded number of entrants, cars per entrant and events;
- one frozen ordered points table;
- successive finishing-position countback;
- final classifications only; and
- no fastest-lap bonus, penalties or provisional payouts in the ordinary series-scoring path. Promotion and final-result correction have separate implemented transaction owners.

Those omissions are explicit. They are not approximated from unrelated race fields.

## Series rules

`CampaignSeriesRules` binds:

- stable series identity and display name;
- cars per entrant;
- minimum and maximum accepted entrants;
- minimum and maximum event count;
- a non-increasing integer points table;
- countback depth;
- the `final_only` classification policy; and
- an integrity digest.

A season retains the exact rules digest. A weekend policy must use the same points table; an event cannot silently replace the season scoring rules.

## Calendar

A season calendar is ordered and immutable apart from its resolution state. Every event records:

- a globally unique campaign event identity and one-based round;
- departure and return slots;
- event revision;
- frozen track and ruleset hashes;
- `scheduled`, `completed` or `cancelled` status; and
- an empty, result-digest or cancellation-reason resolution reference.

Events cannot overlap. Campaign event identities cannot be reused by another series or season. Resolutions form a prefix of the calendar: a later round cannot complete or cancel while an earlier event remains scheduled. A completed item must have exactly one matching immutable competition event; a cancellation creates no sporting award.

Before a new settlement, `CampaignWeekendTransaction` asks the competition authority to verify the active manifest against the next scheduled event. Departure/return slots, event revision, track hash, ruleset hash and the entire accepted person/team/car field must match. A separately valid weekend with different dates or mappings is rejected without changing the caller checkpoint.

## Entry lifecycle

Entries move through explicit records:

`submitted → accepted | rejected`

A submitted or accepted entry may be withdrawn while entries remain open. Live entries cannot repeat entrant, team, person or car identities. Each accepted entry must contain the configured number of stable people and cars. Rejected and withdrawn records remain auditable but do not consume the live entrant limit.

Closing entries requires:

- no undecided submissions;
- at least the series minimum accepted entrants;
- no more than the series maximum; and
- a conflict-free complete field.

The active series season must close before another season opens for the same series. [Multi-season planning](multi-season-progression.md) already records current-car versus next-car investment and explicit promotion choices, but competition entries are not automatically derived from personnel contracts or eligibility. A next-season transition carries explicit accepted entrants; automatic personnel-backed roster registration remains separate work.

## Season lifecycle

The legal sequence is:

`planning → entries_open → preseason → active → final_classification → settled → contract_transition → completed`

Transitions cannot be skipped or reversed. `preseason` and `active` require a valid accepted field. `final_classification` requires every event to be completed or explicitly cancelled and at least one completed event. A new season for the same series can be created only after the prior season reaches `completed`.

The lifecycle states are sporting boundaries only. `settled` does not automatically pay season prizes, renew employment or promote an entrant. Personnel contracts can be renewed through their explicit dated transaction, but the season transition does not silently invoke it.

## Standings and ties

Each completed event stores immutable awards containing stable person/team identity, classified position, explicit eligibility, points, result digest and policy digest. Driver and team standings are rebuilt from the complete event history; persisted totals are validated projections, not an independent authority.

Ordering is:

1. championship points;
2. number of wins;
3. number of second places; and
4. successive finishing-position counts up to the frozen countback depth.

Rows still equal after all configured countback positions receive the same sporting position and an explicit `shared` flag. Stable identity is used only to make serialization/display order deterministic; it never breaks a sporting tie.

Team starts and finishing counts aggregate every entered car. Driver points stay with the stable person identity and team points stay with the team identity recorded for that event.

## Atomic administration and persistence

`CampaignCompetitionTransaction` is the application-level write boundary for series registration, season creation, lifecycle transitions, entry decisions and event cancellation. It restores the caller checkpoint, applies one detached competition mutation, and rebuilds one complete `CampaignCheckpoint` containing unchanged campaign state, receipts, economy, inventory and personnel plus the new competition projection.

A failed mutation returns the exact caller value. Competition administration is frozen while an active weekend manifest exists; the frozen entry cannot be cancelled or administratively rewritten while its race is running. `CampaignStorage` then validates and publishes the complete checkpoint through its temporary-file, backup and rollback policy.

Version-one `CampaignCompetition` projections remain valid inside modern campaign checkpoints. They are read-only when they contain event history because reconstructing an unrecorded calendar, entry field or rule pack would fabricate facts. An empty legacy projection can upgrade to version 2 when the first explicit series is registered.

An identical already-applied legacy event remains an exact no-op. Adding a new event to non-empty legacy history requires a future explicit migration with real calendar and entry evidence.

The current surrounding `CampaignCheckpoint` schema is version 6. Its cross-projection rules require competition, economy and inventory to reference the same complete event set, result digest and policy where applicable; personnel remains a separate organization authority in the same atomic envelope.

## Registered contracts

The registered `weekend_launch_tests` suite runs campaign contracts covering:

- rule-pack and four-round calendar registration;
- rejected lifecycle jumps and unchanged input values;
- duplicate person rejection;
- undecided-entry close protection;
- exact manifest/calendar/field binding;
- out-of-order event rejection;
- frozen-scoring rejection;
- shared sporting positions;
- wins/successive-countback ordering;
- derived-standings tamper detection after digest recomputation;
- final-classification gating;
- complete transition to the next season;
- cancellation without awards; and
- complete projection validation.

Additional registered contracts cover globally unique event identities, atomic checkpoint publication, unchanged rejected checkpoints, active-weekend administration freeze, storage round-trip, and cancellation without sporting or financial consequences. The atomic weekend transaction additionally settles a registered event together with time, inventory, event cash, due obligations, personnel preservation and the exactly-once receipt.

## Implemented integrations and remaining limits

[Readiness/departure](event-readiness-departure.md) checks accepted entries against required player driver/crew availability before freezing the manifest. [Multi-season progression](multi-season-progression.md) adds dated season prizes, explicit promotion choices and a coherent second season. [Final-result correction](result-corrections.md), [rivals](rival-organizations.md) and the [Director Desk](director-desk-first-loop.md) consume the same sporting authority.

Live provisional classification, steward adjudication, license-derived eligibility and roster effective-date registration remain outside this bounded final-only series contract. There is no claim of comprehensive championship regulation or calibrated balance.

## Implementation and coverage

Authority and application owners: [competition.gd](../../../scripts/domain/campaign/competition.gd), [season.gd](../../../scripts/domain/campaign/season.gd), [competition_transaction.gd](../../../scripts/application/campaign/competition_transaction.gd).

Contract fixtures: [campaign_season_contracts.gd](../../../tests/support/campaign_season_contracts.gd), [campaign_competition_transaction_contracts.gd](../../../tests/support/campaign_competition_transaction_contracts.gd).

Campaign fixtures run through registered `weekend_launch_tests`, via
`CampaignStateContracts`. The [verification guide](../../how-to/verification.md) defines
complete-suite execution; this reference describes coverage, not a fresh pass.
