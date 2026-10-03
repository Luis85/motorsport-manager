extends "res://scripts/services/session_lifecycle.gd"
const PITWALL_LAYOUTS = ["minimal", "director", "engineering"]
const ADVANCED_PITWALL_LAYOUTS = ["director", "engineering"]
var content_catalog: ContentCatalog
var content_diagnostics: Array = []
var content_roots: Array = []
## Application services and user data; the simulation never reads this singleton.
var library: Array = []
var load_errors: Array[String] = []
var settings = {
	"fullscreen": false,
	"vsync": true,
	"labels": true,
	"racing_line": false,
	"speed": 1,
	"scenery_detail": "rich",
	"reduced_motion": false,
	"dot_scale": 1.0,
	"guides": {},
	"pitwall_text_scale": 1.0,
	"pitwall_layout": "minimal",
	"advanced_pitwall_layout": "director",
	"campaign_guide_hidden": false
}
var weekend: RaceSim
var recording: RaceRecord
var campaign_path = "user://campaign.json"
var campaign_checkpoint: Dictionary = {}

# The application owns scheduling; scene visibility is not a simulation input.


func _ready() -> void:
	if FileAccess.file_exists("user://settings.json"):
		var result = Storage.read_json("user://settings.json")
		if result.ok and result.data is Dictionary:
			restore_settings(result.data)
	if settings.get("content_roots") is Array:
		content_roots = settings.content_roots.duplicate()
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--content-pack="):
			content_roots.append(arg.trim_prefix("--content-pack="))
	reload_content(content_roots)
	if "--content-validate" in OS.get_cmdline_user_args():
		print(
			"CONTENT_RESULT ",
			JSON.stringify(
				{"ok": content_diagnostics.is_empty(), "diagnostics": content_diagnostics}
			)
		)
		get_tree().quit(0 if content_diagnostics.is_empty() else 1)
		return
	if _run_content_probe():
		return
	# Explicit launch overrides remain useful for development and automated suites.
	for arg in OS.get_cmdline_user_args():
		if not arg.begins_with("--pitwall-layout="):
			continue
		var requested = arg.get_slice("=", 1)
		if requested == "advanced":
			requested = "director"
		if requested in PITWALL_LAYOUTS:
			settings.pitwall_layout = requested
			if requested in ADVANCED_PITWALL_LAYOUTS:
				settings.advanced_pitwall_layout = requested
	apply_settings()


func restore_settings(data: Dictionary) -> void:
	# Minimal remains the safe default. The preferred Advanced start is persisted
	# independently so a temporary return to Minimal does not erase it.
	settings.pitwall_layout = "minimal"
	settings.advanced_pitwall_layout = "director"
	var advanced_layout = str(data.get("advanced_pitwall_layout", "director"))
	if advanced_layout in ADVANCED_PITWALL_LAYOUTS:
		settings.advanced_pitwall_layout = advanced_layout
	var layout = str(data.get("pitwall_layout", "minimal"))
	if layout == "advanced":
		layout = "director"
	if layout in PITWALL_LAYOUTS:
		settings.pitwall_layout = layout
		if layout in ADVANCED_PITWALL_LAYOUTS:
			settings.advanced_pitwall_layout = layout
	_restore_preferences(data)


func apply_settings() -> void:
	if DisplayServer.get_name() != "headless":
		DisplayServer.window_set_mode(
			(
				DisplayServer.WINDOW_MODE_FULLSCREEN
				if settings.fullscreen
				else DisplayServer.WINDOW_MODE_WINDOWED
			)
		)
		DisplayServer.window_set_vsync_mode(
			DisplayServer.VSYNC_ENABLED if settings.vsync else DisplayServer.VSYNC_DISABLED
		)


func save_settings() -> String:
	apply_settings()
	return Storage.write_json("user://settings.json", settings)


