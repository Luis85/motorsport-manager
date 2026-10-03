extends SceneTree
## Native preset selection and real staged approval, with keyboard input and live controls.
var checks = 0
var failures: Array[String] = []
var captures: Array = []
var game: Control
var app: Node


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		print("WEEKEND_UI_FAILURE ", message)


func settle(count: int = 8) -> void:
	for index in range(count):
		await process_frame


func key(code: Key, window_id: int = 0) -> void:
	for down in [true, false]:
		var event = InputEventKey.new()
		event.keycode = code
		event.pressed = down
		event.window_id = window_id
		Input.parse_input_event(event)
		await settle(2)


func inside(control: Control) -> bool:
	return (
		control != null
		and Rect2(Vector2.ZERO, Vector2(root.size)).grow(1).encloses(control.get_global_rect())
	)


func button(text: String) -> Button:
	for node in game.find_children("*", "Button", true, false):
		if node.text == text:
			return node
	return null


func run() -> void:
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	app = root.get_node("App")
	check(
		app.reload_content(["res://content/examples/club-racing"]),
		"Application atomically activates the file-authored example"
	)
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	await settle()
	var document = Storage.read_json("res://data/tracks/hillside.json").data
	document.grid.count = 14
	game.show_library(document)
	await settle()
	var selector: OptionButton = game.find_child("WeekendPreset", true, false)
	check(
		(
			selector != null
			and selector.item_count == app.content_catalog.entries("weekend").size() + 1
		),
		"Setup discovers every catalog preset and retains the custom-selection option"
	)
	if selector == null:
		finish()
		return
	selector.grab_focus()
	await key(KEY_ENTER)
	var popup = selector.get_popup()
	check(popup.visible, "Preset selector opens with keyboard input")
	var window_id = popup.get_window_id()
	var preset_rows = app.content_catalog.entries("weekend")
	var preset_ids = preset_rows.map(func(row): return row.id)
	var target_index = preset_ids.find("local.club.weekend.sprint")
	check(target_index >= 0, "External sprint preset is present in the selected catalog")
	if target_index < 0:
		finish()
		return
	await key(KEY_HOME, window_id)
	# Custom selection occupies index zero; catalog order is not semantic authority.
	for index in range(target_index + 1):
		await key(KEY_DOWN, window_id)
	await key(KEY_ENTER, window_id)
	await settle()
	check(
		game.config.get("weekend_id") == "local.club.weekend.sprint",
		"Native selection applies the external preset ID"
	)
	check(
		game.config.laps == 8 and game.vehicle == "local.club.vehicle.sport",
		"Preset selection updates vehicle and race length together"
	)
	check(
		game.config.get("race_tuning_id") == "local.club.race_tuning.sprint",
		"Preset selects its own tuning definition"
	)
	check(
		app.weekend == null and game.launch_draft.capture().is_empty(),
		"Choosing a preset neither starts nor saves a race"
	)
	for size in [Vector2i(1440, 900), Vector2i(1100, 720)]:
		root.size = size
		root.content_scale_size = size
		app.settings.pitwall_text_scale = 1.3
		game.show_library(document)
		await settle(12)
		selector = game.find_child("WeekendPreset", true, false)
		check(inside(selector), "Native preset control stays reachable at " + str(size))
		check(
			inside(button("Review weekend")),
			"Review action stays reachable with all content selectors at " + str(size)
		)
		check(
			inside(game.library_canvas), "Circuit preview remains inside the window at " + str(size)
		)
		await RenderingServer.frame_post_draw
		var file = "content-weekend-setup-%dx%d.png" % [size.x, size.y]
		root.get_texture().get_image().save_png("res://reports/" + file)
		captures.append(
			{"file": file, "scope": "Actual setup controls, before approval; not racing evidence."}
		)
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	app.settings.pitwall_text_scale = 1.0
	game.show_library(document)
	await settle()
	button("Review weekend").grab_focus()
	await key(KEY_ENTER)
	await settle()
	check(
		game.screen_name == "weekend_welcome" and app.weekend == null,
		"Review stages the preset without replacing a running save"
	)
	check(
		game.launch_draft.session_options().weekend_definition.settings.laps == 8,
		"Welcome draft retains effective preset settings"
	)
	var start = button("Start practice")
	check(start != null and inside(start), "Real approval remains a visible, explicit action")
	if start != null:
		start.grab_focus()
		await key(KEY_ENTER)
		app.session_runner.automatic = false
		await settle()
		check(
			app.weekend != null and app.weekend.phase == "practice",
			"Native approval enters production practice"
		)
		if app.weekend != null:
			check(
				app.weekend.cars.size() == 14 and app.weekend.player_ids() == [12, 13],
				"Native approval preserves authored field ownership"
			)
			check(
				app.weekend.tuning.service.tyre_base_seconds == 6.0,
				"Authored pit service is installed through native UI"
			)
			check(
				app.weekend.weather_state.model.mode == "scripted_training",
				"Weather mode is not discarded at the launch boundary"
			)
			var view = game.content.get_child(0)
			check(
				view is MinimalRaceWorkspace,
				"Preset does not switch the shipping game to a developer workspace"
			)
			app.stop_session()
	finish()


func finish() -> void:
	var result = {
		"passed": failures.is_empty(), "checks": checks, "failures": failures, "captures": captures
	}
	Storage.write_json("res://reports/content-weekend-ui-tests.json", result)
	print("CONTENT_WEEKEND_UI_TESTS ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)
