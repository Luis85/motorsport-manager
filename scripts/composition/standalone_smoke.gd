extends Node
## Explicit developer-only packaged journey. Inert unless the launcher supplies
## an allowlisted stage, an isolated user directory, and its ownership token.
const STAGES = [
	"create",
	"resume",
	"reload",
	"interrupt-temp",
	"recover-temp",
	"interrupt-backup",
	"recover-backup",
	"retry"
]
const NAME = "Smoke – Nürburgring Ω"
const OLD = {"generation": 1, "name": "Nürburgring Ω"}
const NEW = {"generation": 2, "name": "Retry with spaces"}

var game: Control
var stage: String
var checks: int = 0
var failures: Array[String] = []
var evidence: String
var identity: Dictionary = {}
var completed: bool = false


func start(owner: Control, requested_stage: String) -> void:
	game = owner
	stage = requested_stage
	call_deferred("run")


func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)


func settle(count: int = 5) -> void:
	for frame in range(count):
		await get_tree().process_frame


func write(path: String, data: Variant) -> void:
	check(Storage.write_json(path, data).is_empty(), "Write succeeds: " + path.get_file())


func read(path: String) -> Dictionary:
	var result = Storage.read_json(path)
	check(result.ok and result.get("data") is Dictionary, "Read succeeds: " + path.get_file())
	return result.get("data", {}) if result.ok else {}


func guard() -> bool:
	var expected = (
		OS
		. get_environment("MOTORSPORT_SMOKE_USER_DIR")
		. replace("\\", "/")
		. simplify_path()
		. trim_suffix("/")
	)
	var actual = OS.get_user_data_dir().replace("\\", "/").simplify_path().trim_suffix("/")
	var token = OS.get_environment("MOTORSPORT_SMOKE_TOKEN")
	evidence = OS.get_environment("MOTORSPORT_SMOKE_EVIDENCE")
	if stage not in STAGES or expected.is_empty() or token.length() != 32 or evidence.is_empty():
		return false
	if expected.to_lower() != actual.to_lower() or OS.has_feature("editor"):
		return false
	if stage == "create":
		if (
			FileAccess.file_exists("user://weekend.json")
			or FileAccess.file_exists("user://settings.json")
			or FileAccess.file_exists("user://smoke-owner.json")
		):
			return false
		write("user://smoke-owner.json", {"token": token})
	else:
		if read("user://smoke-owner.json").get("token") != token:
			return false
	identity = read("res://build-identity.json")
	check(identity.get("mode") in ["debug", "release"], "Pack carries build mode")
	check(
		OS.is_debug_build() == (identity.get("mode") == "debug"),
		"Actual executable matches packaged mode"
	)
	check(not FileAccess.file_exists("res://tests/run_tests.gd"), "Test sources are not shipped")
	check(
		App.load_errors.is_empty() and App.library.size() >= 8,
		"Bundled JSON catalog loads without the editor cache"
	)
	for filename in ["dry-strategy", "weather-strategy", "recovery", "strategic-duels"]:
		check(
			Storage.read_json("res://data/scenarios/" + filename + ".json").ok,
			"Scenario JSON included: " + filename
		)
	return failures.is_empty()


func screenshot(name: String) -> void:
	await RenderingServer.frame_post_draw
	var error = get_viewport().get_texture().get_image().save_png(evidence.path_join(name + ".png"))
	check(error == OK, "Native screenshot saved: " + name)


func create_weekend() -> void:
	check(
		App.weekend == null and not App.has_saved_weekend(),
		"Fresh packaged launch has no existing weekend"
	)
	game.show_settings()
	await settle()
	var settings = game.content.get_child(0)
	settings.draft.dot_scale = 1.3
	settings.save_requested.emit(settings.draft.duplicate(true))
	await settle()
	check(
		read("user://settings.json").get("dot_scale") == 1.3,
		"Settings commit reaches the real user path"
	)
	game.show_library()
	await settle()
	check(
		game.launch_draft.stage(
			App.library[7],
			{"laps": 6, "qual_duration": 240, "scenario": "dry", "intensity": "calm", "seed": 7314},
			"Formula"
		),
		"Configure a legal weekend"
	)
	game.show_welcome()
	await settle()
	var welcome = game.content.get_child(0)
	welcome.start_button.pressed.emit()
	await settle()
	check(
		game.screen_name == "weekend" and App.weekend != null,
		"Welcome starts the packaged minimal weekend"
	)
	if App.weekend == null:
		return
	App.session_runner.automatic = false
	var view = game.content.get_child(0)
	check(
		view is MinimalRaceWorkspace and App.weekend.phase == "practice",
		"Practice uses the shipping interface"
	)
	check(
		view.controls.send_out(3) and view.controls.send_out(6),
		"Send both drivers through existing commands"
	)
	view.controls.play()
	for tick in range(150):
		App.session_runner.advance(RaceSim.STEP)
	view.controls.pause()
	check(App.weekend.total_time > 0, "Practice advances physical fixed steps")
	check(App.save_weekend().is_empty(), "Production weekend save succeeds")
	var expected = App.weekend.snapshot()
	write(
		"user://smoke-expected.json",
		{
			"snapshot": expected,
			"integers": RaceRecord.integer_paths(expected),
			"event_id": App.recording.event_id
		}
	)
	await screenshot("practice")
	completed = true