func load_library() -> void:
	library.clear()
	load_errors.clear()
	var bundled = (
		{"ok": true, "data": content_catalog.circuit_documents()}
		if content_catalog != null
		else Storage.read_catalog()
	)
	if bundled.ok and bundled.data is Array:
		for raw in bundled.data:
			var errors = TrackDocument.validate(raw)
			if errors.is_empty():
				var d = TrackDocument.normalize(raw)
				d.builtin = true
				library.append(d)
			else:
				load_errors.append(
					str(raw.get("name", "Bundled circuit")) + ": " + "; ".join(errors)
				)
	else:
		load_errors.append("Bundled circuit catalog is unavailable.")
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tracks"))
	var directory = DirAccess.open("user://tracks")
	if directory == null:
		load_errors.append("User track directory could not be opened.")
		return
	for name in directory.get_files():
		if not name.ends_with(".json"):
			continue
		var result = Storage.read_json("user://tracks/" + name)
		if not result.ok:
			load_errors.append(name + ": " + result.error)
			continue
		var errors = TrackDocument.validate(result.data)
		if not errors.is_empty():
			load_errors.append(name + ": " + "; ".join(errors))
			continue
		var d = TrackDocument.normalize(result.data)
		d.builtin = false
		library.append(d)


func save_track(document: Dictionary) -> String:
	var errors = TrackDocument.validate(document)
	if not errors.is_empty():
		return "\n".join(errors)
	var d = TrackDocument.normalize(document)
	if d.get("builtin", false) or not str(d.id).begins_with("custom-"):
		d.id = "custom-" + str(Time.get_unix_time_from_system()).replace(".", "-")
	d.builtin = false
	# Filename comes only from a constrained local identifier, never from an imported path.
	var safe = str(d.id).validate_filename().replace(".", "_").replace("/", "_").replace("\\", "_")
	var error = Storage.write_json("user://tracks/" + safe + ".json", d)
	if error.is_empty():
		document.id = d.id
		document.builtin = false
		load_library()
	return error


func ensure_recording() -> RaceRecord:
	if not (weekend is RaceSim and weekend.has_mechanic("practice")):
		return null
	if recording == null or recording.source == null or recording.source.get_ref() != weekend:
		recording = RaceRecord.new()
		recording.attach(weekend)
	return recording


func save_weekend() -> String:
	if weekend == null:
		return "There is no weekend to save."
	if weekend is RaceSim and weekend.has_mechanic("practice"):
		return ReplayStorage.save_session(checkpoint_path, ensure_recording())
	return Storage.write_json(checkpoint_path, weekend.snapshot())


func load_weekend() -> String:
	var result = Storage.read_json(checkpoint_path)
	if not result.ok:
		return result.error
	if not result.data is Dictionary:
		return "Invalid checkpoint."
	if result.data.get("kind") == ReplayStorage.SESSION_KIND:
		var loaded = ReplayStorage.restore_session(result.data)
		if not loaded.ok:
			return loaded.error
		stop_session()
		weekend = loaded.sim
		recording = loaded.record
	else:
		var restored = PracticeRaceSim.restore_practice(result.data)
		if restored == null:
			return "Checkpoint is invalid or incompatible. The current session was not replaced."
		stop_session()
		weekend = restored
		recording = RaceRecord.new()
		recording.attach(restored, "legacy")
	# Existing explicit Continue behavior; recorded inputs retain subsequent context.
	weekend.paused = weekend.phase in RaceSim.ACTIVE
	return ""


func has_saved_weekend() -> bool:
	return FileAccess.file_exists(checkpoint_path)


func requires_entry_confirmation() -> bool:
	# A disk-only continuation is still the player's weekend, even before Continue.
	return has_saved_weekend() or (weekend != null and weekend.phase != "briefing")


func commit_weekend_entry(draft: WeekendLaunch, expected_revision: int) -> String:
	var result = draft.commit(
		expected_revision, LocalWeekendEntryStore.new(checkpoint_path), int(settings.speed)
	)
	if not result.ok:
		return result.error
	# The previous session remains installed until persistence succeeds.
	stop_session()
	weekend = result.simulation
	recording = result.record
	return ""


