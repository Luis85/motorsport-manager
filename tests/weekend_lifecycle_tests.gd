extends SceneTree
## Repeated application lifecycle, with real running and no phase/result injection.
## The existing six-lap native journey remains the full sporting demonstration.
var checks: int = 0
var failures: Array[String] = []
var app: Node
var game: Control
var view: MinimalRaceWorkspace
var model: RaceSim
var steps: int = 0
var cycles: Array = []
var old_model: WeakRef
var old_record: WeakRef
var stale_handle: MinimalRaceHandle


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)


func settle() -> void:
	for frame in range(8):
		await process_frame


func advance_until(predicate: Callable, maximum: int = 30000) -> bool:
	if model.phase in RaceSim.ACTIVE:
		check(view.controls.play(), "Explicitly resume active session")
	for index in range(maximum):
		if predicate.call():
			if model.phase in RaceSim.ACTIVE:
				view.controls.pause()
			view.refresh()
			return true
		steps += app.session_runner.advance(RaceSim.STEP)
		if index % 1000 == 0:
			view.refresh()
			await process_frame
	check(false, "Physical lifecycle reached bounded step limit in " + model.phase)
	return false


func bind_view() -> void:
	view = game.content.get_child(0)
	app.session_runner.automatic = false
	view.set_process(false)


func start_weekend(laps: int = 2) -> bool:
	game.show_library()
	await settle()
	check(
		game.launch_draft.stage(
			app.library[7],
			{
				"laps": laps,
				"qual_duration": 240,
				"scenario": "dry",
				"intensity": "calm",
				"seed": 7314
			},
			"Formula"
		),
		"Stage another independent weekend"
	)
	var error = app.commit_weekend_entry(game.launch_draft, game.launch_draft.capture().revision)
	check(error.is_empty(), "Persist new entry before replacing the previous weekend: " + error)
	if not error.is_empty():
		return false
	model = app.weekend
	game.show_weekend()
	bind_view()
	await settle()
	check(
		model.phase == "practice" and model.total_time == 0,
		"New entry starts at actual fresh practice"
	)
	if old_model != null:
		check(old_model.get_ref() == null, "Replacing the weekend releases the previous aggregate")
		check(old_record.get_ref() == null, "Replacing the weekend releases the previous recording")
		check(
			(
				stale_handle.query.capture().is_empty()
				and stale_handle.visual_source.capture().is_empty()
			),
			"Retained old presentation handles cannot keep a race alive or observe its replacement"
		)
		var before = model.snapshot()
		check(
			not stale_handle.controls.send_out(3) and model.snapshot() == before,
			"An old command handle cannot target the newly created weekend"
		)
		stale_handle = null
	return true


func leave_and_resume() -> void:
	check(
		view.controls.send_out(3) and view.controls.send_out(6),
		"Send both drivers through production controls"
	)
	view.controls.play()
	for index in range(120):
		steps += app.session_runner.advance(RaceSim.STEP)
	view.controls.pause()
	var before = model.snapshot()
	var runner_ref = weakref(app.session_runner)
	var view_ref = weakref(view)
	stale_handle = view.session
	game.go_home()
	view = null
	await settle()
	check(
		game.screen_name == "main_menu" and app.session_runner == null,
		"Menu releases the active scheduler"
	)
	check(
		runner_ref.get_ref() == null and view_ref.get_ref() == null,
		"Disposed pitwall and scheduler are not retained by their view handle"
	)
	check(
		model.snapshot() == before and app.has_saved_weekend(),
		"Menu preserves and durably saves the paused sporting state"
	)
	game.continue_weekend()
	bind_view()
	await settle()
	check(
		app.weekend == model and model.snapshot() == before,
		"Continue binds a new view without replacing or advancing the live race"
	)
	check(app.session_runner != null and model.paused, "Continuation remains explicitly paused")
	stale_handle = null


