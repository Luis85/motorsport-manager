extends "res://tests/ui_finish_observation_tests.gd"
## Default-layout native input; engineering tests separately exercise the retained layout.
func reset() -> void:
	app.weekend = model; game.show_weekend()
	view = game.content.get_child(0); view.set_process(false)
	await settle(8)
func dialog_key(window: Window, code: Key) -> void:
	for down in [true,false]:
		var event = InputEventKey.new(); event.keycode = code; event.pressed = down
		window.push_input(event); await settle(3)
func click_dialog(control: Control) -> void:
	control.grab_focus(); await dialog_key(control.get_window(),KEY_ENTER)
func text_fits(control: Control) -> bool:
	var font = control.get_theme_font("font"); var points = control.get_theme_font_size("font_size")
	for line in control.text.split("\n"):
		if font.get_string_size(line,HORIZONTAL_ALIGNMENT_LEFT,-1,points).x > control.size.x-(control.get_theme_stylebox("normal").get_minimum_size().x if control is Button else 0)+0.5: return false
	return true
func watch_until_stop(limit: int = 20000) -> bool:
	for i in range(limit):
		if not view.director.armed: view.refresh(); await settle(); return true
		model.advance(0.05)
		if i%200 == 0: view.refresh(); await process_frame
	return false
func profiles() -> void:
	for scale in [1.0,1.15,1.3]:
		for viewport in [Vector2i(1440,900),Vector2i(1100,720)]:
			root.size = viewport; root.content_scale_size = viewport
			app.settings.pitwall_text_scale = scale
			model = race_fixture(); await reset()
			var tag = "%dx%d-%d" % [viewport.x,viewport.y,roundi(scale*100)]
			check(view.director_enabled and view.get_script().get_global_name() == "RaceDirectorWorkspace","Default production layout: "+tag)
			check(inside(view.run_button) and inside(view.pause_button) and inside(view.primary_button) == view.primary_button.visible,"Time and stage controls are contained: "+tag)
			check(inside(view.canvas) and view.canvas.size.y >= 120,"Circuit remains a usable viewport: "+tag)
			check(not view.right_panel.visible and not view.navigation.visible,"Advanced controls do not compete with the default pit wall: "+tag)
			check(inside(view.race_read_button) and view.race_read_button.text == "Race story","Recoverable race story stays directly available: "+tag)
			check(view.follow_control.get_theme_color("font_color").get_luminance()>0.65,"Follow text contrasts against the dark toolbar: "+tag)
			var columns = 0.0
			for i in range(view.tower.columns): columns += view.tower.get_column_width(i)
			check(columns <= view.tower.size.x-4,"Full timing columns fit without horizontal clipping: "+tag)
			for id in [3,6]:
				var card = view.driver_cards[id]
				for target in [card,card.call_button,card.plan_button,card.follow_button]: check(inside(target),"Stable driver controls stay visible: "+tag+" / "+str(id))
				for label in [card.heading,card.tyre,card.fuel,card.call_button,card.plan_button]: check(text_fits(label),"Full essential text fits: "+tag+" / "+str(id)+" / "+label.text)
			await capture("director-live-"+tag,"Declared synthetic race-entry layout fixture; not a completed race")
			var before = RaceRecord.fingerprint(model.snapshot())
			await click(view.driver_cards[3].call_button)
			check(view.call_room.visible and view.call_room.snapshot.driver_id == 3,"Named native driver action opens the correct snapshot: "+tag)
			check(before == RaceRecord.fingerprint(model.snapshot()),"Already-paused inspection changes no authoritative state: "+tag)
			for key in ["push","protect","fuel","pit"]:
				check(inside(view.call_room.option_buttons[key]) and text_fits(view.call_room.option_buttons[key]),"Full option and consequences fit: "+key+" / "+tag)
			check(inside(view.call_room.keep_button) and inside(view.call_room.confirm_button),"Decision footer is fixed and contained: "+tag)
			await click(view.call_room.option_buttons.push)
			check(before == RaceRecord.fingerprint(model.snapshot()),"Choosing an option is not a command: "+tag)
			check(not view.call_room.confirm_button.disabled and text_fits(view.call_room.confirm_button),"Named confirmation is legible and available: "+tag)
			await capture("director-call-"+tag,"Native frozen snapshot with chosen, uncommitted two-lap pace intent")
			await key(KEY_ESCAPE)
			check(not view.call_room.visible and root.gui_get_focus_owner() == view.driver_cards[3].call_button,"Escape restores the exact named driver action: "+tag)
			check(before == RaceRecord.fingerprint(model.snapshot()),"Escape never sends the staged call: "+tag)
