# Campaign event readiness and departure

TM-08 connects the persistent campaign to the already-existing weekend without creating a second race-preparation system.

## Readiness contract

Readiness is derived from authoritative state and has no independent performance effect. A departure is ready only when:

- campaign time equals the registered event departure slot;
- the active season and complete accepted field match the immutable weekend manifest;
- both player drivers and at least one race-operations crew assignment cover the full departure/return interval and are otherwise available;
- the race's frozen v12 performance-profile set exactly matches profiles composed from installed campaign parts; and
- any event-operations cost can be represented as one explicit dated cash commitment.

A reserve-policy breach is a visible risk rather than an implicit block. Missing prior return inventory on the first event is also shown as an explicit risk; the system does not invent historic stock.

## Atomic departure

`CampaignDepartureTransaction` revalidates the live state, reserves each selected person as `event_duty`, creates and settles the event-operations commitment at departure, and then publishes one checkpoint whose `active_manifest` is the existing `CampaignWeekendManifest`.

Any rejected sub-step returns the unchanged caller checkpoint. Once the manifest is active, the existing campaign planning transactions remain frozen until the weekend is settled.

## Installed configuration

For native checkpoint v12 and later, `RaceRecord.manifest_for` includes each per-car `RacePerformanceProfile` in the starting-resource fingerprint. This makes installed campaign configuration part of the immutable race-entry evidence while preserving the historical fingerprint of older v10/v11 recordings.

The weekend still owns setup, tyres, pit routing, commands, timing and race outcomes. Campaign readiness only proves that the chosen organization can legally and physically depart with the already-frozen race entry.
