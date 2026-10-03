extends SceneTree
## Native rendering/input on a real launched entry; no synthetic sporting outcomes.
var failures: Array[String] = []
var checks = 0
var captures: Array = []


class MemoryStore:
	extends WeekendEntryStore

	func save_record(record: RaceRecord) -> String:
		return RaceRecord.validate(record.seal())


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		print("ROSTER_UI_FAILURE ", label)


func settle() -> void:
	for index in range(10):
		await process_frame


func press(button: Button) -> void:
	button.grab_focus()
	for down in [true, false]:
		var event = InputEventKey.new()
		event.keycode = KEY_ENTER
		event.pressed = down
		Input.parse_input_event(event)
		await settle()


func inside(control: Control) -> bool:
	return Rect2(Vector2.ZERO, Vector2(root.size)).grow(1).encloses(control.get_global_rect())


func run() -> void:
	var loaded = ContentPackLoader.new().load_packs(
		["res://config", "res://content/examples/club-racing"]
	)
	check(loaded.ok, "Load authored privateer fixture")
	if not loaded.ok:
		finish()
		return
	var document = Storage.read_json("res://config/circuits/hillside.json").data
	document.grid.count = 14
	var launch = WeekendLaunch.new(loaded.catalog)
	check(
		launch.stage(
			document,
			{"laps": 4, "roster_id": "local.club.roster.privateer"},
			"core.vehicle.formula"
		),
		"Stage real authored entry"
	)
	var committed = launch.commit(int(launch.capture().revision), MemoryStore.new())
	check(committed.ok, "Commit real practice before rendering")
	if not committed.ok:
		finish()
		return
	var sim: RaceSim = committed.simulation
	var minimal = MinimalRaceSession.new(sim)
	var diagnostic = RaceViewSession.new(sim)
	for profile in [Vector2i(1440, 900), Vector2i(1100, 720)]:
		root.size = profile
		root.content_scale_size = profile
		var view = MinimalRaceWorkspace.new()
		view.configure(minimal.view, {"pitwall_text_scale": 1.3})
		root.add_child(view)
		view.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		view.set_process(false)
		await settle()
		check(
			view.driver_buttons.keys() == [12, 13] and view.items_by_id.size() == 14,
			"Minimal controls and timing use actual entry IDs: " + str(profile)
		)
		check(
			view.canvas.geometry.pit_markers().size() == 7,
			"Map renders all seven configured team boxes"
		)
		for control in [
			view.toolbar,
			view.canvas,
			view.pitwall,
			view.send_button,
			view.push_button,
			view.engine_control
		]:
			check(
				inside(control),
				"Primary control remains reachable: " + control.name + "/" + str(profile)
			)
		var before = RaceRecord.sporting(sim.snapshot())
		for index in range(10):
			view.refresh()
		check(
			RaceRecord.equivalent(before, RaceRecord.sporting(sim.snapshot())),
			"Rendering/refresh does not advance or command the race"
		)
		await press(view.driver_buttons[13])
		check(
			view.selected_id == 13 and sim.selected_id == 13,
			"Native tab selects the added second driver"
		)
		var other_pace = sim.cars[12].pace
		var previous = sim.cars[13].pace
		await press(view.push_button)
		check(
			sim.cars[13].pace != previous and sim.cars[12].pace == other_pace,
			"Native Push targets only added driver"
		)
		await RenderingServer.frame_post_draw
		var name = "roster-minimal-%dx%d.png" % [profile.x, profile.y]
		root.get_texture().get_image().save_png("res://reports/" + name)
		captures.append(
			{
				"file": name,
				"phase": sim.phase,
				"time": sim.total_time,
				"player_ids": sim.player_ids(),
				"provenance":
				"Real launched fourteen-car practice, before driving. Not finish evidence."
			}
		)
		view.queue_free()
		await settle()
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	for type in [PracticeWeekendView, RaceDirectorWorkspace]:
		var view = type.new()
		view.configure(diagnostic.view)
		root.add_child(view)
		view.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		view.set_process(false)
		await settle()
		check(
			view.decision_controls.keys() == [12, 13],
			"Retained diagnostic controls have the correct drivers"
		)
		check(
			view.decision_queue.slots.keys() == [12, 13],
			"Stable decision slots match entry ownership"
		)
		check(view.practice_workspace.panels.keys() == [12, 13], "Practice panels follow roster")
		view.select_driver(13)
		view.open_strategy(13)
		view.refresh()
		await settle()
		check(
			(
				view.strategy_desk.driver_id == 13
				and view.strategy_desk.target_picker.get_item_text(1).begins_with("BRK")
			),
			"Strategy draft picker follows added driver"
		)
		view.duel_workspace.open_for(13)
		await settle()
		check(view.duel_workspace.panel.driver_id == 13, "Tactical plan follows added driver")
		view.open_session_workspace()
		view.results_workspace.present()
		await settle()
		check(
			(
				view.results_workspace.drivers.get_item_count() == 2
				and view.results_workspace.drivers.get_item_text(0).begins_with("LAN")
			),
			"Review uses actual driver labels"
		)
		view.queue_free()
		await settle()
	committed.record.detach()
	finish()


func finish() -> void:
	var report = {
		"passed": failures.is_empty(), "checks": checks, "failures": failures, "captures": captures
	}
	Storage.write_json("res://reports/content-roster-ui-tests.json", report)
	print("CONTENT_ROSTER_UI_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
