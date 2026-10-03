class_name CampaignSeasonProgressionContracts
extends RefCounted
## TM-14 two-season continuity, future-car allocation, prize and promotion.
const CAMPAIGN = "career.multi-season"
const ACCOUNT = "organization.multi-season"
const PEOPLE = ["person.a0", "person.a1", "person.b0", "person.b1"]


static func run(check: Callable) -> void:
	var checkpoint = _source_fixture()
	check.call(
		not checkpoint.is_empty(), "TM-14 fixture creates an active four-event source season"
	)
	if checkpoint.is_empty():
		return
	var plan = CampaignSeasonProgressionTransaction.set_plan(
		checkpoint,
		{
			"season_id": "season.one",
			"sporting_ambition": "points",
			"organizational_ambition": "next_platform",
			"current_car_bps": 6000,
			"next_car_bps": 4000,
			"future_car_focus": "mechanical_grip"
		}
	)
	check.call(plan.ok, "Current-versus-next-car investment is an explicit season plan")
	if not plan.ok:
		return
	checkpoint = plan.checkpoint
	for round in range(1, 5):
		checkpoint = _settle_next(checkpoint, "season.one", round, [15, 12, 10, 8])
		check.call(not checkpoint.is_empty(), "Source season round %d settles coherently" % round)
		if checkpoint.is_empty():
			return
	check.call(
		checkpoint.competition.seasons["season.one"].status == "completed",
		"Four-event source season reaches completed contract transition"
	)
	var first_history = RaceStateValue.fingerprint(checkpoint.competition.seasons["season.one"])
	var opening_cash = int(checkpoint.economy.accounts[ACCOUNT].cash_minor)
	var offered = CampaignSeasonProgressionTransaction.offer_promotion(
		checkpoint,
		"season.one",
		"series.promoted",
		checkpoint.state.clock.elapsed_slots + 100,
		50000
	)
	check.call(offered.ok, "Completed season can create a funded promotion opportunity")
	if not offered.ok:
		return
	checkpoint = offered.checkpoint
	var accepted = CampaignSeasonProgressionTransaction.decide_promotion(
		checkpoint, "promotion.season.one", true
	)
	check.call(
		accepted.ok and accepted.status == "accepted",
		"Promotion is an explicit player choice rather than an automatic reset"
	)
	if not accepted.ok:
		return
	checkpoint = accepted.checkpoint
	var rules = CampaignSeriesRules.build(
		{
			"series_id": "series.promoted",
			"name": "Promoted Championship",
			"cars_per_entrant": 2,
			"min_entrants": 2,
			"max_entrants": 2,
			"min_events": 8,
			"max_events": 8,
			"points_by_position": [20, 15, 10, 5],
			"countback_depth": 4
		}
	)
	var definition = _season_definition(
		"season.two", "series.promoted", checkpoint.state.clock.elapsed_slots + 100, 8
	)
	var transitioned = CampaignSeasonProgressionTransaction.begin_next_season(
		checkpoint, "season.one", definition, rules, "promote", 50000
	)
	check.call(transitioned.ok, "Promotion creates one active eight-event next season")
	if not transitioned.ok:
		return
	checkpoint = transitioned.checkpoint
	check.call(
		(
			checkpoint.competition.seasons["season.two"].calendar.size() == 8
			and (
				checkpoint.competition.seasons["season.two"].entries["entrant.a"].status
				== "accepted"
			)
		),
		"Next season carries the stable accepted field into its new frozen rule pack"
	)
	check.call(
		int(checkpoint.economy.accounts[ACCOUNT].cash_minor) == opening_cash + 50000,
		"Season prize is a dated cash receipt, not an implicit balance reset"
	)
	check.call(
		RaceStateValue.fingerprint(checkpoint.competition.seasons["season.one"]) == first_history,
		"Creating the new season does not rewrite prior sporting history"
	)
	for round in range(1, 9):
		checkpoint = _settle_next(checkpoint, "season.two", round, [20, 15, 10, 5])
		check.call(
			not checkpoint.is_empty(), "Eight-event next season round %d settles coherently" % round
		)
		if checkpoint.is_empty():
			return
	var second: Dictionary = checkpoint.competition.seasons["season.two"]
	check.call(
		(
			second.status == "completed"
			and second.calendar.all(func(e): return e.status == "completed")
		),
		"Second eight-event season completes through the normal lifecycle"
	)
	check.call(
		second.drivers["person.a0"].points == 160,
		"Second season uses its own frozen scoring table across all eight events"
	)
	check.call(
		RaceStateValue.fingerprint(checkpoint.competition.seasons["season.one"]) == first_history,
		"Two complete seasons preserve independent rules and classifications"
	)
	check.call(
		(
			checkpoint.management.season_planning.transitions.size() == 1
			and checkpoint.management.season_planning.plans["season.one"].status == "completed"
		),
		"Season transition and future-car plan remain auditable history"
	)
	check.call(
		CampaignCheckpoint.validate(checkpoint).is_empty(),
		"TM-14 multi-season career remains one valid campaign checkpoint"
	)