func resume_weekend() -> void:
	var saved = read("user://smoke-expected.json")
	check(
		App.weekend == null and App.has_saved_weekend(), "New process finds an on-disk continuation"
	)
	check(App.settings.dot_scale == 1.3, "Settings survive executable restart")
	game.continue_weekend()
	await settle()
	if App.weekend == null:
		check(false, "Continue reconstructs the production weekend")
		return
	App.session_runner.automatic = false
	var expected = RaceRecord.apply_types(saved.snapshot, saved.integers)
	check(
		RaceRecord.equivalent(App.weekend.snapshot(), expected),
		"Continue restores complete sporting state and RNG"
	)
	check(
		App.recording.event_id == saved.event_id,
		"Continuation retains its accepted recording identity"
	)
	var isolated = PracticeRaceSim.restore_practice(expected)
	var controls = MinimalRaceControls.new()
	controls.configure(isolated)
	controls.play()
	var view = game.content.get_child(0)
	view.controls.play()
	for tick in range(45):
		App.session_runner.advance(RaceSim.STEP)
		isolated.step()
	view.controls.pause()
	controls.pause()
	check(
		RaceRecord.equivalent(
			RaceRecord.sporting(App.weekend.snapshot()), RaceRecord.sporting(isolated.snapshot())
		),
		"Subsequent packaged behavior matches an isolated restored checkpoint"
	)
	check(App.save_weekend().is_empty(), "Resumed save succeeds")
	await screenshot("continued-practice")
	await create_circuit()
	check(
		FileAccess.file_exists("user://smoke-track.json"),
		"Editor journey reached its persistence checkpoint"
	)
	completed = true


func create_circuit() -> void:
	var document = TrackEditorSession.blank_document()
	document.name = NAME
	game.show_editor(document)
	await settle()
	var editor: TrackEditor = game.editor
	var image = Image.create(16, 16, false, Image.FORMAT_RGBA8)
	image.fill(Color("52654b"))
	var path = "user://reference image – Ω.png"
	check(image.save_png(path) == OK, "External reference image uses Unicode and spaces")
	var reference = editor.storage.read_reference(ProjectSettings.globalize_path(path))
	check(reference.ok, "Production reference adapter loads the image")
	if not reference.ok:
		return
	editor.perform(
		func():
			editor.document.reference = {
				"png": reference.png, "width": 600.0, "x": 0.0, "y": 0.0, "opacity": 0.35
			},
		true
	)
	editor.save_document()
	check(
		not editor.dirty and editor.document.name == NAME, "Editor commits a named custom circuit"
	)
	check(editor.canvas.backdrop != null, "Embedded reference is rendered in the packaged editor")
	var output = ProjectSettings.globalize_path("user://circuit with spaces – Ω.json")
	check(
		editor.session.export_authoring(editor.storage, output, editor.document).is_empty(),
		"Authoring export uses a real Unicode path"
	)
	var imported = editor.storage.load_authoring(output)
	check(
		imported.ok and RaceRecord.equivalent(imported.get("data"), editor.document),
		"Export/import round trip preserves authored content"
	)
	write("user://smoke-track.json", editor.document)
	await screenshot("editor-created")


func reload_circuit() -> void:
	var expected = read("user://smoke-track.json")
	var found: Dictionary = {}
	for document in App.library:
		if document.name == NAME:
			found = document
	check(
		not found.is_empty() and RaceRecord.equivalent(found, expected),
		"Custom circuit and reference survive process restart"
	)
	if found.is_empty():
		return
	game.show_editor(found)
	await settle()
	check(
		game.editor.canvas.backdrop != null,
		"Reloaded reference texture is available without the original import cache"
	)
	game.editor.canvas.toggle_preview()
	await settle(12)
	game.editor.canvas.toggle_preview()
	check(
		not game.editor.session.preview.capture().running,
		"Packaged preview can be started and cancelled"
	)
	await screenshot("editor-reloaded")
	completed = true


