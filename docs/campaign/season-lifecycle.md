# Campaign series, entries and season lifecycle

Status: implemented domain foundation on PR #27. This is not yet a playable campaign UI or a claim of balanced championship rules.

## Authority and scope

`CampaignCompetition` is the single sporting projection for the campaign. Version 2 adds registered `CampaignSeriesRules`, versioned `CampaignSeason` records, immutable event awards, countback standings and controlled lifecycle transitions. It does not create another race simulation or decide classification from race distance.

The first supported series policy is intentionally narrow:

- a bounded number of entrants, cars per entrant and events;
- one frozen ordered points table;
- successive finishing-position countback;
- final classifications only;
- no fastest-lap bonus, penalties, provisional payouts, promotion or correction deltas.

Those omissions are explicit. They are not approximated from unrelated race fields.

## Series rules

`CampaignSeriesRules` binds:

- stable series identity and display name;
- cars per entrant;
- minimum and maximum accepted entrants;
- minimum and maximum event count;
- a non-increasing integer points table;
- countback depth;
- the `final_only` classification policy;
- an integrity digest.

A season retains the exact rules digest. A weekend policy must use the same points table; an event cannot silently replace the season scoring rules.

## Calendar

A season calendar is ordered and immutable apart from its resolution state. Every event records:

- campaign event identity and one-based round;
- departure and return slots;
- event revision;
- frozen track and ruleset hashes;
- `scheduled`, `completed` or `cancelled` status;
- an empty, result-digest or cancellation-reason resolution reference.

Events cannot overlap. Resolutions form a prefix of the calendar: a later round cannot complete or cancel while an earlier event remains scheduled. A completed item must have exactly one matching immutable competition event; a cancellation creates no sporting award.

Before a new settlement, `CampaignWeekendTransaction` asks the competition authority to verify the active manifest against the next scheduled event. Departure/return slots, event revision, track hash, ruleset hash and the entire accepted person/team/car field must match. A separately valid weekend with different dates or mappings is rejected without changing the caller checkpoint.

## Entry lifecycle

Entries move through explicit records:

`submitted → accepted | rejected`

A submitted or accepted entry may be withdrawn while entries remain open. Live entries cannot repeat entrant, team, person or car identities. Each accepted entry must contain the configured number of stable people and cars.

Closing entries requires:

- no undecided submissions;
- at least the series minimum accepted entrants;
- no more than the series maximum;
- a conflict-free complete field.

The current first slice closes the active series season before opening another season for the same series. Parallel next-season planning is deferred until contracts, future commitments and roster effective dates exist.

## Season lifecycle

The legal sequence is:

`planning → entries_open → preseason → active → final_classification → settled → contract_transition → completed`

Transitions cannot be skipped or reversed. `preseason` and `active` require a valid accepted field. `final_classification` requires every event to be completed or explicitly cancelled and at least one completed event. A new season for the same series can be created only after the prior season reaches `completed`.

The lifecycle states are sporting boundaries only. `settled` does not yet pay season prizes, renew contracts or promote an entrant. Those require later explicit finance and contract transactions.

## Standings and ties

Each completed event stores immutable awards containing stable person/team identity, classified position, explicit eligibility, points, result digest and policy digest. Driver and team standings are rebuilt from the complete event history; persisted totals are validated projections, not an independent authority.

Ordering is:

1. championship points;
2. number of wins;
3. number of second places;
4. successive finishing-position counts up to the frozen countback depth.

Rows still equal after all configured countback positions receive the same sporting position and an explicit `shared` flag. Stable identity is used only to make serialization/display order deterministic; it never breaks a sporting tie.

Team starts and finishing counts aggregate every entered car. Driver points stay with the stable person identity and team points stay with the team identity recorded for that event.

## Compatibility and persistence

Version-one `CampaignCompetition` projections remain valid inside existing version-two campaign checkpoints. They are read-only when they contain event history because reconstructing an unrecorded calendar, entry field or rule pack would fabricate facts. An empty legacy projection can upgrade to version 2 when the first explicit series is registered.

An identical already-applied legacy event remains an exact no-op. Adding a new event to non-empty legacy history requires a future explicit migration with real calendar and entry evidence.

The surrounding `CampaignCheckpoint` schema remains version 2. Its existing cross-projection rules still require competition, economy and inventory to reference the same complete event set, result digest and policy where applicable.

## Registered contracts

`CampaignSeasonContracts`, executed by the mandatory `weekend_launch_tests` campaign suite, covers:

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
- cancellation without awards;
- complete projection validation.

The atomic weekend transaction contracts additionally settle a registered season event together with time, inventory, cash and the exactly-once receipt.

## Deliberate next work

This milestone does not implement provisional classifications, stewarding corrections, reversible prize postings, season prize distribution, commitments, payroll, contracts, roster effective dates, promotion, rivals or campaign screens. TM-04 adds commitments, due dates and minimum-cash forecasting as a separate economy responsibility over the factual ledger.
