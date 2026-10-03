class_name CampaignReadinessContracts
extends RefCounted
## TM-08 event-readiness, installed configuration and atomic departure contracts.
const ACCOUNT = "organization.readiness"
const RETURN_SLOT = 40


static func run(check: Callable) -> void:
	var fixture = _fixture()
	check.call(fixture.ok, "TM-08 fixture creates an active registered event and v12 race entry")
	if not fixture.ok:
		return
	var checkpoint: Dictionary = fixture.checkpoint
	var before = RaceStateValue.fingerprint(checkpoint)
	var readiness = CampaignReadinessQuery.evaluate(
		checkpoint, fixture.manifest, fixture.profiles, fixture.assignment_ids, 800
	)
	(
		check
		. call(
			readiness.ok and readiness.ready and readiness.blockers.is_empty(),
			"Readiness derives a legal departure from competition, people, finance and installed configuration"
		)
	)
	(
		check
		. call(
			RaceStateValue.fingerprint(checkpoint) == before,
			"Readiness inspection does not reserve people, spend cash, advance time or mutate the checkpoint"
		)
	)
	var departed = CampaignDepartureTransaction.depart(
		checkpoint, fixture.context, fixture.record, fixture.mappings, fixture.assignment_ids, 800
	)
	check.call(
		departed.ok and departed.status == "departed",
		"One departure transaction freezes the registered weekend"
	)
	if not departed.ok:
		return
	var active: Dictionary = departed.checkpoint.active_manifest
	check.call(
		(
			active.digest == departed.manifest.digest
			and active.starting_resources_hash == fixture.manifest.starting_resources_hash
		),
		"Frozen manifest retains the exact v12 starting resources including performance profiles"
	)
	var commitment_id = (
		CampaignReadinessQuery
		. event_commitment_input(CampaignCheckpoint.restore(checkpoint), fixture.manifest, 800)
		. id
	)
	var commitment: Dictionary = departed.checkpoint.economy.commitments[commitment_id]
	check.call(
		(
			commitment.status == "settled"
			and int(commitment.amount_minor) == -800
			and departed.checkpoint.economy.accounts[ACCOUNT].cash_minor == 99200
		),
		"Departure settles one explicit event-operations commitment at the departure slot"
	)
	var event_reservations = 0
	for reservation in departed.checkpoint.personnel.reservations.values():
		if reservation.kind == "event_duty" and reservation.location_id == "event.readiness":
			event_reservations += 1
	check.call(
		event_reservations == fixture.assignment_ids.size(),
		"Travelling drivers and crew are reserved for the complete weekend interval"
	)
	var duplicate = CampaignDepartureTransaction.depart(
		departed.checkpoint,
		fixture.context,
		fixture.record,
		fixture.mappings,
		fixture.assignment_ids,
		800
	)
	check.call(
		(
			not duplicate.ok
			and (
				RaceStateValue.fingerprint(duplicate.checkpoint)
				== RaceStateValue.fingerprint(departed.checkpoint)
			)
		),
		"A second departure cannot duplicate travel reservations, spending or an active manifest"
	)
	var altered = RaceRecord.new()
	altered.event_id = fixture.record.event_id
	altered.initial = fixture.record.initial.duplicate(true)
	var altered_profiles: Array = fixture.profiles.duplicate(true)
	altered_profiles[0] = RacePerformanceProfile.build(
		{"top": 100, "lat": 0, "accel": 0, "brake": 0}
	)
	altered.initial.performance_profiles = altered_profiles
	var mismatch = CampaignDepartureTransaction.depart(
		checkpoint, fixture.context, altered, fixture.mappings, fixture.assignment_ids, 800
	)
	check.call(
		not mismatch.ok and RaceStateValue.fingerprint(mismatch.checkpoint) == before,
		"Departure rejects a race profile that is not produced by installed campaign parts"
	)


