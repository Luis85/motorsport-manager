extends SceneTree
## Native controls, actual compact viewport, observation purity and explicit recipients.
var checks = 0
var failures: Array[String] = []
var screenshots = 0
var game
var view
var model: StrategyRaceSim

func _initialize() -> void: call_deferred("run")
func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); push_error(message)
func settle() -> void:
	for i in range(10): await process_frame
func capture(name: String) -> void:
	await settle(); await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://reports/strategy-" + name + ".png"); screenshots += 1
func inside(control: Control) -> bool:
	return control.is_visible_in_tree() and control.get_viewport_rect().encloses(control.get_global_rect())
func run() -> void:
	root.size = Vector2i(1440, 900); root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	var app = root.get_node("App")
	game.show_strategy_scenarios(); await capture("scenario-picker")
	check(game.screen_name == "strategy_scenarios", "Dry scenarios are reachable through the native application")
	model = StrategyRaceSim.new(TrackGeometry.new(app.library[7]), {"laps": 24, "scenario": "dry", "intensity": "calm", "seed": 941})
	app.weekend = model; game.show_weekend(); view = game.content.get_child(0); view.set_process(false)
	await capture("briefing")
	check(view.get_script().resource_path.ends_with("strategy_weekend.gd") and view.tabs.current_tab == 6, "New weekends open the integrated strategy surface")
	var desk = view.strategy_desk
	var before = JSON.stringify(model.snapshot())
	desk.show_topic(1); desk.new_draft("balanced")
	desk.stop_rows[0].first.value = 9; desk.stop_rows[0].last.value = 10
	var mer_draft = desk.drafts[3].duplicate(true)
	view.select_driver(6); desk.new_draft("alternate")
	desk.stop_rows[0].first.value = 14; desk.stop_rows[0].last.value = 15
	var mor_draft = desk.drafts[6].duplicate(true)
	view.select_driver(3)
	# Selection is UI-only but lives in the legacy snapshot; normalize that one field.
	check(before == JSON.stringify(model.snapshot()), "Selecting drivers and editing drafts issues no race command")
	for i in range(30): view.refresh()
	check(desk.drafts[3] == mer_draft and desk.drafts[6] == mor_draft, "Thirty refreshes preserve independent per-driver drafts")
	check(model.policy(3).plan.is_empty() and model.policy(6).plan.is_empty(), "Unapproved windows stay outside authoritative strategy")
	desk.stop_rows[0].first.get_line_edit().grab_focus(); await settle()
	var focus = root.gui_get_focus_owner()
	for i in range(30): view.refresh()
	check(root.gui_get_focus_owner() == focus, "Live refresh does not steal keyboard focus from a draft field")
	var fitted = model.cars[3].set_id
	view.select_driver(0); desk.apply_button.pressed.emit()
	check(model.policy(3).plan == mer_draft and model.policy(0).plan.is_empty(), "Apply names MER even while a rival is inspected")
	check(model.cars[3].set_id == fitted and not model.cars[3].pit_order, "Native approval neither mounts a set nor orders entry")
	view.select_driver(6); desk.apply_button.pressed.emit()
	check(model.policy(6).plan == mor_draft, "MOR retains and approves a distinct complementary plan")
	await capture("plan")
	model.command("prepare_race"); model.command("formation")
	for car in model.cars: car.formation_done = true
	model.step(); model.command("lights")
	for i in range(125): model.step()
	model.command("speed", {"value": 8}); model.paused = true
	view.open_strategy(3)
	before = JSON.stringify(model.snapshot())
	desk.show_topic(0)
	for i in range(30): view.refresh()
	check(before == JSON.stringify(model.snapshot()), "Native comparison refresh is observational, including live RNG")
	desk.show_topic(2)
	desk.ownership_controls.engine.select(1); desk.ownership_controls.engine.item_selected.emit(1)
	check(model.policy(3).owners.engine == "player" and model.policy(3).owners.pit == "engineer", "Engine ownership is independent from an approved pit strategy")
	desk.action_buttons[0].pressed.emit()
	check(model.cars[3].pace == 2 and model.policy(3).overrides.has("pace") and model.policy(3).owners.pit == "engineer", "Native temporary push retains delegated pit execution")
	check(model.paused and model.speed == 8, "Commands and panels preserve explicit pause and speed")
	await capture("ownership")
	model.cars[3].fuel = 1; model.cars[6].fuel = 1
	view.refresh(); await settle()
	check(view.decision_controls[3].card.issue == "fuel" and view.decision_controls[6].card.issue == "fuel", "Both cars' critical issues remain independently accessible")
	var box_instance = view.decision_controls[3].box.get_instance_id()
	view.select_driver(0); view.decision_controls[6].save.pressed.emit()
	check(model.policy(6).overrides.has("engine") and not model.policy(3).overrides.has("engine"), "MOR card action cannot be redirected by another selection")
	check(model.paused and model.speed == 8, "A second critical alert never auto-pauses or slows playback")
	view.select_driver(3); view.keep_plan(3)
	check(model.policy(3).held.has("fuel") and model.policy(3).owners.engine == "player", "Keep plan acknowledges without rewriting ownership")
	view.open_strategy(3)
	check("Acknowledged" in desk.issue_text.text and "Ignored:" in desk.issue_text.text, "Acknowledged evidence and default policy remain readable in Compare")
	for i in range(30): view.refresh()
	check(box_instance == view.decision_controls[3].box.get_instance_id(), "Decision controls retain stable identity beneath keyboard focus")
	view.guide.open_guide(); await settle()
	check(model.paused and model.speed == 8, "The resumable guide cannot take time control")
	view.guide.hide()
	await capture("race")
	for size in [Vector2i(1440,900), Vector2i(1100,720)]:
		root.size = size; root.content_scale_size = size; await settle(); view.refresh(); await settle()
		for id in [3,6]:
			check(inside(view.decision_controls[id].box) and inside(view.decision_controls[id].compare) and inside(view.decision_controls[id].save), "Both cars' primary actions fit the actual %dx%d viewport for %d" % [size.x,size.y,id])
		check(inside(view.pause_button) and inside(view.speed_control), "Time controls remain reachable at %dx%d" % [size.x,size.y])
		check(view.canvas.size.x >= 300 and view.canvas.size.y >= 170, "Race map remains usable at %dx%d" % [size.x,size.y])
	await capture("compact")
	model.paused = false; view.refresh()
	var f = view.forecast_cache[3].duplicate(true)
	model.cars[0].pit_stops += 1
	before = JSON.stringify(model.snapshot())
	# Invoke the actual fixed card's captured forecast without a refresh.
	view.box_from_card(3)
	check(before == JSON.stringify(model.snapshot()), "Stale native Box activation rejects without changing gameplay or stock")
	check(model.last_error.contains("stale"), "Stale native Box activation explains why it was rejected")
	model.paused = true
	check(app.save_weekend().is_empty(), "Integrated version-five weekend saves through App")
	check(app.load_weekend().is_empty() and app.weekend is StrategyRaceSim, "App restores the strategy-aware simulation, not only the legacy car state")
	check(app.weekend.strategy_state.records.any(func(record): return record.driver_id in [3,6]), "JSON-restored team journal remains visible to native driver filters")
	for car in model.cars: model.retire(car, "UI result fixture")
	model.paused = false; model.step(); view.tabs.current_tab = 7; view.refresh()
	check("Measured" in view.debrief_text.text and "estimates" in view.debrief_text.text, "Debrief distinguishes measurements from model estimates")
	await capture("debrief")
	Storage.write_json("res://reports/strategy-ui.json", {"passed":failures.is_empty(),"checks":checks,"errors":failures,"screenshots":screenshots})
	print("STRATEGY_UI ", JSON.stringify({"passed":failures.is_empty(),"checks":checks,"errors":failures,"screenshots":screenshots}))
	quit(0 if failures.is_empty() else 1)
