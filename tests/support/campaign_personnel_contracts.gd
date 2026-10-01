class_name CampaignPersonnelContracts
extends RefCounted
## TM-05 people, employment, payroll and availability contracts.
const DAY = CampaignClock.SLOTS_PER_DAY
const WEEK = 7 * DAY
const ACCOUNT = "organization.people"

static func run(check: Callable) -> void:
	_assignment_and_preview_contract(check)
	_renewal_contract(check)

static func _assignment_and_preview_contract(check: Callable) -> void:
	var checkpoint = _checkpoint()
	var changed = CampaignPersonnelTransaction.register_person(checkpoint, {
		"id": "person.alex",
		"display_name": "Alex Morgan",
		"eligible_roles": ["technical_lead", "operations_lead", "commercial_lead"]
	})
	check.call(changed.ok, "A stable person can enter the campaign personnel registry")
	if not changed.ok:
		return
	checkpoint = changed.checkpoint
	var before_preview = RaceStateValue.fingerprint(checkpoint)
	var preview = CampaignPersonnelQuery.contract_preview(
		checkpoint, _contract("contract.alex.1", "person.alex", 0, 4 * WEEK, 10000), 4 * WEEK)
	check.call(preview.ok and preview.payroll_commitment_count == 4 \
		and preview.total_committed_pay_minor == 40000 \
		and preview.forecast.scenarios.committed.ending_cash_minor == 160000,
		"Employment preview exposes all dated payroll before the contract becomes binding")
	check.call(RaceStateValue.fingerprint(checkpoint) == before_preview,
		"Employment preview does not mutate personnel, cash or campaign time")
	changed = CampaignPersonnelTransaction.sign_contract(
		checkpoint, _contract("contract.alex.1", "person.alex", 0, 4 * WEEK, 10000))
	check.call(changed.ok and changed.checkpoint.economy.commitments.size() == 4,
		"Signing employment creates each payroll commitment exactly once")
	if not changed.ok:
		return
	checkpoint = changed.checkpoint
	check.call(CampaignPersonnel.contract_status(
		checkpoint.personnel, "contract.alex.1", 0) == "active",
		"Employment lifecycle status is derived from authoritative campaign time")
	_role_and_availability_contract(check, checkpoint)

static func _role_and_availability_contract(check: Callable, checkpoint: Dictionary) -> void:
	var changed = CampaignPersonnelTransaction.assign_role(checkpoint, {
		"id": "assignment.alex.technical",
		"person_id": "person.alex",
		"contract_id": "contract.alex.1",
		"role_id": "technical_lead",
		"start_slot": 0,
		"end_slot": 4 * WEEK,
		"allocation_bps": 6000
	})
	check.call(changed.ok, "Employment capacity can fund one dated responsibility")
	if not changed.ok:
		return
	checkpoint = changed.checkpoint
	changed = CampaignPersonnelTransaction.assign_role(checkpoint, {
		"id": "assignment.alex.operations",
		"person_id": "person.alex",
		"contract_id": "contract.alex.1",
		"role_id": "operations_lead",
		"start_slot": 0,
		"end_slot": 4 * WEEK,
		"allocation_bps": 4000
	})
	check.call(changed.ok, "Compatible part-time responsibilities may fill remaining contract capacity")
	if not changed.ok:
		return
	checkpoint = changed.checkpoint
	var before_overload = RaceStateValue.fingerprint(checkpoint)
	var overloaded = CampaignPersonnelTransaction.assign_role(checkpoint, {
		"id": "assignment.alex.overload",
		"person_id": "person.alex",
		"contract_id": "contract.alex.1",
		"role_id": "commercial_lead",
		"start_slot": 0,
		"end_slot": WEEK,
		"allocation_bps": 1
	})
	check.call(not overloaded.ok and RaceStateValue.fingerprint(overloaded.checkpoint) == before_overload,
		"Role allocation above contracted capacity fails without changing the checkpoint")
	var ineligible = CampaignPersonnelTransaction.assign_role(checkpoint, {
		"id": "assignment.alex.ineligible",
		"person_id": "person.alex",
		"contract_id": "contract.alex.1",
		"role_id": "chief_mechanic",
		"start_slot": WEEK,
		"end_slot": 2 * WEEK,
		"allocation_bps": 1000
	})
	check.call(not ineligible.ok and RaceStateValue.fingerprint(ineligible.checkpoint) == before_overload,
		"A person cannot receive a role outside their recorded eligibility")
	changed = CampaignPersonnelTransaction.reserve_availability(checkpoint, {
		"id": "reservation.alex.factory",
		"person_id": "person.alex",
		"assignment_id": "assignment.alex.operations",
		"start_slot": 0,
		"end_slot": DAY,
		"kind": "factory_work",
		"location_id": "location.factory"
	})
	check.call(changed.ok, "A role can reserve one explicit period of work")
	if not changed.ok:
		return
	checkpoint = changed.checkpoint
	changed = CampaignPersonnelTransaction.reserve_availability(checkpoint, {
		"id": "reservation.alex.event",
		"person_id": "person.alex",
		"assignment_id": "assignment.alex.technical",
		"start_slot": WEEK,
		"end_slot": WEEK + 2 * DAY,
		"kind": "event_duty",
		"location_id": "event.round1"
	})
	check.call(changed.ok, "Non-overlapping factory and event availability can coexist")
	if not changed.ok:
		return
	checkpoint = changed.checkpoint
	var before_overlap = RaceStateValue.fingerprint(checkpoint)
	var overlap = CampaignPersonnelTransaction.reserve_availability(checkpoint, {
		"id": "reservation.alex.training",
		"person_id": "person.alex",
		"assignment_id": "assignment.alex.operations",
		"start_slot": WEEK + DAY,
		"end_slot": WEEK + 3 * DAY,
		"kind": "training",
		"location_id": "location.academy"
	})
	check.call(not overlap.ok and RaceStateValue.fingerprint(overlap.checkpoint) == before_overlap,
		"One person cannot work, travel, train or attend an event in overlapping intervals")
	var payroll_id: String = checkpoint.personnel.contracts["contract.alex.1"].payroll_commitment_ids[0]
	var cancelled_payroll = CampaignFinanceTransaction.cancel_commitment(checkpoint, payroll_id)
	check.call(not cancelled_payroll.ok \
		and RaceStateValue.fingerprint(cancelled_payroll.checkpoint) == before_overlap,
		"Generic finance cannot cancel payroll while employment remains binding")
	var reserve = CampaignFinanceTransaction.set_reserve_policy(checkpoint, ACCOUNT, 50000)
	check.call(reserve.ok and RaceStateValue.fingerprint(reserve.checkpoint.personnel) \
		== RaceStateValue.fingerprint(checkpoint.personnel),
		"Unrelated finance administration preserves the complete personnel authority")

