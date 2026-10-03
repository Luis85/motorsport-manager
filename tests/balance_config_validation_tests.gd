extends SceneTree
## Complete config authoring acceptance, exercised only in the runner's private source copy.
const ROOT = ContentPackLoader.BUILTIN_ROOT
var checks = 0
var failures: Array[String] = []


func _initialize() -> void:
	call_deferred("run")


func check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures.append(message)
		print("BALANCE_CONFIG_FAILURE ", message)


func run() -> void:
	var result = BalanceConfigValidation.run()
	check(result.ok and result.config_validated, "Complete default config validates")
	check(result.get("config_files", 0) >= 54, "Validation accounts for every shipped JSON family")
	var isolated = OS.get_environment("MOTORSPORT_VERIFY_ROOT")
	var project = ProjectSettings.globalize_path("res://")
	if isolated.is_empty() or not project.begins_with(isolated.path_join("project") + "/"):
		check(false, "Resource mutation tests require the verification runner's private project")
	else:
		mutations()
		result = BalanceConfigValidation.run()
		check(result.ok and result.config_validated, "Restored exact source bytes validate again")
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/balance-config-validation-tests.json", report)
	print("BALANCE_CONFIG_VALIDATION_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)


func mutations() -> void:
	var circuit = Storage.read_json(ROOT + "/circuits/hillside.json").data
	var invalid = circuit.duplicate(true)
	invalid.nodes = []
	reject_value("circuits/hillside.json", invalid, "Invalid raw circuit is rejected")
	var catalog = Storage.read_json(ROOT + "/circuits/catalog.json").data
	invalid = catalog.duplicate(true)
	invalid["ignored"] = true
	reject_value("circuits/catalog.json", invalid, "Unknown raw catalog fields are rejected")
	invalid = catalog.duplicate(true)
	invalid.files.append(invalid.files[0])
	reject_value("circuits/catalog.json", invalid, "Duplicate raw circuit paths are rejected")
	var scenario = Storage.read_json(ROOT + "/scenarios/practice.json").data
	invalid = scenario.duplicate(true)
	invalid.scenarios[0]["callback"] = "res://untrusted.gd"
	reject_value("scenarios/practice.json", invalid, "Malformed diagnostic collection is rejected")
	invalid = scenario.duplicate(true)
	invalid.scenarios[0].track = "missing-circuit"
	reject_value("scenarios/practice.json", invalid, "Diagnostic track references must resolve")
	var path = ROOT + "/scenarios/practice.json"
	var bytes = FileAccess.get_file_as_bytes(path)
	write_bytes(path, '{"version":1,"version":1}'.to_utf8_buffer())
	rejected(BalanceConfigValidation.run(), "Strict duplicate-key diagnostic JSON is rejected")
	write_bytes(path, bytes)
	var moved = path + ".validation-hidden"
	check(DirAccess.rename_absolute(path, moved) == OK, "Temporarily hide one required collection")
	rejected(BalanceConfigValidation.run(), "Missing required diagnostic collection is rejected")
	check(DirAccess.rename_absolute(moved, path) == OK, "Restore the missing collection")
	var extra = ROOT + "/unlisted.json"
	write_bytes(extra, "{}".to_utf8_buffer())
	rejected(BalanceConfigValidation.run(), "Unlisted config JSON cannot be silently ignored")
	DirAccess.remove_absolute(extra)
	extra = ROOT + "/.unlisted.json"
	write_bytes(extra, "{}".to_utf8_buffer())
	rejected(BalanceConfigValidation.run(), "Hidden unlisted JSON cannot be silently ignored")
	DirAccess.remove_absolute(extra)
	var collision = ROOT + "/scenarios/PRACTICE.json"
	write_bytes(collision, bytes)
	rejected(BalanceConfigValidation.run(), "Case-colliding JSON paths are rejected")
	DirAccess.remove_absolute(collision)
	links()


func links() -> void:
	var directory = DirAccess.open(ROOT)
	var linked = ProjectSettings.globalize_path(ROOT + "/linked.json")
	var target = ProjectSettings.globalize_path(ROOT + "/scenarios/practice.json")
	var error = directory.create_link(target, linked)
	check(error == OK, "Create an unlisted linked JSON fixture")
	if error == OK:
		rejected(BalanceConfigValidation.run(), "Unlisted symbolic links are rejected")
		DirAccess.remove_absolute(linked)


func reject_value(relative: String, value: Dictionary, message: String) -> void:
	var path = ROOT.path_join(relative)
	var before = FileAccess.get_file_as_bytes(path)
	write_bytes(path, JSON.stringify(value, "", false, true).to_utf8_buffer())
	rejected(BalanceConfigValidation.run(), message)
	write_bytes(path, before)
	check(
		FileAccess.get_file_as_bytes(path) == before, "Mutation restores exact bytes: " + relative
	)


func rejected(result: Dictionary, message: String) -> void:
	check(not result.ok and result.config_validated == false, message)
	check(not result.get("diagnostics", []).is_empty(), "Rejected config provides diagnostics")


func write_bytes(path: String, bytes: PackedByteArray) -> void:
	var file = FileAccess.open(path, FileAccess.WRITE)
	check(file != null, "Open bounded config mutation fixture")
	if file != null:
		file.store_buffer(bytes)
		file.close()
