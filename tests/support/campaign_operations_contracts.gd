class_name CampaignOperationsContracts
extends RefCounted
## TM-06 facilities, bounded capacity, rented services and cross-authority contracts.
const DAY = CampaignClock.SLOTS_PER_DAY
const WEEK = 7 * DAY
const ACCOUNT = "organization.operations"

static func run(check: Callable) -> void:
	_capacity_and_service_contract(check)
	_previous_checkpoint_migration_contract(check)

static func _capacity_and_service_contract(check: Callable) -> void:
	var checkpoint = _staffed_checkpoint()
	check.call(not checkpoint.is_empty(), "Operations fixture creates a staffed campaign checkpoint")
	if checkpoint.is_empty():
		return
	for resource in [
		_resource("facility.workshop", "Preparation workshop", "preparation_workshop", 1),
		_resource("facility.design", "Design office", "design_office", 1),
		_resource("facility.test", "Validation rig", "test_validation", 1)
	]:
		var changed = CampaignOperationsTransaction.register_owned(checkpoint, resource)
		check.call(changed.ok, "Each first-slice facility family can register owned capacity")
		if not changed.ok:
			return
		checkpoint = changed.checkpoint
	var service = CampaignOperationsTransaction.register_service(checkpoint, {
		"id": "service.workshop",
		"display_name": "Independent preparation bay",
		"family": "preparation_workshop",
		"available_from_slot": 0,
		"available_until_slot": 8 * WEEK,
		"capacity_units": 1,
		"rate_minor_per_unit_slot": 25
	})
	check.call(service.ok, "External rented capacity is registered separately from owned facilities")
	if not service.ok:
		return
	checkpoint = service.checkpoint
	var first = CampaignOperationsTransaction.schedule_internal(checkpoint, {
		"id": "work.prep.primary",
		"family": "preparation_workshop",
		"resource_id": "facility.workshop",
		"start_slot": DAY,
		"end_slot": 2 * DAY,
		"units": 1,
		"assignment_ids": ["assignment.mech.a"]
	})
	check.call(first.ok, "Internal work reserves explicit staff and facility capacity together")
	if not first.ok:
		return
	checkpoint = first.checkpoint
	var first_order: Dictionary = checkpoint.operations.work_orders["work.prep.primary"]
	check.call(first_order.personnel_reservation_ids.size() == 1 \
		and checkpoint.personnel.reservations.has(first_order.personnel_reservation_ids[0]),
		"Internal work owns one linked exclusive personnel reservation")
	var before_conflict = RaceStateValue.fingerprint(checkpoint)
	var machine_conflict = CampaignOperationsTransaction.schedule_internal(checkpoint, {
		"id": "work.prep.second",
		"family": "preparation_workshop",
		"resource_id": "facility.workshop",
		"start_slot": DAY,
		"end_slot": 2 * DAY,
		"units": 1,
		"assignment_ids": ["assignment.mech.b"]
	})
	check.call(not machine_conflict.ok \
		and RaceStateValue.fingerprint(machine_conflict.checkpoint) == before_conflict,
		"Owned machine capacity cannot be allocated twice even with different staff")
	var person_conflict = CampaignOperationsTransaction.schedule_internal(checkpoint, {
		"id": "work.design.conflict",
		"family": "design_office",
		"resource_id": "facility.design",
		"start_slot": DAY,
		"end_slot": 2 * DAY,
		"units": 1,
		"assignment_ids": ["assignment.mech.a"]
	})
	check.call(not person_conflict.ok \
		and RaceStateValue.fingerprint(person_conflict.checkpoint) == before_conflict,
		"One person cannot be allocated to two simultaneous facility work orders")
	var options = CampaignOperationsQuery.capacity_options(
		checkpoint, "preparation_workshop", DAY, 2 * DAY, 1)
	check.call(options.ok and options.options.size() == 2,
		"Capacity query compares owned and rented alternatives from detached state")
	var owned = _option(options.options, "facility.workshop")
	var rented = _option(options.options, "service.workshop")
	check.call(not owned.available and rented.available and rented.quoted_cost_minor == 2400,
		"Busy internal capacity leaves a priced rented-service alternative available")
	check.call(RaceStateValue.fingerprint(checkpoint) == before_conflict,
		"Capacity comparison does not reserve staff, machines, cash or time")
	var rented_work = CampaignOperationsTransaction.schedule_service(checkpoint, {
		"id": "work.prep.rented",
		"family": "preparation_workshop",
		"resource_id": "service.workshop",
		"start_slot": DAY,
		"end_slot": 2 * DAY,
		"units": 1
	})
	check.call(rented_work.ok, "Rented service can execute without consuming internal people or facility capacity")
	if not rented_work.ok:
		return
	checkpoint = rented_work.checkpoint
	var order: Dictionary = checkpoint.operations.work_orders["work.prep.rented"]
	var commitment_id: String = order.commitment_ids[0]
	check.call(order.personnel_reservation_ids.is_empty() and order.quoted_cost_minor == 2400 \
		and checkpoint.economy.commitments[commitment_id].amount_minor == -2400 \
		and checkpoint.economy.commitments[commitment_id].due_slot == DAY,
		"Outsourcing trades internal capacity for one explicit dated facility commitment")
	var before_provider_conflict = RaceStateValue.fingerprint(checkpoint)
	var provider_conflict = CampaignOperationsTransaction.schedule_service(checkpoint, {
		"id": "work.prep.rented.second",
		"family": "preparation_workshop",
		"resource_id": "service.workshop",
		"start_slot": DAY,
		"end_slot": 2 * DAY,
		"units": 1
	})
	check.call(not provider_conflict.ok \
		and RaceStateValue.fingerprint(provider_conflict.checkpoint) == before_provider_conflict,
		"External provider capacity is finite rather than an unlimited escape hatch")
	var generic_cancel = CampaignPersonnelTransaction.cancel_reservation(
		checkpoint, first_order.personnel_reservation_ids[0])
	check.call(not generic_cancel.ok \
		and RaceStateValue.fingerprint(generic_cancel.checkpoint) == before_provider_conflict,
		"Personnel administration cannot silently release staff still owned by a work order")
	var cancelled = CampaignOperationsTransaction.cancel_work_order(checkpoint, "work.prep.rented")
	check.call(cancelled.ok, "Future rented work can be cancelled through its owning operations transaction")
	if not cancelled.ok:
		return
	checkpoint = cancelled.checkpoint
	check.call(checkpoint.economy.commitments[commitment_id].status == "cancelled" \
		and checkpoint.operations.capacity_reservations[order.capacity_reservation_id].status == "cancelled",
		"Cancelling rented work releases capacity and its future payment atomically")
	var reserve = CampaignFinanceTransaction.set_reserve_policy(checkpoint, ACCOUNT, 50000)
	check.call(reserve.ok and RaceStateValue.fingerprint(reserve.checkpoint.operations) \
		== RaceStateValue.fingerprint(checkpoint.operations),
		"Unrelated finance administration preserves the complete operations authority")

