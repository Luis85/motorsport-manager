# Campaign people, contracts and availability

Implemented personnel authority. [Recruitment and development](people-development-recruitment.md) consume these contracts; a dedicated Team/Person screen remains future presentation.

## Authority and scope

`CampaignPersonnel` is the campaign authority for stable people, employment terms, role allocations and exclusive dated availability. It is separate from:

- `CampaignState`, which owns authoritative campaign time and principal interventions;
- `CampaignEconomy`, which owns cash, commitments and postings;
- `CampaignCompetition`, which owns series entries and sporting identity; and
- the race weekend, which consumes a frozen entry but does not hire, pay or schedule staff.

This authority establishes the invariants used by capacity, facilities and projects. Persistent attributes, morale/trust and development belong to TM-13 people records. Personnel itself does not calculate fatigue, shift productivity or hidden race-performance bonuses.

## Current checkpoint version 6

`CampaignCheckpoint` version 6 retains personnel alongside operations, engineering and management authorities. Personnel was introduced in version 3 and operations in version 4. Its core publication contracts include:

- replay-validated campaign state and time;
- factual weekend receipts and optional active manifest;
- competition, economy and inventory projections; and
- personnel, employment, assignment and availability records.

Personnel history and finance are cross-validated before publication. A caller cannot persist a contract without its payroll commitments, cancel binding payroll while employment remains active, or retain future payroll after dated termination.

Version-two checkpoints migrate without inventing people or contracts. Existing version-two payroll commitments, if present, are retained in an explicit `legacy_payroll_ids` index. Personnel authority begins at the migration slot. New payroll after migration must be backed by one recorded employment contract.

Version-one campaign checkpoints continue through the existing deterministic migration path and receive empty personnel authority at the restored campaign slot.

## People

`CampaignPerson` records:

- stable person identity;
- bounded display name;
- explicit eligible role set;
- creation slot; and
- integrity digest.

The supported first-slice role vocabulary is:

- race driver;
- race engineer;
- technical lead;
- chief mechanic;
- operations lead;
- commercial lead;
- department workforce; and
- academy lead.

Role eligibility is descriptive authority for assignment validation. Attributes and confidence belong to the separate persistent candidate/people-development records; employment itself does not supply licenses or hidden performance modifiers.

## Employment contracts

`CampaignEmploymentContract` records immutable terms:

- stable contract, person and payroll-account identities;
- signing, start and end slots;
- payroll interval and integer-minor-unit installment;
- contracted capacity in basis points;
- renewal-window duration;
- predecessor and successor identities;
- termination evidence;
- deterministic payroll commitment identities;
- immutable terms digest; and
- complete record digest.

Lifecycle state is derived from authoritative campaign time rather than stored independently:

` signed_future → active → renewal_window → expired `

A dated termination changes the derived path to `terminated`. The same contract cannot be both terminated and succeeded by a renewal.

Contract durations must contain complete payroll intervals. This first slice uses fixed installments only; it does not implement prorating, bonuses, buyouts, notice pay, release clauses, unpaid leave or settlement negotiation.

## Payroll generation

Signing a contract generates every dated payroll installment as an explicit `CampaignCashCommitment`:

- the contract identity is the commitment source;
- the organization account is the payroll account;
- the due slot comes from the immutable contract schedule;
- the amount is the negative contract installment; and
- the category is `payroll`.

Payroll does not create a second personnel cash ledger. Cash moves only when the existing economy settles the commitment and creates one posting at the contractual due slot.

`CampaignPersonnelEconomy` verifies the complete relationship:

- every contract installment has exactly one commitment;
- amount, account, source, creation slot and due slot match the contract;
- payroll cannot be cancelled while the contract remains binding;
- settled payroll cannot be dated before its due slot;
- future payroll is cancelled at termination; and
- no new payroll commitment exists without one contract schedule.

Project or department summaries must not charge the same salary again. Later internal cost allocation may analyze paid staff time, but it cannot produce a second cash movement.

## Contract preview

`CampaignPersonnelQuery.contract_preview()` stages a proposed contract and its payroll commitments only on detached values. It returns:

- the proposed immutable contract;
- payroll-installment count;
- total committed pay;
- committed cash forecast through the requested horizon; and
- source checkpoint digest.

Opening, refreshing or discarding the preview does not sign employment, add commitments, move cash, issue a campaign command or advance time.

## Role allocation

`CampaignRoleAssignment` assigns a person to a role over an explicit interval and consumes a fixed share of the employment contract’s capacity.

Validation requires:

- one known person and employment contract;
- an eligible role;
- assignment dates inside the contract term;
- binding employment when the assignment is created;
- no duplicate overlapping assignment for the same role; and
- total simultaneous allocation no greater than contracted capacity.

Compatible part-time responsibilities may coexist when their total allocation fits the contract. One person cannot silently provide more than 100 percent of a full-capacity contract.

Assignments are immutable dated records in this slice. A later capacity scheduler may add planned revisions and department-team abstractions, but may not rewrite prior responsibility evidence.

## Exclusive availability

`CampaignAvailabilityReservation` records one exclusive use of a person:

- factory work;
- event duty;
- travel;
- training; or
- leave.

Each reservation names a role assignment, location and start/end interval. Active reservations for the same person cannot overlap, even when they originate from different compatible roles. A person therefore cannot work at headquarters, travel, train and attend a race during the same interval.

