extends "res://tests/minimal_ui_tests.gd"


## Native entry/exit wiring, retention and layout. Terminal layout fixtures are synthetic;
## minimal_weekend_ui_tests independently executes the full physical sessions.
func find_button(parent: Node, prefix: String) -> Button:
	if parent is Button and parent.text.begins_with(prefix):
		return parent
	for child in parent.get_children():
		var found = find_button(child, prefix)
		if found:
			return found
	return null


func click_dialog(control: Control) -> void:
	# Native dialogs own a separate viewport. Exercise normal keyboard activation
	# in that viewport rather than injecting root-window pointer coordinates.
	control.grab_focus()
	for pressed in [true, false]:
		var event = InputEventKey.new()
		event.keycode = KEY_ENTER
		event.pressed = pressed
		control.get_window().push_input(event)
		await settle(3)


func run() -> void:
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	app = root.get_node("App")
	await settle()
	app.settings.pitwall_layout = "minimal"
	app.settings.pitwall_text_scale = 1.0
	model = PracticeRaceSim.new(
		TrackGeometry.new(app.library[7]),
		{"laps": 6, "scenario": "dry", "intensity": "calm", "seed": 7314}
	)
	var controls = MinimalRaceControls.new()
	controls.configure(model)
	controls.advance_stage()
	model.paused = true
	app.weekend = model
	check(app.save_weekend().is_empty(), "Existing practice checkpoint saved before navigation")
	var checkpoint = Storage.read_json(app.checkpoint_path).data
	var original = RaceStateValue.fingerprint(model.snapshot())
	app.weekend = null
	check(
		app.requires_entry_confirmation(),
		"An unopened disk checkpoint still requires replacement approval"
	)
	app.weekend = model
	game.show_menu()
	await settle()
	await click(find_button(game, "GRAND PRIX WEEKEND"))
	check(game.screen_name == "grand_prix_setup", "Main menu opens weekend configuration")
	game.selected_track = app.library[7]
	game.config = {
		"laps": 6,
		"qual_duration": 240,
		"scenario": "dry",
		"intensity": "calm",
		"seed": 7314,
		"tactical_duels": true
	}
	await click(find_button(game, "Review weekend"))
	check(
		game.screen_name == "weekend_welcome",
		"Configuration opens the welcome before replacing the current weekend"
	)
	var welcome = game.content.get_child(0)
	check(
		welcome is WeekendEntryView and welcome.data.laps == 6, "Welcome reflects the chosen entry"
	)
	check(
		app.weekend == model and original == RaceStateValue.fingerprint(model.snapshot()),
		"Welcome does not alter the existing practice"
	)
	check(
		Storage.read_json(app.checkpoint_path).data == checkpoint,
		"Welcome leaves the stored continuation unchanged"
	)
	await capture(
		"weekend-flow-welcome", "Native staged welcome; previous real practice remains intact"
	)
	await click(welcome.start_button)
	var confirm: ConfirmationDialog
	for child in welcome.get_children():
		if child is ConfirmationDialog:
			confirm = child
	check(
		confirm != null and confirm.visible,
		"Replacing an active weekend requires explicit confirmation"
	)
	if confirm:
		await click_dialog(confirm.get_cancel_button())
	check(
		app.weekend == model and Storage.read_json(app.checkpoint_path).data == checkpoint,
		"Cancel preserves the prior weekend and checkpoint"
	)
	await click(welcome.back_button)
	check(
		game.screen_name == "grand_prix_setup" and game.selected_track.id == app.library[7].id,
		"Back retains the selected circuit"
	)
	await click(find_button(game, "Review weekend"))
	welcome = game.content.get_child(0)
	await click(welcome.start_button)
	for child in welcome.get_children():
		if child is ConfirmationDialog:
			confirm = child
	await click_dialog(confirm.get_ok_button())
	await settle()
	check(
		game.screen_name == "weekend" and app.weekend.phase == "practice",
		"Confirmed Start practice enters the production pitwall"
	)
	view = game.content.get_child(0)
	root.get_node("App").session_runner.automatic = false
	view.set_process(false)
	model = app.weekend
	model.paused = true
	view.refresh()
	check(
		model.cars[3].route == "garage" and model.cars[6].route == "garage",
		"Start does not silently send either driver out"
	)
	await click(view.send_button)
	check(
		(
			not model.practice_driver(3).active.is_empty()
			and model.practice_driver(6).active.is_empty()
		),
		"First visible send command targets only the selected driver"
	)
	await capture(
		"weekend-flow-practice",
		"Practice entered through actual native confirmation; one driver explicitly sent"
	)
	for scale in [1.0, 1.15, 1.3]:
		for viewport in [Vector2i(1440, 900), Vector2i(1100, 720)]:
			root.size = viewport
			root.content_scale_size = viewport
			app.settings.pitwall_text_scale = scale
			check(
				game.launch_draft.stage(app.library[7], game.config),
				"Layout fixture stages valid entry"
			)
			game.show_welcome()
			await settle(8)
			welcome = game.content.get_child(0)
			check(
				(
					inside(welcome.start_button)
					and text_fits(welcome.start_button)
					and inside(welcome.back_button)
					and text_fits(welcome.back_button)
				),
				"Welcome actions fit chosen text scale and viewport"
			)
			check(
				(
					inside(welcome.preview)
					and welcome.preview.size.x >= 300
					and welcome.preview.size.y >= 300
				),
				"Welcome track keeps usable space"
			)
			await capture(
				"weekend-welcome-%d-%d" % [viewport.x, roundi(scale * 100)],
				"Native layout fixture; no session command"
			)
			# Synthetic completed field is for result layout only, not evidence of a physical finish.
			var result_model = PracticeRaceSim.new(TrackGeometry.new(app.library[7]))
			result_model.phase = "results"
			for car in result_model.cars:
				car.finished = true
				car.completed = 6
				car.finish_time = 1000.0 + car.id
			game.clear_screen("layout_result")
			var result = WeekendEndView.new()
			result.configure(WeekendSummary.capture(result_model), scale)
			game.content.add_child(result)
			await settle(8)
			check(
				(
					inside(result.new_button)
					and inside(result.menu_button)
					and inside(result.track_button)
				),
				"Results navigation remains reachable"
			)
			check(
				result.classification.get_root().get_child_count() == 12,
				"Results retain all classified cars"
			)
			await capture(
				"weekend-result-%d-%d" % [viewport.x, roundi(scale * 100)],
				"Synthetic completed-field layout fixture, not a simulated finish"
			)
	var report = {
		"passed": failures.is_empty(),
		"checks": checks,
		"failures": failures,
		"screenshots": captures.size(),
		"captures": captures
	}
	Storage.write_json("res://reports/weekend-flow-ui.json", report)
	print("WEEKEND_FLOW_UI ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
