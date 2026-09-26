extends SceneTree
## Finishing acceptance. Native input uses the actual composed production scene.
## Race-entry boundary fixtures are disclosed; subsequent motion is the unchanged model.
var checks = 0
var failures: Array[String] = []
var captures: Array = []
var game
var app
var view
var model: PracticeRaceSim

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, description: String) -> void:
	checks += 1
	if not value:
		failures.append(description)
		push_error(description)

func settle(frames: int = 4) -> void:
	for i in range(frames): await process_frame

func key(code: Key) -> void:
	for down in [true, false]:
		var event = InputEventKey.new()
		event.keycode = code; event.pressed = down
		Input.parse_input_event(event)
		await settle(2)

func capture(label: String, provenance: String) -> void:
	await settle(); await RenderingServer.frame_post_draw
	var filename = "finish-" + label + ".png"
	root.get_texture().get_image().save_png("res://reports/" + filename)
	captures.append({"file": filename, "phase": model.phase, "time": model.total_time,
		"clock": model.clock, "viewport": [root.size.x, root.size.y],
		"text_scale": app.settings.pitwall_text_scale, "provenance": provenance,
		"circuit": model.track.document.name, "seed": 7314})

func race_fixture() -> PracticeRaceSim:
	var result = PracticeRaceSim.new(TrackGeometry.new(app.library[7]),
		{"laps": 24, "scenario": "dry", "intensity": "calm", "seed": 7314})
	result.phase = "race"; result.paused = true
	for car in result.cars:
		car.route = "track"; car.distance = 300 + (12 - car.id) * 24
		car.previous_distance = car.distance; car.speed = 40
	return result

func reset() -> void:
	app.weekend = model; game.show_weekend()
	view = game.content.get_child(0); view.set_process(false)
	await settle(8)

func advance_until(condition: Callable, seconds: float = 700) -> bool:
	model.paused = false
	for i in range(ceili(seconds / RaceSim.STEP)):
		if condition.call(): model.paused = true; return true
		model.step()
		if i % 400 == 0: await process_frame
	model.paused = true
	return condition.call()

func confirm(button: Button) -> void:
	button.grab_focus(); await key(KEY_ENTER); await key(KEY_ENTER)

func lifecycle_tests() -> void:
	model = race_fixture(); model.cars[3].fuel = 20.0; await reset()
	view.open_decision(3); await settle()
	check(view.decision_drawer.snapshot.primary.get("issue") == "fuel", "G01 fuel reproduction uses a real DecisionFeed issue")
	await confirm(view.decision_drawer.fuel)
	check(model.policy(3).overrides.has("engine"), "G01 native Enter accepts the reviewed driver's bounded intent")
	check(not model.policy(6).overrides.has("engine"), "G01 the teammate is unaffected by confirmation")
	var accepted_count = model.commands.size()
	# Repeated native activation must not stage the already accepted action again.
	view.decision_drawer.fuel.grab_focus(); await key(KEY_ENTER); await key(KEY_ENTER)
	check(model.commands.size() == accepted_count, "G01 repeated accepted-action activation does not duplicate a command")
	check(await advance_until(func(): return not model.policy(3).overrides.has("engine")), "G01 the unchanged model physically expires the two-lap override")
	view.decision_drawer.refresh_state()
	check(view.decision_drawer.stage == "OUTCOME" and view.decision_drawer.message.text.contains("Completed"), "G01 fuel handback reaches a correlated Completed outcome")
	await capture("fuel-handback", "Synthetic race-entry fixture; two-lap override expired through physical fixed steps")
	var before = JSON.stringify(model.snapshot())
	view.open_decision(3); await settle()
	check(view.decision_drawer.stage == "OUTCOME", "G01 reopening a completed action retains its receipt instead of offering the same action")
	check(before == JSON.stringify(model.snapshot()), "G01 opening an outcome is observational")

	model = race_fixture(); model.cars[3].fuel = 20.0; await reset()
	view.open_decision(3); await settle(); await confirm(view.decision_drawer.fuel)
	check(model.command("engine", {"id": 3, "value": 1}), "G01 an explicit competing engine command is accepted")
	view.decision_drawer.refresh_state()
	check(view.decision_drawer.stage == "OUTCOME" and view.decision_drawer.message.text.contains("Superseded"), "G01 explicit replacement has a Superseded outcome, not successful completion")

	model = race_fixture(); await reset(); view.open_decision(3); await settle()
	await confirm(view.decision_drawer.box)
	check(model.cars[3].pit_order, "G01 native pit confirmation produces a physical order")
	check(model.command("cancel_pit", {"id": 3}), "G01 the existing boundary permits cancellation on track")
	view.decision_drawer.refresh_state()
	check(view.decision_drawer.stage == "OUTCOME" and view.decision_drawer.message.text.contains("Canceled"), "G01 a canceled approach is not left executing")
	await capture("pit-canceled", "Synthetic race-entry fixture; accepted/canceled commands use the production command boundary")

	model = race_fixture(); model.cars[3].fuel = 20.0; await reset()
	view.open_decision(3); await settle(); await confirm(view.decision_drawer.fuel)
	# Deliberately synthetic unrelated-event boundary; it must not count as evidence.
	model.cars[3].pit_stops += 1
	view.decision_drawer.refresh_state()
	check(view.decision_drawer.stage == "EXECUTING", "G01 an unrelated pit count cannot complete an engine intent")
	check(model.command("retire_car", {"id": 3, "confirm": true}), "G01 retirement uses the existing explicit command")
	view.decision_drawer.refresh_state()
	check(view.decision_drawer.stage == "OUTCOME" and view.decision_drawer.message.text.contains("Interrupted"), "G01 retirement interrupts rather than completes an unfinished action")

	model = PracticeRaceSim.new(TrackGeometry.new(app.library[7]),
		{"laps": 24, "scenario": "dry", "intensity": "calm", "seed": 7314})
	check(model.command("qualify"), "G01 qualifying starts through the existing session approval")
	model.paused = true; await reset(); view.open_decision(3); await settle()
	await confirm(view.decision_drawer.release)
	check(model.cars[3].qual_runs == 1 and model.cars[3].route != "garage", "G01 native release starts the named physical run")
	check(await advance_until(func(): return model.cars[3].route == "garage"), "G01 release physically follows out/hot/in laps back to the garage")
	view.decision_drawer.refresh_state()
	check(view.decision_drawer.stage == "OUTCOME" and view.decision_drawer.message.text.contains("Completed"), "G01 completed qualifying run has its own terminal outcome")
	check(not model.cars[3].qual_history.is_empty(), "G01 the qualifying outcome has a recorded lap, not a fake success grade")
	await capture("qualifying-return", "Physically released qualifying run; real out/hot/in/garage sequence and recorded lap")