A reservation must remain inside its role assignment and effective employment. Future reservations are released when employment terminates. Employment cannot terminate through an already-started reservation; the caller must resolve that active commitment first.

Cancellation is allowed only before the reservation starts and keeps dated cancellation evidence. It does not erase the historical record.

This is an exclusive-occupancy foundation, not a full workload or fatigue model. It does not yet calculate shift productivity, recovery, holidays, overtime or travel fatigue.

## Renewal, termination and replacement

A renewal is available only during the declared renewal window. It creates a non-overlapping successor contract beginning exactly when the predecessor ends. Both records retain reciprocal predecessor/successor identities. The successor’s payroll schedule is committed once when renewal becomes binding.

Termination:

1. settles all commitments already due at authoritative campaign time;
2. records termination slot and reason;
3. cancels every future payroll installment at the same slot;
4. releases future availability reservations; and
5. publishes personnel and economy together or publishes neither.

A replacement transaction performs termination and a different person’s new contract in one complete checkpoint. It does not automatically transfer role assignments, promises, expertise or future work. Those decisions remain explicit.

## Application and query boundaries

`CampaignPersonnelTransaction` is the write boundary for:

- registering people;
- signing and renewing employment;
- terminating or replacing employment;
- assigning roles;
- reserving availability; and
- cancelling an unstarted reservation.

Every operation restores the complete checkpoint, stages detached personnel and finance values, validates cross-envelope rules, and returns one complete candidate or the exact caller checkpoint.

Personnel planning is frozen while an immutable weekend manifest is active. Existing payroll commitments still continue through ordinary dated settlement. `factory_work` reservations owned by TM-06 work orders are additionally cross-validated against operations and cannot be cancelled through a generic personnel mutation while the work order remains scheduled.

`CampaignPersonnelQuery.roster()` returns a detached, time-aware roster. Contract status is derived at the checkpoint slot. An assignment is reported active only while both its dates and effective employment are active. Availability is calculated without reserving time.

## Weekend behavior

Employment terms and reservations do not use the race clock. When a campaign weekend runs from departure to return:

- personnel records remain frozen in the departure checkpoint;
- race pause or speed does not create extra employment time;
- payroll due inside the interval settles at its contractual campaign slot;
- event cash and payroll remain separately sourced; and
- the return checkpoint publishes time, sporting consequences, inventory, event cash, due payroll and personnel together.

TM-08 [event readiness and departure](event-readiness-departure.md) now bind required player driver/crew availability to the immutable entry manifest and explicit event-duty reservations. This is not a general automatic travel or staff-scheduling model.

## Timeline and integrity rules

`CampaignPersonnelTimeline` rejects:

- personnel authority beginning after campaign time;
- people created in the future;
- contracts signed or terminated in the future;
- role assignments created in the future; and
- reservations created or cancelled in the future.

Future contract starts, ends, payroll due dates and availability intervals remain valid plans. Integrity digests do not replace structural and cross-record validation; recomputing an outer digest cannot conceal overlapping employment, excess allocation or unowned payroll.

## Registered contracts

The registered `weekend_launch_tests` suite runs campaign contracts covering:

- stable person registration;
- detached contract and payroll forecast preview;
- exact payroll commitment generation;
- derived contract lifecycle state;
- compatible part-time roles;
- over-capacity and ineligible-role rejection with unchanged checkpoints;
- exclusive work/event/training availability;
- generic payroll-cancellation rejection;
- renewal windows and reciprocal successor lineage;
- duplicate-renewal rejection;
- replacement with earned payroll settlement and future-payroll cancellation;
- release of future reservations on termination;
- payroll due during a weekend settling at its contractual slot;
- version-two migration preserving legacy payroll without invented staff;
- complete storage round-trip; and
- active-weekend planning freeze.

These checks establish domain, application and persistence behavior. They do not establish believable staff markets, employment balance, legal realism, usability or player attachment.

## Implemented consumers and remaining limits

[Operations](facilities-capacity-services.md) and [engineering](engineering-parts-race-profile.md) consume the same people/facility reservations. [People development/recruitment](people-development-recruitment.md) adds persistent candidates, bounded negotiation, attributes, workload-based development, morale/trust and explicit promises. [Delegation](delegation-mandates.md) and [readiness](event-readiness-departure.md) retain their named authority boundaries.

Richer scouting uncertainty, chemistry/fatigue, shift productivity, department headcount, staff-planner AI, comprehensive contractual buyouts/notice and dedicated Team/Person UI remain separate depth. None is inferred from an employment title or converted into a hidden race-pace modifier.

## Implementation and coverage

Authority and application owners: [personnel.gd](../../../scripts/domain/campaign/personnel.gd), [personnel_transaction.gd](../../../scripts/application/campaign/personnel_transaction.gd), [personnel_query.gd](../../../scripts/application/campaign/personnel_query.gd).

Contract fixtures: [campaign_personnel_contracts.gd](../../../tests/support/campaign_personnel_contracts.gd), [campaign_personnel_lifecycle_contracts.gd](../../../tests/support/campaign_personnel_lifecycle_contracts.gd).

Campaign fixtures run through registered `weekend_launch_tests`, via
`CampaignStateContracts`. The [verification guide](../../how-to/verification.md) defines
complete-suite execution; this reference describes coverage, not a fresh pass.
