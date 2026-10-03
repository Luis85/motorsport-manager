class_name CampaignStarter
extends RefCounted
## Deterministic Team Principal campaign assembled from validated authored content
## and one actual race entry. Ongoing careers consume their frozen content closure.
const DAY = CampaignClock.SLOTS_PER_DAY


static func create(record: RaceRecord, definition: Dictionary, circuits: Dictionary) -> Dictionary:
	if (
		record == null
		or not RaceRecord.valid_id(record.event_id)
		or not record.initial is Dictionary
		or record.initial.is_empty()
	):
		return {}
	if int(record.initial.get("version", 0)) < TacticalDuels.CHECKPOINT_VERSION:
		return {}
	var campaign = CampaignDefinition.from_record(definition)
	var frozen = CampaignContentSnapshot.build(definition, record.initial, circuits)
	if campaign == null or frozen.is_empty():
		return {}
	var config = campaign.to_record()
	var race_manifest = RaceRecord.manifest_for(record.initial)
	var groups = _roster_groups(record.initial)
	if groups.is_empty() or config.rivals.size() != groups.size() - 1:
		return {}
	var player_label = _player_team_label(record.initial)
	if (
		player_label.is_empty()
		or player_label != config.player.roster_team_id
		or not groups.has(player_label)
	):
		return {}
	var career: Dictionary = config.career
	var state = CampaignState.create(
		{
			"campaign_id": career.campaign_id,
			"organization_id": career.organization_id,
			"principal_id": career.principal_id,
			"start": career.start,
			"energy_capacity": career.energy_capacity
		}
	)
	if state == null:
		return {}
	var economy = CampaignEconomy.create(
		state.campaign_id, state.organization_id, int(career.opening_cash_minor), 0
	)
	var management = CampaignManagement.empty(state.campaign_id, state.organization_id, 0)
	management = CampaignManagement.with_campaign_content(management, frozen)
	if economy.is_empty() or management.is_empty():
		return {}
	var checkpoint = CampaignCheckpoint.build(
		state, {}, {}, {}, economy, {}, {}, {}, {}, management
	)
	if checkpoint.is_empty():
		return {}
	checkpoint = _prepare_competition(checkpoint, record, config, circuits, groups, race_manifest)
	if checkpoint.is_empty():
		return {}
	checkpoint = CampaignStarterResources._add_player_people(checkpoint, record.initial, config)
	if checkpoint.is_empty():
		return {}
	var reserve = CampaignFinanceTransaction.set_reserve_policy(
		checkpoint, state.organization_id, int(career.reserve_minor)
	)
	if not reserve.ok:
		return {}
	checkpoint = reserve.checkpoint
	checkpoint = CampaignStarterResources._add_facilities(checkpoint, config.facilities)
	if checkpoint.is_empty():
		return {}
	checkpoint = CampaignStarterResources._add_rivals(
		checkpoint, config.rivals, config.rival_policy
	)
	return checkpoint if CampaignCheckpoint.validate(checkpoint).is_empty() else {}