func has_saved_sandbox() -> bool:
	return FileAccess.file_exists(sandbox_path)


func has_saved_campaign() -> bool:
	return FileAccess.file_exists(campaign_path)


func save_campaign() -> String:
	if campaign_checkpoint.is_empty():
		return "There is no campaign to save."
	return CampaignStorage.new(campaign_path).save_checkpoint(campaign_checkpoint)


func load_campaign() -> String:
	var loaded = CampaignStorage.new(campaign_path).load()
	if not loaded.get("ok", false):
		return loaded.get("error", "Campaign could not be loaded.")
	campaign_checkpoint = loaded.checkpoint.duplicate(true)
	return ""


func clear_weekend_checkpoint() -> void:
	stop_session()
	weekend = null
	recording = null
	var absolute = ProjectSettings.globalize_path(checkpoint_path)
	if FileAccess.file_exists(checkpoint_path):
		DirAccess.remove_absolute(absolute)


func reload_content(roots: Array) -> bool:
	var result = ContentPackLoader.new().load_packs(["res://content/packs/core"] + roots)
	content_diagnostics = result.diagnostics
	if not result.ok:
		return false
	content_catalog = result.catalog
	content_roots = roots.duplicate()
	load_library()
	return true


func content_warnings() -> String:
	var messages: Array[String] = []
	for diagnostic in content_diagnostics:
		messages.append(
			(
				"%s %s%s: %s"
				% [
					diagnostic.code,
					diagnostic.get("file", ""),
					diagnostic.field,
					diagnostic.message
				]
			)
		)
	return "\n".join(messages)


func _restore_preferences(data: Dictionary) -> void:
	if data.get("content_roots") is Array and data.content_roots.size() <= 31:
		if data.content_roots.all(func(path): return path is String and path.length() <= 1024):
			settings.content_roots = data.content_roots.duplicate()
	if data.get("pitwall_text_scale") in [1.0, 1.15, 1.3]:
		settings.pitwall_text_scale = float(data.pitwall_text_scale)
	for key in ["fullscreen", "vsync", "labels", "racing_line", "reduced_motion"]:
		if data.get(key) is bool:
			settings[key] = data[key]
	if data.get("campaign_guide_hidden") is bool:
		settings.campaign_guide_hidden = data.campaign_guide_hidden
	if data.get("scenery_detail") in ["rich", "simple"]:
		settings.scenery_detail = data.scenery_detail
	if data.get("dot_scale") in [1.0, 1.3, 1.6]:
		settings.dot_scale = float(data.dot_scale)
	var value = data.get("speed", 1)
	if (
		TrackDocument.valid_number(value, 1, 16)
		and value == floor(value)
		and int(value) in [1, 2, 4, 8, 16]
	):
		settings.speed = int(value)

	if data.get("guides") is Dictionary:
		for flow in ["editor", "pit wall", "race director"]:
			if RaceCheckpoint.integral(data.guides.get(flow), 0, 20):
				settings.guides[flow] = int(data.guides[flow])


func _run_content_probe() -> bool:
	var probe_selection: Dictionary = {}
	for argument in OS.get_cmdline_user_args():
		for key in [
			"roster_id",
			"tyre_allocation_id",
			"setup_id",
			"race_tuning_id",
			"weekend_id",
			"circuit_id",
			"scenario_id"
		]:
			var prefix = "--content-probe-" + key + "="
			if argument.begins_with(prefix):
				probe_selection[key] = argument.trim_prefix(prefix)
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--content-probe=") or argument == "--content-probe-restore":
			var result = (
				ContentRuntimeProbe.restore()
				if argument == "--content-probe-restore"
				else ContentRuntimeProbe.start(
					content_catalog, argument.trim_prefix("--content-probe="), probe_selection
				)
			)
			print("CONTENT_RESULT ", JSON.stringify(result))
			get_tree().quit(0 if result.ok else 1)
			return true
	return false
