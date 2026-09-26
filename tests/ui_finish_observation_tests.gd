extends "res://tests/ui_finish_tests.gd"
## G02–G04: native reproductions first; boundary data is explicitly synthetic.

func click(control: Control) -> void:
	await settle(3)
	var point = control.get_global_rect().get_center()
	var motion = InputEventMouseMotion.new(); motion.position = point; motion.global_position = point
	Input.parse_input_event(motion); await settle(2)
	for down in [true, false]:
		var event = InputEventMouseButton.new(); event.position = point; event.global_position = point
		event.button_index = MOUSE_BUTTON_LEFT; event.pressed = down
		Input.parse_input_event(event); await settle(2)

func inside(control: Control) -> bool:
	return control.is_visible_in_tree() and Rect2(Vector2.ZERO, Vector2(root.size)).encloses(control.get_global_rect())

func visible_copy(node: Node) -> String:
	var result = ""
	if node is Control and not node.is_visible_in_tree(): return result
	if node is Label or node is BaseButton: result += node.text + "\n"
	for child in node.get_children(): result += visible_copy(child)
	return result

func run() -> void:
	root.size = Vector2i(1440,900); root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	app = root.get_node("App"); await settle()
	app.settings.pitwall_text_scale = 1.0
	model = race_fixture(); await reset()
	for id in [3,6]:
		var name_control = view.car_cards[id].name_label
		var width = name_control.get_theme_font("font").get_string_size(name_control.text, HORIZONTAL_ALIGNMENT_LEFT, -1, name_control.get_theme_font_size("font_size")).x
		check(width <= name_control.size.x - 12, "G02 full driver identity fits the wide card without arbitrary truncation: " + model.cars[id].short)
	await capture("observation-baseline", "Synthetic race-entry fixture; native production composition, no fabricated measured laps")
	var fitted = TyreInventory.find(model.cars[3],model.cars[3].set_id)
	fitted.wheels.FL.punctured = true; model.cars[3].fuel = 1
	view.forecast_cache.clear(); view.refresh(); await settle()
	var pending = DecisionFeed.for_driver(model,3,model.policy(3),view.forecast_cache[3]).filter(func(item): return not item.acknowledged).size()
	check(pending >= 2, "G03 fixture supplies multiple real feed issues for the same driver")
	check(visible_copy(view.decision_queue).contains("CRITICAL"), "G03 critical severity is visible without a tooltip")
	check(view.decision_queue.slots[3].review.text.contains(str(pending)), "G03 pending count is visible on the stable named-driver slot")
	var before = JSON.stringify(model.snapshot())
	await click(view.decision_queue.slots[3].review)
	check(view.tabs.current_tab == view.decision_page_index and before == JSON.stringify(model.snapshot()), "G03 native queue review navigates without issuing commands")
	var selector = view.decision_drawer.get("issue_selector")
	check(selector != null, "G03 every counted issue has a stable action-specific selector in the drawer")
	if selector != null:
		selector.grab_focus(); await key(KEY_ENTER); await key(KEY_DOWN); await key(KEY_ENTER)
		check(view.decision_drawer.snapshot.primary.issue == "fuel" and view.decision_drawer.fuel.visible, "G03 selecting the fuel issue exposes its action without replacing a command")
		check(before == JSON.stringify(model.snapshot()), "G03 secondary-issue inspection leaves RNG, commands and speed unchanged")
	await capture("multiple-issues", "Synthetic puncture/low-fuel boundary; native queue and action-specific review")
	model = PracticeRaceSim.new(TrackGeometry.new(app.library[7]), {"laps":24,"scenario":"dry","intensity":"calm","seed":7314})
	check(model.command("qualify"), "G04 real qualifying session approval")
	model.paused = true; await reset()
	var release = RaceForecaster.qualifying_release(model,model.cars[3])
	var summary = visible_copy(view.qualifying_workspace)
	check(summary.contains("%.0f" % release.required_seconds) and summary.to_lower().contains("latest"), "G04 required hot-lap time and latest release are visible outside hover")
	await capture("qualifying-release-context", "Real qualifying approval, both cars still in the garage")
	var report = {"passed":failures.is_empty(),"checks":checks,"errors":failures,"captures":captures,"screenshots":captures.size(),"engine":Engine.get_version_info().string}
	Storage.write_json("res://reports/ui-finish-observation.json",report)
	print("UI_FINISH_OBSERVATION ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
