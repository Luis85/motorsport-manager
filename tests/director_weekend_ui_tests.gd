extends "res://tests/director_ui_tests.gd"
## Native default-layout journey. No phase, car-position, stock or result injection.
var milestones: Array = []
func mark(label: String) -> void:
	milestones.append({"label":label,"phase":model.phase,"time":model.total_time,"clock":model.clock})
	print("DIRECTOR_JOURNEY ",label," · ",model.phase," · ",model.total_time)
func snapshot(label: String) -> void:
	view.refresh(); await settle(8)
	await capture("director-weekend-"+label,"Real approved weekend from briefing; native actions and physical fixed steps, no synthetic classification")
func watched_phase(target: String, max_segments: int = 40) -> bool:
	for segment in range(max_segments):
		if model.phase == target: return true
		if model.phase not in RaceSim.ACTIVE: return false
		view.refresh(); await click(view.run_button)
		if not await watch_until_stop(): return false
	return model.phase == target
func run() -> void:
	root.size = Vector2i(1440,900); root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	app = root.get_node("App"); await settle()
	app.settings.pitwall_layout = "director"; app.settings.pitwall_text_scale = 1.0
	model = PracticeRaceSim.new(TrackGeometry.new(app.library[7]), {"laps":6,"qual_duration":240,"scenario":"dry","intensity":"calm","seed":7314,"tactical_duels":true})
	await reset()
	check(model.phase == "briefing" and view.director_enabled,"New weekend opens in the shipping Race Director")
	await snapshot("briefing"); mark("briefing")
	await click(view.practice_button)
	check(view.full_workspace == view.practice_workspace,"Optional practice opens the two-driver programme workspace")
	await click(view.practice_workspace.session_action)
	check(model.phase == "practice","Practice starts by explicit native approval")
	for id in [3,6]:
		var panel = view.practice_workspace.panels[id]
		await click(panel.objective_buttons.tyre_life)
		panel.lap_count.value = 1; await settle()
		check(not panel.run.disabled,"One measured lap is available for "+model.cars[id].short)
		await click(panel.run)
		check(model.practice_driver(id).runs.size() == 1,"Native practice run commits to the named driver")
	await snapshot("practice-running")
	check(await advance_until(func():return model.practice_driver(3).active.is_empty() and model.practice_driver(6).active.is_empty(),400),"Both practice programmes physically return")
	for id in [3,6]:
		check(model.practice_driver(id).runs[0].samples.size()>0,"Real measured practice evidence exists: "+model.cars[id].short)
	await snapshot("practice-evidence"); mark("measured practice")
	await click(view.practice_workspace.finish)
	var end_practice = view.practice_workspace.panels[3].confirmation
	check(is_instance_valid(end_practice) and end_practice.visible,"Ending practice requests confirmation")
	if is_instance_valid(end_practice): await click_dialog(end_practice.get_ok_button())
	check(await advance_until(func():return model.phase == "practice_results",300),"Practice closes without teleporting running cars")
	view.refresh(); await settle(); await click(view.practice_workspace.finish)
	check(model.phase == "briefing" and model.practice_state.status == "complete","Measured practice returns to the weekend briefing")
	await key(KEY_ESCAPE); view.refresh(); await settle()
	await click(view.primary_button)
	check(model.phase == "qualifying","Qualifying starts by stage approval")
	# Explicitly take qualifying control; other channels retain their current owners.
	for id in [3,6]: check(model.command("delegation",{"id":id,"channel":"qualifying","owner":"player"}),"Declare player-owned qualifying release")
	view.refresh(); await settle()
	for id in [3,6]:
		await click(view.driver_cards[id].call_button)
		check(view.call_room.snapshot.driver_id == id,"Qualifying call is pinned to the chosen driver")
		await click(view.call_room.option_buttons.send)
		check(not view.call_room.confirm_button.disabled,"A reviewed banker run is available")
		await click(view.call_room.confirm_button)
		check(model.cars[id].qual_runs == 1 and model.cars[id].route != "garage","Qualifying release enters the real pit exit")
		await key(KEY_ESCAPE)
	await snapshot("qualifying-release")
	check(await advance_until(func():return model.cars[3].qual_best>0 and model.cars[6].qual_best>0,350),"Both cars record a measured flying lap")
	mark("measured qualifying"); await snapshot("qualifying-times")
	for id in [3,6]:
		check(DirectorReadModel.car(model,id).rival.contains("%.3f" % model.cars[id].qual_best),"Qualifying card shows the measured best lap, not a misleading physical race gap")
	# Close only an active session; naturally closed sessions need no second approval.
	if model.phase == "qualifying" and not model.qual_closed:
		await click(view.primary_button)
		var dialog: ConfirmationDialog
		for child in view.get_children():
			if child is ConfirmationDialog and child.visible: dialog = child
		check(dialog != null,"Close qualifying has a native confirmation")
		if dialog != null: await click_dialog(dialog.get_ok_button())
	check(await advance_until(func():return model.phase == "qualifying_results",300),"Qualifying classifications follow physical return")
	view.refresh(); await settle(); await click(view.primary_button)
	check(model.phase == "race_preparation","The player approves race preparation")
	await snapshot("grid-plan"); mark("race preparation")
	await click(view.primary_button)
	check(model.phase == "formation","Formation begins through the native stage action")
	check(await watched_phase("grid_ready",20),"Next moment follows physical formation to a held grid")
	var held_grid = RaceRecord.fingerprint(model.snapshot())
	model.advance(1.0)
	check(model.phase == "grid_ready" and held_grid == RaceRecord.fingerprint(model.snapshot()),"Inactive grid is held until the player approves lights, independent of the active-session pause flag")
	await snapshot("grid-ready")
	await click(view.primary_button)
	check(model.phase == "lights","The player explicitly starts the light sequence")
	check(await watched_phase("race",10),"Lights become real racing through watched fixed steps")
	check(model.paused and model.race_time < 1,"Race start is a bounded decision moment")
	mark("lights out"); await snapshot("lights-out")
	# Preserve an actual pre-call checkpoint for the later experiment.
	check(view.recording.bookmark("Lights out — before the first call").is_empty(),"Real pre-call checkpoint is retained")
	await click(view.driver_cards[3].call_button); await click(view.call_room.option_buttons.protect)
	await click(view.call_room.confirm_button)
	check(model.policy(3).overrides.has("pace"),"A native two-lap tyre-protection call is accepted in the real race")
	await click(view.call_room.watch_button)
	check(await watch_until_stop(),"Accepted instruction leads back into watched racing")
	view.refresh(); await snapshot("racing")
	check(await watched_phase("results",50),"Moment-paced play reaches an actual classified finish")
	check(model.cars.all(func(c):return c.finished or c.dnf),"The field is terminal before the final result")
	check(not model.policy(3).overrides.has("pace"),"The bounded radio instruction is not left active at the finish")
	mark("classified finish")
	await click(view.driver_cards[3].call_button)
	check(view.full_workspace == view.results_workspace,"Finished-driver action opens the actual result workspace")
	await snapshot("classification")
	view.open_topic(7); await settle()
	check(view.full_workspace == view.analysis_workspace and view.accept_button.visible,"Debrief retains explicit original-result acceptance")
	var original = RaceRecord.fingerprint(model.snapshot())
	var error = game.replay_controller.open_data(view.recording.seal())
	check(error.is_empty(),"The completed native weekend loads into the real replay viewer: "+error)
	await settle(10)
	var replay = game.replay_controller.workspace
	if replay != null:
		replay.seek(0); await settle()
		check(replay.player.sim.phase == "race","The retained checkpoint reconstructs the actual lights-out decision")
		await click(replay.branch_button); await settle(12)
		check(replay.sandbox_view != null and replay.sandbox_view.director_enabled,"Try another decision mounts the same default Race Director")
		if replay.sandbox_view != null:
			replay.sandbox_view.set_process(false)
			check(replay.sandbox_view.sim.paused and replay.sandbox_record.origin == "sandbox","The experiment is separate and starts paused")
			check(original == RaceRecord.fingerprint(model.snapshot()),"Branching leaves original time, RNG, stock and result unchanged")
			await capture("director-weekend-sandbox","Native sandbox of an actual pre-call checkpoint; no alteration to original classified result")
			captures.back().original_time = model.total_time
			captures.back().origin = "sandbox"
			captures.back().phase = replay.sandbox_view.sim.phase
			captures.back().time = replay.sandbox_view.sim.total_time
			captures.back().clock = replay.sandbox_view.sim.clock
			await click(replay.sandbox_return); await settle(10)
		await click(replay.return_button); await settle(10)
	check(view.is_visible_in_tree() and game.replay_controller.workspace == null,"Return restores the same original workspace")
	check(original == RaceRecord.fingerprint(model.snapshot()),"The full replay round trip is observational for the original result")
	var report = {"passed":failures.is_empty(),"checks":checks,"errors":failures,"captures":captures,"screenshots":captures.size(),"milestones":milestones,"engine":Engine.get_version_info().string,"provenance":"Actual native briefing, measured practice and qualifying, approved grid, physical race and sandbox; no injected results"}
	Storage.write_json("res://reports/director-weekend-ui.json",report)
	print("DIRECTOR_WEEKEND_UI ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
