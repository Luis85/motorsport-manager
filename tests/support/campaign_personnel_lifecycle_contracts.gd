class_name CampaignPersonnelLifecycleContracts
extends RefCounted
## TM-05 replacement, weekend payroll, migration and persistence contracts.
const DAY = CampaignPersonnelContracts.DAY
const WEEK = CampaignPersonnelContracts.WEEK
const ACCOUNT = CampaignPersonnelContracts.ACCOUNT

static func run(check: Callable) -> void:
	_replacement_contract(check)
	_weekend_payroll_contract(check)
	_migration_storage_and_freeze_contract(check)

static func _replacement_contract(check: Callable) -> void:
	var checkpoint = CampaignPersonnelContracts._checkpoint()
	for person in [
		{"id": "person.outgoing", "display_name": "Outgoing Mechanic",
			"eligible_roles": ["chief_mechanic"]},
		{"id": "person.incoming", "display_name": "Incoming Mechanic",
			"eligible_roles": ["chief_mechanic"]}
	]:
		var registered = CampaignPersonnelTransaction.register_person(checkpoint, person)
		check.call(registered.ok, "Replacement fixture registers " + person.id)
		if not registered.ok:
			return
		checkpoint = registered.checkpoint
	var changed = CampaignPersonnelTransaction.sign_contract(
		checkpoint, CampaignPersonnelContracts._contract(
			"contract.outgoing", "person.outgoing", 0, 4 * WEEK, 10000))
	if not changed.ok:
		check.call(false, "Outgoing employment fixture signs successfully")
		return
	checkpoint = changed.checkpoint
	changed = CampaignPersonnelTransaction.assign_role(checkpoint, {
		"id": "assignment.outgoing",
		"person_id": "person.outgoing",
		"contract_id": "contract.outgoing",
		"role_id": "chief_mechanic",
		"start_slot": 0,
		"end_slot": 4 * WEEK,
		"allocation_bps": 10000
	})
	if not changed.ok:
		check.call(false, "Outgoing mechanic receives the required role")
		return
	checkpoint = changed.checkpoint
	changed = CampaignPersonnelTransaction.reserve_availability(checkpoint, {
		"id": "reservation.outgoing.future",
		"person_id": "person.outgoing",
		"assignment_id": "assignment.outgoing",
		"start_slot": 2 * WEEK,
		"end_slot": 3 * WEEK,
		"kind": "event_duty",
		"location_id": "event.future"
	})
	if not changed.ok:
		check.call(false, "Outgoing mechanic can hold a future event reservation")
		return
	checkpoint = CampaignPersonnelContracts._advance(changed.checkpoint, WEEK)
	changed = CampaignPersonnelTransaction.replace_contract(
		checkpoint, "contract.outgoing",
		CampaignPersonnelContracts._contract(
			"contract.incoming", "person.incoming", WEEK, 5 * WEEK, 11000),
		"Planned role replacement.")
	check.call(changed.ok and changed.settled_count == 1 \
		and changed.cancelled_payroll_count == 3,
		"Replacement settles earned payroll, cancels future payroll and signs the successor atomically")
	if not changed.ok:
		return
	checkpoint = changed.checkpoint
	var outgoing: Dictionary = checkpoint.personnel.contracts["contract.outgoing"]
	var statuses = {}
	for commitment_id in outgoing.payroll_commitment_ids:
		var status: String = checkpoint.economy.commitments[commitment_id].status
		statuses[status] = int(statuses.get(status, 0)) + 1
	check.call(outgoing.terminated_slot == WEEK \
		and statuses.get("settled", 0) == 1 and statuses.get("cancelled", 0) == 3,
		"Replacement retains exact earned and cancelled payroll evidence")
	check.call(checkpoint.personnel.reservations["reservation.outgoing.future"].status == "cancelled",
		"Replacement releases future event availability from the outgoing contract")
	check.call(checkpoint.economy.accounts[ACCOUNT].cash_minor == 190000,
		"Replacement changes cash only for payroll actually due at the replacement boundary")
	check.call(CampaignCheckpoint.validate(checkpoint).is_empty(),
		"Replacement publishes one complete personnel and economy checkpoint")