static func _source_fixture() -> Dictionary:
	var state = CampaignState.create(
		{
			"campaign_id": CAMPAIGN,
			"organization_id": ACCOUNT,
			"principal_id": "person.principal",
			"start": {"year": 1950, "month": 1, "day": 1, "slot": 0}
		}
	)
	var checkpoint = CampaignCheckpoint.build(
		state, {}, {}, {}, CampaignEconomy.create(CAMPAIGN, ACCOUNT, 100000, 0), {}
	)
	var rules = CampaignSeriesRules.build(
		{
			"series_id": "series.base",
			"name": "Base Championship",
			"cars_per_entrant": 2,
			"min_entrants": 2,
			"max_entrants": 2,
			"min_events": 4,
			"max_events": 4,
			"points_by_position": [15, 12, 10, 8],
			"countback_depth": 4
		}
	)
	var changed = CampaignCompetitionTransaction.register_series(checkpoint, rules)
	if not changed.ok:
		return {}
	checkpoint = changed.checkpoint
	changed = CampaignCompetitionTransaction.create_season(
		checkpoint, _season_definition("season.one", "series.base", 0, 4)
	)
	if not changed.ok:
		return {}
	checkpoint = changed.checkpoint
	changed = CampaignCompetitionTransaction.transition_season(
		checkpoint, "season.one", "entries_open"
	)
	if not changed.ok:
		return {}
	checkpoint = changed.checkpoint
	for entry in [
		{
			"entrant_id": "entrant.a",
			"team_id": "team.a",
			"person_ids": ["person.a0", "person.a1"],
			"car_ids": ["car.a0", "car.a1"]
		},
		{
			"entrant_id": "entrant.b",
			"team_id": "team.b",
			"person_ids": ["person.b0", "person.b1"],
			"car_ids": ["car.b0", "car.b1"]
		}
	]:
		changed = CampaignCompetitionTransaction.submit_entry(checkpoint, "season.one", entry)
		if not changed.ok:
			return {}
		checkpoint = changed.checkpoint
		changed = CampaignCompetitionTransaction.decide_entry(
			checkpoint, "season.one", entry.entrant_id, true
		)
		if not changed.ok:
			return {}
		checkpoint = changed.checkpoint
	for target in ["preseason", "active"]:
		changed = CampaignCompetitionTransaction.transition_season(checkpoint, "season.one", target)
		if not changed.ok:
			return {}
		checkpoint = changed.checkpoint
	return checkpoint


static func _season_definition(
	season_id: String, series_id: String, start_slot: int, count: int
) -> Dictionary:
	var calendar: Array = []
	for index in range(count):
		calendar.append(
			{
				"campaign_event_id": "%s.event.%02d" % [season_id, index + 1],
				"round": index + 1,
				"departure_slot": start_slot + index * 100,
				"return_slot": start_slot + index * 100 + 40,
				"event_revision": 1,
				"track_hash": "%064x" % (index + 1),
				"ruleset_hash": "%064x" % (index + 101)
			}
		)
	return {"season_id": season_id, "series_id": series_id, "calendar": calendar}


