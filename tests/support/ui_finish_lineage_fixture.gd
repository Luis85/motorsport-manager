extends "res://tests/ui_finish_guide_tests.gd"
## Populated acceptance: one physical practice/qualifying/race lineage, replayed
## through validated snapshots at each supported viewport. No fabricated lap data.
var states: Dictionary = {}
var provenance: Dictionary = {}
var inspected: Array = []


func retain(label: String, description: String) -> void:
	var data = JSON.parse_string(JSON.stringify(model.snapshot(), "", false, true))
	states[label] = data
	provenance[label] = {
		"kind": "physical-model-run",
		"description": description,
		"seed": model.seed_value,
		"time": model.total_time,
		"phase": model.phase,
		"sha256": JSON.stringify(data, "", false, true).sha256_text()
	}
	check(
		Storage.write_json("res://reports/physical-" + label + ".json", data).is_empty(),
		"Physical state is retained: " + label
	)


func restore_state(label: String) -> void:
	model = PracticeRaceSim.restore_practice(states[label].duplicate(true))
	check(model != null, "Validated snapshot restores actual " + label)
	if model == null:
		quit(1)
		return
	await reset()


func shoot(label: String, source: String) -> void:
	await settle(5)
	check(
		view.get_combined_minimum_size().x <= root.size.x,
		"G16 no horizontal expansion: " + label + str(root.size)
	)
	await capture(
		"populated-" + label + "-" + str(root.size.x),
		(
			"Physical lineage: "
			+ source
			+ ". Frozen step for cross-layout comparison; native UI interactions."
		)
	)
	captures.back()["source_sha256"] = provenance[source].sha256
	captures.back()["seed"] = model.seed_value
	inspected.append(
		{
			"screen": label,
			"source": source,
			"viewport": [root.size.x, root.size.y],
			"scale": view.text_scale
		}
	)


func header_and_drivers(label: String) -> void:
	check(
		(
			reachable(view.pause_button)
			and reachable(view.speed_control)
			and reachable(view.weekend_menu)
		),
		"G16 fixed time and utility controls remain reachable: " + label
	)
	if is_instance_valid(view.full_workspace) and view.full_workspace.visible:
		if view.full_workspace == view.analysis_workspace:
			check(
				(
					reachable(view.analysis_workspace.drivers[3])
					and reachable(view.analysis_workspace.drivers[6])
				),
				"G16 both focused-workspace driver targets reachable: " + label
			)
	else:
		for id in [3, 6]:
			check(
				reachable(view.car_cards[id].name_label),
				"G16 named driver reachable: " + model.cars[id].short + " " + label
			)


func choose(option: OptionButton, index: int) -> void:
	option.grab_focus()
	await key(KEY_ENTER)
	var popup = option.get_popup()
	for i in range(option.item_count + 2):
		if popup.get_focused_item() == index:
			break
		await key(KEY_DOWN)
	await key(KEY_ENTER)


func approve_dialog(dialog: ConfirmationDialog) -> void:
	check(is_instance_valid(dialog) and dialog.visible, "Native confirmation is displayed")
	dialog.get_ok_button().grab_focus()
	await key(KEY_ENTER)