static func _weekend_payroll_contract(check: Callable) -> void:
	var state = CampaignState.create({
		"campaign_id": "career.test",
		"organization_id": "organization.test",
		"principal_id": "person.principal",
		"start": {"year": 1950, "month": 1, "day": 1, "slot": 0}
	})
	var economy = CampaignEconomy.create(state.campaign_id, state.organization_id, 10000, 0)
	var checkpoint = CampaignCheckpoint.build(state, {}, {}, {}, economy, {})
	var changed = CampaignPersonnelTransaction.register_person(checkpoint, {
		"id": "person.payroll",
		"display_name": "Weekend Payroll",
		"eligible_roles": ["department_workforce"]
	})
	if not changed.ok:
		check.call(false, "Weekend payroll fixture registers its employee")
		return
	checkpoint = changed.checkpoint
	changed = CampaignPersonnelTransaction.sign_contract(checkpoint, {
		"id": "contract.weekend.payroll",
		"person_id": "person.payroll",
		"account_id": state.organization_id,
		"start_slot": 24,
		"end_slot": 216,
		"pay_interval_slots": DAY,
		"pay_minor": 300,
		"capacity_bps": 10000,
		"renewal_window_slots": DAY
	})
	if not changed.ok:
		check.call(false, "Weekend payroll fixture signs dated employment")
		return
	checkpoint = CampaignPersonnelContracts._advance(changed.checkpoint, 100)
	var manifest = CampaignWeekendTransactionContracts._manifest()
	var policy = CampaignWeekendTransactionContracts._policy(manifest)
	var competition = CampaignWeekendTransactionContracts._competition(manifest, policy)
	checkpoint = CampaignCheckpoint.build(
		CampaignCheckpoint.restore(checkpoint).state, checkpoint.settlements, manifest,
		competition, checkpoint.economy, checkpoint.inventory, checkpoint.personnel)
	var staged = CampaignWeekendTransaction.stage_receipt(
		checkpoint, manifest, CampaignWeekendTransactionContracts._receipt(manifest), policy)
	check.call(staged.ok and staged.settled_commitments == 1,
		"Payroll due during travel settles with the atomic weekend return transaction")
	if not staged.ok:
		return
	var payroll_id = staged.checkpoint.personnel.contracts[
		"contract.weekend.payroll"].payroll_commitment_ids[0]
	var payroll: Dictionary = staged.checkpoint.economy.commitments[payroll_id]
	check.call(payroll.status == "settled" and payroll.resolution_slot == 120 \
		and staged.checkpoint.economy.accounts[state.organization_id].cash_minor == 9900,
		"Weekend payroll keeps its contractual due slot and reconciles with event cash")

static func _migration_storage_and_freeze_contract(check: Callable) -> void:
	var current = CampaignPersonnelContracts._checkpoint()
	var legacy_payroll = CampaignEconomy.add_commitment(current.economy, {
		"id": "legacy.payroll.1",
		"account_id": ACCOUNT,
		"source_id": "legacy.payroll.source",
		"due_slot": WEEK,
		"amount_minor": -5000,
		"category": "payroll"
	}, 0)
	check.call(legacy_payroll.ok, "Migration fixture creates one explicit legacy payroll commitment")
	if not legacy_payroll.ok:
		return
	var previous = current.duplicate(true)
	previous.version = CampaignCheckpoint.CONSEQUENCE_VERSION
	previous.erase("personnel")
	previous.erase("operations")
	previous.erase("engineering")
	previous.economy = legacy_payroll.economy
	CampaignPersonnelContracts._reseal(previous)
	var migrated = CampaignCheckpoint.restore(previous)
	check.call(migrated.ok and migrated.checkpoint.version == CampaignCheckpoint.VERSION \
		and migrated.personnel.people.is_empty() \
		and "legacy.payroll.1" in migrated.personnel.legacy_payroll_ids,
		"Version-two checkpoints preserve explicit legacy payroll without inventing staff")
	var checkpoint = CampaignPersonnelContracts._registered_checkpoint(
		"person.storage", ["commercial_lead"])
	var changed = CampaignPersonnelTransaction.sign_contract(
		checkpoint, CampaignPersonnelContracts._contract(
			"contract.storage", "person.storage", 0, 2 * WEEK, 7000))
	if not changed.ok:
		check.call(false, "Storage fixture signs employment")
		return
	checkpoint = changed.checkpoint
	var files = CampaignStorageContracts.MemoryFiles.new()
	var storage = CampaignStorage.new("user://campaign-personnel.json", files)
	check.call(storage.save_checkpoint(checkpoint).is_empty(),
		"Campaign storage accepts personnel and payroll in the complete checkpoint")
	var loaded = storage.load()
	check.call(loaded.ok and loaded.personnel.contracts.has("contract.storage") \
		and loaded.economy.commitments.size() == 2,
		"Save and restore preserve employment terms and dated payroll commitments")
	var active = CampaignCheckpoint.build(
		loaded.state, loaded.settlements, _active_manifest(),
		loaded.competition, loaded.economy, loaded.inventory, loaded.personnel)
	var before = RaceStateValue.fingerprint(active)
	var frozen = CampaignPersonnelTransaction.assign_role(active, {
		"id": "assignment.storage",
		"person_id": "person.storage",
		"contract_id": "contract.storage",
		"role_id": "commercial_lead",
		"start_slot": 0,
		"end_slot": WEEK,
		"allocation_bps": 10000
	})
	check.call(not frozen.ok and RaceStateValue.fingerprint(frozen.checkpoint) == before,
		"Personnel planning is frozen while the immutable weekend manifest is active")

static func _active_manifest() -> Dictionary:
	var data = {
		"kind": CampaignWeekendManifest.KIND,
		"version": CampaignWeekendManifest.VERSION,
		"campaign_id": "career.people",
		"season_id": "season.people",
		"campaign_event_id": "event.people",
		"entrant_id": "entrant.people",
		"event_revision": 1,
		"departure_slot": 0,
		"return_slot": WEEK,
		"race_event_id": "11111111111141118111111111111111",
		"race_model": "practice-race-sim",
		"checkpoint_version": 11,
		"track_hash": "1111111111111111111111111111111111111111111111111111111111111111",
		"roster_hash": "2222222222222222222222222222222222222222222222222222222222222222",
		"starting_resources_hash": "3333333333333333333333333333333333333333333333333333333333333333",
		"ruleset_hash": "4444444444444444444444444444444444444444444444444444444444444444",
		"mappings": [
			{"race_id": 0, "person_id": "person.storage", "team_id": "team.people", "car_id": "car.0"},
			{"race_id": 1, "person_id": "person.other", "team_id": "team.people", "car_id": "car.1"}
		]
	}
	CampaignPersonnelContracts._reseal(data)
	return data