static func _settle_next(
	checkpoint: Dictionary, season_id: String, round: int, points: Array
) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return {}
	var season: Dictionary = restored.competition.seasons[season_id]
	var event: Dictionary = season.calendar[round - 1]
	var current = restored.state.clock.elapsed_slots
	if current < int(event.departure_slot):
		if not restored.state.command(
			"advance_slots", {"slots": int(event.departure_slot) - current}
		):
			return {}
		checkpoint = CampaignCheckpoint.build(
			restored.state,
			restored.settlements,
			{},
			restored.competition,
			restored.economy,
			restored.inventory,
			restored.personnel,
			restored.operations,
			restored.engineering,
			restored.management
		)
		restored = CampaignCheckpoint.restore(checkpoint)
	var manifest = _manifest(restored.competition, season_id, event)
	var active = CampaignCheckpoint.build(
		restored.state,
		restored.settlements,
		manifest,
		restored.competition,
		restored.economy,
		restored.inventory,
		restored.personnel,
		restored.operations,
		restored.engineering,
		restored.management
	)
	if active.is_empty():
		return {}
	var policy = CampaignWeekendPolicy.build(
		{
			"campaign_id": CAMPAIGN,
			"season_id": season_id,
			"campaign_event_id": event.campaign_event_id,
			"account_id": ACCOUNT
		},
		points,
		PEOPLE,
		["person.a0", "person.a1"],
		{
			"entry_cost_minor": 0,
			"participation_minor": 0,
			"position_bonus_minor": points.map(func(_p): return 0)
		}
	)
	var receipt = _receipt(manifest, round)
	var staged = CampaignWeekendTransaction.stage_receipt(active, manifest, receipt, policy)
	if not staged.ok:
		return {}
	var follow = CampaignDirectorTransaction.after_weekend(staged.checkpoint)
	return follow.checkpoint if follow.ok else {}


static func _manifest(_competition: Dictionary, season_id: String, event: Dictionary) -> Dictionary:
	var data = {
		"kind": CampaignWeekendManifest.KIND,
		"version": CampaignWeekendManifest.VERSION,
		"campaign_id": CAMPAIGN,
		"season_id": season_id,
		"campaign_event_id": event.campaign_event_id,
		"entrant_id": "entrant.a",
		"event_revision": event.event_revision,
		"departure_slot": event.departure_slot,
		"return_slot": event.return_slot,
		"race_event_id": RaceStateValue.fingerprint([season_id, event.round]).substr(0, 32),
		"race_model": "practice-race-sim",
		"checkpoint_version": 12,
		"track_hash": event.track_hash,
		"roster_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		"starting_resources_hash":
		"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		"ruleset_hash": event.ruleset_hash,
		"mappings":
		[
			{"race_id": 0, "person_id": "person.a0", "team_id": "team.a", "car_id": "car.a0"},
			{"race_id": 1, "person_id": "person.a1", "team_id": "team.a", "car_id": "car.a1"},
			{"race_id": 2, "person_id": "person.b0", "team_id": "team.b", "car_id": "car.b0"},
			{"race_id": 3, "person_id": "person.b1", "team_id": "team.b", "car_id": "car.b1"}
		]
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data


static func _receipt(manifest: Dictionary, round: int) -> Dictionary:
	var order = PEOPLE.duplicate()
	var classification: Array = []
	var returned: Array = []
	for index in range(order.size()):
		var person: String = order[index]
		var team = "team.a" if person.begins_with("person.a") else "team.b"
		var car = "car." + person.trim_prefix("person.")
		classification.append(
			{
				"position": index + 1,
				"person_id": person,
				"team_id": team,
				"car_id": car,
				"status": "finished",
				"laps": 12,
				"finish_time": 900.0 + index,
				"name": person,
				"team": team,
				"points_eligibility": "not_defined_by_standalone_rules"
			}
		)
		returned.append(
			{
				"person_id": person,
				"team_id": team,
				"car_id": car,
				"health": 90.0,
				"damage": 10.0,
				"tyres": [{"id": "set.%02d.%02d" % [round, index], "life": 50.0}]
			}
		)
	var data = {
		"kind": CampaignWeekendReceipt.KIND,
		"version": CampaignWeekendReceipt.VERSION,
		"campaign_id": CAMPAIGN,
		"season_id": manifest.season_id,
		"campaign_event_id": manifest.campaign_event_id,
		"entrant_id": "entrant.a",
		"race_event_id": manifest.race_event_id,
		"manifest_digest": manifest.digest,
		"result_digest": RaceStateValue.fingerprint([manifest.campaign_event_id, "result"]),
		"classification": classification,
		"returned_resources": returned,
		"statistics": {"passes": round, "incidents": 0},
		"provenance": "Synthetic final classification for TM-14 season continuity."
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data
