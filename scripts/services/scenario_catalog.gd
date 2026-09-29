class_name ScenarioCatalog
extends RefCounted
## Infrastructure adapter for shipped diagnostic scenario resources. Unknown names fail closed.
const MAX_SCENARIOS = 64
const PATHS = {
	"dry": "res://data/scenarios/dry-strategy.json",
	"weather": "res://data/scenarios/weather-strategy.json",
	"recovery": "res://data/scenarios/recovery.json",
	"duels": "res://data/scenarios/strategic-duels.json",
	"practice": "res://data/scenarios/practice.json",
	"rivals": "res://data/scenarios/rivals.json",
}

static func collection(name: String) -> Dictionary:
	if not PATHS.has(name):
		return {}
	var result = Storage.read_json(PATHS[name])
	if not result.ok or not result.data is Dictionary:
		return {}
	return validate_collection(result.data)

static func read(name: String) -> Array:
	return collection(name).get("scenarios", []).duplicate(true)

static func validate_collection(data: Dictionary) -> Dictionary:
	if data.get("version") != 1 or not data.get("scenarios") is Array:
		return {}
	if data.scenarios.is_empty() or data.scenarios.size() > MAX_SCENARIOS:
		return {}
	for key in ["title", "description"]:
		if data.has(key) and (not data[key] is String or data[key].strip_edges().is_empty() or data[key].length() > (100 if key == "title" else 1200)):
			return {}
	var seen: Dictionary = {}
	for recipe in data.scenarios:
		if not recipe is Dictionary:
			return {}
		for key in ["id", "title", "objective", "hint"]:
			if not recipe.get(key) is String or recipe[key].strip_edges().is_empty():
				return {}
		if recipe.id.length() > 96 or recipe.title.length() > 100 or recipe.objective.length() > 600 or recipe.hint.length() > 800:
			return {}
		if seen.has(recipe.id):
			return {}
		seen[recipe.id] = true
	return data.duplicate(true)

static func entries(data: Dictionary) -> Array:
	return validate_collection(data).get("scenarios", []).duplicate(true)

static func build_duel(recipe: Dictionary, library: Array) -> PracticeRaceSim:
	return DuelScenarios.build(recipe, library, read("duels"))