static func _fixture() -> Dictionary:
	var state = CampaignState.create(
		{
			"campaign_id": "career.readiness",
			"organization_id": ACCOUNT,
			"principal_id": "person.principal",
			"start": {"year": 1950, "month": 1, "day": 1, "slot": 0}
		}
	)
	var economy = CampaignEconomy.create(state.campaign_id, ACCOUNT, 100000, 0)
	var checkpoint = CampaignCheckpoint.build(state, {}, {}, {}, economy, {})
	var people = [
		["person.00", "Driver A", "race_driver", "assignment.driver.00"],
		["person.01", "Driver B", "race_driver", "assignment.driver.01"],
		["person.engineer", "Race Engineer", "race_engineer", "assignment.engineer"]
	]
	checkpoint = staff_checkpoint(checkpoint, people)
	if checkpoint.is_empty():
		return {"ok": false}
	var mappings: Array = []
	for id in range(12):
		mappings.append(
			{
				"race_id": id,
				"person_id": "person.%02d" % id,
				"team_id": "team.%02d" % int(id / 2),
				"car_id": "car.%02d" % id
			}
		)
	var profiles: Array = []
	for _id in range(12):
		profiles.append(RacePerformanceProfile.baseline())
	var track_doc = Storage.read_json("res://config/circuits/hillside.json").data
	var geometry = TrackGeometry.new(track_doc, "Formula")
	var sim = PracticeRaceSim.new(
		geometry,
		{
			"laps": 6,
			"scenario": "dry",
			"intensity": "calm",
			"seed": 7314,
			"tactical_duels": true,
			"performance_profiles": profiles
		}
	)
	if not sim.last_error.is_empty():
		return {"ok": false}
	var record = RaceRecord.new()
	record.event_id = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	record.initial = sim.snapshot()
	var context = {
		"campaign_id": state.campaign_id,
		"season_id": "season.readiness",
		"campaign_event_id": "event.readiness",
		"entrant_id": "entrant.player",
		"event_revision": 1,
		"departure_slot": 0,
		"return_slot": RETURN_SLOT
	}
	var manifest = CampaignWeekendManifest.build(context, record, mappings)
	if manifest.is_empty():
		return {"ok": false}
	var rules = CampaignSeriesRules.build(
		{
			"series_id": "series.readiness",
			"name": "Readiness Series",
			"cars_per_entrant": 2,
			"min_entrants": 6,
			"max_entrants": 6,
			"min_events": 1,
			"max_events": 1,
			"points_by_position": [15, 12, 10, 8, 6, 4, 2, 1],
			"countback_depth": 4
		}
	)
	var competition = CampaignCompetition.empty(state.campaign_id)
	var changed = CampaignCompetition.register_series(competition, rules)
	if not changed.ok:
		return {"ok": false}
	competition = changed.competition
	changed = CampaignCompetition.create_season(
		competition,
		{
			"season_id": context.season_id,
			"series_id": rules.series_id,
			"calendar":
			[
				{
					"campaign_event_id": context.campaign_event_id,
					"round": 1,
					"departure_slot": 0,
					"return_slot": RETURN_SLOT,
					"event_revision": 1,
					"track_hash": manifest.track_hash,
					"ruleset_hash": manifest.ruleset_hash
				}
			]
		}
	)
	if not changed.ok:
		return {"ok": false}
	competition = changed.competition
	changed = CampaignCompetition.transition_season(competition, context.season_id, "entries_open")
	if not changed.ok:
		return {"ok": false}
	competition = changed.competition
	for team_index in range(6):
		var person_ids = ["person.%02d" % (team_index * 2), "person.%02d" % (team_index * 2 + 1)]
		var car_ids = ["car.%02d" % (team_index * 2), "car.%02d" % (team_index * 2 + 1)]
		var entrant_id = "entrant.player" if team_index == 0 else "entrant.%02d" % team_index
		changed = CampaignCompetition.submit_entry(
			competition,
			context.season_id,
			{
				"entrant_id": entrant_id,
				"team_id": "team.%02d" % team_index,
				"person_ids": person_ids,
				"car_ids": car_ids
			}
		)
		if not changed.ok:
			return {"ok": false}
		competition = changed.competition
		changed = CampaignCompetition.decide_entry(competition, context.season_id, entrant_id, true)
		if not changed.ok:
			return {"ok": false}
		competition = changed.competition
	for target in ["preseason", "active"]:
		changed = CampaignCompetition.transition_season(competition, context.season_id, target)
		if not changed.ok:
			return {"ok": false}
		competition = changed.competition
	var restored = CampaignCheckpoint.restore(checkpoint)
	checkpoint = CampaignCheckpoint.build(
		restored.state,
		restored.settlements,
		{},
		competition,
		restored.economy,
		restored.inventory,
		restored.personnel,
		restored.operations,
		restored.engineering
	)
	if checkpoint.is_empty():
		return {"ok": false}
	return {
		"ok": true,
		"checkpoint": checkpoint,
		"record": record,
		"context": context,
		"manifest": manifest,
		"mappings": mappings,
		"profiles": profiles,
		"assignment_ids": ["assignment.driver.00", "assignment.driver.01", "assignment.engineer"]
	}


static func staff_checkpoint(checkpoint: Dictionary, people: Array) -> Dictionary:
	for item in people:
		var person = CampaignPersonnelTransaction.register_person(
			checkpoint, {"id": item[0], "display_name": item[1], "eligible_roles": [item[2]]}
		)
		if not person.ok:
			return {}
		checkpoint = person.checkpoint
		var contract_id = "contract." + str(item[0])
		var contract = CampaignPersonnelTransaction.sign_contract(
			checkpoint,
			{
				"id": contract_id,
				"person_id": item[0],
				"account_id": ACCOUNT,
				"start_slot": 0,
				"end_slot": 480,
				"pay_interval_slots": 96,
				"pay_minor": 1000,
				"capacity_bps": 10000,
				"renewal_window_slots": 96
			}
		)
		if not contract.ok:
			return {}
		checkpoint = contract.checkpoint
		var assigned = CampaignPersonnelTransaction.assign_role(
			checkpoint,
			{
				"id": item[3],
				"person_id": item[0],
				"contract_id": contract_id,
				"role_id": item[2],
				"start_slot": 0,
				"end_slot": 480,
				"allocation_bps": 10000
			}
		)
		if not assigned.ok:
			return {}
		checkpoint = assigned.checkpoint
	return checkpoint
