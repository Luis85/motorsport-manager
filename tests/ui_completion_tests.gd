extends SceneTree
## Integration acceptance for the actual UI plan components and command boundaries.
var checks=0
var failures: Array[String]=[]
var screenshots=0
var game
var app
var view
var model: PracticeRaceSim
func _initialize():call_deferred("run")
func check(value: bool,message: String) -> void:
	checks+=1
	if not value:failures.append(message);push_error(message)
func settle(frames: int=5) -> void:
	for i in range(frames):await process_frame
func inside(control: Control) -> bool:
	if not control.is_visible_in_tree() or not root.get_visible_rect().encloses(control.get_global_rect()):return false
	var ancestor=control.get_parent()
	while ancestor:
		if ancestor is Control and ancestor.clip_contents and not ancestor.get_global_rect().encloses(control.get_global_rect()):return false
		ancestor=ancestor.get_parent()
	return true
func capture(name: String) -> void:
	await settle();await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://reports/completion-"+name+".png");screenshots+=1
func joy(button: JoyButton) -> void:
	for down in [true,false]:
		var event=InputEventJoypadButton.new();event.button_index=button;event.pressed=down;Input.parse_input_event(event);await settle(2)
func key(code: Key) -> void:
	for down in [true,false]:
		var event=InputEventKey.new();event.keycode=code;event.pressed=down;Input.parse_input_event(event);await settle(2)
func fixture() -> PracticeRaceSim:
	var m=PracticeRaceSim.new(TrackGeometry.new(app.library[7]),{"laps":24,"scenario":"dry","intensity":"calm","seed":7314})
	m.phase="race";m.paused=true
	for c in m.cars:
		c.route="track";c.distance=300+(12-c.id)*24;c.previous_distance=c.distance;c.speed=40
	return m
func reset(scale_factor: float=1.0) -> void:
	app.settings.pitwall_text_scale=scale_factor;app.weekend=model;game.show_weekend();view=game.content.get_child(0);view.set_process(false);await settle(10)
