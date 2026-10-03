class_name ScenarioCatalog
extends RefCounted
## Infrastructure adapter for shipped diagnostic scenario resources. Unknown names fail closed.
const MAX_SCENARIOS = 64
# Restrict trusted developer fixtures to known, inert parameters. These are not
# external-pack definitions and may not carry arbitrary executable fields.
const RECIPE_FIELDS = {
	"dry": ["id", "title", "track", "laps", "seed", "objective", "hint", "plans"],
	"weather":
	[
		"id",
		"title",
		"track",
		"laps",
		"seed",
		"scenario",
		"weather_mode",
		"pit_owner",
		"objective",
		"hint"
	],
	"recovery": ["id", "title", "track", "laps", "seed", "damage", "health", "objective", "hint"],
	"duels": ["id", "title", "track", "laps", "seed", "life", "grid", "objective", "hint"],
	"practice": ["id", "title", "track", "scenario", "seed", "objective", "hint"],
	"rivals": ["id", "title", "track", "seed", "laps", "life", "grid", "objective", "hint"],
}
const PATHS = {
	"dry": "res://config/scenarios/dry-strategy.json",
	"weather": "res://config/scenarios/weather-strategy.json",
	"recovery": "res://config/scenarios/recovery.json",
	"duels": "res://config/scenarios/strategic-duels.json",
	"practice": "res://config/scenarios/practice.json",
	"rivals": "res://config/scenarios/rivals.json",
}


static func collection(name: String) -> Dictionary:
	if not PATHS.has(name):
		return {}
	var result = Storage.read_json(PATHS[name])
	if not result.ok or not result.data is Dictionary:
		return {}
	return validate_collection(result.data, name)


static func read(name: String) -> Array:
	return collection(name).get("scenarios", []).duplicate(true)


static func validate_collection(data: Dictionary, family: String = "") -> Dictionary:
	if family != "" and not RECIPE_FIELDS.has(family):
		return {}
	if data.get("version") != 1 or not data.get("scenarios") is Array:
		return {}
	for key in data:
		if key not in ["version", "title", "description", "scenarios", "notice"]:
			return {}
	if data.scenarios.is_empty() or data.scenarios.size() > MAX_SCENARIOS:
		return {}
	for key in ["title", "description"]:
		if (
			not data.get(key) is String
			or data[key].strip_edges().is_empty()
			or data[key].length() > (100 if key == "title" else 1200)
		):
			return {}
	if data.has("notice") and (not data.notice is String or data.notice.length() > 1200):
		return {}
	return _recipes(data, family)


static func _valid_recipe(family: String, recipe: Dictionary) -> bool:
	var fields: Array = RECIPE_FIELDS[family]
	if recipe.size() != fields.size():
		return false
	for key in fields:
		if not recipe.has(key):
			return false
	match family:
		"dry":
			return _dry_recipe(recipe)
		"weather":
			return WeatherScenarios.valid(recipe)
		"recovery":
			return RecoveryScenarios.valid(recipe)
		"practice":
			return PracticeScenarios.valid(recipe)
		"rivals", "duels":
			return RivalScenarios.valid(recipe)
	return true


static func entries(data: Dictionary) -> Array:
	return validate_collection(data).get("scenarios", []).duplicate(true)


static func build_duel(recipe: Dictionary, library: Array) -> PracticeRaceSim:
	return DuelScenarios.build(recipe, library, read("duels"))


static func _recipes(data: Dictionary, family: String) -> Dictionary:
	var id_pattern = RegEx.new()
	id_pattern.compile("^[a-z][a-z0-9_-]*$")
	var seen: Dictionary = {}
	for recipe in data.scenarios:
		if not recipe is Dictionary:
			return {}
		for key in ["id", "title", "objective", "hint"]:
			if not recipe.get(key) is String or recipe[key].strip_edges().is_empty():
				return {}
		if (
			recipe.id.length() > 96
			or id_pattern.search(recipe.id) == null
			or recipe.title.length() > 100
			or recipe.objective.length() > 600
			or recipe.hint.length() > 800
		):
			return {}
		if seen.has(recipe.id):
			return {}
		seen[recipe.id] = true
		if family != "" and not _valid_recipe(family, recipe):
			return {}
	return data.duplicate(true)


static func _dry_recipe(recipe: Dictionary) -> bool:
	if not WeekendScenarios.valid(recipe):
		return false
	for plan in recipe.plans:
		var plan_fields = ["driver_id", "starting", "objective"]
		if plan.has("replacement"):
			plan_fields.append_array(["replacement", "first", "last"])
		if plan.size() != plan_fields.size():
			return false
		for key in plan_fields:
			if not plan.has(key):
				return false
		if plan.starting.is_empty() or (plan.has("replacement") and plan.replacement.is_empty()):
			return false
	return true
