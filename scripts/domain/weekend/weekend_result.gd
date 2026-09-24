class_name WeekendResult
extends RefCounted
## A factual, versioned boundary; no campaign finance, scoring or invented diagnosis.
static func build(record: RaceRecord) -> Dictionary:
	if record == null or record.source == null: return {}
	var sim = record.source.get_ref()
	if sim == null or sim.phase != "results" or not sim.cars.all(func(c): return c.finished or c.dnf): return {}
	var classification: Array = []
	for c in sim.standings():
		classification.append({"position": classification.size()+1, "driver_id": c.id, "team": c.team,
			"name": c.name, "laps": c.completed, "status": "finished" if c.finished else "retired",
			"finish_time": c.finish_time, "points_eligibility": "not_defined_by_standalone_rules"})
	var data = {"kind": "motorsport-manager-weekend-result", "version": 1, "event_id": record.event_id,
		"origin": record.origin, "parent": record.parent.duplicate(true), "engine": Engine.get_version_info().string,
		"checkpoint_version": 10, "model": RaceRecord.MODEL, "ruleset": RaceRecord.manifest_for(record.initial).ruleset, "track_hash": RaceRecord.fingerprint(sim.track.document),
		"roster_hash": RaceRecord.fingerprint(record.initial.cars.map(func(c): return {"id": c.id, "name": c.name, "team": c.team})),
		"classification": classification, "final": true, "achievements": [],
		"returned_resources": sim.cars.map(func(c): return {"driver_id": c.id, "health": c.health, "damage": c.damage, "tyres": c.tyre_sets.duplicate(true)}),
		"statistics": sim.stats.duplicate(true), "provenance": "Measured standalone classification and retained aggregate condition. No component diagnosis, championship points, money or XP inferred."}
	data.digest = RaceRecord.fingerprint(data)
	return data
