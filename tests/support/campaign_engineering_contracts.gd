class_name CampaignEngineeringContracts
extends RefCounted
## TM-07 deterministic project gates, physical inventory and per-car race-profile seam.
const DAY = CampaignClock.SLOTS_PER_DAY
const WEEK = 7 * DAY
const ACCOUNT = "organization.engineering"
const PROJECT = "project.first-package"
const CAR = "car.player"

static func run(check: Callable) -> void:
	var checkpoint = _fixture()
	check.call(not checkpoint.is_empty(), "TM-07 fixture creates staffed engineering capacity")
	if checkpoint.is_empty(): return
	var created = CampaignEngineeringTransaction.create_project(checkpoint, {
		"id": PROJECT,
		"title": "First validated package",
		"domain": "aerodynamic_package",
		"target_event_id": "round.2",
		"target_car_id": CAR,
		"profile_delta": {"top": 250, "lat": 100, "accel": 100, "brake": 50},
		"material_cost_minor": 5000
	})
	check.call(created.ok and created.checkpoint.engineering.projects[PROJECT].stage == "investigation",
		"Engineering begins as a problem/project record without spawning a design or part")
	if not created.ok: return
	checkpoint = created.checkpoint
	var gates = [
		["investigation", "design_office"],
		["concept", "design_office"],
		["detailed_design", "design_office"],
		["prototype", "preparation_workshop"],
		["validation", "test_validation"],
		["production", "preparation_workshop"],
		["integration", "preparation_workshop"]
	]
	for index in range(gates.size()):
		var stage: String = gates[index][0]
		var order_id = "work.engineering.%s" % stage
		var start = _slot(checkpoint)
		var scheduled = CampaignOperationsTransaction.schedule_internal(checkpoint, {
			"id": order_id,
			"family": gates[index][1],
			"resource_id": "facility." + str(gates[index][1]),
			"start_slot": start,
			"end_slot": start + DAY,
			"units": 1,
			"assignment_ids": ["assignment.engineering"]
		})
		check.call(scheduled.ok, "Engineering gate reserves explicit people and capacity: " + stage + ("" if scheduled.ok else ": " + str(scheduled.error)))
		if not scheduled.ok: return
		checkpoint = scheduled.checkpoint
		var bound = CampaignEngineeringTransaction.bind_stage(checkpoint, PROJECT, order_id)
		check.call(bound.ok, "Engineering project binds its current gate to one operations order: " + stage)
		if not bound.ok: return
		checkpoint = bound.checkpoint
		var too_early = CampaignEngineeringTransaction.complete_stage(checkpoint, PROJECT)
		check.call(not too_early.ok, "Engineering gate cannot complete before its reserved work interval: " + stage)
		if stage == "production":
			var material_id: String = checkpoint.engineering.projects[PROJECT].material_commitment_id
			check.call(not material_id.is_empty() and checkpoint.economy.commitments[material_id].amount_minor == -5000,
				"Production creates one explicit material commitment instead of hidden project cost")
			var settled = CampaignFinanceTransaction.settle_due(checkpoint, start)
			check.call(settled.ok, "Due production material settles through the existing cash ledger")
			if not settled.ok: return
			checkpoint = settled.checkpoint
		checkpoint = _advance(checkpoint, DAY)
		if checkpoint.is_empty():
			check.call(false, "Campaign time advances while preserving engineering and operations authority")
			return
		var completed = CampaignEngineeringTransaction.complete_stage(checkpoint, PROJECT)
		check.call(completed.ok, "Completed operations work advances exactly one engineering gate: " + stage)
		if not completed.ok: return
		checkpoint = completed.checkpoint
		if stage == "validation":
			check.call(checkpoint.engineering.designs.size() == 1 				and checkpoint.engineering.parts.is_empty(),
				"Validation publishes a design but still no physical part")
		if stage == "production":
			check.call(checkpoint.engineering.parts.size() == 1 				and checkpoint.engineering.parts.values()[0].status == "available",
				"Production creates one traceable physical part from the validated design")
	check.call(checkpoint.engineering.projects[PROJECT].stage == "complete",
		"Integration completes the small engineering pipeline")
	var part: Dictionary = checkpoint.engineering.parts.values()[0]
	check.call(part.status == "installed" and part.installed_car_id == CAR,
		"Integration installs the manufactured instance on the named campaign car")
	var profile = CampaignEngineeringQuery.profile_for_car(checkpoint, CAR)
	check.call(not profile.is_empty() and profile.top_bps == 10250 		and profile.source_ids == [part.id],
		"Installed validated parts compose the supported per-car performance profile")
	_race_profile_contract(check, checkpoint, profile)
	_integrity_and_migration_contract(check, checkpoint)

