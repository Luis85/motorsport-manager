class_name CampaignStarter
extends RefCounted
## Deterministic four-event Team Principal starter built from one actual race entry.
## The race roster remains authoritative; campaign identities map to it explicitly.
const DAY = CampaignClock.SLOTS_PER_DAY
const EVENT_COST_MINOR = 8000
const CAMPAIGN_ID = "career.team-principal"
const ORGANIZATION_ID = "organization.obsidian"
const SEASON_ID = "season.1950"
const SERIES_ID = "series.starter"

static func create(record: RaceRecord) -> Dictionary:
	if record == null or not RaceRecord.valid_id(record.event_id) 			or not record.initial is Dictionary or record.initial.is_empty():
		return {}
	if int(record.initial.get("version", 0)) < TacticalDuels.CHECKPOINT_VERSION:
		return {}
	var race_manifest = RaceRecord.manifest_for(record.initial)
	var groups = _roster_groups(record.initial)
	if groups.is_empty(): return {}
	var player_label = _player_team_label(record.initial)
	if player_label.is_empty() or not groups.has(player_label): return {}
	var state = CampaignState.create({"campaign_id": CAMPAIGN_ID,
		"organization_id": ORGANIZATION_ID, "principal_id": "person.principal",
		"start": {"year": 1950, "month": 1, "day": 1, "slot": 0}})
	if state == null: return {}
	var economy = CampaignEconomy.create(CAMPAIGN_ID, ORGANIZATION_ID, 150000, 0)
	var checkpoint = CampaignCheckpoint.build(state, {}, {}, {}, economy, {})
	if checkpoint.is_empty(): return {}
	var rules = CampaignSeriesRules.build({"series_id": SERIES_ID,
		"name": "Obsidian Starter Championship", "cars_per_entrant": 2,
		"min_entrants": groups.size(), "max_entrants": groups.size(),
		"min_events": 4, "max_events": 4,
		"points_by_position": [15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0],
		"countback_depth": mini(12, record.initial.cars.size())})
	if rules.is_empty(): return {}
	var changed = CampaignCompetitionTransaction.register_series(checkpoint, rules)
	if not changed.ok: return {}
	checkpoint = changed.checkpoint
	var calendar: Array = []
	for index in range(4):
		var departure = index * 7 * DAY
		calendar.append({"campaign_event_id": "event.1950.%d" % (index + 1),
			"round": index + 1, "departure_slot": departure,
			"return_slot": departure + 2 * DAY, "event_revision": 1,
			"track_hash": race_manifest.track_hash,
			"ruleset_hash": RaceRecord.fingerprint(race_manifest.ruleset)})
	changed = CampaignCompetitionTransaction.create_season(checkpoint,
		{"season_id": SEASON_ID, "series_id": SERIES_ID, "calendar": calendar})
	if not changed.ok: return {}
	checkpoint = changed.checkpoint
	changed = CampaignCompetitionTransaction.transition_season(checkpoint, SEASON_ID, "entries_open")
	if not changed.ok: return {}
	checkpoint = changed.checkpoint
	var labels = groups.keys(); labels.sort()
	var rival_index = 0
	for label in labels:
		var group: Array = groups[label]
		if group.size() != 2: return {}
		var player = label == player_label
		var entry = {"entrant_id": "entrant.player" if player else "entrant.rival.%d" % rival_index,
			"team_id": "team.player" if player else "team.rival.%d" % rival_index,
			"person_ids": group.map(func(id): return _person_id(int(id))),
			"car_ids": group.map(func(id): return _car_id(int(id)))}
		changed = CampaignCompetitionTransaction.submit_entry(checkpoint, SEASON_ID, entry)
		if not changed.ok: return {}
		checkpoint = changed.checkpoint
		changed = CampaignCompetitionTransaction.decide_entry(
			checkpoint, SEASON_ID, entry.entrant_id, true)
		if not changed.ok: return {}
		checkpoint = changed.checkpoint
		if not player: rival_index += 1
	for target in ["preseason", "active"]:
		changed = CampaignCompetitionTransaction.transition_season(checkpoint, SEASON_ID, target)
		if not changed.ok: return {}
		checkpoint = changed.checkpoint
	checkpoint = _add_player_people(checkpoint, record.initial)
	if checkpoint.is_empty(): return {}
	var reserve = CampaignFinanceTransaction.set_reserve_policy(checkpoint, ORGANIZATION_ID, 60000)
	if not reserve.ok: return {}
	checkpoint = reserve.checkpoint
	checkpoint = _add_facilities(checkpoint)
	if checkpoint.is_empty(): return {}
	checkpoint = _add_rivals(checkpoint)
	return checkpoint if not checkpoint.is_empty() and CampaignCheckpoint.validate(checkpoint).is_empty() else {}

