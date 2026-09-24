class_name RecoveryScenarios
extends RefCounted
## Initial conditions are disclosed, not injected at a dramatic point during the race.
static func catalog() -> Array:
	var result = Storage.read_json("res://data/scenarios/recovery.json")
	if not result.ok or not result.data is Dictionary or result.data.get("version") != 1 or not result.data.get("scenarios") is Array: return []
	return result.data.scenarios

static func valid(recipe: Variant) -> bool:
	if not recipe is Dictionary: return false
	for key in ["id", "title", "track", "objective", "hint"]:
		if not recipe.get(key) is String or recipe[key].is_empty(): return false
	if not RaceCheckpoint.integral(recipe.get("laps"), 4, 100) or not RaceCheckpoint.integral(recipe.get("seed"), 0, 4294967295): return false
	for key in ["damage", "health"]:
		if not recipe.get(key) is Array or recipe[key].size() != 2: return false
		for value in recipe[key]:
			if not RaceCheckpoint.number(value, 0 if key == "damage" else 1, 100): return false
	return true

static func build(recipe: Dictionary, library: Array) -> RecoveryRaceSim:
	if not valid(recipe): return null
	var document: Dictionary = {}
	for track in library:
		if track.id == recipe.track: document = track; break
	if document.is_empty(): return null
	var geometry = TrackGeometry.new(document, "Formula")
	if TrackDiagnostics.blocking(TrackDiagnostics.inspect(geometry)): return null
	var sim = RecoveryRaceSim.new(geometry, {"laps": int(recipe.laps), "seed": int(recipe.seed), "scenario": "dry", "intensity": "calm"})
	RaceJournal.append(sim.strategy_state, sim, "scenario", -1, {"id": recipe.id, "title": recipe.title, "objective": recipe.objective, "hint": recipe.hint,
		"track_hash": JSON.stringify(geometry.document).sha256_text(), "ruleset": "scalar-recovery-virtual-v1", "assists": "Dry; calm incidents; disclosed unequal starting condition; manual player pits; no fabricated winner or free repair."})
	for i in range(2):
		var id = [3, 6][i]; var car = sim.cars[id]
		car.damage = recipe.damage[i]; car.health = recipe.health[i]; sim.observe_reliability(car)
		if not sim.command("delegation", {"id": id, "channel": "pit", "owner": "player"}): return null
	return sim
