class_name WeekendResult
extends RefCounted
## A factual, versioned boundary; no campaign finance, scoring or invented diagnosis.
static func build(record: RaceRecord) -> Dictionary:
	if record == null or record.source == null: return {}
	var sim = record.source.get_ref()
	if sim == null or sim.phase != "results" or not sim.cars.all(func(c): return c.finished or c.dnf): return {}
	var classification: Array = []
	for c in sim.standings():
		classification.append({"position": classification.size()+1, "driver_id": c.id, "team": EntrantReadModel.team_name(c, sim.roster_definition),
			"name": c.name, "laps": c.completed, "status": "finished" if c.finished else "retired",
			"finish_time": c.finish_time, "points_eligibility": "not_defined_by_standalone_rules"})
	var data = {"kind": "motorsport-manager-weekend-result", "version": 1, "event_id": record.event_id,
		"origin": record.origin, "parent": record.parent.duplicate(true), "engine": Engine.get_version_info().string,
		"checkpoint_version": int(record.initial.version), "model": RaceRecord.model_for(record.initial), "ruleset": RaceRecord.manifest_for(record.initial).ruleset, "track_hash": RaceRecord.fingerprint(sim.track.document),
		"roster_hash": RaceRecord.fingerprint(record.initial.cars.map(func(c): return {"id": c.id, "name": c.name, "team": c.team})),
		"classification": classification, "final": true, "achievements": [],
		"returned_resources": sim.cars.map(func(c): return {"driver_id": c.id, "health": c.health, "damage": c.damage, "tyres": c.tyre_sets.duplicate(true)}),
		"statistics": sim.stats.duplicate(true), "provenance": "Measured standalone classification and retained aggregate condition. No component diagnosis, championship points, money or XP inferred."}
	data.digest = RaceRecord.fingerprint(data)
	return data

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data): return "Result exceeds serialized-value limits."
	if not data is Dictionary or (not data.get("kind") is String or data.kind != "motorsport-manager-weekend-result") or not RaceCheckpoint.integral(data.get("version"), 1, 1): return "Unsupported result format."
	if not RaceRecord.valid_id(data.get("event_id")) or data.get("origin") not in ["standalone", "legacy", "sandbox"] or (not data.get("final") is bool or not data.final): return "Invalid result identity or completion."
	for key in ["track_hash", "roster_hash"]:
		if not data.get(key) is String or data[key].length() != 64 or not data[key].is_valid_hex_number(false): return "Invalid result manifest hash."
	if not RaceCheckpoint.integral(data.get("checkpoint_version"), 10, 11) or not data.get("model") is String or not data.get("engine") is String: return "Missing result model metadata."
	if not data.get("parent") is Dictionary or not data.get("ruleset") is Dictionary or not data.get("achievements") is Array or not data.achievements.is_empty(): return "Unsupported result provenance or achievements."
	if data.ruleset.has("vehicle_definition"):
		if not data.ruleset.vehicle_definition is Dictionary or VehicleDefinition.from_record(data.ruleset.vehicle_definition) == null: return "Invalid frozen vehicle definition."
	if data.checkpoint_version == 11:
		if data.model != TacticalDuels.MODEL or data.ruleset.get("checkpoint_schema") != 11 or not data.ruleset.get("tactical_duels") is bool or not data.ruleset.tactical_duels: return "Tactical result model and ruleset disagree."
	if data.origin == "sandbox" and not RaceRecord.valid_id(data.parent.get("event_id")): return "Missing sandbox lineage."
	if data.ruleset.has("setup_definition") and SetupDefinition.from_record(data.ruleset.setup_definition) == null: return "Invalid frozen setup profile."
	var tyres = RaceTyreRules.legacy()
	if data.ruleset.has("tyre_definition"):
		tyres = RaceTyreRules.from_snapshot(data.ruleset.tyre_definition)
		if tyres == null: return "Invalid frozen tyre allocation."
	var roster: RosterDefinition
	if data.ruleset.has("roster_definition"):
		roster = RosterDefinition.decode_snapshot(data.ruleset.roster_definition)
		if roster == null: return "Invalid frozen roster definition."
	var count = roster.count if roster != null else 12
	if not data.get("classification") is Array or data.classification.size() != count: return "Result must account for every entered car."
	if roster != null:
		var identities_for_hash: Array = []
		for id in range(count):
			var entry = roster.entrant(id).values()
			identities_for_hash.append({"id": id, "name": entry.name, "team": roster.entrant(id).team_id})
		if data.roster_hash != RaceRecord.fingerprint(identities_for_hash): return "Result roster hash disagrees with frozen entries."
	var identities = {}
	for index in range(count):
		var row = data.classification[index]
		if not row is Dictionary or not RaceCheckpoint.integral(row.get("driver_id"), 0, count - 1) or not RaceCheckpoint.integral(row.get("position"), index + 1, index + 1): return "Invalid classified identity or ordering."
		var id = int(row.driver_id)
		if identities.has(id): return "Duplicate classified entrant."
		identities[id] = true
		if row.get("status") not in ["finished", "retired"] or not RaceCheckpoint.integral(row.get("laps"), 0, 100): return "Invalid finishing status or distance."
		if not RaceCheckpoint.number(row.get("finish_time"), -1, 10000000) or (not row.get("points_eligibility") is String or row.points_eligibility != "not_defined_by_standalone_rules"): return "Invalid timing or invented points eligibility."
		if not row.get("name") is String or not row.get("team") is String: return "Missing entrant names."
		if roster != null:
			var entry = roster.entrant(id).values()
			if row.name != entry.name or row.team != entry.team: return "Classified identity disagrees with frozen roster."
	if not data.get("returned_resources") is Array or data.returned_resources.size() != count: return "Missing returned inventory."
	identities.clear()
	for row in data.returned_resources:
		if not row is Dictionary or not RaceCheckpoint.integral(row.get("driver_id"), 0, count - 1): return "Invalid inventory owner."
		var id = int(row.driver_id)
		if identities.has(id) or not RaceCheckpoint.number(row.get("health"), 0, 100) or not RaceCheckpoint.number(row.get("damage"), 0, 100): return "Duplicate inventory owner or invalid condition."
		identities[id] = true
		var expected = tyres.inventory_entries(id)
		if not row.get("tyres") is Array or row.tyres.size() != expected.size(): return "Missing finite tyre allocation."
		for index in range(expected.size()):
			var tyre = row.tyres[index]
			if not tyre is Dictionary: return "Invalid returned tyre record."
			for key in ["id", "label", "compound"]:
				if tyre.get(key) != expected[index][key]: return "Invalid returned tyre identity."
			if not TyreInventory.valid_set(tyre): return "Invalid returned wheel state."
	if not data.get("statistics") is Dictionary or data.statistics.size() != 4: return "Invalid statistics."
	for key in ["passes", "incidents", "pits", "blue_flags"]:
		if not RaceCheckpoint.integral(data.statistics.get(key), 0, 100000000): return "Invalid measured count."
	if not data.get("provenance") is String or data.provenance.length() > 1000: return "Missing evidence provenance."
	var content = data.duplicate(true); content.erase("digest")
	if (not data.get("digest") is String or data.digest != RaceRecord.fingerprint(content)): return "Result integrity check failed."
	return ""
