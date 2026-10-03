# Facilities, capacity and rented services

Status: TM-06 first-slice implementation contract.

This milestone adds schedulable organizational capacity without introducing a second work clock, a passive facility performance bonus, or a second engineering/part authority. The implemented [TM-07 engineering pipeline](engineering-parts-race-profile.md) consumes these work orders. Campaign time remains the dated 15-minute `CampaignClock`; people remain owned by `CampaignPersonnel`; binding cash remains owned by `CampaignEconomy`.

## First-slice facility families

TM-06 introduced three deliberately bounded capability families (TM-15 [operational depth](operational-depth.md) adds fabrication, race operations, staff development, commercial operations and academy capacity):

- `preparation_workshop` — workshop/bay capacity used by preparation work;
- `design_office` — internal design/coordination capacity; and
- `test_validation` — bench, rig or equivalent validation capacity.

A `CampaignCapacityResource` is either `owned` or `service`. Owned capacity has no hidden per-slot charge. External service capacity has an explicit integer-minor-unit rate per capacity unit per campaign slot.

The resource record contains availability dates and a bounded capacity count. It does not directly improve a race car, shorten a lap, manufacture a part, or create research progress.

## Work orders and reservations

`CampaignWorkOrder` is the only new TM-06 authority that binds capacity. A work order has a stable identity, family, resource, dated interval, unit count and one of two modes:

- `internal` requires one or more existing personnel role assignments and one owned facility;
- `rented_service` requires one external service resource, no internal personnel reservation and one explicit facility cash commitment.

Every work order owns one deterministic `CampaignCapacityReservation`. Internal work also owns one deterministic `CampaignAvailabilityReservation` per assigned person. These reservations use the existing personnel `factory_work` kind, so one person cannot simultaneously work on another order, travel, train, attend an event or take leave.

Capacity is evaluated as a half-open interval. For every resource and interval, the sum of active reservation units may not exceed the resource's declared capacity. A second mechanic cannot use the same one-bay workshop merely because they are a different person.

## Renting and outsourcing

External services are represented as finite capacity, not as an unlimited escape hatch. The quoted cost is calculated from:

`rate per unit-slot × reserved slots × reserved units`

The resulting amount becomes one normal `CampaignCashCommitment` in the `facility` category, due when the rented work begins. The work order stores the same quoted amount and deterministic commitment identity. Checkpoint validation rejects any disagreement between the provider rate, work order and economy record.

This preserves three distinct facts:

- capacity availability is an operations fact;
- internal staff availability is a personnel fact; and
- the payment obligation is an economy fact.

TM-06 does not charge internal payroll again through a work-order summary. Employment payroll remains the only salary authority.

## Cancellation

Only future work can be cancelled. Cancellation is published atomically through `CampaignOperationsTransaction`:

1. cancel the work order;
2. release its facility/service capacity reservation;
3. release linked future personnel reservations for internal work;
4. cancel the future rented-service payment when applicable; and
5. rebuild one complete campaign checkpoint.

A generic personnel or finance action cannot silently tear down one side of an active work-order contract. Cross-envelope validation rejects partial cancellation.

## Read-only capacity comparison

`CampaignOperationsQuery.capacity_options()` compares registered resources for one family, interval and capacity requirement. It returns detached owned/rented alternatives, availability reasons and an external-service quote where applicable.

The query does not reserve people, capacity, cash or campaign time. A busy internal workshop can therefore be compared with an available rented service before the player makes a binding commitment.

## Checkpoint integration

Version 4 introduced the `operations` projection. Current `CampaignCheckpoint` version 6 also carries engineering and management, preserving the same people/capacity/economy links.

Cross-envelope validation requires:

- operations campaign/organization identity to match the checkpoint;
- operations history not to be dated after authoritative campaign time;
- internal work reservations to match the existing personnel assignments exactly;
- rented-service commitments to match the economy exactly; and
- facility capacity never to be allocated beyond its recorded limit.

Version-three checkpoints migrate deterministically. Existing `facility` cash commitments are preserved in an explicit legacy index; migration does not fabricate facilities, providers, work orders or historical capacity usage.

Unrelated competition, finance, personnel and weekend transactions carry the operations projection forward unchanged. Facility planning is frozen while a weekend manifest is active, matching the existing personnel/finance planning boundary. Already binding cash commitments continue through the normal due-settlement path.

## Verification contract

The registered campaign suite covers:

- all three first-slice facility families;
- internal work reserving personnel and facility capacity together;
- rejection of double-booked owned capacity with otherwise free staff;
- rejection of double-booked people on different facilities;
- finite external-provider capacity;
- detached owned-versus-rented comparison;
- explicit rented-service commitment amount and due date;
- atomic cancellation of service capacity and future payment;
- prevention of generic personnel cancellation for work-order-owned reservations;
- preservation of operations through unrelated finance administration; and
- version-three migration with exact legacy facility spending and no fabricated history.

## Deliberate limits

Facility construction, commissioning, facility condition/maintenance and recurring operating costs remain separate depth. [Engineering](engineering-parts-race-profile.md) now consumes explicit work/capacity for designs and physical parts; [operational depth](operational-depth.md) adds material stock, uncertainty and part wear/repair. Director Desk summaries expose bounded organization work; dedicated facility specialist screens remain future presentation.

Capacity itself never grants a passive performance bonus. Installed engineering parts affect the race only through the versioned, frozen and tested performance-profile seam.
