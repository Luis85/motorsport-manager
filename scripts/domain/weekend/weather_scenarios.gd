class_name WeatherScenarios
extends RefCounted
## Scenario premises set initial conditions and assists, never predetermined sporting outcomes.
static func catalog() -> Array:
	var result = Storage.read_json("res://data/scenarios/weather-strategy.json")
	if not result.ok or not result.data is Dictionary or result.data.get("version") != 1 or not result.data.get("scenarios") is Array: return []
	return result.data.scenarios

static func valid(recipe: Variant) -> bool:
	if not recipe is Dictionary: return false
	for key in ["id", "title", "track", "objective", "hint"]:
		if not recipe.get(key) is String or recipe[key].is_empty(): return false
	return RaceCheckpoint.integral(recipe.get("laps"), 4, 100) and RaceCheckpoint.integral(recipe.get("seed"), 0, 4294967295) and recipe.get("scenario") in ["dry", "wet", "changeable"] and recipe.get("weather_mode") in WeekendWeather.MODES and recipe.get("pit_owner") in ["player", "engineer"]

static func build(recipe: Dictionary, library: Array) -> WeatherRaceSim:
	if not valid(recipe): return null
	var document: Dictionary = {}
	for track in library:
		if track.id == recipe.track: document = track; break
	if document.is_empty(): return null
	var geometry = TrackGeometry.new(document, "Formula")
	if TrackDiagnostics.blocking(TrackDiagnostics.inspect(geometry)): return null
	var sim = WeatherRaceSim.new(geometry, {"laps": int(recipe.laps), "seed": int(recipe.seed), "scenario": recipe.scenario, "weather_mode": recipe.weather_mode, "intensity": "calm"})
	RaceJournal.append(sim.strategy_state, sim, "scenario", -1, {"id": recipe.id, "title": recipe.title, "objective": recipe.objective,
		"hint": recipe.hint, "track_hash": JSON.stringify(geometry.document).sha256_text(), "ruleset": "native-four-wheel-physical-pits-weather-v1",
		"assists": "Calm incidents; " + recipe.weather_mode + "; player pit owner: " + recipe.pit_owner + "; normal resources for every entrant; no forced outcome."})
	for id in [3, 6]:
		if not sim.command("delegation", {"id": id, "channel": "pit", "owner": recipe.pit_owner}): return null
	return sim