func interaction_tests() -> void:
	root.size = Vector2i(1440,900); root.content_scale_size = root.size; app.settings.pitwall_text_scale = 1.0
	model = race_fixture(); await reset()
	# Only the explicit Pause & decide path changes time, not navigation.
	model.command("pause"); model.command("speed",{"value":4}); view.refresh()
	await click(view.driver_cards[6].call_button)
	check(model.paused and model.speed == 4,"Explicit named decision pauses without changing chosen speed")
	check(view.call_room.snapshot.driver_id == 6 and view.call_room.heading.text.contains("Lucas Moreau"),"Full teammate identity is pinned")
	await click(view.call_room.option_buttons.fuel)
	model.selected_id = 3
	await click(view.call_room.confirm_button)
	check(model.policy(6).overrides.has("engine") and not model.policy(3).overrides.has("engine"),"Selection changes cannot retarget a staged radio instruction")
	check(view.call_room.outcome_panel.visible and view.call_room.outcome_metrics.text.contains("Fuel on board"),"Acceptance exposes observed follow-through, not just a toast")
	var sequence = model.strategy_state.sequence
	view.call_room.commit(); view.call_room.commit()
	check(sequence == model.strategy_state.sequence,"Repeated commit cannot duplicate an accepted call")
	await capture("director-radio-accepted","Actual named Moreau engine intent; current observations separated from causality")
	await click(view.call_room.watch_button)
	check(not view.call_room.visible and view.director.armed and model.speed == 8,"Watch accepted instruction returns to the real circuit at explicit 8x")
	check(await watch_until_stop(),"Actual simulation reaches an observed check-in")
	check(model.paused and model.speed == 4,"Check-in restores the previous speed and pauses")
	for segment in range(12):
		if not model.policy(6).overrides.has("engine"): break
		await click(view.run_button); check(await watch_until_stop(),"Watch segment remains bounded")
	check(not model.policy(6).overrides.has("engine"),"Actual two-lap instruction expires")
	view.refresh(); await click(view.driver_cards[6].call_button)
	check(view.call_room.message.text.contains("Completed"),"The named call shows the recorded handback")
	check(view.call_room.snapshot.forecast.time < model.total_time,"Reopening an accepted call preserves the acceptance snapshot, not a misleading fresh one")
	await capture("director-radio-outcome","Physical two-lap handback and actual observed resource changes; no measured benefit claimed")
	await key(KEY_ESCAPE)
	# Stale source revisions, phase changes and unavailable pit stock never authorize.
	model = race_fixture(); await reset(); await click(view.driver_cards[3].call_button); await click(view.call_room.option_buttons.pit)
	model.command("pace",{"id":3,"value":0}); view.refresh()
	check(view.call_room.confirm_button.disabled and view.call_room.stage_label.text.contains("STALE"),"Changed source revision invalidates the previous choice")
	sequence = model.commands.size(); view.call_room.commit()
	check(sequence == model.commands.size() and not model.cars[3].pit_order,"Stale confirmation cannot order a stop")
	await click(view.call_room.refresh_button); await click(view.call_room.option_buttons.pit)
	check(not view.call_room.confirm_button.disabled,"Explicit refresh captures a new available stop")
	await click(view.call_room.confirm_button)
	var replacement = view.call_room.receipt.payload.set_id
	check(model.cars[3].pit_order,"Current reviewed stop is accepted")
	await click(view.call_room.watch_button)
	for segment in range(20):
		check(await watch_until_stop(),"Physical pit watch yields at a bounded moment")
		if model.cars[3].route == "track" and model.cars[3].pit_stops == 1: break
		await click(view.run_button)
	check(model.cars[3].pit_stops == 1 and model.cars[3].set_id == replacement and model.cars[3].route == "track","Physical stop fits the exact finite set and rejoins")
	await click(view.driver_cards[3].call_button)
	check(view.call_room.message.text.contains("Completed") and not view.call_room.receipt.entry_id.is_empty(),"Completion matches the order's actual pit entry and exit")
	await capture("director-pit-outcome","Actual one-stop service, fitted replacement and matching physical exit")
	await key(KEY_ESCAPE)
	# Both complete layouts share one model; browsing cannot lose an advanced draft.
	var old = RaceRecord.fingerprint(model.snapshot())
	view.director_plan(3); await settle()
	check(view.full_workspace == view.analysis_workspace and inside(view.analysis_workspace),"Race plan opens the existing full engineering workspace")
	check(old == RaceRecord.fingerprint(model.snapshot()),"Opening the plan changes no commands, RNG, time or ownership")
	await key(KEY_ESCAPE); await settle()
	view.set_director_enabled(false); await settle()
	check(view.navigation.visible and not view.director_cards.visible and view.guide.flow == "pit wall","Engineering layout and original tutorial remain available")
	view.set_director_enabled(true); await settle()
	check(not view.navigation.visible and view.director_cards.visible and view.guide.flow == "race director","Default layout restores with independent guide progress")
	check(old == RaceRecord.fingerprint(model.snapshot()),"Switching inactive layouts cannot change the sporting state")
	await click(view.tools_button)
	check(view.navigator.visible and view.navigator.search.has_focus(),"All tools opens with native search focus")
	await dialog_key(view.navigator,KEY_ESCAPE)
	check(not view.navigator.visible and view.tools_button.has_focus(),"All tools Escape returns to its visible button")
	view.open_destination(6,1); await settle()
	check(view.full_workspace == view.analysis_workspace and view.analysis_workspace.drivers[view.own_selection()].has_focus(),"All tools destination places focus in the visible full workspace")
	await key(KEY_ESCAPE); await settle()
	view.guide.open_guide(); await settle()
	check(view.guide.target == view.director_strip and inside(view.guide.card),"Default tutorial introduces the actual new flow")
	await capture("director-guide","Native resumable, observational Race Director guide")
	view.guide.dismiss()
	var prior_speed = model.speed
	await click(view.run_button); check(view.director.armed,"Leave test arms the temporary watch")
	game.go_home(); await settle(12)
	check(model.paused and model.speed == prior_speed,"Confirmed exit cancels the temporary watch before saving")
func run() -> void:
	root.size = Vector2i(1440,900); root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	app = root.get_node("App"); await settle(); app.settings.pitwall_layout = "director"
	await profiles(); await interaction_tests()
	var report = {"passed":failures.is_empty(),"checks":checks,"errors":failures,"captures":captures,"screenshots":captures.size(),"engine":Engine.get_version_info().string}
	Storage.write_json("res://reports/director-ui.json",report); print("DIRECTOR_UI ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
