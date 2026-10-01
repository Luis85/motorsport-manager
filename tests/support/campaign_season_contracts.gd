class_name CampaignSeasonContracts
extends RefCounted
## Four-round series, entry, standings and season-transition contracts.

static func run(check: Callable) -> void:
	var rules = _rules()
	var competition = CampaignCompetition.empty("career.season-test")
	var changed = CampaignCompetition.register_series(competition, rules)
	check.call(changed.ok, "A versioned campaign series rule pack can be registered")
	competition = changed.competition
	changed = CampaignCompetition.create_season(competition, _season_definition("season.1950", "round", 100))
	check.call(changed.ok, "An ordered four-event calendar can create one planning season")
	competition = changed.competition
	var untouched = RaceStateValue.fingerprint(competition)
	var premature = CampaignCompetition.transition_season(competition, "season.1950", "preseason")
	check.call(not premature.ok and RaceStateValue.fingerprint(premature.competition) == untouched,
		"A rejected lifecycle jump leaves the complete competition unchanged")
	changed = CampaignCompetition.transition_season(competition, "season.1950", "entries_open")
	check.call(changed.ok, "Planning opens the explicit season-entry window")
	competition = changed.competition
	changed = CampaignCompetition.submit_entry(competition, "season.1950", _entry("entrant.alpha", "team.alpha",
		["person.a0", "person.a1"], ["car.a0", "car.a1"]))
	check.call(changed.ok, "A two-car entrant can submit stable people and car identities")
	competition = changed.competition
	var entry_snapshot = RaceStateValue.fingerprint(competition)
	var duplicate_identity = CampaignCompetition.submit_entry(competition, "season.1950", _entry("entrant.conflict", "team.conflict",
		["person.a0", "person.c1"], ["car.c0", "car.c1"]))
	check.call(not duplicate_identity.ok and RaceStateValue.fingerprint(duplicate_identity.competition) == entry_snapshot,
		"A person cannot occupy two live season entries")
	changed = CampaignCompetition.decide_entry(competition, "season.1950", "entrant.alpha", true)
	check.call(changed.ok and changed.status == "accepted", "Series authority can accept a submitted entry")
	competition = changed.competition
	changed = CampaignCompetition.submit_entry(competition, "season.1950", _entry("entrant.beta", "team.beta",
		["person.b0", "person.b1"], ["car.b0", "car.b1"]))
	check.call(changed.ok, "A second legal entrant can join the frozen field")
	competition = changed.competition
	var undecided = CampaignCompetition.transition_season(competition, "season.1950", "preseason")
	check.call(not undecided.ok, "Entries cannot close while a submitted application remains undecided")
	changed = CampaignCompetition.decide_entry(competition, "season.1950", "entrant.beta", true)
	check.call(changed.ok, "The complete two-team field can be accepted")
	competition = changed.competition
	for target in ["preseason", "active"]:
		changed = CampaignCompetition.transition_season(competition, "season.1950", target)
		check.call(changed.ok, "Season lifecycle reaches " + target + " through its required predecessor")
		competition = changed.competition
	var manifest = _manifest(competition.seasons["season.1950"], 0)
	check.call(CampaignCompetition.manifest_error(competition, manifest).is_empty(),
		"The next weekend binds exactly to the active calendar and accepted field")
	var wrong_manifest = manifest.duplicate(true)
	wrong_manifest.track_hash = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
	wrong_manifest.erase("digest"); wrong_manifest["digest"] = RaceStateValue.fingerprint(wrong_manifest)
	check.call(not CampaignCompetition.manifest_error(competition, wrong_manifest).is_empty(),
		"A different frozen track snapshot cannot launch under the scheduled event identity")
	var out_of_order = CampaignCompetition.stage(competition,
		_receipt("season.1950", "round.2", 1, _orders()[1]), _policy("season.1950", "round.2"))
	check.call(not out_of_order.ok and RaceStateValue.fingerprint(out_of_order.competition) == RaceStateValue.fingerprint(competition),
		"A later round cannot settle before the next scheduled event")
	var wrong_scoring = CampaignWeekendPolicy.build({
		"campaign_id": "career.season-test", "season_id": "season.1950",
		"campaign_event_id": "round.1", "account_id": "organization.alpha"
	}, [14, 12, 10, 8], _people(), ["person.a0", "person.a1"], {
		"entry_cost_minor": 0, "participation_minor": 0, "position_bonus_minor": [0, 0, 0, 0]
	})
	var scoring_rejection = CampaignCompetition.stage(competition,
		_receipt("season.1950", "round.1", 0, _orders()[0]), wrong_scoring)
	check.call(not scoring_rejection.ok and RaceStateValue.fingerprint(scoring_rejection.competition) == RaceStateValue.fingerprint(competition),
		"An event cannot replace the season's frozen scoring table")
	for index in range(2):
		changed = CampaignCompetition.stage(competition,
			_receipt("season.1950", "round.%d" % (index + 1), index, _orders()[index]),
			_policy("season.1950", "round.%d" % (index + 1)))
		check.call(changed.ok and changed.status == "applied", "Scheduled round %d applies once" % (index + 1))
		competition = changed.competition
	var midpoint: Dictionary = competition.seasons["season.1950"]
	var a1_rank = _ranking(midpoint.rankings.drivers, "person.a1")
	var b1_rank = _ranking(midpoint.rankings.drivers, "person.b1")
	check.call(not a1_rank.is_empty() and a1_rank.position == b1_rank.position \
		and a1_rank.shared and b1_rank.shared and a1_rank.points == 18 and b1_rank.points == 18,
		"Exact points and countback equality produce an explicit shared sporting position")
	var tampered = competition.duplicate(true)
	tampered.seasons["season.1950"].rankings.drivers[0].points += 1
	_reseal(tampered.seasons["season.1950"])
	_reseal(tampered)
	check.call(not CampaignCompetition.validate(tampered).is_empty(),
		"Recomputed integrity digests cannot conceal standings that disagree with event awards")
	changed = CampaignCompetition.stage(competition,
		_receipt("season.1950", "round.3", 2, _orders()[2]), _policy("season.1950", "round.3"))
	check.call(changed.ok, "The third scheduled round applies")
	competition = changed.competition
	var early_final = CampaignCompetition.transition_season(competition, "season.1950", "final_classification")
	check.call(not early_final.ok, "Final classification waits for every scheduled round or explicit cancellation")
	changed = CampaignCompetition.stage(competition,
		_receipt("season.1950", "round.4", 3, _orders()[3]), _policy("season.1950", "round.4"))
	check.call(changed.ok, "The fourth scheduled round completes the sporting calendar")
	competition = changed.competition
	var final_season: Dictionary = competition.seasons["season.1950"]
	var a0_rank = _ranking(final_season.rankings.drivers, "person.a0")
	var b0_rank = _ranking(final_season.rankings.drivers, "person.b0")
	check.call(a0_rank.points == 46 and b0_rank.points == 46 and a0_rank.position == 1 and b0_rank.position == 2,
		"Wins then successive finishing counts break equal championship points deterministically")
	check.call(final_season.drivers["person.a0"].wins == 2 and final_season.teams["team.alpha"].starts == 8,
		"Driver and team standings rebuild from immutable per-event classifications")
	var blocked_next = CampaignCompetition.create_season(competition, _season_definition("season.1951", "next", 1000))
	check.call(not blocked_next.ok, "The next season cannot open before final classification and contract transition complete")
	for target in ["final_classification", "settled", "contract_transition", "completed"]:
		changed = CampaignCompetition.transition_season(competition, "season.1950", target)
		check.call(changed.ok, "Season lifecycle reaches " + target + " without rewriting sporting history")
		competition = changed.competition
	changed = CampaignCompetition.create_season(competition, _season_definition("season.1951", "next", 1000))
	check.call(changed.ok and changed.competition.seasons["season.1950"].status == "completed",
		"A completed season permits a separate next-season planning record")
	competition = changed.competition
	competition = _activate_second_season(competition, check)
	var before_cancel = competition.events.size()
	changed = CampaignCompetition.cancel_event(competition, "season.1951", "next.1", "Circuit unavailable under the published event rules.")
	check.call(changed.ok and changed.competition.events.size() == before_cancel \
		and CampaignSeason.next_scheduled_event_id(changed.competition.seasons["season.1951"]) == "next.2",
		"Cancelling the next event records a reason, awards nothing and advances the ordered calendar")
	competition = changed.competition
	check.call(CampaignCompetition.validate(competition).is_empty(),
		"The complete series, two seasons, entries, cancellation and event history validate as one projection")

