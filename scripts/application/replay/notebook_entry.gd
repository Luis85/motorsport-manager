class_name NotebookEntry
extends RefCounted
## Compact historical evidence, not a performance prior or reward-bearing result.
const MAX_NOTE = 1200
const OUTCOMES = ["none", "observation", "met", "not_met"]

static func build(record: RaceRecord) -> Dictionary:
	var result = WeekendResult.build(record)
	if result.is_empty() or not WeekendResult.validate(result).is_empty(): return {}
	var sim = record.source.get_ref()
	var endpoint = sim.snapshot()
	if not RaceRecord.equivalent(RaceRecord.static_identity(record.initial), RaceRecord.static_identity(endpoint)): return {}
	var brief = record.parent.get("scenario", {})
	if not brief.is_empty() and not ScenarioBrief.validate(brief).is_empty(): return {}
	var players: Array = []
	for id in sim.player_ids():
		var car = sim.cars[id]
		var row = result.classification.filter(func(c): return int(c.driver_id) == id)[0]
		var practice_laps = 0
		for run in sim.practice_driver(id).runs: practice_laps += run.samples.size()
		players.append({"id": id, "name": car.name, "position": row.position,
			"laps": row.laps, "status": row.status, "stops": car.pit_stops,
			"qualifying_best": car.qual_best, "practice_laps": practice_laps})
	var challenge = {"key": "", "title": "", "goal": "", "outcome": "none"}
	if not brief.is_empty():
		var outcome = "observation"
		if brief.goal != "observe":
			var met = players.all(func(c): return c.status == "finished")
			if brief.goal in ["mer_top_six", "mor_top_six"]:
				var target = ScenarioBrief.named_target(brief.goal, sim.roster_definition)
				var targets = players.filter(func(car): return car.id == target)
				if targets.is_empty(): return {}
				var car = targets[0]
				met = car.status == "finished" and car.position <= 6
			outcome = "met" if met else "not_met"
		challenge = {"key": RaceRecord.fingerprint({"brief": brief, "start": RaceRecord.sporting(record.initial)}),
			"title": brief.title, "goal": brief.goal, "outcome": outcome}
	var facts = {"event_id": record.event_id, "origin": record.origin, "result_digest": result.digest,
		"track_name": str(sim.track.document.name), "track_hash": result.track_hash,
		"context": RaceRecord.static_identity(record.initial), "engine": result.engine, "model": result.model,
		"start_time": record.initial.total_time, "end_time": sim.total_time,
		"players": players, "challenge": challenge}
	if record.parent.has("content_scenario"):
		facts.content_scenario = record.parent.content_scenario.duplicate(true)
	return {"facts": facts, "digest": RaceRecord.fingerprint(facts), "note": "", "revision": 0}

static func hash_valid(value: Variant) -> bool:
	return value is String and value.length() == 64 and value.is_valid_hex_number(false)

static func text_valid(value: Variant, limit: int, empty: bool = false) -> bool:
	return value is String and value.length() <= limit and (empty or not value.strip_edges().is_empty())