static func content(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return {}
	var value = restored.management.get("campaign_content", {})
	return value.duplicate(true) if CampaignContentSnapshot.validate(value).is_empty() else {}


static func definition(checkpoint: Dictionary) -> Dictionary:
	var frozen = content(checkpoint)
	return frozen.get("definition", {}).duplicate(true)


static func circuits(checkpoint: Dictionary) -> Dictionary:
	var frozen = content(checkpoint)
	return frozen.get("circuits", {}).duplicate(true)


static func race_options(checkpoint: Dictionary) -> Dictionary:
	var frozen = content(checkpoint)
	return (
		frozen.race_options.duplicate(true)
		if not frozen.is_empty()
		else CampaignStarterLegacy.race_options()
	)


static func vehicle(checkpoint: Dictionary) -> String:
	var frozen = content(checkpoint)
	return (
		str(frozen.vehicle)
		if not frozen.is_empty()
		else str(CampaignStarterLegacy.DEFAULTS.vehicle)
	)


static func vehicle_definition(checkpoint: Dictionary) -> Dictionary:
	var frozen = content(checkpoint)
	return frozen.get("vehicle_definition", {}).duplicate(true)


static func event_cost_minor(checkpoint: Dictionary) -> int:
	var authored = definition(checkpoint)
	return (
		int(authored.event_finance.departure_cost_minor)
		if not authored.is_empty()
		else int(CampaignStarterLegacy.DEFAULTS.departure_cost_minor)
	)


static func mappings(checkpoint: Dictionary) -> Array:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return []
	var season = _current_season(restored)
	if season.is_empty():
		return []
	var rows: Array = []
	for entry in season.entries.values():
		if entry.status != "accepted":
			continue
		for index in range(entry.person_ids.size()):
			var person_id: String = entry.person_ids[index]
			if not person_id.begins_with("person.race."):
				return []
			var race_id = person_id.trim_prefix("person.race.").to_int()
			rows.append(
				{
					"race_id": race_id,
					"person_id": person_id,
					"team_id": entry.team_id,
					"car_id": entry.car_ids[index]
				}
			)
	rows.sort_custom(func(a, b): return int(a.race_id) < int(b.race_id))
	return rows


static func event_assignments(checkpoint: Dictionary) -> Array:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return []
	var authored = definition(checkpoint)
	var driver_role = str(
		authored.get("player", {}).get(
			"driver_role_id", CampaignStarterLegacy.DEFAULTS.driver_role_id
		)
	)
	var operations_role = str(
		authored.get("player", {}).get("operations_lead", {}).get(
			"role_id", CampaignStarterLegacy.DEFAULTS.operations_role_id
		)
	)
	var result: Array = []
	for assignment in restored.personnel.assignments.values():
		if assignment.role_id in [driver_role, operations_role]:
			result.append(assignment.id)
	result.sort()
	return result


static func next_event_context(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return {}
	var season = _current_season(restored)
	var player = _player_entry(restored, season)
	if season.is_empty() or player.is_empty():
		return {}
	var event_id = CampaignSeason.next_scheduled_event_id(season)
	if event_id.is_empty():
		return {}
	var event = CampaignSeason.calendar_event(season, event_id)
	return {
		"campaign_id": restored.state.campaign_id,
		"season_id": season.season_id,
		"campaign_event_id": event.campaign_event_id,
		"entrant_id": player.entrant_id,
		"event_revision": event.event_revision,
		"departure_slot": event.departure_slot,
		"return_slot": event.return_slot
	}


static func weekend_policy(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return {}
	var season = _current_season(restored)
	if season.is_empty():
		return {}
	var event_id = restored.active_manifest.get(
		"campaign_event_id", CampaignSeason.next_scheduled_event_id(season)
	)
	if str(event_id).is_empty():
		return {}
	var rules: Dictionary = restored.competition.series[season.series_id]
	var eligible: Array = []
	for entry in season.entries.values():
		if entry.status == "accepted":
			eligible.append_array(entry.person_ids)
	var player = _player_entry(restored, season)
	if player.is_empty():
		return {}
	var authored = definition(checkpoint)
	var participation = int(CampaignStarterLegacy.DEFAULTS.participation_minor)
	var bonuses = CampaignStarterLegacy.position_bonuses(rules.points_by_position.size())
	if not authored.is_empty():
		participation = int(authored.event_finance.participation_minor)
		bonuses = authored.event_finance.position_bonus_minor.duplicate(true)
	return CampaignWeekendPolicy.build(
		{
			"campaign_id": restored.state.campaign_id,
			"season_id": season.season_id,
			"campaign_event_id": event_id,
			"account_id": restored.state.organization_id
		},
		rules.points_by_position,
		eligible,
		player.person_ids,
		{
			"entry_cost_minor": 0,
			"participation_minor": participation,
			"position_bonus_minor": bonuses
		}
	)


static func _roster_groups(initial: Dictionary) -> Dictionary:
	var groups = {}
	for car in initial.get("cars", []):
		var label = str(car.get("team", ""))
		if label.is_empty():
			return {}
		if not groups.has(label):
			groups[label] = []
		groups[label].append(int(car.id))
	return groups


static func _player_team_label(initial: Dictionary) -> String:
	var label = ""
	for car in initial.get("cars", []):
		if not car.get("player", false):
			continue
		if label.is_empty():
			label = str(car.team)
		elif label != str(car.team):
			return ""
	return label


static func _current_season(restored: Dictionary) -> Dictionary:
	if not restored.get("ok", false):
		return {}
	if not restored.active_manifest.is_empty():
		return restored.competition.seasons.get(restored.active_manifest.season_id, {})
	var ids = restored.competition.seasons.keys()
	ids.sort()
	for id in ids:
		var season: Dictionary = restored.competition.seasons[id]
		if not CampaignSeason.next_scheduled_event_id(season).is_empty():
			return season
	return restored.competition.seasons[ids[-1]] if not ids.is_empty() else {}


static func _player_entry(restored: Dictionary, season: Dictionary) -> Dictionary:
	if season.is_empty():
		return {}
	for entry in season.entries.values():
		if entry.status != "accepted":
			continue
		var owned = true
		for person_id in entry.person_ids:
			if not restored.personnel.people.has(person_id):
				owned = false
				break
		if owned:
			return entry
	return {}


static func _person_id(race_id: int) -> String:
	return "person.race.%02d" % race_id


static func _car_id(race_id: int) -> String:
	return "car.race.%02d" % race_id


static func _prepare_competition(
	checkpoint: Dictionary,
	record: RaceRecord,
	config: Dictionary,
	circuits: Dictionary,
	groups: Dictionary,
	race_manifest: Dictionary
) -> Dictionary:
	var series: Dictionary = config.series
	var rules = CampaignSeriesRules.build(
		{
			"series_id": series.series_id,
			"name": series.name,
			"cars_per_entrant": series.cars_per_entrant,
			"min_entrants": groups.size(),
			"max_entrants": groups.size(),
			"min_events": config.calendar.size(),
			"max_events": config.calendar.size(),
			"points_by_position": series.points_by_position,
			"countback_depth": mini(CampaignWeekendReceipt.MAX_ENTRANTS, record.initial.cars.size())
		}
	)
	if rules.is_empty():
		return {}
	var changed = CampaignCompetitionTransaction.register_series(checkpoint, rules)
	if not changed.ok:
		return {}
	checkpoint = changed.checkpoint
	var calendar: Array = []
	for authored in config.calendar:
		var circuit: Dictionary = circuits.get(authored.circuit_id, {})
		if circuit.is_empty():
			return {}
		calendar.append(
			{
				"campaign_event_id": authored.campaign_event_id,
				"round": authored.round,
				"departure_slot": int(authored.departure_day) * DAY,
				"return_slot": int(authored.return_day) * DAY,
				"event_revision": authored.event_revision,
				"track_hash": RaceStateValue.fingerprint(circuit),
				"ruleset_hash": RaceRecord.fingerprint(race_manifest.ruleset)
			}
		)
	changed = CampaignCompetitionTransaction.create_season(
		checkpoint,
		{"season_id": series.season_id, "series_id": series.series_id, "calendar": calendar}
	)
	if not changed.ok:
		return {}
	checkpoint = changed.checkpoint
	var season_id: String = str(series.season_id)
	changed = CampaignCompetitionTransaction.transition_season(
		checkpoint, season_id, "entries_open"
	)
	if not changed.ok:
		return {}
	checkpoint = changed.checkpoint
	var entry_configs: Array = [config.player]
	entry_configs.append_array(config.rivals)
	if entry_configs.size() != groups.size():
		return {}
	for entry_config in entry_configs:
		var roster_team_id: String = entry_config.roster_team_id
		if not groups.has(roster_team_id):
			return {}
		var group: Array = groups[roster_team_id]
		if group.size() != int(series.cars_per_entrant):
			return {}
		var entry = {
			"entrant_id": entry_config.entrant_id,
			"team_id": entry_config.team_id,
			"person_ids": group.map(func(id): return _person_id(int(id))),
			"car_ids": group.map(func(id): return _car_id(int(id)))
		}
		changed = CampaignCompetitionTransaction.submit_entry(checkpoint, season_id, entry)
		if not changed.ok:
			return {}
		checkpoint = changed.checkpoint
		changed = CampaignCompetitionTransaction.decide_entry(
			checkpoint, season_id, entry.entrant_id, true
		)
		if not changed.ok:
			return {}
		checkpoint = changed.checkpoint
	for target in ["preseason", "active"]:
		changed = CampaignCompetitionTransaction.transition_season(checkpoint, season_id, target)
		if not changed.ok:
			return {}
		checkpoint = changed.checkpoint
	return checkpoint
