class_name CampaignCommercialContracts
extends RefCounted
## TM-09 guaranteed sponsorship, conditional value and appearance-capacity contracts.
const DAY = CampaignClock.SLOTS_PER_DAY
const ACCOUNT = "organization.commercial"

static func run(check: Callable) -> void:
	var checkpoint = _fixture()
	check.call(not checkpoint.is_empty(), "TM-09 fixture creates a commercial campaign authority")
	if checkpoint.is_empty(): return
	var before_cash = int(checkpoint.economy.accounts[ACCOUNT].cash_minor)
	var signed = CampaignCommercialTransaction.sign_agreement(checkpoint, {
		"id": "sponsor.primary", "sponsor_name": "Northline Tools",
		"account_id": ACCOUNT, "team_id": "team.player", "start_slot": 0, "end_slot": 8 * DAY,
		"guaranteed_payments": [
			{"id": "sponsor.primary.payment.1", "due_slot": 2 * DAY, "amount_minor": 5000},
			{"id": "sponsor.primary.payment.2", "due_slot": 6 * DAY, "amount_minor": 5000}],
		"appearances": [{"id": "sponsor.primary.appearance.1", "person_id": "person.commercial",
			"assignment_id": "assignment.commercial", "start_slot": DAY, "end_slot": 2 * DAY}],
		"bonus_terms": [{"event_id": "event.future", "max_position": 3, "amount_minor": 2500}]})
	check.call(signed.ok, "Signing sponsor terms atomically records money and people obligations")
	if not signed.ok: return
	checkpoint = signed.checkpoint
	check.call(int(checkpoint.economy.accounts[ACCOUNT].cash_minor) == before_cash,
		"Guaranteed sponsor value is not spendable cash before its due date")
	check.call(checkpoint.economy.commitments["sponsor.primary.payment.1"].category == "sponsor" 		and checkpoint.economy.commitments["sponsor.primary.payment.2"].status == "open",
		"Guaranteed sponsor payments are explicit dated commitments")
	check.call(checkpoint.personnel.reservations.has("sponsor.primary.appearance.1") 		and checkpoint.personnel.reservations["sponsor.primary.appearance.1"].kind == "commercial",
		"Sponsor appearances consume shared person availability")
	var view = CampaignCommercialQuery.portfolio(checkpoint)
	check.call(view.ok and view.guaranteed_open_minor == 10000 and view.earned_bonus_minor == 0,
		"Portfolio keeps guaranteed open and unearned conditional value separate")
	var before_conflict = RaceStateValue.fingerprint(checkpoint)
	var conflict = CampaignPersonnelTransaction.reserve_availability(checkpoint, {
		"id": "reservation.conflict", "person_id": "person.commercial",
		"assignment_id": "assignment.commercial", "start_slot": DAY, "end_slot": 2 * DAY,
		"kind": "training", "location_id": "training.room"})
	check.call(not conflict.ok and RaceStateValue.fingerprint(conflict.checkpoint) == before_conflict,
		"Commercial appearances cannot be double-booked")
	var unearned = CampaignCommercialTransaction.claim_event_bonus(checkpoint, "sponsor.primary", "event.future")
	check.call(not unearned.ok and RaceStateValue.fingerprint(unearned.checkpoint) == before_conflict,
		"Conditional sponsor value cannot become cash without settled sporting evidence")
	var restored = CampaignCheckpoint.restore(checkpoint)
	var state: CampaignState = restored.state
	check.call(state.command("advance_slots", {"slots": 2 * DAY}), "Commercial fixture advances to payment date")
	checkpoint = CampaignCheckpoint.build(state, restored.settlements, restored.active_manifest,
		restored.competition, restored.economy, restored.inventory, restored.personnel,
		restored.operations, restored.engineering, restored.management)
	var settled = CampaignFinanceTransaction.settle_due(checkpoint, 2 * DAY)
	check.call(settled.ok and settled.checkpoint.economy.accounts[ACCOUNT].cash_minor == before_cash + 5000,
		"Only the due guaranteed sponsor payment becomes spendable cash")
	if not settled.ok: return
	checkpoint = settled.checkpoint
	var management_before = RaceStateValue.fingerprint(checkpoint.management)
	var reserve = CampaignFinanceTransaction.set_reserve_policy(checkpoint, ACCOUNT, 20000)
	check.call(reserve.ok and RaceStateValue.fingerprint(reserve.checkpoint.management) == management_before,
		"Unrelated finance administration preserves sponsor authority")
	var legacy = checkpoint.duplicate(true)
	legacy.version = CampaignCheckpoint.ENGINEERING_VERSION
	legacy.erase("management")
	_reseal(legacy)
	var migrated = CampaignCheckpoint.restore(legacy)
	check.call(migrated.ok and migrated.management.commercial.agreements.is_empty() 		and migrated.management.authority_from_slot == migrated.state.clock.elapsed_slots,
		"Version-five checkpoints migrate without fabricated sponsor history")

static func _fixture() -> Dictionary:
	var state = CampaignState.create({"campaign_id": "career.commercial", "organization_id": ACCOUNT,
		"principal_id": "person.principal", "start": {"year": 1950, "month": 1, "day": 1, "slot": 0}})
	var economy = CampaignEconomy.create(state.campaign_id, ACCOUNT, 50000, 0)
	var checkpoint = CampaignCheckpoint.build(state, {}, {}, {}, economy, {})
	var person = CampaignPersonnelTransaction.register_person(checkpoint, {
		"id": "person.commercial", "display_name": "Commercial Lead", "eligible_roles": ["commercial_lead"]})
	if not person.ok: return {}
	checkpoint = person.checkpoint
	var contract = CampaignPersonnelTransaction.sign_contract(checkpoint, {
		"id": "contract.commercial", "person_id": "person.commercial", "account_id": ACCOUNT,
		"start_slot": 0, "end_slot": 10 * DAY, "pay_interval_slots": 5 * DAY, "pay_minor": 1000,
		"capacity_bps": 10000, "renewal_window_slots": DAY})
	if not contract.ok: return {}
	checkpoint = contract.checkpoint
	var assignment = CampaignPersonnelTransaction.assign_role(checkpoint, {
		"id": "assignment.commercial", "person_id": "person.commercial", "contract_id": "contract.commercial",
		"role_id": "commercial_lead", "start_slot": 0, "end_slot": 10 * DAY, "allocation_bps": 10000})
	return assignment.checkpoint if assignment.ok else {}

static func _reseal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