static func _activate_second_season(competition: Dictionary, check: Callable) -> Dictionary:
	var changed = CampaignCompetition.transition_season(competition, "season.1951", "entries_open")
	check.call(changed.ok, "Second-season entries open")
	if not changed.ok: return competition
	competition = changed.competition
	for entry in [
		_entry("entrant.alpha", "team.alpha", ["person.a0", "person.a1"], ["car.a0", "car.a1"]),
		_entry("entrant.beta", "team.beta", ["person.b0", "person.b1"], ["car.b0", "car.b1"])
	]:
		changed = CampaignCompetition.submit_entry(competition, "season.1951", entry)
		check.call(changed.ok, "Second-season entry submits")
		if not changed.ok: return competition
		competition = changed.competition
		changed = CampaignCompetition.decide_entry(competition, "season.1951", entry.entrant_id, true)
		check.call(changed.ok, "Second-season entry accepts")
		if not changed.ok: return competition
		competition = changed.competition
	for target in ["preseason", "active"]:
		changed = CampaignCompetition.transition_season(competition, "season.1951", target)
		check.call(changed.ok, "Second season reaches " + target)
		if not changed.ok: return competition
		competition = changed.competition
	return competition

static func _rules() -> Dictionary:
	return CampaignSeriesRules.build({
		"series_id": "series.open-wheel",
		"name": "Obsidian Open Wheel Championship",
		"cars_per_entrant": 2,
		"min_entrants": 2,
		"max_entrants": 2,
		"min_events": 4,
		"max_events": 4,
		"points_by_position": [15, 12, 10, 8],
		"countback_depth": 4
	})

