class_name RivalScenarios
extends RefCounted


static func catalog() -> Array:
	return ScenarioCatalog.read("rivals")


## Disclosed preparation starts; no generated qualifying times, incidents or winners.
static func valid(recipe: Variant) -> bool:
	if not recipe is Dictionary or recipe.size() != 9:
		return false
	for key in ["id", "title", "track", "objective", "hint"]:
		if not recipe.get(key) is String or recipe[key].is_empty():
			return false
	if not RaceCheckpoint.integral(recipe.get("seed"), 0, 4294967295):
		return false
	if not RaceCheckpoint.integral(recipe.get("laps"), 4, 100):
		return false
	if (
		typeof(recipe.get("life")) not in [TYPE_FLOAT, TYPE_INT]
		or not is_finite(float(recipe.life))
		or recipe.life < 1
		or recipe.life > 100
	):
		return false
	if not recipe.get("grid") is Array or recipe.grid.size() != 12:
		return false
	var ids: Dictionary = {}
	for id in recipe.grid:
		if not RaceCheckpoint.integral(id, 0, 11) or ids.has(int(id)):
			return false
		ids[int(id)] = true
	return ids.size() == 12


static func build(recipe: Dictionary, library: Array) -> PracticeRaceSim:
	if not valid(recipe) or recipe not in catalog():
		return null
	for document in library:
		if document.id != recipe.track:
			continue
		var geometry = TrackGeometry.new(document, "Formula")
		if TrackDiagnostics.blocking(TrackDiagnostics.inspect(geometry)):
			return null
		var sim = PracticeRaceSim.new(
			geometry,
			{"laps": recipe.laps, "seed": recipe.seed, "scenario": "dry", "intensity": "calm"}
		)
		sim.practice_state.status = "skipped"
		for i in range(recipe.grid.size()):
			var c = sim.cars[recipe.grid[i]]
			c.grid = i + 1
			c.distance = -i * geometry.grid_spacing
			c.previous_distance = c.distance
			c.lane = (-1 if i % 2 == 0 else 1) * 2.0
			var fitted = TyreInventory.find(c, c.set_id)
			for wheel in fitted.wheels.values():
				wheel.life = recipe.life
			WheelTyres.publish(fitted)
			c.tyre = fitted.life
			c.temperature = fitted.temperature
			c.next_compound = fitted.compound
			c.next_set_id = fitted.id  # Explicit starting set survives the formation fit.
		sim.transition("race_preparation")
		for id in [3, 6]:
			sim.command("delegation", {"id": id, "channel": "pit", "owner": "player"})
		var disclosure = (
			(
				"Curated untimed grid; starts at preparation, skipping "
				+ "practice/qualifying. Every fitted M1 begins at %.0f%% tread; other "
				+ "driver-owned stock is unchanged. Dry, calm incidents, manual player "
				+ "pits. Physical formation/start approvals remain. No forced outcome."
			)
			% recipe.life
		)
		RaceJournal.append(
			sim.strategy_state,
			sim,
			"scenario",
			-1,
			{
				"id": recipe.id,
				"title": recipe.title,
				"objective": recipe.objective,
				"hint": recipe.hint,
				"track_hash": JSON.stringify(document).sha256_text(),
				"ruleset": "contextual-rivals-v1",
				"assists": disclosure
			}
		)
		sim.post("weekend", recipe.title + ": " + recipe.objective + " " + disclosure)
		return sim
	return null
