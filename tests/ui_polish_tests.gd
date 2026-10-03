extends "res://tests/support/ui_polish_reading_contracts.gd"
## Regression-first polish. Synthetic boundary fixtures are explicitly identified.


func queue_regressions() -> void:
	model = race_fixture()
	await reset()
	var queue = view.decision_queue
	check(
		not queue.slots[3].review.text.contains("On plan"),
		"P01 an empty issue list must not claim an approved plan exists"
	)
	model.cars[3].fuel = 1.0
	queue.present(view.sim, {})
	check(
		queue.entries.get(3, {}).get("issue") == "fuel",
		"P02 urgent fuel advice remains visible when the optional forecast cache is absent"
	)
	var fitted = TyreInventory.find(model.cars[6], model.cars[6].set_id)
	fitted.wheels.FL.punctured = true
	queue.present(view.sim, {})
	check(
		queue.entries.get(6, {}).get("issue") == "tyre" and queue.pending_count >= 2,
		"P02 missing forecasts cannot hide the teammate's damaged tyre"
	)
	queue.present(view.sim, {3: model.forecast(3), 6: model.forecast(6)})
	model.cars[3].dnf = true
	model.cars[6].finished = true
	queue.present(view.sim, {})
	check(
		queue.entries[3].is_empty() and queue.slots[3].hold.disabled,
		"P03 retirement clears stale acknowledgement targets without a forecast"
	)
	check(
		queue.entries[6].is_empty() and queue.slots[6].hold.disabled,
		"P03 finishing clears stale teammate acknowledgement targets"
	)
	check(
		(
			queue.slots[3].review.text.contains("Retired")
			and queue.slots[6].review.text.contains("Finished")
		),
		"P03 terminal driver states are explicit in the stable queue slots"
	)
	check(queue.pending_count == 0, "P03 queue count agrees with the terminal state")


func overlay_regressions() -> void:
	model = race_fixture()
	await reset()
	var overlay = view.battle_overlay
	overlay._process(0)
	var before = overlay.stamp.duplicate(true)
	model.selected_id = 6
	overlay._process(0)
	check(
		before != overlay.stamp,
		"P04 changing selection invalidates a paused battle overlay immediately"
	)
	before = overlay.stamp.duplicate(true)
	model.cars[6].finished = true
	overlay._process(0)
	check(before != overlay.stamp, "P04 finishing invalidates stale battle outlines immediately")
	before = overlay.stamp.duplicate(true)
	model.phase = "results"
	overlay._process(0)
	check(
		before != overlay.stamp,
		"P04 session transition invalidates the battle overlay while paused"
	)


func reading_model_tests() -> void:
	model = race_fixture()
	await reset()
	var before = JSON.stringify(model.snapshot())
	var read = RaceReadModel.capture(model, {})
	check(
		(
			read.drivers.size() == 2
			and read.drivers[0].driver_id == 3
			and read.drivers[1].driver_id == 6
		),
		"P05 reading always contains two stable named own-driver slots"
	)
	check(
		(
			read.drivers[0].evidence.contains("No approved")
			and read.drivers[0].choice.contains("Staying out")
		),
		"P05 calm running explains deliberate waiting without inventing a strategy"
	)
	RaceReadModel.reading(read)
	check(
		before == JSON.stringify(model.snapshot()),
		"P05 reading and formatting do not change the complete authoritative snapshot"
	)
	var public_before = JSON.stringify(RaceReadModel.capture(model, {}))
	model.cars[0].fuel = 9876.543
	model.cars[0].health = 12.345
	model.cars[0].tyre = 3.14159
	check(
		public_before == JSON.stringify(RaceReadModel.capture(model, {})),
		"P05 private rival resources cannot affect or leak into the reading"
	)
	model = race_fixture()
	await reset()
	var button_id = view.race_read_panel.read_button.get_instance_id()
	view.race_read_panel.read_button.grab_focus()
	model.cars[6].fuel = 1.0
	view.forecast_cache.clear()
	view.refresh()
	await settle()
	read = RaceReadModel.capture(model, view.forecast_cache)
	check(
		read.focus.driver_id == 6 and read.focus.priority >= 90,
		"P05 a real teammate fuel issue takes priority over calm running"
	)
	check(
		(
			button_id == view.race_read_panel.read_button.get_instance_id()
			and view.race_read_panel.read_button.has_focus()
		),
		"P05 changing story priority never replaces or retargets the focused reading action"
	)
	var updates = view.race_read_panel.update_count
	for i in range(30):
		view.race_read_panel.present(read)
	check(
		updates == view.race_read_panel.update_count,
		"P05 unchanged read-panel content creates no redundant control updates"
	)
	model = race_fixture()
	await reset()
	var record = model.battle_state.drivers[3]
	record.target_id = 2
	record.phase = "alongside"
	read = RaceReadModel.capture(model, {})
	check(
		(
			read.drivers[0].title.contains("Alongside")
			and read.drivers[0].evidence.contains("neither a pass nor a defence is guaranteed")
		),
		"P06 a genuine battle-state boundary is described without claiming a completed pass"
	)
	check(
		RaceReadModel.recent_evidence(model).is_empty(),
		"P06 an active battle does not fabricate completed-pass evidence"
	)
	model.cars[2].finished = true
	check(
		RaceContestReadModel.observed_contest(model, 3).is_empty(),
		"P06 a finished opponent is not an active contest"
	)
	model.cars[2].finished = false
	record.phase = "recover"
	check(
		RaceContestReadModel.observed_contest(model, 3).is_empty(),
		"P06 recovery is not presented as an ongoing attack"
	)
	model.battle_state.drivers[3].phase = "idle"
	model.cars[3].distance = (model.laps - 1.2) * model.track.length
	check(
		RaceReadModel.capture(model, {}).drivers[0].title == "Closing laps",
		"P06 final-stint emphasis is grounded in the car's remaining physical distance"
	)
	model.cars[3].finished = true
	model.cars[3].finish_position = 3
	read = RaceReadModel.capture(model, {})
	check(
		read.drivers[0].title == "Finished" and read.drivers[0].evidence.contains("finish P3"),
		"P06 recorded finish position replaces final-lap suspense"
	)
	check(
		read.drivers[0].choice.contains("not proof"),
		"P06 the finish is not attributed to a command without causal evidence"
	)
	for phase in [
		"briefing",
		"practice",
		"practice_results",
		"qualifying",
		"qualifying_results",
		"race_preparation",
		"formation",
		"start_ready",
		"results"
	]:
		model = race_fixture()
		model.phase = phase
		before = JSON.stringify(model.snapshot())
		read = RaceReadModel.capture(model, {})
		check(
			(
				not RaceReadModel.reading(read).is_empty()
				and before == JSON.stringify(model.snapshot())
			),
			"P06 phase-specific reading is observational: " + phase
		)