static func mappings(checkpoint: Dictionary) -> Array:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok or not restored.competition.seasons.has(SEASON_ID): return []
	var rows: Array = []
	var season: Dictionary = restored.competition.seasons[SEASON_ID]
	for entry in season.entries.values():
		if entry.status != "accepted": continue
		for index in range(entry.person_ids.size()):
			var person_id: String = entry.person_ids[index]
			if not person_id.begins_with("person.race."): return []
			var race_id = person_id.trim_prefix("person.race.").to_int()
			rows.append({"race_id": race_id, "person_id": person_id,
				"team_id": entry.team_id, "car_id": entry.car_ids[index]})
	rows.sort_custom(func(a, b): return int(a.race_id) < int(b.race_id))
	return rows

static func event_assignments(checkpoint: Dictionary) -> Array:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok: return []
	var result: Array = []
	for assignment in restored.personnel.assignments.values():
		if assignment.role_id in ["race_driver", "operations_lead"]:
			result.append(assignment.id)
	result.sort()
	return result

static func next_event_context(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok or not restored.competition.seasons.has(SEASON_ID): return {}
	var season: Dictionary = restored.competition.seasons[SEASON_ID]
	var event_id = CampaignSeason.next_scheduled_event_id(season)
	if event_id.is_empty(): return {}
	var event = CampaignSeason.calendar_event(season, event_id)
	return {"campaign_id": restored.state.campaign_id, "season_id": season.season_id,
		"campaign_event_id": event.campaign_event_id, "entrant_id": "entrant.player",
		"event_revision": event.event_revision, "departure_slot": event.departure_slot,
		"return_slot": event.return_slot}

static func weekend_policy(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok or not restored.competition.seasons.has(SEASON_ID): return {}
	var season: Dictionary = restored.competition.seasons[SEASON_ID]
	var event_id = ""
	if not restored.active_manifest.is_empty():
		event_id = restored.active_manifest.campaign_event_id
	else:
		event_id = CampaignSeason.next_scheduled_event_id(season)
	if event_id.is_empty(): return {}
	var rules: Dictionary = restored.competition.series[season.series_id]
	var eligible: Array = []
	for entry in season.entries.values():
		if entry.status == "accepted": eligible.append_array(entry.person_ids)
	var player: Dictionary = season.entries.get("entrant.player", {})
	var bonuses: Array = []
	for index in range(rules.points_by_position.size()):
		bonuses.append([10000, 7000, 5000, 3000, 2000, 1000, 500, 250].get(index, 0))
	return CampaignWeekendPolicy.build({"campaign_id": restored.state.campaign_id,
		"season_id": season.season_id, "campaign_event_id": event_id,
		"account_id": restored.state.organization_id}, rules.points_by_position,
		eligible, player.get("person_ids", []), {"entry_cost_minor": 0,
			"participation_minor": 5000, "position_bonus_minor": bonuses})

static func race_options() -> Dictionary:
	return {"laps": 6, "qual_duration": 240, "scenario": "dry",
		"intensity": "calm", "seed": 7314, "tactical_duels": true}

static func _roster_groups(initial: Dictionary) -> Dictionary:
	var groups = {}
	for car in initial.get("cars", []):
		var label = str(car.get("team", ""))
		if label.is_empty(): return {}
		if not groups.has(label): groups[label] = []
		groups[label].append(int(car.id))
	return groups

static func _player_team_label(initial: Dictionary) -> String:
	var label = ""
	for car in initial.get("cars", []):
		if not car.get("player", false): continue
		if label.is_empty(): label = str(car.team)
		elif label != str(car.team): return ""
	return label

static func _add_player_people(checkpoint: Dictionary, initial: Dictionary) -> Dictionary:
	var player_ids: Array = []
	for car in initial.cars:
		if car.get("player", false): player_ids.append(int(car.id))
	if player_ids.size() != 2: return {}
	for race_id in player_ids:
		var car: Dictionary = initial.cars[race_id]
		checkpoint = _employ(checkpoint, _person_id(race_id), str(car.name),
			["race_driver"], "race_driver", 8000)
		if checkpoint.is_empty(): return {}
	checkpoint = _employ(checkpoint, "person.operations", "Operations Lead",
		["operations_lead"], "operations_lead", 5000)
	return checkpoint

static func _employ(checkpoint: Dictionary, person_id: String, name: String,
		eligible: Array, role: String, pay: int) -> Dictionary:
	var person = CampaignPersonnelTransaction.register_person(checkpoint,
		{"id": person_id, "display_name": name, "eligible_roles": eligible})
	if not person.ok: return {}
	var contract_id = "contract." + person_id
	var contract = CampaignPersonnelTransaction.sign_contract(person.checkpoint,
		{"id": contract_id, "person_id": person_id, "account_id": ORGANIZATION_ID,
			"start_slot": 0, "end_slot": 28 * DAY, "pay_interval_slots": 7 * DAY,
			"pay_minor": pay, "capacity_bps": 10000, "renewal_window_slots": 7 * DAY})
	if not contract.ok: return {}
	var assignment = CampaignPersonnelTransaction.assign_role(contract.checkpoint,
		{"id": "assignment." + person_id, "person_id": person_id,
			"contract_id": contract_id, "role_id": role, "start_slot": 0,
			"end_slot": 28 * DAY, "allocation_bps": 10000})
	return assignment.checkpoint if assignment.ok else {}

static func _add_facilities(checkpoint: Dictionary) -> Dictionary:
	for item in [["facility.workshop", "Preparation workshop", "preparation_workshop"],
		["facility.design", "Design office", "design_office"],
		["facility.test", "Validation rig", "test_validation"]]:
		var changed = CampaignOperationsTransaction.register_owned(checkpoint,
			{"id": item[0], "display_name": item[1], "family": item[2],
				"available_from_slot": 0, "available_until_slot": 28 * DAY,
				"capacity_units": 1})
		if not changed.ok: return {}
		checkpoint = changed.checkpoint
	return checkpoint

static func _add_rivals(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok: return {}
	var season: Dictionary = restored.competition.seasons[SEASON_ID]
	var index = 0
	for entry in season.entries.values():
		if entry.status != "accepted" or entry.entrant_id == "entrant.player": continue
		var archetype = CampaignRivals.ARCHETYPES[index % CampaignRivals.ARCHETYPES.size()]
		var changed = CampaignRivalTransaction.register_team(checkpoint, {
			"team_id": entry.team_id, "entrant_id": entry.entrant_id,
			"person_ids": entry.person_ids, "car_ids": entry.car_ids,
			"archetype": archetype, "cash_minor": 100000,
			"reserve_minor": 40000, "capability_bps": 9500 + index * 150,
			"next_review_slot": 0, "review_interval_slots": 7 * DAY})
		if not changed.ok: return {}
		checkpoint = changed.checkpoint
		index += 1
	return checkpoint

static func _person_id(race_id: int) -> String:
	return "person.race.%02d" % race_id

static func _car_id(race_id: int) -> String:
	return "car.race.%02d" % race_id