func interrupt(boundary: String) -> void:
	write("user://recovery/atomic.json", OLD)
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://recovery/atomic.json.bak"))
	var files = StandaloneSmokeFiles.new()
	files.boundary = boundary
	Storage.write_json("user://recovery/atomic.json", NEW, files)
	check(false, "External launcher should have interrupted the real replacement stage")


func recover(boundary: String) -> void:
	var path = "user://recovery/atomic.json"
	check(
		RaceRecord.equivalent(read(path + ".tmp"), NEW),
		"Interrupted temporary file contains the flushed candidate"
	)
	if boundary == "temp":
		check(
			RaceRecord.equivalent(read(path), OLD),
			"Interruption before replacement preserves current primary"
		)
	else:
		check(not FileAccess.file_exists(path), "Interrupted replacement has no false primary")
		check(
			RaceRecord.equivalent(read(path + ".bak"), OLD),
			"Interruption after backup preserves the prior committed data"
		)
		# Explicit developer recovery, not an assertion of automatic player fallback.
		check(
			(
				DirAccess.rename_absolute(
					ProjectSettings.globalize_path(path + ".bak"),
					ProjectSettings.globalize_path(path)
				)
				== OK
			),
			"Explicit backup recovery restores the known valid primary"
		)
	write(path, NEW)
	check(
		RaceRecord.equivalent(read(path), NEW) and RaceRecord.equivalent(read(path + ".bak"), OLD),
		"Retry commits once and retains the previous backup"
	)
	if boundary == "backup":
		var blocker = FileAccess.open("user://blocked destination", FileAccess.WRITE)
		blocker.store_string("This file deliberately prevents directory creation.")
		blocker.close()
		var error = Storage.write_json("user://blocked destination/retry.json", NEW)
		check(
			not error.is_empty(), "Real unavailable destination fails without fabricating success"
		)
		check(
			RaceRecord.equivalent(read(path), NEW),
			"Unrelated committed data survives the filesystem failure"
		)
	completed = true


func retry_after_restart() -> void:
	check(
		FileAccess.file_exists("user://blocked destination"),
		"Failed destination persists into a new process"
	)
	check(
		(
			DirAccess.remove_absolute(ProjectSettings.globalize_path("user://blocked destination"))
			== OK
		),
		"The explicitly owned blocker can be removed"
	)
	write("user://blocked destination/retry.json", NEW)
	check(
		RaceRecord.equivalent(read("user://blocked destination/retry.json"), NEW),
		"Real save retry succeeds after restarting the app"
	)
	check(
		RaceRecord.equivalent(read("user://recovery/atomic.json.bak"), OLD),
		"Prior valid backup remains available after all retries"
	)
	completed = true


func run() -> void:
	if not guard():
		push_error(
			(
				"Packaged smoke refused: missing build identity, ownership token or isolated "
				+ "user path."
			)
		)
		get_tree().quit(2)
		return
	await settle()
	match stage:
		"create":
			await create_weekend()
		"resume":
			await resume_weekend()
		"reload":
			await reload_circuit()
		"interrupt-temp":
			interrupt("temp")
		"interrupt-backup":
			interrupt("backup")
		"recover-temp":
			recover("temp")
		"recover-backup":
			recover("backup")
		"retry":
			retry_after_restart()
	check(completed, "Requested stage reaches its final postcondition")
	var report = {
		"passed": failures.is_empty(),
		"checks": checks,
		"failures": failures,
		"stage": stage,
		"build": identity,
		"engine": Engine.get_version_info().string,
		"os": OS.get_name(),
		"debug_build": OS.is_debug_build(),
		"user_directory": OS.get_user_data_dir(),
		"renderer": RenderingServer.get_current_rendering_method(),
		"adapter": RenderingServer.get_video_adapter_name(),
		"scope":
		(
			"Scripted application/native-control journey; not human usability or "
			+ "keyboard-only acceptance"
		)
	}
	Storage.write_json(evidence.path_join(stage + ".json"), report)
	print("STANDALONE_SMOKE ", JSON.stringify(report))
	get_tree().quit(0 if failures.is_empty() else 1)