static func _race_profile_contract(check: Callable, checkpoint: Dictionary, profile: Dictionary) -> void:
	var mappings: Array = []
	for id in range(12):
		mappings.append({"race_id": id, "car_id": CAR if id == 3 else "car.%02d" % id})
	var projected = CampaignEngineeringQuery.race_profiles(checkpoint, mappings)
	check.call(projected.ok and projected.profiles[3].digest == profile.digest 		and projected.profiles[0].top_bps == RacePerformanceProfile.BASE_BPS,
		"Stable campaign car IDs project to explicit race-local profiles without modifying rivals")
	if not projected.ok: return
	var track_doc = Storage.read_json("res://data/tracks/hillside.json").data
	var geometry = TrackGeometry.new(track_doc, "Formula")
	var enhanced = PracticeRaceSim.new(geometry, {
		"laps": 6, "scenario": "dry", "intensity": "calm", "seed": 7314,
		"tactical_duels": true, "performance_profiles": projected.profiles
	})
	check.call(enhanced.last_error.is_empty() and enhanced.snapshot().version == TacticalDuels.CHECKPOINT_VERSION,
		"New weekend freezes per-car performance in the versioned native race checkpoint")
	var restored = PracticeRaceSim.restore_practice(enhanced.snapshot())
	check.call(restored != null and restored.performance_profile(restored.cars[3]).digest == profile.digest,
		"Race checkpoint restore preserves the exact installed-part performance source")
	var baseline_profiles: Array = []
	for _id in range(12): baseline_profiles.append(RacePerformanceProfile.baseline())
	var baseline = PracticeRaceSim.new(geometry, {
		"laps": 6, "scenario": "dry", "intensity": "calm", "seed": 7314,
		"tactical_duels": true, "performance_profiles": baseline_profiles
	})
	_prepare_isolated_race(baseline)
	_prepare_isolated_race(enhanced)
	var base_forecast = RaceForecaster.evaluate(RaceForecaster.capture(baseline, 3))
	var enhanced_forecast = RaceForecaster.evaluate(RaceForecaster.capture(enhanced, 3))
	for _step in range(100):
		baseline.step()
		enhanced.step()
	check.call(enhanced.cars[3].distance > baseline.cars[3].distance,
		"Installed performance changes supported runtime vehicle capability rather than a result-screen bonus")
	check.call(enhanced_forecast.options[0].seconds < base_forecast.options[0].seconds,
		"The coarse forecaster consumes the same frozen performance profile and reflects its direction")

static func _integrity_and_migration_contract(check: Callable, checkpoint: Dictionary) -> void:
	var before = RaceStateValue.fingerprint(checkpoint)
	var part_id: String = checkpoint.engineering.parts.keys()[0]
	var tampered = checkpoint.duplicate(true)
	tampered.engineering.parts[part_id].installed_car_id = "car.other"
	_reseal(tampered.engineering.parts[part_id])
	_reseal(tampered.engineering)
	_reseal(tampered)
	check.call(not CampaignCheckpoint.validate(tampered).is_empty(),
		"Recomputed outer digests cannot silently remap an installed physical part")
	var previous = checkpoint.duplicate(true)
	previous.version = CampaignCheckpoint.OPERATIONS_VERSION
	previous.erase("engineering")
	_reseal(previous)
	var migrated = CampaignCheckpoint.restore(previous)
	check.call(migrated.ok and migrated.engineering.projects.is_empty() 		and int(migrated.engineering.authority_from_slot) == migrated.state.clock.elapsed_slots 		and checkpoint.engineering.projects[PROJECT].material_commitment_id 			in migrated.engineering.legacy_development_commitment_ids,
		"Version-four operations checkpoints preserve development commitments without invented project history")
	check.call(RaceStateValue.fingerprint(checkpoint) == before,
		"Engineering observations, profile projection and migration probes do not mutate their source checkpoint")

static func _fixture() -> Dictionary:
	var state = CampaignState.create({"campaign_id": "career.engineering",
		"organization_id": ACCOUNT, "principal_id": "person.principal",
		"start": {"year": 1950, "month": 1, "day": 1, "slot": 0}})
	var economy = CampaignEconomy.create(state.campaign_id, state.organization_id, 200000, 0)
	var checkpoint = CampaignCheckpoint.build(state, {}, {}, {}, economy, {})
	var person = CampaignPersonnelTransaction.register_person(checkpoint, {
		"id": "person.engineering", "display_name": "Engineering Lead",
		"eligible_roles": ["technical_lead"]})
	if not person.ok: return {}
	checkpoint = person.checkpoint
	var contract = CampaignPersonnelTransaction.sign_contract(checkpoint, {
		"id": "contract.engineering", "person_id": "person.engineering", "account_id": ACCOUNT,
		"start_slot": 0, "end_slot": 12 * WEEK, "pay_interval_slots": WEEK,
		"pay_minor": 5000, "capacity_bps": 10000, "renewal_window_slots": WEEK})
	if not contract.ok: return {}
	checkpoint = contract.checkpoint
	var assigned = CampaignPersonnelTransaction.assign_role(checkpoint, {
		"id": "assignment.engineering", "person_id": "person.engineering",
		"contract_id": "contract.engineering", "role_id": "technical_lead",
		"start_slot": 0, "end_slot": 12 * WEEK, "allocation_bps": 10000})
	if not assigned.ok: return {}
	checkpoint = assigned.checkpoint
	for item in [
		["preparation_workshop", "Preparation workshop"],
		["design_office", "Design office"],
		["test_validation", "Validation rig"]
	]:
		var registered = CampaignOperationsTransaction.register_owned(checkpoint, {
			"id": "facility." + str(item[0]), "display_name": item[1], "family": item[0],
			"available_from_slot": 0, "available_until_slot": 12 * WEEK, "capacity_units": 1})
		if not registered.ok: return {}
		checkpoint = registered.checkpoint
	return checkpoint

static func _slot(checkpoint: Dictionary) -> int:
	return int(checkpoint.state.clock.elapsed_slots)

static func _advance(checkpoint: Dictionary, slots: int) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok or not restored.state.command("advance_slots", {"slots": slots}):
		return {}
	return CampaignCheckpoint.build(restored.state, restored.settlements, restored.active_manifest,
		restored.competition, restored.economy, restored.inventory, restored.personnel,
		restored.operations, restored.engineering)

static func _prepare_isolated_race(sim: PracticeRaceSim) -> void:
	sim.phase = "race"
	sim.paused = false
	for car in sim.cars:
		car.route = "track"
		car.distance = 0.0
		car.previous_distance = 0.0
		car.speed = 20.0
		car.dnf = car.id != 3
		car.finished = false

static func _reseal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
