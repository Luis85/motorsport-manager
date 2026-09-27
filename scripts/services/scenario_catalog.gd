class_name ScenarioCatalog
extends RefCounted
## Infrastructure adapter for shipped scenario resources. Unknown names fail closed.
const PATHS = {
	"dry": "res://data/scenarios/dry-strategy.json",
	"weather": "res://data/scenarios/weather-strategy.json",
	"recovery": "res://data/scenarios/recovery.json",
	"duels": "res://data/scenarios/strategic-duels.json",
}

static func read(name: String) -> Array:
	if not PATHS.has(name):
		return []
	var result = Storage.read_json(PATHS[name])
	if not result.ok or not result.data is Dictionary:
		return []
	return entries(result.data)

static func entries(data: Dictionary) -> Array:
	if data.get("version") != 1 or not data.get("scenarios") is Array:
		return []
	return data.scenarios.duplicate(true)

static func build_duel(recipe: Dictionary, library: Array) -> PracticeRaceSim:
	return DuelScenarios.build(recipe, library, read("duels"))