static func validate(entry: Variant) -> bool:
	if not entry is Dictionary or entry.size() != 4 or not entry.get("facts") is Dictionary: return false
	if not text_valid(entry.get("note"), MAX_NOTE, true) or not RaceCheckpoint.integral(entry.get("revision"), 0, 1000000): return false
	var f = entry.facts
	if f.size() != 12 + (1 if f.has("content_scenario") else 0) or not RaceRecord.valid_id(f.get("event_id")) or f.get("origin") not in ["standalone", "legacy", "sandbox"]: return false
	if not hash_valid(f.get("result_digest")) or not hash_valid(f.get("track_hash")): return false
	if not text_valid(f.get("track_name"), 200) or not text_valid(f.get("engine"), 100) or not text_valid(f.get("model"), 100): return false
	if not RaceCheckpoint.number(f.get("start_time"), 0, 10000000) or not RaceCheckpoint.number(f.get("end_time"), f.start_time, 10000000): return false
	var context = f.get("context")
	if not context is Dictionary or context.size() != 8: return false
	if not hash_valid(context.get("track_hash")) or context.track_hash != f.track_hash or not hash_valid(context.get("roster_hash")): return false
	if context.get("weather") not in ["dry", "wet", "changeable"]: return false
	if context.get("incident_exposure") not in ["calm", "standard", "volatile"]: return false
	if not RaceCheckpoint.integral(context.get("seed"), 0, 4294967295) or not RaceCheckpoint.integral(context.get("laps"), 1, 100): return false
	var rules = context.get("ruleset")
	if not rules is Dictionary: return false
	var expected_keys = 6 if int(rules.get("checkpoint_schema", 0)) >= TacticalDuels.LEGACY_CHECKPOINT_VERSION else 5
	for key in RaceContentSnapshot.RULE_KEYS:
		if rules.has(key): expected_keys += 1
	if rules.size() != expected_keys: return false
	if not RaceContentSnapshot.valid_mechanics(rules): return false
	if rules.has("vehicle_definition"):
		if not rules.vehicle_definition is Dictionary: return false
		var definition = VehicleDefinition.from_record(rules.vehicle_definition)
		if definition == null or definition.id != context.get("vehicle"): return false
	elif context.get("vehicle") not in VehicleDefinition.LEGACY: return false
	if int(rules.get("checkpoint_schema", 0)) >= TacticalDuels.LEGACY_CHECKPOINT_VERSION and (not rules.get("tactical_duels") is bool or not rules.tactical_duels): return false
	if not RaceCheckpoint.integral(rules.get("checkpoint_schema"), 10, 12) or rules.get("weather") not in WeekendWeather.MODES: return false
	if rules.get("reliability") not in ["legacy", "staged"] or not rules.get("rival_styles") is bool: return false
	if rules.get("race_control") not in ["virtual-neutralization-v1", "legacy-speed-cap"]: return false
	if rules.has("tuning_definition") and RaceTuningDefinition.from_record(rules.tuning_definition) == null: return false
	if rules.has("weekend_definition") and WeekendDefinition.from_record(rules.weekend_definition) == null: return false
	if not ContentScenarioDefinition.valid_notebook_context(f): return false
	var roster: RosterDefinition
	if rules.has("setup_definition") and SetupDefinition.from_record(rules.setup_definition) == null: return false
	if rules.has("tyre_definition") and RaceTyreRules.from_snapshot(rules.tyre_definition) == null: return false
	if rules.has("roster_definition"):
		roster = RosterDefinition.decode_snapshot(rules.roster_definition)
		if roster == null: return false
	var player_ids = roster.player_ids() if roster != null else [3, 6]
	var entrant_count = roster.count if roster != null else 12
	if not f.get("players") is Array or f.players.size() != 2: return false
	for index in range(2):
		var c = f.players[index]
		if not c is Dictionary or c.size() != 8 or not RaceCheckpoint.integral(c.get("id"), player_ids[index], player_ids[index]): return false
		if roster != null and c.get("name") != roster.entrant(player_ids[index]).values().name: return false
		if not text_valid(c.get("name"), 160) or c.get("status") not in ["finished", "retired"]: return false
		if not RaceCheckpoint.integral(c.get("position"), 1, entrant_count) or not RaceCheckpoint.integral(c.get("laps"), 0, context.laps): return false
		if not RaceCheckpoint.integral(c.get("stops"), 0, 10000) or not RaceCheckpoint.integral(c.get("practice_laps"), 0, 12): return false
		if not RaceCheckpoint.number(c.get("qualifying_best"), 0, 10000000): return false
	if f.players[0].position == f.players[1].position: return false
	var challenge = f.get("challenge")
	if not challenge is Dictionary or challenge.size() != 4 or challenge.get("outcome") not in OUTCOMES: return false
	if challenge.outcome == "none":
		for key in ["key", "title", "goal"]:
			if not challenge.get(key) is String or not challenge[key].is_empty(): return false
	else:
		if (f.origin != "sandbox" and not f.has("content_scenario")) or not hash_valid(challenge.get("key")) or not text_valid(challenge.get("title"), 80) or challenge.get("goal") not in ScenarioBrief.GOALS: return false
		var expected = "observation"
		if challenge.goal != "observe":
			var met = f.players.all(func(c): return c.status == "finished")
			if challenge.goal in ["mer_top_six", "mor_top_six"]:
				var target = ScenarioBrief.named_target(challenge.goal, roster)
				var targets = f.players.filter(func(car): return car.id == target)
				if targets.is_empty(): return false
				var c = targets[0]
				met = c.status == "finished" and c.position <= 6
			expected = "met" if met else "not_met"
		if challenge.outcome != expected: return false
	return hash_valid(entry.get("digest")) and entry.digest == RaceRecord.fingerprint(f)

static func describe(entry: Dictionary) -> String:
	var f = entry.facts
	var c = f.context
	var lines: Array[String] = [f.track_name + " · " + ("SANDBOX" if f.origin == "sandbox" else f.origin.to_upper()),
		"%s · %d laps · seed %d · %s / %s incidents" % [c.vehicle, c.laps, c.seed, c.weather, c.incident_exposure],
		"Observed finish; not a controlled comparison or a forecast."]
	for car in f.players:
		lines.append("%s: P%d · %d/%d laps · %s · %d stops" % [car.name, car.position, car.laps, c.laps, car.status, car.stops])
		lines.append("Practice: %d measured laps · qualifying: %s" % [car.practice_laps, RaceSim.format_time(car.qualifying_best) if car.qualifying_best > 0 else "no measured time"])
	if f.challenge.outcome != "none":
		lines.append(f.challenge.title + " · " + ScenarioBrief.GOALS[f.challenge.goal])
		lines.append("Observed goal: " + f.challenge.outcome.replace("_", " ") + ". No score, unlock or campaign reward.")
	if f.origin == "legacy": lines.append("Legacy continuation: earlier command history was not recorded.")
	lines.append("Rules: %s weather · %s reliability · %s rivals" % [c.ruleset.weather, c.ruleset.reliability, "contextual" if c.ruleset.rival_styles else "classic"])
	lines.append("Track %s · model %s · engine %s" % [f.track_hash.left(12), f.model, f.engine])
	return "\n".join(lines)