static func _previous_checkpoint_migration_contract(check: Callable) -> void:
	var state = CampaignState.create({
		"campaign_id": "career.operations.migrate",
		"organization_id": "organization.operations.migrate",
		"principal_id": "person.principal",
		"start": {"year": 1950, "month": 1, "day": 1, "slot": 0}
	})
	var checkpoint = CampaignCheckpoint.build(state)
	var restored = CampaignCheckpoint.restore(checkpoint)
	var economy = CampaignEconomy.add_commitment(restored.economy, {
		"id": "legacy.facility.bill",
		"account_id": restored.state.organization_id,
		"source_id": "legacy.facility.source",
		"due_slot": DAY,
		"amount_minor": -1000,
		"category": "facility"
	}, 0)
	check.call(economy.ok, "Previous checkpoint fixture can contain an already binding facility commitment")
	if not economy.ok:
		return
	var previous = checkpoint.duplicate(true)
	previous.version = CampaignCheckpoint.PERSONNEL_VERSION
	previous.economy = economy.economy
	previous.erase("operations")
	_reseal(previous)
	check.call(CampaignCheckpoint.validate(previous).is_empty(),
		"Version-three checkpoint remains valid without operations authority")
	var upgraded = CampaignCheckpoint.upgrade(previous)
	check.call(not upgraded.is_empty() and upgraded.version == CampaignCheckpoint.VERSION \
		and "legacy.facility.bill" in upgraded.operations.legacy_facility_commitment_ids,
		"Migration preserves prior facility spending explicitly without fabricating a work order")
	check.call(upgraded.operations.work_orders.is_empty() \
		and upgraded.economy.commitments["legacy.facility.bill"].amount_minor == -1000,
		"Operations migration preserves the exact old economy and creates no historical capacity usage")

static func _staffed_checkpoint() -> Dictionary:
	var state = CampaignState.create({
		"campaign_id": "career.operations",
		"organization_id": ACCOUNT,
		"principal_id": "person.principal",
		"start": {"year": 1950, "month": 1, "day": 1, "slot": 0}
	})
	var economy = CampaignEconomy.create(state.campaign_id, state.organization_id, 200000, 0)
	var checkpoint = CampaignCheckpoint.build(state, {}, {}, {}, economy, {})
	for item in [
		["person.mech.a", "Mechanic A"],
		["person.mech.b", "Mechanic B"]
	]:
		var person = CampaignPersonnelTransaction.register_person(checkpoint, {
			"id": item[0], "display_name": item[1], "eligible_roles": ["chief_mechanic"]})
		if not person.ok:
			return {}
		checkpoint = person.checkpoint
		var contract_id = "contract." + str(item[0])
		var contract = CampaignPersonnelTransaction.sign_contract(checkpoint, {
			"id": contract_id,
			"person_id": item[0],
			"account_id": ACCOUNT,
			"start_slot": 0,
			"end_slot": 8 * WEEK,
			"pay_interval_slots": WEEK,
			"pay_minor": 5000,
			"capacity_bps": 10000,
			"renewal_window_slots": WEEK
		})
		if not contract.ok:
			return {}
		checkpoint = contract.checkpoint
		var suffix = "a" if item[0] == "person.mech.a" else "b"
		var assignment = CampaignPersonnelTransaction.assign_role(checkpoint, {
			"id": "assignment.mech." + suffix,
			"person_id": item[0],
			"contract_id": contract_id,
			"role_id": "chief_mechanic",
			"start_slot": 0,
			"end_slot": 8 * WEEK,
			"allocation_bps": 10000
		})
		if not assignment.ok:
			return {}
		checkpoint = assignment.checkpoint
	return checkpoint

static func _resource(id: String, name: String, family: String, units: int) -> Dictionary:
	return {
		"id": id,
		"display_name": name,
		"family": family,
		"available_from_slot": 0,
		"available_until_slot": 8 * WEEK,
		"capacity_units": units
	}

static func _option(options: Array, resource_id: String) -> Dictionary:
	for option in options:
		if option.resource_id == resource_id:
			return option
	return {}

static func _reseal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