func prepare_race() -> bool:
	var contract_predicate_0 = func():
		return (
			model.practice_driver(3).active.is_empty()
			and model.practice_driver(6).active.is_empty()
		)
	if not await advance_until(contract_predicate_0):
		return false
	check(
		(
			MinimalRaceTiming.practice_best(model, 3) > 0
			and MinimalRaceTiming.practice_best(model, 6) > 0
		),
		"Both actual practice times survive menu/resume"
	)
	check(view.controls.advance_stage(), "End practice through the normal approval")
	if not await advance_until(func(): return model.phase == "practice_results"):
		return false
	check(view.controls.advance_stage(), "Approve qualifying")
	check(view.controls.send_out(3) and view.controls.send_out(6), "Release both qualifiers")
	if not await advance_until(
		func(): return model.cars[3].qual_best > 0 and model.cars[6].qual_best > 0
	):
		return false
	check(view.controls.advance_stage(), "Close qualifying")
	if not await advance_until(func(): return model.phase == "qualifying_results"):
		return false
	check(view.controls.advance_stage(), "Approve physical formation")
	if not await advance_until(func(): return model.phase == "grid_ready"):
		return false
	check(view.controls.advance_stage(), "Approve start lights")
	return await advance_until(func(): return model.phase == "race")


func finish_weekend() -> bool:
	if not await prepare_race():
		return false
	for id in [3, 6]:
		check(view.controls.mode(id, "pace", 0), "Choose Calm through a legal driver command")
	if not await advance_until(func(): return model.phase == "results", 40000):
		return false
	check(
		model.cars[3].finished and model.cars[6].finished,
		"Both cars physically finish the bounded race"
	)
	check(
		PracticeRaceSim.restore_practice(model.snapshot()) != null, "Final checkpoint remains valid"
	)
	return true


func close_finished(cycle: int) -> void:
	var previous_view = weakref(view)
	var previous_runner = weakref(app.session_runner)
	stale_handle = view.session
	game.show_weekend_end()
	view = null
	await settle()
	check(game.screen_name == "weekend_complete", "Completed race opens its factual end screen")
	check(
		previous_view.get_ref() == null and previous_runner.get_ref() == null,
		"Result transition releases the old view and runner while retaining only intended weekend state"
	)
	check(
		game.content.get_child(0).data.managed.all(
			func(driver): return driver.status == "Finished"
		),
		"Actual managed finishes reach the result screen"
	)
	game.show_menu()
	await settle()
	cycles.append(
		{
			"cycle": cycle,
			"phase": model.phase,
			"simulated_seconds": model.total_time,
			"nodes": int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT)),
			"resources": int(Performance.get_monitor(Performance.OBJECT_RESOURCE_COUNT)),
			"orphans": int(Performance.get_monitor(Performance.OBJECT_ORPHAN_NODE_COUNT))
		}
	)
	old_model = weakref(model)
	old_record = weakref(app.recording)
	model = null
	if cycle >= 2:
		for metric in ["nodes", "resources", "orphans"]:
			check(
				cycles[cycle][metric] == cycles[1][metric],
				"After warm-up repeated weekends do not accumulate " + metric
			)
	print("WEEKEND_LIFECYCLE_CYCLE ", JSON.stringify(cycles.back()))


func run() -> void:
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	app = root.get_node("App")
	app.settings.pitwall_layout = "minimal"
	await settle()
	for cycle in range(3):
		if not await start_weekend():
			break
		await leave_and_resume()
		if not await finish_weekend():
			break
		await close_finished(cycle)
	check(cycles.size() == 3, "All three complete weekend cycles reached the menu")
	if cycles.size() == 3:
		await start_weekend()
	var report = {
		"passed": failures.is_empty(),
		"checks": checks,
		"failures": failures,
		"cycles": cycles,
		"steps": steps,
		"seed": 7314,
		"race_laps": 2,
		"provenance":
		"Application commands and fixed-step scheduler; no injected phases, positions or results",
		"memory_scope":
		"Weak ownership plus warmed node/resource/orphan counts, not OS resident-memory equality"
	}
	Storage.write_json("res://reports/weekend-lifecycle-tests.json", report)
	print("WEEKEND_LIFECYCLE ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