func run() -> void:
	root.size=Vector2i(1440,900);root.content_scale_size=root.size
	game=load("res://scenes/main.tscn").instantiate();root.add_child(game);app=root.get_node("App");await settle()
	model=fixture();await reset()
	check(view.session_header is RaceSessionHeader and view.session_header.visible,"UI-02 uses one active extracted header")
	check(view.timing_view is RaceTimingTower and view.tower==view.timing_view.tower,"UI-02 timing component owns the real Tree")
	check(view.race_workspace is RaceObservationWorkspace,"UI-04 uses the observation workspace")
	check(view.decision_queue is RaceDecisionQueue and view.decision_drawer is RaceDecisionDrawer,"UI-03 queue and drawer are live components")
	check(view.gamepad_navigation!=null,"UI-10 gamepad route is installed")
	var mapped=InputMap.action_get_events("ui_accept").size();view.gamepad_navigation.configure(view)
	check(InputMap.action_get_events("ui_accept").size()==mapped,"Controller bindings remain idempotent across view configuration")
	view.watch_button.grab_focus();await joy(JOY_BUTTON_DPAD_RIGHT)
	check(root.gui_get_focus_owner()==view.group_buttons.Strategy,"Controller D-pad traverses the native task navigation")
	check(view.session_header.speed_control.accessibility_name=="Simulation speed","Time scale control has semantic metadata")
	check(view.session_header.pause_button.accessibility_name.length()>0,"Header pause has an explicit semantic name")
	var before=JSON.stringify(model.snapshot());var nodes=get_node_count();var updates=view.timing_view.update_count
	for i in range(40):view.refresh()
	check(before==JSON.stringify(model.snapshot()),"All workspace refreshes are observational")
	check(nodes==get_node_count() and updates==view.timing_view.update_count,"Stable updates preserve nodes and timing rows")
	await capture("race")
	view.open_decision(3);await settle()
	check(view.tabs.current_tab==view.decision_page_index and inside(view.decision_drawer.box),"Decision review is reachable and commits stay fixed")
	check(view.decision_drawer.stage=="REVIEW","A decision starts in review, never commits on inspection")
	before=JSON.stringify(model.snapshot());view.decision_drawer.prepare("pit")
	check(view.decision_drawer.stage=="CONFIRM" and before==JSON.stringify(model.snapshot()),"First activation stages the exact pit call without model changes")
	await capture("decision-confirm")
	view.decision_drawer.reset_review();check(before==JSON.stringify(model.snapshot()),"Canceling confirmation leaves the race untouched")
	view.decision_drawer.prepare("pit");var time=model.total_time;model.total_time+=RaceForecaster.MAX_AGE+1
	view.decision_drawer.refresh_state();var commands=model.commands.size();view.decision_drawer.prepare("pit")
	check(view.decision_drawer.stale and view.decision_drawer.box.disabled and model.commands.size()==commands,"Stale evidence is blocked; no silent replacement command")
	await capture("decision-stale")
	model.total_time=time;view.open_decision(3);await settle();view.decision_drawer.box.grab_focus();await joy(JOY_BUTTON_A)
	check(view.decision_drawer.stage=="CONFIRM","Controller A activates the native focused confirmation action")
	view.decision_drawer.reset_review();view.decision_drawer.box.grab_focus();await key(KEY_ENTER)
	check(view.decision_drawer.stage=="CONFIRM","Native Enter stages the displayed pit call")
	await key(KEY_ENTER)
	check(model.cars[3].pit_order and not model.cars[6].pit_order,"Confirmed pit call targets only the displayed car")
	check(view.decision_drawer.stage=="EXECUTING","Accepted command enters executing state")
	model=fixture();await reset();model.cars[6].fuel=1.0;view.refresh();view.open_decision(6)
	check(not view.decision_drawer.snapshot.primary.is_empty(),"Fuel issue comes from the authoritative DecisionFeed")
	before=JSON.stringify([model.cars[6].pit_order,model.paused,model.speed]);view.decision_drawer.keep_plan()
	check(view.decision_drawer.stage=="ACKNOWLEDGED" and before==JSON.stringify([model.cars[6].pit_order,model.paused,model.speed]),"Keep plan acknowledges without pit or time changes")
	model=fixture();await reset();view.open_strategy(3);view.strategy_desk._toggle_timeline();view.open_analysis_workspace();await settle()
	check(view.full_workspace==view.analysis_workspace and view.right_panel.get_parent()==view.analysis_workspace.content,"Focused analysis reuses the existing live inspector")
	check(inside(view.strategy_desk.box_now) and view.strategy_desk.timeline.options==view.strategy_desk.preview.options,"Strategy schedules use actual forecaster candidates")
	check(view.strategy_desk.timeline.update_count>0 and not view.strategy_desk.timeline.accessibility_description.is_empty(),"Strategy chart exposes data and text alternative")
	check(not view.teammate_buttons[0].get_parent().visible,"Focused analysis removes the duplicate recipient/expand toolbar")
	await capture("strategy")
	await key(KEY_ESCAPE);check(view.full_workspace==null and view.right_panel.get_parent()==view.inspector_home,"Escape restores the original inspector parent")
	view.open_analysis_workspace();await settle();view.watch_button.pressed.emit();await settle()
	check(view.full_workspace==null and view.race_workspace.visible and not view.right_panel.visible,"Race view exits focused analysis without leaving an empty workspace")
	view.open_topic(1);view.telemetry_inspector.selector.select(2);view.telemetry_inspector._choose(2);await settle()
	check(view.telemetry_chart==view.trace and view.telemetry_chart.unit=="laps","One telemetry chart uses the selected metric and correct units")
	view.select_driver(0);await settle();check(not view.telemetry_inspector.is_visible_in_tree(),"Rival inspection conceals the complete private telemetry component")
	view.select_driver(3);view.open_topic(1);await capture("telemetry")
	view.open_topic(3);view.show_tyres(0);await settle();check(view.tyre_readout.planned.text.length()>0,"Tyres distinguish planned from physically fitted identity");await capture("tyres")
	model.phase="race_preparation";view.refresh();view.open_topic(4);await settle()
	before=JSON.stringify(model.cars[3].car_setup);view.racecraft.sliders.wing.value=7
	check(view.racecraft.fields.wing.value==7 and view.racecraft.drafts[3].wing==7,"Setup slider is synchronized with the numeric draft")
	check(before==JSON.stringify(model.cars[3].car_setup),"Staged visual setup does not apply itself")
	check(view.racecraft.draft_effects.text.contains("DRAFT EFFECTS"),"Setup shows actual model-derived draft effects")
	await capture("setup");view.racecraft.revert();model.phase="race";view.refresh()
	view.open_topic(8);await settle();check(view.team_panel.driver_summaries.size()==2,"Team inspector names both actual drivers");await capture("team")
	view.open_topic(9);await settle();check(view.weather_panel.outlook_chart.mode=="cases","Weather keeps independent same-horizon stress cases");await capture("weather")
	view.open_topic(2);await settle();check(view.radio_inspector.rows.size()==8 and view.radio_inspector.caption.text.begins_with("LIVE"),"Radio has bounded chronological message cards")
	view.radio_inspector._older();check(view.radio_inspector.history_mode,"Older radio explicitly enters a history snapshot");await capture("radio")
	view.close_detail();var command_count=model.commands.size();await joy(JOY_BUTTON_RIGHT_SHOULDER)
	check(model.selected_id==6 and model.commands.size()==command_count,"Controller shoulder changes selection without orders")
	await joy(JOY_BUTTON_X);check(view.tabs.current_tab==view.decision_page_index,"Controller X reviews the selected car, never boxes directly")
	await joy(JOY_BUTTON_B);check(not view.right_panel.visible,"Controller B returns to the race")
	var paused=model.paused;await joy(JOY_BUTTON_START);check(model.paused!=paused,"Controller Start explicitly toggles pause");model.paused=true
	model=PracticeRaceSim.new(model.track,{"laps":24,"scenario":"dry","intensity":"calm","seed":15});await reset()
	view.open_practice_workspace();await settle()
	check(view.full_workspace==view.practice_workspace and inside(view.practice_workspace.panels[3].objective_buttons.tyre_life) and inside(view.practice_workspace.panels[6].objective_buttons.tyre_life),"Both driver programmes appear simultaneously")
	before=JSON.stringify(model.snapshot());view.practice_workspace.panels[6].update_draft("laps",3)
	check(view.practice_panel.drafts[6].laps==3 and view.practice_panel.drafts[3].laps==2,"Practice editors share per-driver drafts without cross-driver changes")
	check(before==JSON.stringify(model.snapshot()),"Editing a programme remains unapplied")
	await capture("practice")
	view.practice_workspace.session_action.pressed.emit();await settle()
	check(model.phase=="practice","Dashboard session action starts real optional practice")
	view.practice_workspace.panels[6].run.pressed.emit();await settle()
	check(not model.practice_driver(6).active.is_empty() and model.practice_driver(3).active.is_empty(),"Dashboard releases only the commanded programme driver")
	var modal=AcceptDialog.new();view.add_child(modal);modal.popup_centered();await settle()
	paused=model.paused;await joy(JOY_BUTTON_START);check(model.paused==paused,"Global controller time commands do not leak through a modal")
	modal.hide();modal.queue_free();await settle()
	model.phase="briefing" # Subsequent qualifying fixture is a separate session-state presentation check.
	view.close_session_workspace();check(view.race_workspace.visible,"Closing practice restores race observation")
	model.command("qualify",{});model.paused=true;view.refresh();view.close_detail();await settle()
	check(view.qualifying_workspace.visible and view.qualifying_workspace.labels.size()==2,"Qualifying has specialized run-state/feasibility context")
	await capture("qualifying")
	model.phase="qualifying_results";model.cars[3].qual_best=91.2;model.cars[6].qual_best=92.1;view.refresh();view.open_results_workspace();await settle()
	check(view.full_workspace==view.results_workspace and view.results_panel.get_parent()==view.results_workspace.pages[0],"Results is a first-class workspace reusing classification")
	check(view.results_panel.rows[0].get_metadata(0)==3 and view.results_panel.rows[0].get_text(3)=="POLE","Results keeps qualifying semantics")
	await capture("results");view.results_workspace.show_page(1);await settle();await capture("results-laps")
	view.results_workspace.show_page(3);await settle();check(view.results_workspace.journal!=null,"Full results integrates structured decision evidence")
	await capture("decision-history")
	await key(KEY_ESCAPE);check(view.results_panel.get_parent()==view.results_home,"Results restores stable original classification after close")
	for pair in [[Vector2i(1280,800),1.15],[Vector2i(1100,720),1.3]]:
		root.size=pair[0];root.content_scale_size=root.size;model=fixture();await reset(pair[1])
		view.open_decision(3);await settle()
		check(inside(view.pause_button) and inside(view.decision_drawer.box) and inside(view.decision_drawer.refresh_button),"Scaled decision commitment remains reachable "+str(pair))
		await capture("decision-"+str(pair[0].x))
		model=PracticeRaceSim.new(model.track,{"laps":24,"scenario":"dry","intensity":"calm","seed":15});await reset(pair[1])
		view.open_practice_workspace();await settle()
		check(inside(view.practice_workspace.session_action),"Scaled practice start is fixed and reachable "+str(pair))
		view.practice_workspace.session_action.pressed.emit();model.paused=true;view.refresh();await settle()
		check(inside(view.practice_workspace.panels[3].run) and inside(view.practice_workspace.panels[6].run),"Both scaled programme Run actions remain visible "+str(pair))
		for id in [3,6]:check(inside(view.practice_workspace.panels[id].objective_buttons.tyre_life),"Scaled programme input remains reachable "+str(id)+" "+str(pair))
		await capture("practice-"+str(pair[0].x))
		view.close_session_workspace();view.open_results_workspace();await settle()
		check(inside(view.results_workspace.buttons[0]),"Scaled results navigation fits "+str(pair))
		model.phase="results"
		for id in [3,6]:
			model.cars[id].stints=[]
			for i in range(5):model.cars[id].stints.append({"set_id":"%d-M1" % id,"from":float(i*4),"to":float(i*4+4)})
		view.results_workspace.show_page(2);await settle()
		check(inside(view.results_workspace.next_button) and view.results_workspace.narrative.get_parent().get_parent() is ScrollContainer,"Long stint evidence scrolls without moving fixed actions "+str(pair))
		await capture("results-stints-"+str(pair[0].x))
	var report={"passed":failures.is_empty(),"checks":checks,"errors":failures,"screenshots":screenshots,"engine":Engine.get_version_info().string}
	Storage.write_json("res://reports/ui-completion.json",report);print("UI_COMPLETION ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
