extends SceneTree


## Headless companion for the production validator. No alternate Python acceptance rules.
func _initialize() -> void:
	call_deferred("run")


func run() -> void:
	var roots: Array = [ContentPackLoader.BUILTIN_ROOT]
	var action = "validate"
	var identity = ""
	var output = ""
	var steps = 1600
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--pack="):
			roots.append(argument.trim_prefix("--pack="))
		elif argument.begins_with("--action="):
			action = argument.trim_prefix("--action=")
		elif argument.begins_with("--id="):
			identity = argument.trim_prefix("--id=")
		elif argument.begins_with("--output="):
			output = argument.trim_prefix("--output=")
		elif argument.begins_with("--steps="):
			var value = argument.trim_prefix("--steps=")
			if not value.is_valid_int() or value.length() > 6:
				finish({"ok": false, "error": "Choose 1–20000 fixed steps."})
				return
			steps = int(value)
		else:
			finish({"ok": false, "error": "Unknown argument: " + argument})
			return
	if action == "schemas":
		var schemas: Dictionary = {}
		for kind in ["pack"] + ContentSchema.KINDS:
			schemas[kind] = ContentSchema.document(kind)
		finish({"ok": true, "schemas": schemas}, output)
		return
	if action not in ["validate", "inspect", "export", "test"]:
		finish({"ok": false, "error": "Choose validate, inspect, export, test or schemas."})
		return
	_execute(roots, action, identity, output, steps)


func finish(result: Dictionary, output: String = "") -> void:
	if not output.is_empty():
		var error = Storage.write_json(output, result)
		if not error.is_empty():
			result = {"ok": false, "error": error}
	print("CONTENT_RESULT ", JSON.stringify(result))
	quit(0 if result.ok else 1)


func _execute(roots: Array, action: String, identity: String, output: String, steps: int) -> void:
	var loaded = ContentPackLoader.new().load_packs(roots)
	if loaded.ok:
		loaded.kinds = ContentSchema.KINDS.duplicate()
		loaded.definitions = []
		for kind in ContentSchema.KINDS:
			for entry in loaded.catalog.entries(kind):
				loaded.definitions.append({"id": entry.id, "kind": kind, "name": entry.name})
		if action == "inspect":
			loaded.inspection = loaded.catalog.explain(identity)
			if loaded.inspection.definition.is_empty():
				loaded.ok = false
				loaded.diagnostics.append(
					ContentValidation.diagnostic(
						"CONTENT_NOT_FOUND", "/id", "Unknown definition: " + identity
					)
				)
		if action == "export":
			var records: Dictionary = {}
			var sources: Dictionary = {}
			for entry in loaded.definitions:
				records[entry.id] = loaded.catalog.record(entry.id)
				sources[entry.id] = loaded.catalog.explain(entry.id).source
			loaded.snapshot = {
				"kind": "motorsport-manager-resolved-content",
				"version": 1,
				"records": records,
				"provenance": sources
			}
		if action == "test":
			var tested = ContentScenarioTest.run(loaded.catalog, identity, steps)
			loaded.erase("catalog")
			loaded.merge(tested, true)
		else:
			loaded.erase("catalog")
	finish(loaded, output)
