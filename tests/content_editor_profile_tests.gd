extends SceneTree
## Authoring presentation data can change without making pack data executable.
var checks = 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func source_record() -> Dictionary:
	var loaded = Storage.read_json("res://content/packs/core/editor_profiles/default.json")
	check(loaded.ok and loaded.data is Dictionary, "Core editor profile is a readable JSON object")
	return loaded.data if loaded.ok and loaded.data is Dictionary else {}

func sealed(record: Dictionary) -> Dictionary:
	var catalog = ContentCatalog.new()
	var shape = catalog.add(record, {"pack":"test","version":"1.0.0","root":"test","file":"editor.json"})
	if not shape.is_empty(): return {"catalog":catalog,"errors":shape}
	return {"catalog":catalog,"errors":catalog.seal()}

func run() -> void:
	var record = source_record()
	var profile = EditorProfileDefinition.from_record(record)
	check(profile != null, "Core editor profile satisfies schema and semantic validation")
	if profile != null:
		check(profile.placements().size() == 8, "Default profile retains the eight existing scenery choices")
		check(profile.guide_steps().size() == 5, "Default profile supplies all five established guide steps")
		check(profile.guide_steps().all(func(step): return step.keys().size() == 3 and not step.has("target") and not step.has("reveal")), "Authored guide data contains text and semantic keys only")
		var grandstand = profile.placements()[1].duplicate(true)
		grandstand.scale = 1.5; grandstand.rotation_deg = 90.0
		var object = EditorProfileDefinition.placement_object(grandstand, Vector2(12.5, -8.0))
		check(object == {"type":"grandstand","x":12.5,"y":-8.0,"h":0,"scale":1.5,"rotation":90.0}, "A preset creates only ordinary bounded TrackDocument scenery data")
		check(EditorProfileDefinition.placement_object({"object_type":"script","scale":1.0,"rotation_deg":0.0}, Vector2.ZERO).is_empty(), "Executable or unsupported object types cannot become placement data")

	var loaded = ContentPackLoader.new().load_packs(["res://content/packs/core"])
	check(loaded.ok, "Core pack compiles with the editor profile")
	if loaded.ok:
		var session = TrackEditorSession.new(TrackEditorSession.blank_document())
		session.content_catalog = loaded.catalog
		check(session.placement_choices().size() == 8 and session.placement_choices()[0].id == "tree", "Editor session reads placement choices from the validated catalog")
		check(session.guide_steps().map(func(step): return step.key) == EditorProfileDefinition.GUIDE_KEYS, "Editor session reads ordered guide copy from the validated catalog")
		check("preset" in session.placement_help().to_lower(), "Placement help is supplied by the editor profile")

	var legacy = TrackEditorSession.new(TrackEditorSession.blank_document())
	check(legacy.placement_choices().size() == 8 and legacy.guide_steps().size() == 5, "No-catalog direct editor API retains the legacy-safe presentation fallback")

	var override_catalog = ContentCatalog.new()
	var errors = override_catalog.add(record, {"pack":"core","version":"1.0.0","root":"core","file":"editor.json"})
	var changed = record.duplicate(true); changed.placements[0].scale = 1.6; changed.guide[0].title = "Shape your circuit"
	errors.append_array(override_catalog.add(changed, {"pack":"local","version":"1.0.0","root":"local","file":"editor.json"}, RaceStateValue.fingerprint(record)))
	errors.append_array(override_catalog.seal())
	check(errors.is_empty(), "An explicit hash-pinned whole-record override can customize authoring presentation")
	if errors.is_empty():
		var overridden = TrackEditorSession.new(TrackEditorSession.blank_document()); overridden.content_catalog = override_catalog
		check(is_equal_approx(overridden.placement_choices()[0].scale, 1.6) and overridden.guide_steps()[0].title == "Shape your circuit", "Editor consumes the resolved override without executable pack behavior")

	var bad = record.duplicate(true); bad.placements[1].id = bad.placements[0].id
	var candidate = sealed(bad)
	check(not candidate.errors.is_empty() and candidate.errors[0].code == "CONTENT_EDITOR_PROFILE", "Duplicate placement IDs reject the candidate catalog")
	bad = record.duplicate(true); bad.guide[1].key = bad.guide[0].key
	candidate = sealed(bad)
	check(not candidate.errors.is_empty() and candidate.errors[0].code == "CONTENT_EDITOR_PROFILE", "Missing/duplicate guide semantics reject the candidate catalog")
	bad = record.duplicate(true); bad.guide[0].script = "res://arbitrary.gd"
	check(EditorProfileDefinition.from_record(bad) == null, "Unknown executable-looking guide fields are rejected by the schema")
	bad = record.duplicate(true); bad.placements[0].object_type = "script"
	check(EditorProfileDefinition.from_record(bad) == null, "Unsupported placement renderer types are rejected by the schema")
	bad = record.duplicate(true); bad.id = "local.editor_profile.unused"
	candidate = sealed(bad)
	check(not candidate.errors.is_empty() and candidate.errors[0].code == "CONTENT_EDITOR_PROFILE", "Additional ambiguous editor profiles are rejected; customization uses the explicit hash-pinned default override")

	var result = {"passed":failures.is_empty(),"checks":checks,"failures":failures}
	Storage.write_json("res://reports/content-editor-profile-tests.json", result)
	print("CONTENT_EDITOR_PROFILE_TESTS ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)