func actual_outcome_tests() -> void:
	model = race_fixture()
	await reset()
	view.open_decision(3, true)
	await settle()
	await confirm(view.decision_drawer.box)
	check(model.cars[3].pit_order, "P07 an actual native reviewed pit command is accepted")
	check(
		RaceReadModel.capture(model, {}).drivers[0].title == "Approaching the accepted stop",
		"P07 an accepted order is described as approach, not execution or completion"
	)
	check(
		RaceReadModel.recent_evidence(model).is_empty(),
		"P07 a command alone is not an observed result"
	)
	check(
		await advance_until(func(): return model.cars[3].route == "pit", 300),
		"P07 the unmodified model physically reaches pit entry"
	)
	check(
		RaceReadModel.capture(model, {}).drivers[0].title == "The stop is unfolding",
		"P07 actual pit entry changes the story to physical execution"
	)
	view.close_detail()
	view.refresh()
	await capture(
		"polish-pit-entry",
		"Actual accepted pit command and physical entry from a disclosed race-entry boundary fixture"
	)
	check(
		await advance_until(func(): return model.cars[3].route == "track", 300),
		"P07 the unchanged simulation completes the physical visit"
	)
	var evidence = RaceReadModel.recent_evidence(model)
	var contract_predicate_0 = func(item):
		return (
			item.text.contains("Pit exit recorded") and item.text.contains("not net race-time loss")
		)
	check(
		evidence.any(contract_predicate_0),
		"P07 only a recorded pit exit supplies measured visit duration, never invented net loss"
	)
	for i in range(RaceReadModel.RECENT_SCAN_LIMIT + 3):
		RaceJournal.append(model.strategy_state, model, "boundary_probe", 3)
	check(
		RaceReadModel.recent_evidence(model).is_empty(),
		"P07 recent evidence honors its bounded scan instead of silently reading the complete journal"
	)
	model.strategy_state.truncated = true
	check(
		RaceReadModel.reading(RaceReadModel.capture(model, {})).contains("retention limit"),
		"P07 incomplete journal retention is disclosed explicitly"
	)


func noninterference_tests() -> void:
	model = race_fixture()
	await reset()
	var control = race_fixture()
	var started = Time.get_ticks_usec()
	for i in range(240):
		model.step()
		control.step()
		RaceReadModel.capture(model, {})
		if i % 40 == 0:
			await process_frame
	check(
		JSON.stringify(model.snapshot()) == JSON.stringify(control.snapshot()),
		"P09 240 identical fixed steps with/without observation preserve all authoritative state and RNG"
	)
	var samples: Array[float] = []
	var before = JSON.stringify(model.snapshot())
	for i in range(200):
		started = Time.get_ticks_usec()
		RaceReadModel.capture(model, {})
		samples.append((Time.get_ticks_usec() - started) / 1000.0)
	samples.sort()
	check(
		before == JSON.stringify(model.snapshot()),
		"P09 repeated performance sampling remains purely observational"
	)
	Storage.write_json(
		"res://reports/race-read-performance.json",
		{
			"passed": true,
			"samples": samples.size(),
			"median_ms": samples[100],
			"p95_ms": samples[190],
			"max_ms": samples.back(),
			"scope":
			(
				"Two-own-driver capture, bounded recent evidence, no forecast "
				+ "recomputation; local runtime diagnostic, not a player-device FPS guarantee"
			)
		}
	)


func run() -> void:
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	app = root.get_node("App")
	await settle()
	app.settings.pitwall_text_scale = 1.0
	await queue_regressions()
	await overlay_regressions()
	await reading_model_tests()
	await actual_outcome_tests()
	await reading_ui_tests()
	await noninterference_tests()
	var report = {
		"passed": failures.is_empty(),
		"checks": checks,
		"errors": failures,
		"captures": captures,
		"screenshots": captures.size(),
		"engine": Engine.get_version_info().string
	}
	Storage.write_json("res://reports/ui-polish.json", report)
	print("UI_POLISH ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