func generate_lineage() -> void:
	model = PracticeRaceSim.new(
		TrackGeometry.new(app.library[7]),
		{"laps": 12, "scenario": "dry", "intensity": "calm", "seed": 7314}
	)
	model.paused = true
	await reset()
	retain("briefing", "New original weekend, no race or practice data invented")
	view.open_practice_workspace()
	await settle()
	await click(view.practice_workspace.panels[6].objective_buttons.qualifying)
	await click(view.practice_workspace.session_action)
	check(model.phase == "practice", "Native practice approval starts the real session")
	for id in [3, 6]:
		await click(view.practice_workspace.panels[id].run)
	check(
		(
			not model.practice_driver(3).active.is_empty()
			and not model.practice_driver(6).active.is_empty()
		),
		"Both native programme releases are accepted independently"
	)
	var contract_predicate_0 = func():
		return (
			model.practice_driver(3).runs[0].samples.size() >= 1
			and model.practice_driver(6).runs[0].samples.size() >= 1
		)
	check(
		await advance_until(contract_predicate_0, 400),
		"Both programmes record actual measured lap evidence"
	)
	view.refresh()
	retain(
		"practice-progress",
		"Independent tyre-life and qualifying programmes with physical measured samples"
	)
	await click(view.practice_workspace.panels[6].recall)
	var contract_predicate_1 = func():
		return (
			model.practice_driver(3).active.is_empty()
			and model.practice_driver(6).active.is_empty()
		)
	check(
		await advance_until(contract_predicate_1, 500),
		"Completed and recalled programmes both return physically"
	)
	view.refresh()
	await settle()
	await click(view.practice_workspace.finish)
	await approve_dialog(view.practice_workspace.panels[3].confirmation)
	check(
		await advance_until(func(): return model.phase == "practice_results", 200),
		"Practice closes with its actual complete/partial records"
	)
	view.refresh()
	retain(
		"practice-results",
		"Practice completion and native recall retain actual sample quality and observed costs"
	)
	await click(view.practice_workspace.finish)
	view.close_session_workspace()
	view.close_detail()
	view.refresh()
	await settle()
	await click(view.primary_button)
	check(
		model.phase == "qualifying",
		"Native approval follows optional practice with single-session qualifying"
	)
	retain("qualifying-garage", "Real session start; finite previously used allocation retained")
	for id in [3, 6]:
		view.open_decision(id, true)
		await settle()
		await confirm(view.decision_drawer.release)
	view.close_detail()
	view.refresh()
	var contract_predicate_2 = func():
		return model.cars[3].qual_state == "hotlap" and model.cars[6].qual_state == "hotlap"
	check(
		await advance_until(contract_predicate_2, 300),
		"Both cars physically begin their timed attempts"
	)
	view.refresh()
	retain(
		"qualifying-hotlap", "Real out laps completed; timed lap progress and traffic are physical"
	)
	view.primary_button.grab_focus()
	await key(KEY_ENTER)
	await settle()
	# Qualifying uses the established approval dialog created by the host.
	var dialog: ConfirmationDialog
	for child in view.get_children():
		if child is ConfirmationDialog and child.visible:
			dialog = child
	if dialog == null:
		for window in root.get_embedded_subwindows():
			if window is ConfirmationDialog and window.visible:
				dialog = window
	check(dialog != null, "Native end-qualifying confirmation is reachable")
	if dialog:
		await approve_dialog(dialog)
	retain("qualifying-closed", "Explicit session close while existing hot laps may still finish")
	check(
		await advance_until(func(): return model.phase == "qualifying_results", 400),
		"Closed qualifying physically produces the final classification"
	)
	check(
		not model.cars[3].qual_history.is_empty() and not model.cars[6].qual_history.is_empty(),
		"Qualifying results include recorded durations, not synthetic best times"
	)
	retain(
		"qualifying-results",
		"Physically completed single-session qualifying; valid/invalid flags are the model's own"
	)
	view.refresh()
	view.open_results_workspace()
	await settle()
	await click(view.results_workspace.next_button)
	check(model.phase == "race_preparation", "Native Next preserves explicit preparation approval")
	retain("preparation", "Real qualifying grid and finite set allocation before formation")
	view.close_detail()
	await settle()
	await click(view.primary_button)
	check(model.phase == "formation", "Native approval starts physical formation")
	check(
		await advance_until(func(): return model.clock > 10 or model.phase == "grid_ready", 80),
		"Formation advances by the original fixed-step model"
	)
	retain("formation", "Physical formation in progress, no fabricated grid positions")
	check(
		await advance_until(func(): return model.phase == "grid_ready", 160),
		"Cars physically reach the grid"
	)
	retain("grid", "Actual cars at grid; lights still require approval")
	view.refresh()
	await settle()
	await click(view.primary_button)
	check(
		await advance_until(func(): return model.phase == "race", 10),
		"Native lights approval starts this race"
	)
	# Approved windows are real domain fixture inputs, not scheduled by the UI timeline.
	for id in [3, 6]:
		var plan = StrategyPlan.draft(model.cars[id], model.laps)
		plan.starting_set = model.cars[id].set_id
		check(
			model.command(
				"approve_plan", {"id": id, "plan": plan, "revision": model.policy(id).revision}
			),
			"Accepted strategy fixture for " + model.cars[id].short
		)
	check(
		await advance_until(
			func(): return model.cars[3].completed >= 2 and model.cars[6].completed >= 2, 400
		),
		"Both cars record race laps and telemetry"
	)
	view.refresh()
	retain("race", "Actual racing, measured laps, wheel wear, live telemetry and approved plans")
	for id in [3, 6]:
		view.open_decision(id, true)
		await settle()
		await confirm(view.decision_drawer.box)
	retain("approach", "Two native reviewed and confirmed pit calls in the physical race")
	check(
		await advance_until(
			func(): return model.cars[3].route == "pit" and model.cars[3].pit_stage == "service",
			200
		),
		"Native pit call reaches physical service"
	)
	retain("service", "Actual frozen whole-car service transaction and timer")
	var contract_predicate_3 = func():
		return (
			model.cars[3].pit_stops > 0
			and model.cars[6].pit_stops > 0
			and model.cars[3].route == "track"
			and model.cars[6].route == "track"
		)
	check(
		await advance_until(contract_predicate_3, 300),
		"Both cars physically complete service and rejoin"
	)
	retain("rejoined", "Correlated real entry/exit records and actual fitted stints")
	check(
		await advance_until(func(): return model.phase == "results", 1500),
		"Full race physically reaches results without manufactured finishes"
	)
	check(
		model.cars[3].history.size() > 0 and model.cars[6].history.size() > 0,
		"Final result retains actual completed race laps"
	)
	retain(
		"results",
		"Completed original simulation with actual classification, retirements, fitted stints and pit records"
	)
	# Independent wet-to-drying physical run, seeded model, not a painted forecast fixture.
	model = PracticeRaceSim.new(
		TrackGeometry.new(app.library[7]),
		{"laps": 12, "scenario": "wet", "weather_mode": "seeded", "intensity": "calm", "seed": 86}
	)
	model.command("prepare_race")
	model.paused = true
	await reset()
	await click(view.primary_button)
	check(
		await advance_until(func(): return model.phase == "grid_ready", 200),
		"Wet-session formation remains physical"
	)
	view.refresh()
	await settle()
	await click(view.primary_button)
	check(
		await advance_until(func(): return model.phase == "race" and model.clock >= 90, 220),
		"Seeded wet session evolves real surface and observations"
	)
	retain(
		"weather",
		"Separate seeded wet physical run; observed sectors and public same-horizon cases only"
	)