func receipt_edge_tests() -> void:
	model = race_fixture(); await reset(); view.open_decision(6); await settle()
	await confirm(view.decision_drawer.box)
	var expected = view.decision_drawer.pending_payload.set_id
	check(await advance_until(func(): return model.cars[6].route == "pit"), "G01 accepted pit order physically enters the lane")
	view.decision_drawer.refresh_state()
	check(view.decision_drawer.stage == "EXECUTING", "G01 entry is execution, not completion")
	check(await advance_until(func(): return model.cars[6].route == "track"), "G01 the accepted visit physically rejoins")
	view.decision_drawer.refresh_state()
	check(view.decision_drawer.stage == "OUTCOME" and view.decision_drawer.message.text.contains("Completed") and model.cars[6].set_id == expected, "G01 exact order-entry-exit chain completes on the reviewed real set")
	var prior = view.decision_drawer.message.text
	view.decision_drawer.command_result(false, "Late callback boundary fixture", "pit")
	check(view.decision_drawer.stage == "OUTCOME" and view.decision_drawer.message.text == prior, "G01 a late acknowledgement cannot overwrite a terminal receipt")
	await capture("pit-completed", "Synthetic race-entry fixture; physical accepted order, entry, queue/service and exit")

	model = race_fixture(); model.cars[3].fuel = 20.0; await reset()
	view.open_decision(3); await settle(); await confirm(view.decision_drawer.fuel)
	var unavailable = view.decision_drawer.receipt.duplicate(true); unavailable.command_id = ""
	check(RaceDecisionViewModel.receipt_progress(model, unavailable).label == "Outcome unavailable", "G01 missing accepted journal identity cannot manufacture completion")
	model.phase = "results" # disclosed session-end boundary, not a physical finish result
	view.decision_drawer.refresh_state()
	check(view.decision_drawer.stage == "OUTCOME" and view.decision_drawer.message.text.contains("Interrupted"), "G01 a session boundary interrupts the unexpired action")

	model = PracticeRaceSim.new(TrackGeometry.new(app.library[7]), {"laps":24,"scenario":"dry","intensity":"calm","seed":7314})
	check(model.command("qualify"), "G01 invalid-run boundary starts with real qualifying approval")
	model.paused = true; await reset(); view.open_decision(3); await settle(); await confirm(view.decision_drawer.release)
	check(await advance_until(func(): return model.cars[3].qual_state == "hotlap"), "G01 released run physically reaches a flying lap")
	model.cars[3].hot_valid = false; model.cars[3].invalid_reason = "Disclosed invalid-lap boundary fixture"
	check(await advance_until(func(): return model.cars[3].route == "garage"), "G01 invalid flying lap physically returns through the pit lane")
	view.decision_drawer.refresh_state()
	check(view.decision_drawer.stage == "OUTCOME" and view.decision_drawer.message.text.contains("invalid lap"), "G01 completed run discloses invalidity rather than promising improvement")
	await capture("qualifying-invalid-return", "Synthetic invalidity flag during physically progressed out/hot/in run; not a race result or skill probability")

