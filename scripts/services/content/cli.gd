extends SceneTree
## Headless companion for the production validator. No alternate Python acceptance rules.
func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var roots: Array = ["res://content/packs/core"]
	var action = "validate"
	var identity = ""
	var output = ""
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--pack="): roots.append(argument.trim_prefix("--pack="))
		elif argument.begins_with("--action="): action = argument.trim_prefix("--action=")
		elif argument.begins_with("--id="): identity = argument.trim_prefix("--id=")
		elif argument.begins_with("--output="): output = argument.trim_prefix("--output=")
		else:
			finish({"ok": false, "error": "Unknown argument: " + argument})
			return
	if action == "schemas":
		var schemas: Dictionary = {}
		for kind in ["pack"] + ContentSchema.KINDS:
			schemas[kind] = ContentSchema.document(kind)
		finish({"ok": true, "schemas": schemas}, output)
		return
	if action not in ["validate", "inspect"]:
		finish({"ok": false, "error": "Choose validate, inspect or schemas."})
		return
	var loaded = ContentPackLoader.new().load_packs(roots)
	if loaded.ok:
		if action == "inspect":
			loaded.inspection = loaded.catalog.explain(identity)
			if loaded.inspection.definition.is_empty():
				loaded.ok = false
				loaded.diagnostics.append(ContentValidation.diagnostic("CONTENT_NOT_FOUND", "/id", "Unknown definition: " + identity))
		loaded.erase("catalog")
	finish(loaded, output)

func finish(result: Dictionary, output: String = "") -> void:
	if not output.is_empty():
		var error = Storage.write_json(output, result)
		if not error.is_empty(): result = {"ok": false, "error": error}
	print("CONTENT_RESULT ", JSON.stringify(result))
	quit(0 if result.ok else 1)
