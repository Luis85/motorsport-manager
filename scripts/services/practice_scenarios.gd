class_name PracticeScenarios
extends RefCounted


static func catalog() -> Array:
	return ScenarioCatalog.read("practice")


static func valid(recipe: Variant) -> bool:
	if not recipe is Dictionary or recipe.size() != 7:
		return false
	for key in ["id", "title", "track", "objective", "hint"]:
		if not recipe.get(key) is String or recipe[key].is_empty():
			return false
	if recipe.scenario not in ["dry", "wet", "changeable"]:
		return false
	return RaceCheckpoint.integral(recipe.get("seed"), 0, 4294967295)


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
			{
				"laps": 12,
				"scenario": recipe.scenario,
				"seed": recipe.seed,
				"intensity": "calm",
				"rival_styles": false
			}
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
				"ruleset": "native-optional-practice-v1",
				"assists":
				(
					"Calm incidents for everyone; optional practice; normal finite "
					+ "allocation; no forced outcome."
				)
			}
		)
		return sim
	return null
