class_name CampaignGroupContracts
extends RefCounted
## TM-16 founder business, academy, era and dynasty contracts.
const DAY = CampaignClock.SLOTS_PER_DAY


static func run(check: Callable) -> void:
	var checkpoint = CampaignOperationsContracts._staffed_checkpoint()
	check.call(not checkpoint.is_empty(), "TM-16 fixture has finite employed workshop staff")
	if checkpoint.is_empty():
		return
	for resource in [
		{
			"id": "facility.workshop",
			"display_name": "Preparation workshop",
			"family": "preparation_workshop",
			"available_from_slot": 0,
			"available_until_slot": 60 * DAY,
			"capacity_units": 1
		},
		{
			"id": "facility.academy",
			"display_name": "Academy room",
			"family": "academy",
			"available_from_slot": 0,
			"available_until_slot": 60 * DAY,
			"capacity_units": 1
		}
	]:
		var registered = CampaignOperationsTransaction.register_owned(checkpoint, resource)
		if not registered.ok:
			check.call(false, "Group facility registers")
			return
		checkpoint = registered.checkpoint
	var initialized = CampaignGroupTransaction.initialize(
		checkpoint,
		20000,
		{
			"id": "era.1950",
			"display_name": "Workshop Era",
			"start_year": 1950,
			"capabilities": ["craft"]
		}
	)
	check.call(initialized.ok, "Founder group starts with explicit parent capital and era profile")
	if not initialized.ok:
		return
	checkpoint = initialized.checkpoint
	var work = CampaignOperationsTransaction.schedule_internal(
		checkpoint,
		{
			"id": "work.customer.1",
			"family": "preparation_workshop",
			"resource_id": "facility.workshop",
			"start_slot": 0,
			"end_slot": DAY,
			"units": 1,
			"assignment_ids": ["assignment.mech.a"]
		}
	)
	check.call(
		work.ok, "Customer service reserves the same finite workshop/staff capacity as racing work"
	)
	if not work.ok:
		return
	checkpoint = work.checkpoint
	var order = CampaignGroupTransaction.create_service_order(
		checkpoint,
		{
			"id": "business.order.1",
			"customer": "North Road Garage",
			"work_order_id": "work.customer.1",
			"value_minor": 10000,
			"due_slot": DAY
		}
	)
	check.call(order.ok, "Founder business income is bound to one shared work order")
	if not order.ok:
		return
	var duplicate_order = CampaignGroupTransaction.create_service_order(
		order.checkpoint,
		{
			"id": "business.order.duplicate",
			"customer": "Second Customer",
			"work_order_id": "work.customer.1",
			"value_minor": 10000,
			"due_slot": DAY
		}
	)
	check.call(
		not duplicate_order.ok,
		"One completed work order cannot be sold twice to duplicate parent-company revenue"
	)
	checkpoint = _advance(order.checkpoint, DAY)
	if checkpoint.is_empty():
		return
	var completed = CampaignGroupTransaction.complete_service_order(checkpoint, "business.order.1")
	check.call(
		completed.ok and completed.checkpoint.management.group.parent_cash_minor == 30000,
		"Completed customer work earns parent-company cash only after capacity finishes"
	)
	if not completed.ok:
		return
	checkpoint = completed.checkpoint
	var team_cash_before = int(
		checkpoint.economy.accounts[checkpoint.state.organization_id].cash_minor
	)
	var transfer = CampaignGroupTransaction.transfer_to_team(checkpoint, "transfer.racing.1", 15000)
	check.call(
		transfer.ok, "Parent capital can be transferred explicitly into the racing operation"
	)
	if not transfer.ok:
		return
	checkpoint = transfer.checkpoint
	check.call(
		(
			checkpoint.management.group.parent_cash_minor == 15000
			and (
				int(checkpoint.economy.accounts[checkpoint.state.organization_id].cash_minor)
				== team_cash_before + 15000
			)
		),
		"Group transfer conserves value across parent and team rather than creating money twice"
	)
	academy_and_dynasty(checkpoint, check)


static func _advance(checkpoint: Dictionary, slots: int) -> Dictionary:
	var r = CampaignCheckpoint.restore(checkpoint)
	if not r.ok or not r.state.command("advance_slots", {"slots": slots}):
		return {}
	return CampaignCheckpoint.build(
		r.state,
		r.settlements,
		r.active_manifest,
		r.competition,
		r.economy,
		r.inventory,
		r.personnel,
		r.operations,
		r.engineering,
		r.management
	)


