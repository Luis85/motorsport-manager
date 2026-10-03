extends "res://tests/minimal_ui_tests.gd"


## Native source-authored roster layout/targeting. Physical completion is a separate suite.
func run() -> void:
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	app = root.get_node("App")
	await settle()
	var loaded = ContentPackLoader.new().load_packs(
		["res://config", "res://content/examples/club-racing"]
	)
	check(loaded.ok, "Native roster fixture loads through production validation")
	if not loaded.ok:
		finish_roster()
		return
	var roster = loaded.catalog.roster("local.club.roster.expanded")
	var document: Dictionary = app.library[7].duplicate(true)
	document.grid.count = 14
	for layout in ["minimal", "engineering", "director"]:
		app.settings.pitwall_layout = layout
		app.settings.pitwall_text_scale = 1.0
		model = PracticeRaceSim.new(
			TrackGeometry.new(
				document,
				"local.club.vehicle.sport",
				false,
				loaded.catalog.vehicle("local.club.vehicle.sport")
			),
			{"laps": 2, "scenario": "dry", "intensity": "calm", "tactical_duels": true},
			roster
		)
		var controls = MinimalRaceControls.new()
		controls.configure(model)
		check(controls.advance_stage(), "Real practice approval: " + layout)
		await reset()
		var before = RaceStateValue.fingerprint(model.snapshot())
		for index in range(5):
			view.refresh()
			await settle()
		check(
			before == RaceStateValue.fingerprint(model.snapshot()),
			"New roster observation never mutates a session: " + layout
		)
		check(model.selected_id == 12, "Native selection begins on the actual player: " + layout)
		if layout == "minimal":
			check(view.driver_buttons.keys() == [12, 13], "Shipping tabs contain the authored pair")
			check(view.driver_cards.keys() == [12, 13], "Shipping cards contain the authored pair")
			check(view.items_by_id.size() == 14, "Timing tower includes all fourteen entrants")
			await click(view.driver_buttons[13])
			await click(view.send_button)
			check(
				(
					not model.practice_driver(13).active.is_empty()
					and model.practice_driver(6).active.is_empty()
				),
				"Native Send out targets Robin, not former MOR slot"
			)
			await click(view.driver_buttons[12])
			await click(view.send_button)
			check(
				(
					not model.practice_driver(12).active.is_empty()
					and model.practice_driver(3).active.is_empty()
				),
				"Native Send out targets Avery, not former MER slot"
			)
			for size in [Vector2i(1440, 900), Vector2i(1100, 720)]:
				root.size = size
				root.content_scale_size = size
				await settle(8)
				check(
					(
						inside(view.send_button)
						and inside(view.driver_row)
						and inside(view.timing_panel)
					),
					"Expanded roster primary controls are reachable: " + str(size)
				)
				await capture(
					"roster-minimal-" + str(size.x),
					"Fourteen file-authored entries at real practice approval; layout/input evidence, not race completion"
				)
		else:
			await capture(
				"roster-" + layout,
				"Retained diagnostic workspace on a real fourteen-car practice entry; no synthetic race result"
			)
		root.size = Vector2i(1440, 900)
		root.content_scale_size = root.size
	finish_roster()


func finish_roster() -> void:
	var report = {
		"passed": failures.is_empty(),
		"checks": checks,
		"failures": failures,
		"captures": captures,
		"screenshots": captures.size()
	}
	Storage.write_json("res://reports/roster-content-ui-tests.json", report)
	print("ROSTER_CONTENT_UI ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
