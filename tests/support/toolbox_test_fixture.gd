extends SceneTree
## Shared native SDK harness; reference fixtures use the production launch boundary.
var checks: int = 0
var failures: Array[String] = []
var catalog: ContentCatalog


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		push_error(label)


func prepare() -> bool:
	var loaded = ContentPackLoader.new().load_packs(["res://content/packs/core"])
	check(loaded.ok, "SDK fixtures load the sealed production core catalog")
	if loaded.ok:
		catalog = loaded.catalog
	return loaded.ok


func configuration() -> Dictionary:
	return {
		"circuit_id": "core.circuit.hillside",
		"weekend_id": "core.weekend.quick",
		"overrides": {"laps": 2, "seed": 7314, "intensity": "calm", "qual_duration": 240.0}
	}


func reference_weekend(settings: Dictionary) -> Dictionary:
	var launch = WeekendLaunch.new(catalog)
	var circuit = catalog.circuit(settings.circuit_id)
	var staged = launch.stage_preset(settings.weekend_id, circuit.document(), settings.overrides)
	check(staged, "Reference stages the identical authored weekend: " + launch.last_error)
	if not staged:
		return {}
	var simulation = PracticeRaceSim.new(launch.visual_track(), launch.session_options())
	check(simulation.last_error.is_empty(), "Reference constructs the production staged simulation")
	var record = RaceRecord.new()
	record.attach(simulation)
	return {"simulation": simulation, "record": record}


func accepted(response: Dictionary, label: String) -> bool:
	check(response.get("ok", false), label + ": " + str(response.get("error", "")))
	if response.get("ok", false):
		check(RaceStateValue.serializable(response.result), label + " returns JSON values only")
	return response.get("ok", false)


func rejected(response: Dictionary, label: String, code: String = "") -> void:
	check(not response.get("ok", true), label + " is rejected")
	var error: Dictionary = response.get("error", {})
	check(
		not str(error.get("message", "")).is_empty() and error.get("details") is Dictionary,
		label + " carries structured owner feedback"
	)
	if not code.is_empty():
		check(error.get("code") == code, label + " uses the stable error code")


func same(actual: Variant, expected: Variant, label: String) -> void:
	check(
		RaceStateValue.fingerprint(actual) == RaceStateValue.fingerprint(expected),
		label + " preserves complete values including RNG, resources and journals"
	)


func json_round_trip(value: Variant) -> Variant:
	var parsed = ContentJson.parse(JSON.stringify(value, "", false, true), true)
	check(parsed.ok, "Production transport codec accepts the full-precision JSON value")
	return parsed.data if parsed.ok else null


func player_files(path: String = "user://") -> Dictionary:
	var result: Dictionary = {}
	var directory = DirAccess.open(path)
	if directory == null:
		return result
	for filename in directory.get_files():
		var file = path.path_join(filename)
		result[file] = FileAccess.get_sha256(file)
	for child in directory.get_directories():
		result.merge(player_files(path.path_join(child)))
	return result


func finish(name: String) -> void:
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/" + name + ".json", report)
	print(name.to_upper().replace("-", "_"), " ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
