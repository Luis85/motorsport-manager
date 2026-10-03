class_name RaceRecordFormat
extends RefCounted
## Detached replay numeric codecs, static identity and manifest values.
const KIND = "motorsport-manager-replay"
const VERSION = 1
const MODEL = "race-weekend-0.12-v1"
const MAX_INPUTS = 4096
const MAX_MARKS = 4
const MAX_STEPS = 3000000
const CONTEXT_KEYS = ["selected_id", "paused", "speed", "accumulator"]


static func fingerprint(data: Variant) -> String:
	# Normalize JSON's number/key representation before computing an integrity digest.
	return RaceStateValue.fingerprint(data)


static func valid_id(value: Variant) -> bool:
	if not value is String or value.length() != 32:
		return false
	for character in value:
		if character not in "0123456789abcdef":
			return false
	return true


static func equivalent(a: Variant, b: Variant) -> bool:
	if a is Dictionary and b is Dictionary:
		if a.size() != b.size():
			return false
		for key in a:
			if not b.has(key) or not equivalent(a[key], b[key]):
				return false
		return true
	if a is Array and b is Array:
		if a.size() != b.size():
			return false
		for i in a.size():
			if not equivalent(a[i], b[i]):
				return false
		return true
	if (a is float or a is int) and (b is float or b is int):
		return absf(float(a) - float(b)) <= 0.00000001
	if typeof(a) != typeof(b):
		return false
	return a == b


static func sporting(snapshot: Dictionary) -> Dictionary:
	var result = snapshot.duplicate(true)
	# Only presentation/time-accumulator fields; all car, stream and journal state stays.
	for key in CONTEXT_KEYS:
		result.erase(key)
	return result


static func integer_paths(value: Variant, path: Array = []) -> Array:
	var result: Array = []
	_append_integer_paths(value, path.duplicate(), result)
	return result


static func _append_integer_paths(value: Variant, path: Array, result: Array) -> void:
	# One traversal stack; only retained integer paths receive their own copy.
	# Preserve insertion/index order and never modify the supplied prefix or value.
	if value is int:
		result.append(path.duplicate())
	elif value is Dictionary or value is Array:
		for key in value.keys() if value is Dictionary else range(value.size()):
			path.append(key)
			_append_integer_paths(value[key], path, result)
			path.pop_back()


static func valid_types(payload: Dictionary, paths: Variant) -> bool:
	if not paths is Array or paths.size() > 20000:
		return false
	for path in paths:
		if not path is Array or path.is_empty() or path.size() > 32:
			return false
		var node = payload
		for key in path:
			if node is Dictionary and (key is String or key is StringName) and node.has(key):
				node = node[key]
			elif node is Array and RaceCheckpoint.integral(key, 0, node.size() - 1):
				node = node[int(key)]
			else:
				return false
		if (
			not (node is int or node is float)
			or not is_finite(float(node))
			or float(node) != floor(float(node))
			or absf(float(node)) > 9007199254740991
		):
			return false
	return true


static func apply_types(value: Dictionary, paths: Array) -> Dictionary:
	var payload = value.duplicate(true)
	for path in paths:
		var node = payload
		for i in range(path.size() - 1):
			node = node[int(path[i]) if node is Array else path[i]]
		var key = int(path.back()) if node is Array else path.back()
		node[key] = int(node[key])
	return payload


static func typed_payload(entry: Dictionary) -> Dictionary:
	return apply_types(entry.payload, entry.integers)


static func manifest_for(snapshot: Dictionary) -> Dictionary:
	var rules = {
		"checkpoint_schema": int(snapshot.version),
		"weather": snapshot.weather_state.model.mode,
		"reliability": snapshot.reliability_state.mode,
		"rival_styles": snapshot.rival_styles.enabled,
		"race_control":
		(
			"virtual-neutralization-v1"
			if snapshot.reliability_state.mode == "staged"
			else "legacy-speed-cap"
		)
	}
	if int(snapshot.version) >= TacticalDuels.LEGACY_CHECKPOINT_VERSION:
		rules.tactical_duels = true
	for key in RaceContentSnapshot.RULE_KEYS:
		if snapshot.has(key):
			rules[key] = snapshot[key].duplicate(true)
	var scenarios: Array = []
	for entry in snapshot.strategy_state.records:
		if entry.kind == "scenario" and scenarios.size() < 3:
			scenarios.append(entry.evidence.duplicate(true))
	var starting_resources: Array = []
	var profiles = snapshot.get("performance_profiles", [])
	for index in range(snapshot.cars.size()):
		var car = snapshot.cars[index]
		var resource = {
			"id": car.id,
			"fuel": car.fuel,
			"health": car.health,
			"damage": car.damage,
			"tyres": car.tyre_sets
		}
		if int(snapshot.version) >= TacticalDuels.CHECKPOINT_VERSION:
			var profile = (
				profiles[index]
				if profiles is Array and profiles.size() == snapshot.cars.size()
				else RacePerformanceProfile.baseline()
			)
			resource["performance_profile"] = profile.duplicate(true)
		starting_resources.append(resource)
	return {
		"track_hash": fingerprint(snapshot.track),
		"roster_hash":
		fingerprint(
			snapshot.cars.map(func(c): return {"id": c.id, "name": c.name, "team": c.team})
		),
		"starting_resources_hash": fingerprint(starting_resources),
		"ruleset": rules,
		"vehicle": snapshot.vehicle,
		"seed": snapshot.seed_value,
		"laps": snapshot.laps,
		"weather": snapshot.scenario,
		"incident_exposure": snapshot.intensity,
		"initial_phase": snapshot.phase,
		"briefing":
		(
			"Recorded initial resources and applied settings; no forced result. "
			+ "Changing a decision changes exposure and rival responses."
		),
		"scenarios": scenarios,
		"objectives": scenarios.map(func(s): return s.objective),
		"assists":
		"Recorded per-driver ownership and intents; presentation settings are not sporting rules."
	}


static func static_identity(snapshot: Dictionary) -> Dictionary:
	var manifest = manifest_for(snapshot)
	var result = {}
	for key in [
		"track_hash",
		"roster_hash",
		"vehicle",
		"seed",
		"laps",
		"weather",
		"incident_exposure",
		"ruleset"
	]:
		result[key] = manifest.get(key)
	return result


static func model_for(snapshot: Dictionary) -> String:
	var version = int(snapshot.get("version", 0))
	if version == TacticalDuels.CHECKPOINT_VERSION:
		return TacticalDuels.MODEL
	if version == TacticalDuels.LEGACY_CHECKPOINT_VERSION:
		return TacticalDuels.LEGACY_MODEL
	return MODEL


static func model_supported(data: Dictionary) -> bool:
	return data.get("initial") is Dictionary and data.get("model") == model_for(data.initial)
