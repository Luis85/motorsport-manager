extends Node
## Application services and user data; the simulation never reads this singleton.
var library: Array = []
var load_errors: Array[String] = []
var settings = {"fullscreen": false, "vsync": true, "labels": true, "racing_line": false, "speed": 1}
var weekend: RaceSim
var checkpoint_path = "user://weekend.json"

func _ready() -> void:
	load_library()
	if FileAccess.file_exists("user://settings.json"):
		var result = Storage.read_json("user://settings.json")
		if result.ok and result.data is Dictionary:
			for key in settings:
				if result.data.has(key) and typeof(result.data[key]) == typeof(settings[key]): settings[key] = result.data[key]
			if result.data.get("speed", 1) in [1, 2, 4, 8, 16]: settings.speed = int(result.data.get("speed", 1))
	apply_settings()

func apply_settings() -> void:
	if DisplayServer.get_name() != "headless":
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN if settings.fullscreen else DisplayServer.WINDOW_MODE_WINDOWED)
		DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_ENABLED if settings.vsync else DisplayServer.VSYNC_DISABLED)

func save_settings() -> String:
	apply_settings()
	return Storage.write_json("user://settings.json", settings)

func load_library() -> void:
	library.clear(); load_errors.clear()
	var bundled = Storage.read_catalog()
	if bundled.ok and bundled.data is Array:
		for raw in bundled.data:
			var errors = TrackDocument.validate(raw)
			if errors.is_empty():
				var d = TrackDocument.normalize(raw); d.builtin = true; library.append(d)
			else: load_errors.append(str(raw.get("name", "Bundled circuit")) + ": " + "; ".join(errors))
	else: load_errors.append("Bundled circuit catalog is unavailable.")
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tracks"))
	var directory = DirAccess.open("user://tracks")
	if directory == null: load_errors.append("User track directory could not be opened."); return
	for name in directory.get_files():
		if not name.ends_with(".json"): continue
		var result = Storage.read_json("user://tracks/" + name)
		if not result.ok: load_errors.append(name + ": " + result.error); continue
		var errors = TrackDocument.validate(result.data)
		if not errors.is_empty(): load_errors.append(name + ": " + "; ".join(errors)); continue
		var d = TrackDocument.normalize(result.data); d.builtin = false; library.append(d)

func save_track(document: Dictionary) -> String:
	var errors = TrackDocument.validate(document)
	if not errors.is_empty(): return "\n".join(errors)
	var d = TrackDocument.normalize(document)
	if d.get("builtin", false) or not str(d.id).begins_with("custom-"):
		d.id = "custom-" + str(Time.get_unix_time_from_system()).replace(".", "-")
	d.builtin = false
	# Filename comes only from a constrained local identifier, never from an imported path.
	var safe = str(d.id).validate_filename().replace(".", "_").replace("/", "_").replace("\\", "_")
	var error = Storage.write_json("user://tracks/" + safe + ".json", d)
	if error.is_empty():
		document.id = d.id; document.builtin = false; load_library()
	return error

func save_weekend() -> String:
	if weekend == null: return "There is no weekend to save."
	return Storage.write_json(checkpoint_path, weekend.snapshot())

func load_weekend() -> String:
	var result = Storage.read_json(checkpoint_path)
	if not result.ok: return result.error
	if not result.data is Dictionary: return "Invalid checkpoint."
	var restored = RaceSim.restore(result.data)
	if restored == null: return "Checkpoint is invalid or incompatible. The current session was not replaced."
	weekend = restored
	weekend.paused = weekend.phase in RaceSim.ACTIVE
	return ""