static func academy_and_dynasty(checkpoint: Dictionary, check: Callable) -> void:
	var candidate = CampaignPeopleTransaction.register_candidate(
		checkpoint,
		{
			"id": "person.academy.1",
			"display_name": "Jamie Cole",
			"eligible_roles": ["race_driver"],
			"attributes":
			{
				"technical": 45,
				"operations": 40,
				"commercial": 30,
				"feedback": 55,
				"development": 82
			},
			"confidence": 45,
			"salary_expectation_minor": 4000,
			"available_slot": DAY,
			"preferences": ["development_support"]
		}
	)
	check.call(candidate.ok, "Academy prospect first exists in the persistent candidate market")
	if not candidate.ok:
		return
	checkpoint = candidate.checkpoint
	var capacity = CampaignGroupTransaction.set_academy_capacity(checkpoint, 1)
	check.call(capacity.ok, "Academy exposes finite owned places")
	if not capacity.ok:
		return
	checkpoint = capacity.checkpoint
	var prospect = CampaignGroupTransaction.add_academy_prospect(checkpoint, "person.academy.1")
	check.call(
		prospect.ok and prospect.checkpoint.management.group.academy.prospects.size() == 1,
		"Academy place links one uncertain candidate without inventing a full junior series"
	)
	if not prospect.ok:
		return
	checkpoint = prospect.checkpoint
	var duplicate = CampaignGroupTransaction.add_academy_prospect(checkpoint, "person.academy.1")
	check.call(not duplicate.ok, "Academy capacity cannot be bypassed by duplicate enrollment")
	var era = CampaignGroupTransaction.register_era(
		checkpoint,
		{
			"id": "era.engineering",
			"display_name": "Expanding Engineering Era",
			"start_year": 1965,
			"capabilities": ["craft", "specialists"]
		}
	)
	check.call(
		era.ok,
		"Additional era is a versioned capability profile rather than a cosmetic date switch"
	)
	if not era.ok:
		return
	checkpoint = era.checkpoint
	var activated = CampaignGroupTransaction.activate_era(checkpoint, "era.engineering")
	check.call(
		activated.ok and activated.checkpoint.management.group.active_era_id == "era.engineering",
		"Era transition is an explicit career milestone when no championship is active"
	)
	if not activated.ok:
		return
	checkpoint = activated.checkpoint
	var successor = CampaignGroupTransaction.appoint_successor(checkpoint, "person.mech.a")
	check.call(
		(
			successor.ok
			and (
				successor.checkpoint.management.group.dynasty.operating_principal_id
				== "person.mech.a"
			)
		),
		"Founder can appoint one employed successor without deleting organization history"
	)
	if not successor.ok:
		return
	checkpoint = successor.checkpoint
	var goal = CampaignGroupTransaction.add_legacy_goal(
		checkpoint,
		{"id": "legacy.customer-work", "title": "Fund racing from customer work", "evidence_id": ""}
	)
	check.call(goal.ok, "Dynasty can record an optional explicit legacy goal")
	if not goal.ok:
		return
	checkpoint = goal.checkpoint
	var done = CampaignGroupTransaction.complete_legacy_goal(
		checkpoint, "legacy.customer-work", "business.order.1"
	)
	check.call(
		(
			done.ok
			and (
				done.checkpoint.management.group.dynasty.legacy_goals["legacy.customer-work"].status
				== "completed"
			)
		),
		"Legacy goal completes from named campaign evidence rather than a grind currency"
	)
	if not done.ok:
		return
	checkpoint = done.checkpoint
	check.call(
		CampaignCheckpoint.validate(checkpoint).is_empty(),
		"TM-16 group expansions remain one conserved auditable campaign checkpoint"
	)
	var files = CampaignStorageContracts.MemoryFiles.new()
	var storage = CampaignStorage.new("user://campaign-group-contract.json", files)
	check.call(
		storage.save_checkpoint(checkpoint).is_empty(),
		"Expanded management checkpoint persists through the atomic campaign store"
	)
	var loaded = storage.load()
	(
		check
		. call(
			(
				loaded.ok
				and (
					RaceStateValue.fingerprint(loaded.management)
					== RaceStateValue.fingerprint(checkpoint.management)
				)
			),
			"Campaign storage round-trip preserves people, supply, group, dynasty and management history"
		)
	)
