class_name DuelScenarios
extends RefCounted
## Shipped, disclosed preparation grids. No fictional qualifying times or forced outcomes.
static func catalog() -> Array:
	var data = Storage.read_json("res://data/scenarios/strategic-duels.json")
	if not data.ok or not data.data is Dictionary or data.data.get("version") != 1 or not data.data.get("scenarios") is Array: return []
	return data.data.scenarios

static func build(recipe: Dictionary, library: Array) -> PracticeRaceSim:
	if recipe not in catalog(): return null
	for document in library:
		if document.id != recipe.track: continue
		var geometry = TrackGeometry.new(document, "Formula")
		if TrackDiagnostics.blocking(TrackDiagnostics.inspect(geometry)): return null
		var sim = PracticeRaceSim.new(geometry, {"laps": int(recipe.laps), "seed": int(recipe.seed), "scenario": "dry", "intensity": "calm", "tactical_duels": true})
		sim.practice_state.status = "skipped"
		for i in range(recipe.grid.size()):
			var c = sim.cars[int(recipe.grid[i])]
			c.grid = i + 1; c.distance = -i * geometry.grid_spacing; c.previous_distance = c.distance
			c.lane = (-1 if i % 2 == 0 else 1) * 2.0
			var fitted = TyreInventory.find(c, c.set_id)
			for wheel in fitted.wheels.values(): wheel.life = float(recipe.life)
			WheelTyres.publish(fitted); c.tyre = fitted.life; c.temperature = fitted.temperature
			c.next_compound = fitted.compound; c.next_set_id = fitted.id
		sim.transition("race_preparation")
		for id in [3, 6]: sim.command("delegation", {"id": id, "channel": "pit", "owner": "player"})
		var disclosure = "Untimed preparation grid; practice and qualifying explicitly skipped. All fitted M1 sets start at %.0f%% tread; other stock unchanged. Dry, calm incidents, manual player pits. Physical formation and lights require approval. No forced winner or rewards." % recipe.life
		RaceJournal.append(sim.strategy_state, sim, "scenario", -1, {"id": recipe.id, "title": recipe.title, "objective": recipe.objective, "hint": recipe.hint,
			"track_hash": RaceRecord.fingerprint(document), "ruleset": TacticalDuels.MODEL, "assists": disclosure})
		sim.post("weekend", recipe.title + ": " + recipe.objective + " " + disclosure)
		return sim
	return null