func chart_reproductions() -> void:
	model = race_fixture(); await reset(); view.open_topic(1); await settle()
	var chart = view.telemetry_chart
	chart.present("Missing middle sample", "km/h", [10.0, NAN, 30.0], 0, 40)
	check(chart.series.size() == 3, "G09 a missing chronological sample retains its original position")
	check(chart.series.size() == 3 and chart.series[1] == null, "G09 missing values are represented as unavailable rather than zero or a compressed trace")
	chart.present_cases("Missing category", ["Now", "Drier", "Trend", "Wetter"], [0.0, NAN, 30.0, 60.0])
	check(chart.series.size() == 4 and chart.categories.size() == 4, "G09 a missing case cannot shift category labels")
	check(chart.series.size() == 4 and chart.series[0] == 0.0 and chart.series[2] == 30.0, "G09 zero water remains measured and Trend retains its actual value")
	await capture("missing-category", "Disclosed synthetic missing-category boundary; no future weather or probability is implied")

func chart_inspection_tests() -> void:
	var chart = view.telemetry_chart
	var before = JSON.stringify(model.snapshot())
	chart.present_samples("Recorded acceleration boundary", "m/s²", [0.0, null, -2.0], -4, 4, [2.0, 4.0, 10.0])
	chart.grab_focus(); await key(KEY_HOME); await key(KEY_RIGHT)
	check(chart.cursor == 1 and chart.selected_text().contains("Unavailable"), "G08 native keyboard cursor exposes a missing sample without inventing zero")
	check(is_equal_approx(chart.x_fraction(1), 0.25), "G08 irregular elapsed timestamps retain true horizontal spacing")
	check(chart.selected_text().contains("4.0"), "G08 selected sample names the recorded elapsed time")
	await key(KEY_END)
	check(chart.selected_text().contains("-2.00 m/s²"), "G08 negative acceleration retains its sign and unit")
	var revisions = chart.update_count
	chart.present_samples("Recorded acceleration boundary", "m/s²", [0.0, null, -2.0], -4, 4, [2.0, 4.0, 10.0])
	check(chart.update_count == revisions, "G08 unchanged nullable inputs do not allocate new chart state")
	check(before == JSON.stringify(model.snapshot()), "G08 chart inspection leaves simulation, commands, pause, owners and RNG untouched")
	chart.present_samples("Unavailable time domain", "laps", [0.0, 2.0], 0, 3, [2.0, NAN])
	check(chart.domain == "Sample" and chart.x_values.is_empty(), "G08 invalid timestamps fall back to explicit samples, not invented seconds")
	var bounds = RaceMetricChart.padded_range([90.12, null, 90.14])
	check(bounds.x < 90.12 and bounds.y > 90.14 and bounds.y - bounds.x < 1, "G08 close lap evidence gets a padded local range")
	bounds = RaceMetricChart.padded_range([0.0, 0.0])
	check(bounds.x < 0 and bounds.y > 0, "G08 zero/flat samples retain a nonzero readable range")
	chart.present("Single measured sample", "laps", [0.0], 0, 1); await key(KEY_HOME)
	check(chart.series.size() == 1 and chart.selected_text().contains("0.00 laps"), "G08 a single zero sample is recorded data, not an empty chart")
	chart.present("No measured samples", "laps", [], 0, 1)
	check(chart.cursor == -1 and chart.selected_text().contains("No recorded"), "G08 clearing history clears cursor/readout safely")

func run() -> void:
	root.size = Vector2i(1440, 900); root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	app = root.get_node("App"); await settle()
	await lifecycle_tests()
	await receipt_edge_tests()
	await chart_reproductions()
	await chart_inspection_tests()
	var report = {"passed": failures.is_empty(), "checks": checks, "errors": failures,
		"screenshots": captures.size(), "captures": captures, "engine": Engine.get_version_info().string}
	Storage.write_json("res://reports/ui-finish.json", report)
	print("UI_FINISH ", JSON.stringify(report)); quit(0 if failures.is_empty() else 1)