static func _season_definition(season_id: String, prefix: String, start_slot: int) -> Dictionary:
	var tracks = [
		"1111111111111111111111111111111111111111111111111111111111111111",
		"2222222222222222222222222222222222222222222222222222222222222222",
		"3333333333333333333333333333333333333333333333333333333333333333",
		"4444444444444444444444444444444444444444444444444444444444444444"
	]
	var calendar: Array = []
	for index in range(4):
		calendar.append({
			"campaign_event_id": "%s.%d" % [prefix, index + 1],
			"round": index + 1,
			"departure_slot": start_slot + index * 100,
			"return_slot": start_slot + index * 100 + 40,
			"event_revision": 1,
			"track_hash": tracks[index],
			"ruleset_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
		})
	return {"season_id": season_id, "series_id": "series.open-wheel", "calendar": calendar}

static func _entry(entrant_id: String, team_id: String, people: Array, cars: Array) -> Dictionary:
	return {"entrant_id": entrant_id, "team_id": team_id,
		"person_ids": people, "car_ids": cars}

static func _orders() -> Array:
	return [
		["person.a0", "person.b0", "person.a1", "person.b1"],
		["person.a0", "person.b0", "person.b1", "person.a1"],
		["person.b1", "person.b0", "person.a1", "person.a0"],
		["person.a1", "person.b1", "person.b0", "person.a0"]
	]

static func _people() -> Array:
	return ["person.a0", "person.a1", "person.b0", "person.b1"]