static func _renewal_contract(check: Callable) -> void:
	var checkpoint = _registered_checkpoint("person.renew", ["race_engineer"])
	var changed = CampaignPersonnelTransaction.sign_contract(
		checkpoint, _contract("contract.renew.1", "person.renew", 0, 4 * WEEK, 8000))
	check.call(changed.ok, "Renewal fixture starts with one binding employment term")
	if not changed.ok:
		return
	checkpoint = _advance(changed.checkpoint, 3 * WEEK)
	changed = CampaignFinanceTransaction.settle_due(checkpoint, 3 * WEEK)
	check.call(changed.ok and changed.settled_count == 3,
		"Payroll due before the renewal window settles once")
	if not changed.ok:
		return
	checkpoint = changed.checkpoint
	changed = CampaignPersonnelTransaction.renew_contract(checkpoint, "contract.renew.1", {
		"id": "contract.renew.2",
		"end_slot": 8 * WEEK,
		"pay_interval_slots": WEEK,
		"pay_minor": 9000,
		"capacity_bps": 10000,
		"renewal_window_slots": WEEK
	})
	check.call(changed.ok and changed.checkpoint.economy.commitments.size() == 8,
		"Renewal adds a non-overlapping future term and its dated payroll schedule")
	if not changed.ok:
		return
	checkpoint = changed.checkpoint
	var first: Dictionary = checkpoint.personnel.contracts["contract.renew.1"]
	var second: Dictionary = checkpoint.personnel.contracts["contract.renew.2"]
	check.call(first.successor_contract_id == second.id \
		and second.predecessor_contract_id == first.id \
		and CampaignPersonnel.contract_status(checkpoint.personnel, second.id, 3 * WEEK) == "signed_future",
		"Renewal preserves predecessor, successor and future-start evidence")
	var before_duplicate = RaceStateValue.fingerprint(checkpoint)
	var duplicate = CampaignPersonnelTransaction.renew_contract(checkpoint, "contract.renew.1", {
		"id": "contract.renew.3",
		"end_slot": 8 * WEEK,
		"pay_interval_slots": WEEK,
		"pay_minor": 9000
	})
	check.call(not duplicate.ok and RaceStateValue.fingerprint(duplicate.checkpoint) == before_duplicate,
		"One employment term cannot acquire two successor renewals")

static func _checkpoint() -> Dictionary:
	var state = CampaignState.create({
		"campaign_id": "career.people",
		"organization_id": ACCOUNT,
		"principal_id": "person.principal",
		"start": {"year": 1950, "month": 1, "day": 1, "slot": 0}
	})
	var economy = CampaignEconomy.create(state.campaign_id, state.organization_id, 200000, 0)
	return CampaignCheckpoint.build(state, {}, {}, {}, economy, {})

static func _registered_checkpoint(person_id: String, roles: Array) -> Dictionary:
	var checkpoint = _checkpoint()
	var changed = CampaignPersonnelTransaction.register_person(checkpoint, {
		"id": person_id,
		"display_name": person_id.replace(".", " ").capitalize(),
		"eligible_roles": roles
	})
	return changed.checkpoint if changed.ok else {}

static func _contract(id: String, person_id: String, start_slot: int,
		end_slot: int, pay_minor: int) -> Dictionary:
	return {
		"id": id,
		"person_id": person_id,
		"account_id": ACCOUNT,
		"start_slot": start_slot,
		"end_slot": end_slot,
		"pay_interval_slots": WEEK,
		"pay_minor": pay_minor,
		"capacity_bps": 10000,
		"renewal_window_slots": WEEK
	}

static func _advance(checkpoint: Dictionary, slots: int) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok or not restored.state.command("advance_slots", {"slots": slots}):
		return {}
	return CampaignCheckpoint.build(
		restored.state, restored.settlements, restored.active_manifest,
		restored.competition, restored.economy, restored.inventory, restored.personnel)

static func _reseal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
