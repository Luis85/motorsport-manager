extends SceneTree
## Adversarial folder inputs and catalog replacement, through the production adapter.
const ROOT = "user://content-pack-test"
var checks = 0
var failures: Array = []
var manifest: Dictionary
var definition: Dictionary


func _initialize() -> void:
	call_deferred("run")


func check(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures.append(label)


func reset() -> void:
	manifest = {
		"kind": "motorsport-manager-content-pack",
		"schema_version": 1,
		"id": "test.pack",
		"version": "1",
		"runtime_contract": 1,
		"dependencies": [{"id": "core", "version": "1.0.0"}],
		"files": ["vehicle.json"],
		"overrides": []
	}
	definition = VehicleDefinition.legacy("GT").to_record()
	definition.id = "test.pack.vehicle.gt"
	Storage.write_json(ROOT + "/pack.json", manifest)
	Storage.write_json(ROOT + "/vehicle.json", definition)


func load_pack() -> Dictionary:
	return ContentPackLoader.new().load_packs(["res://config", ROOT])


func invalid(code: String, label: String) -> void:
	var result = load_pack()
	check(
		not result.ok and result.diagnostics[0].code == code,
		label + ": " + JSON.stringify(result.get("diagnostics", []))
	)


func run() -> void:
	var app = root.get_node("App")
	reset()
	check(load_pack().ok, "Folder pack accepted")
	for field in ["schema_version", "runtime_contract"]:
		manifest[field] = 2
		Storage.write_json(ROOT + "/pack.json", manifest)
		var preserved = FileAccess.get_file_as_bytes(ROOT + "/pack.json")
		invalid("CONTENT_FUTURE_VERSION", "Newer " + field + " requires a compatible runtime")
		check(
			FileAccess.get_file_as_bytes(ROOT + "/pack.json") == preserved,
			"Version rejection never edits the source"
		)
		manifest[field] = 0
		Storage.write_json(ROOT + "/pack.json", manifest)
		invalid("CONTENT_MIGRATION_REQUIRED", "No invented converter for older " + field)
		reset()
	definition.schema_version = 2
	Storage.write_json(ROOT + "/vehicle.json", definition)
	invalid("CONTENT_FUTURE_VERSION", "Newer definition version is diagnosed before activation")
	reset()
	manifest.dependencies.append(manifest.dependencies[0].duplicate())
	Storage.write_json(ROOT + "/pack.json", manifest)
	invalid("CONTENT_DEPENDENCY", "Duplicate dependencies rejected")
	reset()
	manifest.dependencies.append({"id": manifest.id, "version": manifest.version})
	Storage.write_json(ROOT + "/pack.json", manifest)
	invalid("CONTENT_DEPENDENCY", "Self dependency rejected")
	reset()
	var original: ContentCatalog = app.content_catalog
	check(app.reload_content([ROOT]), "Application swaps complete validated catalog")
	var valid: ContentCatalog = app.content_catalog
	check(
		valid != original and valid.vehicle(definition.id) != null, "New catalog has new definition"
	)
	definition.top_speed_mps = -1
	Storage.write_json(ROOT + "/vehicle.json", definition)
	invalid("CONTENT_RANGE", "Invalid tuning")
	check(
		not app.reload_content([ROOT]) and app.content_catalog == valid,
		"Failed reload preserves last valid catalog"
	)
	check(
		valid.vehicle("test.pack.vehicle.gt").top_speed_mps == 76,
		"Failed file edit cannot alter existing definitions"
	)
	reset()
	for path in [
		"../outside.json",
		"/outside.json",
		"file.txt",
		"nested/../vehicle.json",
		"a\\b.json",
		"a//b.json",
		"res://other.json"
	]:
		manifest.files = [path]
		Storage.write_json(ROOT + "/pack.json", manifest)
		invalid("CONTENT_PATH", "Unsafe path " + path)
	reset()
	manifest.files = ["vehicle.json", "VEHICLE.json"]
	Storage.write_json(ROOT + "/pack.json", manifest)
	invalid("CONTENT_DUPLICATE_FILE", "Case-colliding manifest paths")
	reset()
	manifest.files.append("second.json")
	Storage.write_json(ROOT + "/second.json", definition)
	Storage.write_json(ROOT + "/pack.json", manifest)
	invalid("CONTENT_DUPLICATE_ID", "Same ID in different files")
	reset()
	manifest.dependencies[0].version = "not-installed"
	Storage.write_json(ROOT + "/pack.json", manifest)
	invalid("CONTENT_DEPENDENCY", "Version mismatch")
	reset()
	definition.id = "core.vehicle.gt"
	Storage.write_json(ROOT + "/vehicle.json", definition)
	invalid("CONTENT_NAMESPACE", "Implicit overrides forbidden")
	manifest.overrides = [{"id": definition.id, "expected_sha256": "0".repeat(64)}]
	Storage.write_json(ROOT + "/pack.json", manifest)
	invalid("CONTENT_OVERRIDE", "Wrong prior hash")
	manifest.overrides[0].expected_sha256 = original.explain(definition.id).source.sha256
	Storage.write_json(ROOT + "/pack.json", manifest)
	var overridden = load_pack()
	check(overridden.ok, "Pinned whole-record override accepted")
	if overridden.ok:
		check(
			overridden.catalog.explain(definition.id).source.previous.pack == "core",
			"Override provenance retains prior owner"
		)
	reset()
	var absolute = ProjectSettings.globalize_path(ROOT)
	var directory = DirAccess.open(ROOT)
	var link = absolute.path_join("linked.json")
	if FileAccess.file_exists(link):
		DirAccess.remove_absolute(link)
	var linked = directory.create_link(absolute.path_join("vehicle.json"), link)
	check(linked == OK, "Create test symlink")
	if linked == OK:
		manifest.files = ["linked.json"]
		Storage.write_json(ROOT + "/pack.json", manifest)
		invalid("CONTENT_LINK", "Symlinked content refused")
		DirAccess.remove_absolute(link)
	reset()
	var file = FileAccess.open(ROOT + "/vehicle.json", FileAccess.WRITE)
	file.store_buffer(PackedByteArray([0x7b, 0xff, 0x7d]))
	file.close()
	invalid("CONTENT_ENCODING", "Invalid UTF-8 is diagnostic, not an engine error")
	for bytes in [[0xc0, 0x80], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xc2], [0x80]]:
		check(
			not ContentJson.valid_utf8(PackedByteArray(bytes)),
			"Invalid UTF-8 boundary " + str(bytes)
		)
	check(
		ContentJson.valid_utf8("München 🏁".to_utf8_buffer()), "Valid UTF-8 including non-BMP text"
	)
	reset()
	file = FileAccess.open(ROOT + "/vehicle.json", FileAccess.WRITE)
	file.store_string(" ".repeat(ContentPackLoader.MAX_FILE_BYTES + 1))
	file.close()
	invalid("CONTENT_LIMIT", "Oversized file refused before parsing")
	reset()
	file = FileAccess.open(ROOT + "/vehicle.json", FileAccess.WRITE)
	file.store_string('{"kind":"vehicle","kind":"vehicle"}')
	file.close()
	invalid("CONTENT_JSON", "Duplicate JSON key refused")
	check(app.reload_content([]), "Recover after a failed reload")
	var result = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/content-pack-tests.json", result)
	print("CONTENT_PACK_TESTS ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)