static func _policy(season_id: String, event_id: String) -> Dictionary:
	return CampaignWeekendPolicy.build({
		"campaign_id": "career.season-test",
		"season_id": season_id,
		"campaign_event_id": event_id,
		"account_id": "organization.alpha"
	}, [15, 12, 10, 8], _people(), ["person.a0", "person.a1"], {
		"entry_cost_minor": 0,
		"participation_minor": 0,
		"position_bonus_minor": [0, 0, 0, 0]
	})

static func _receipt(season_id: String, event_id: String, index: int, order: Array) -> Dictionary:
	var race_ids = [
		"10000000-0000-4000-8000-000000000001",
		"10000000-0000-4000-8000-000000000002",
		"10000000-0000-4000-8000-000000000003",
		"10000000-0000-4000-8000-000000000004"
	]
	var manifest_hashes = [
		"5555555555555555555555555555555555555555555555555555555555555555",
		"6666666666666666666666666666666666666666666666666666666666666666",
		"7777777777777777777777777777777777777777777777777777777777777777",
		"8888888888888888888888888888888888888888888888888888888888888888"
	]
	var result_hashes = [
		"9999999999999999999999999999999999999999999999999999999999999999",
		"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
	]
	var classification: Array = []
	var returned: Array = []
	for position in range(order.size()):
		var person_id: String = order[position]
		var team_id = "team.alpha" if person_id.begins_with("person.a") else "team.beta"
		var car_id = "car." + person_id.trim_prefix("person.")
		classification.append({
			"position": position + 1,
			"person_id": person_id,
			"team_id": team_id,
			"car_id": car_id,
			"status": "finished",
			"laps": 12,
			"finish_time": 900.0 + position,
			"name": person_id,
			"team": team_id,
			"points_eligibility": "not_defined_by_standalone_rules"
		})
		returned.append({
			"person_id": person_id,
			"team_id": team_id,
			"car_id": car_id,
			"health": 90.0 - position,
			"damage": 10.0 + position,
			"tyres": [{"id": "set.%d.%d" % [index, position], "life": 50.0}]
		})
	var data = {
		"kind": CampaignWeekendReceipt.KIND,
		"version": CampaignWeekendReceipt.VERSION,
		"campaign_id": "career.season-test",
		"season_id": season_id,
		"campaign_event_id": event_id,
		"entrant_id": "entrant.alpha",
		"race_event_id": race_ids[index],
		"manifest_digest": manifest_hashes[index],
		"result_digest": result_hashes[index],
		"classification": classification,
		"returned_resources": returned,
		"statistics": {"passes": index, "incidents": 0},
		"provenance": "Synthetic final classification for deterministic season contracts."
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data

static func _manifest(season: Dictionary, event_index: int) -> Dictionary:
	var event: Dictionary = season.calendar[event_index]
	var data = {
		"kind": CampaignWeekendManifest.KIND,
		"version": CampaignWeekendManifest.VERSION,
		"campaign_id": "career.season-test",
		"season_id": season.season_id,
		"campaign_event_id": event.campaign_event_id,
		"entrant_id": "entrant.alpha",
		"event_revision": event.event_revision,
		"departure_slot": event.departure_slot,
		"return_slot": event.return_slot,
		"race_event_id": "10000000-0000-4000-8000-000000000001",
		"race_model": "practice-race-sim",
		"checkpoint_version": 11,
		"track_hash": event.track_hash,
		"roster_hash": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
		"starting_resources_hash": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
		"ruleset_hash": event.ruleset_hash,
		"mappings": [
			{"race_id": 0, "person_id": "person.a0", "team_id": "team.alpha", "car_id": "car.a0"},
			{"race_id": 1, "person_id": "person.a1", "team_id": "team.alpha", "car_id": "car.a1"},
			{"race_id": 2, "person_id": "person.b0", "team_id": "team.beta", "car_id": "car.b0"},
			{"race_id": 3, "person_id": "person.b1", "team_id": "team.beta", "car_id": "car.b1"}
		]
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data

static func _ranking(rows: Array, identity: String) -> Dictionary:
	for row in rows:
		if row.identity == identity:
			return row
	return {}

static func _reseal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
