extends "res://tests/ui_finish_guide_tests.gd"
## Populated acceptance: one physical practice/qualifying/race lineage, replayed
## through validated snapshots at each supported viewport. No fabricated lap data.
var states: Dictionary = {}
var provenance: Dictionary = {}
var inspected: Array = []

func retain(label: String, description: String) -> void:
	var data=JSON.parse_string(JSON.stringify(model.snapshot(),"",false,true))
	states[label]=data
	provenance[label]={"kind":"physical-model-run","description":description,"seed":model.seed_value,"time":model.total_time,"phase":model.phase,"sha256":JSON.stringify(data,"",false,true).sha256_text()}
	check(Storage.write_json("res://reports/physical-"+label+".json",data).is_empty(),"Physical state is retained: "+label)

func restore_state(label: String) -> void:
	model=PracticeRaceSim.restore_practice(states[label].duplicate(true))
	check(model!=null,"Validated snapshot restores actual "+label)
	if model==null:quit(1);return
	await reset()

func shoot(label: String, source: String) -> void:
	await settle(5)
	check(view.get_combined_minimum_size().x<=root.size.x,"G16 no horizontal expansion: "+label+str(root.size))
	await capture("populated-"+label+"-"+str(root.size.x),"Physical lineage: "+source+". Frozen step for cross-layout comparison; native UI interactions.")
	captures.back()["source_sha256"]=provenance[source].sha256
	captures.back()["seed"]=model.seed_value
	inspected.append({"screen":label,"source":source,"viewport":[root.size.x,root.size.y],"scale":view.text_scale})

func header_and_drivers(label: String) -> void:
	check(reachable(view.pause_button) and reachable(view.speed_control) and reachable(view.weekend_menu),"G16 fixed time and utility controls remain reachable: "+label)
	if is_instance_valid(view.full_workspace) and view.full_workspace.visible:
		if view.full_workspace==view.analysis_workspace:
			check(reachable(view.analysis_workspace.drivers[3]) and reachable(view.analysis_workspace.drivers[6]),"G16 both focused-workspace driver targets reachable: "+label)
	else:
		for id in [3,6]:check(reachable(view.car_cards[id].name_label),"G16 named driver reachable: "+model.cars[id].short+" "+label)

func choose(option: OptionButton,index: int) -> void:
	option.grab_focus();await key(KEY_ENTER)
	var popup=option.get_popup()
	for i in range(option.item_count+2):
		if popup.get_focused_item()==index:break
		await key(KEY_DOWN)
	await key(KEY_ENTER)

func approve_dialog(dialog: ConfirmationDialog) -> void:
	check(is_instance_valid(dialog) and dialog.visible,"Native confirmation is displayed")
	dialog.get_ok_button().grab_focus();await key(KEY_ENTER)

func generate_lineage() -> void:
	model=PracticeRaceSim.new(TrackGeometry.new(app.library[7]),{"laps":12,"scenario":"dry","intensity":"calm","seed":7314})
	model.paused=true;await reset();retain("briefing","New original weekend, no race or practice data invented")
	view.open_practice_workspace();await settle()
	await click(view.practice_workspace.panels[6].objective_buttons.qualifying)
	await click(view.practice_workspace.session_action)
	check(model.phase=="practice","Native practice approval starts the real session")
	for id in [3,6]:await click(view.practice_workspace.panels[id].run)
	check(not model.practice_driver(3).active.is_empty() and not model.practice_driver(6).active.is_empty(),"Both native programme releases are accepted independently")
	check(await advance_until(func():return model.practice_driver(3).runs[0].samples.size()>=1 and model.practice_driver(6).runs[0].samples.size()>=1,400),"Both programmes record actual measured lap evidence")
	view.refresh();retain("practice-progress","Independent tyre-life and qualifying programmes with physical measured samples")
	await click(view.practice_workspace.panels[6].recall)
	check(await advance_until(func():return model.practice_driver(3).active.is_empty() and model.practice_driver(6).active.is_empty(),500),"Completed and recalled programmes both return physically")
	view.refresh();await settle();await click(view.practice_workspace.finish)
	await approve_dialog(view.practice_workspace.panels[3].confirmation)
	check(await advance_until(func():return model.phase=="practice_results",200),"Practice closes with its actual complete/partial records")
	view.refresh();retain("practice-results","Practice completion and native recall retain actual sample quality and observed costs")
	await click(view.practice_workspace.finish);view.close_session_workspace();view.close_detail();view.refresh();await settle()
	await click(view.primary_button)
	check(model.phase=="qualifying","Native approval follows optional practice with single-session qualifying")
	retain("qualifying-garage","Real session start; finite previously used allocation retained")
	for id in [3,6]:
		view.open_decision(id,true);await settle();await confirm(view.decision_drawer.release)
	view.close_detail();view.refresh()
	check(await advance_until(func():return model.cars[3].qual_state=="hotlap" and model.cars[6].qual_state=="hotlap",300),"Both cars physically begin their timed attempts")
	view.refresh();retain("qualifying-hotlap","Real out laps completed; timed lap progress and traffic are physical")
	view.primary_button.grab_focus();await key(KEY_ENTER);await settle()
	# Qualifying uses the established approval dialog created by the host.
	var dialog: ConfirmationDialog
	for child in view.get_children():
		if child is ConfirmationDialog and child.visible:dialog=child
	if dialog==null:
		for window in root.get_embedded_subwindows():
			if window is ConfirmationDialog and window.visible:dialog=window
	check(dialog!=null,"Native end-qualifying confirmation is reachable")
	if dialog:await approve_dialog(dialog)
	retain("qualifying-closed","Explicit session close while existing hot laps may still finish")
	check(await advance_until(func():return model.phase=="qualifying_results",400),"Closed qualifying physically produces the final classification")
	check(not model.cars[3].qual_history.is_empty() and not model.cars[6].qual_history.is_empty(),"Qualifying results include recorded durations, not synthetic best times")
	retain("qualifying-results","Physically completed single-session qualifying; valid/invalid flags are the model's own")
	view.refresh();view.open_results_workspace();await settle();await click(view.results_workspace.next_button)
	check(model.phase=="race_preparation","Native Next preserves explicit preparation approval")
	retain("preparation","Real qualifying grid and finite set allocation before formation")
	view.close_detail();await settle();await click(view.primary_button)
	check(model.phase=="formation","Native approval starts physical formation")
	check(await advance_until(func():return model.clock>10 or model.phase=="grid_ready",80),"Formation advances by the original fixed-step model")
	retain("formation","Physical formation in progress, no fabricated grid positions")
	check(await advance_until(func():return model.phase=="grid_ready",160),"Cars physically reach the grid")
	retain("grid","Actual cars at grid; lights still require approval")
	view.refresh();await settle();await click(view.primary_button)
	check(await advance_until(func():return model.phase=="race",10),"Native lights approval starts this race")
	# Approved windows are real domain fixture inputs, not scheduled by the UI timeline.
	for id in [3,6]:
		var plan=StrategyPlan.draft(model.cars[id],model.laps);plan.starting_set=model.cars[id].set_id
		check(model.command("approve_plan",{"id":id,"plan":plan,"revision":model.policy(id).revision}),"Accepted strategy fixture for "+model.cars[id].short)
	check(await advance_until(func():return model.cars[3].completed>=2 and model.cars[6].completed>=2,400),"Both cars record race laps and telemetry")
	view.refresh();retain("race","Actual racing, measured laps, wheel wear, live telemetry and approved plans")
	for id in [3,6]:
		view.open_decision(id,true);await settle();await confirm(view.decision_drawer.box)
	retain("approach","Two native reviewed and confirmed pit calls in the physical race")
	check(await advance_until(func():return model.cars[3].route=="pit" and model.cars[3].pit_stage=="service",200),"Native pit call reaches physical service")
	retain("service","Actual frozen whole-car service transaction and timer")
	check(await advance_until(func():return model.cars[3].pit_stops>0 and model.cars[6].pit_stops>0 and model.cars[3].route=="track" and model.cars[6].route=="track",300),"Both cars physically complete service and rejoin")
	retain("rejoined","Correlated real entry/exit records and actual fitted stints")
	check(await advance_until(func():return model.phase=="results",1500),"Full race physically reaches results without manufactured finishes")
	check(model.cars[3].history.size()>0 and model.cars[6].history.size()>0,"Final result retains actual completed race laps")
	retain("results","Completed original simulation with actual classification, retirements, fitted stints and pit records")
	# Independent wet-to-drying physical run, seeded model, not a painted forecast fixture.
	model=PracticeRaceSim.new(TrackGeometry.new(app.library[7]),{"laps":12,"scenario":"wet","weather_mode":"seeded","intensity":"calm","seed":86})
	model.command("prepare_race");model.paused=true;await reset();await click(view.primary_button)
	check(await advance_until(func():return model.phase=="grid_ready",200),"Wet-session formation remains physical")
	view.refresh();await settle();await click(view.primary_button)
	check(await advance_until(func():return model.phase=="race" and model.clock>=90,220),"Seeded wet session evolves real surface and observations")
	retain("weather","Separate seeded wet physical run; observed sectors and public same-horizon cases only")

func render_profile(profile: Array) -> void:
	root.size=Vector2i(profile[0],profile[1]);root.content_scale_size=root.size;app.settings.pitwall_text_scale=profile[2]
	var suffix=str(profile)
	for state in ["briefing","qualifying-garage","qualifying-hotlap","qualifying-closed","formation","grid"]:
		await restore_state(state);view.close_detail();await settle();header_and_drivers(state+suffix);await shoot(state,state)
		if state=="qualifying-hotlap":check(view.qualifying_workspace.visible,"G04 qualifying context is visible: "+suffix)
	for state in ["practice-progress","practice-results"]:
		await restore_state(state);view.open_practice_workspace();await settle()
		header_and_drivers(state+suffix)
		for id in [3,6]:
			var panel=view.practice_workspace.panels[id]
			check(reachable(panel.run) if state=="practice-progress" else reachable(view.practice_workspace.finish),"G05 fixed programme/next actions remain accessible: "+suffix)
			check(panel.evidence.text.contains("Measured"),"G05 populated summary reflects real measurements")
			if state=="practice-results":
				check(panel.forecast_text.text.contains("SESSION COMPLETE") and not panel.forecast_text.text.contains("session remaining"),"G05 completed session cannot show a fresh future run budget")
				check(panel.objective_buttons[model.practice_driver(id).runs.back().objective].text.contains("Latest"),"G05 sealed result highlights the recorded programme, not a new default draft")
		await shoot(state,state)
	await restore_state("preparation");view.open_topic(4);view.open_analysis_workspace();await settle()
	check(reachable(view.racecraft.apply_button) and reachable(view.racecraft.reset_button),"G10 setup actions stay outside scrolling content "+suffix)
	for key in view.racecraft.sliders:check(reachable(view.racecraft.sliders[key]),"G10 all five setup axes reachable in focus: "+key+suffix)
	await shoot("setup","preparation")
	await restore_state("race");view.close_detail();await settle();header_and_drivers("race"+suffix);await shoot("race","race")
	var signature=race_fingerprint()
	await click(view.car_cards[3].name_label);await settle()
	check(reachable(view.decision_drawer.box) and reachable(view.decision_drawer.refresh_button),"G01 review/commit controls remain fixed "+suffix)
	await shoot("decision","race")
	await click(view.group_buttons.Strategy);await settle()
	check(view.tabs.current_tab==6,"G15 Strategy navigation escapes a historical decision drawer")
	view.strategy_desk._toggle_timeline();await click(view.focus_button);await settle();header_and_drivers("strategy"+suffix)
	check(reachable(view.strategy_desk.box_now),"G06 focused Strategy keeps its action boundary visible "+suffix)
	await shoot("strategy","race")
	view.close_session_workspace();view.open_topic(1);await click(view.focus_button);await settle()
	var telemetry=view.telemetry_inspector
	for channel in range(4):
		await choose(telemetry.selector,channel);telemetry.chart.grab_focus();await key(KEY_HOME)
		check(telemetry.chart.series.size()>0 and telemetry.chart.series.any(func(value):return value!=null),"G08 channel contains actual retained samples: "+str(channel)+suffix)
		check(telemetry.chart.domain=="Elapsed s" and reachable(telemetry.chart),"G08 populated chart has a visible elapsed-time domain: "+suffix)
		await shoot("telemetry-"+str(channel),"race")
	await click(telemetry.compare);await shoot("telemetry-comparison","race")
	view.close_session_workspace();view.open_topic(3);view.show_tyres(0);await click(view.focus_button);await settle()
	check(reachable(view.tyre_readout),"G10 fitted and planned identities visible "+suffix);await shoot("tyres","race")
	view.show_tyres(1);await settle();await shoot("wheels","race")
	view.close_session_workspace();view.open_topic(8);view.team_panel.show_topic(0);await settle()
	check(reachable(view.team_panel.apply_button),"G12 team instruction commitment stays visible "+suffix);await shoot("team","race")
	await click(view.team_panel.topic_buttons[3]);await click(view.focus_button);await settle()
	check(reachable(view.team_panel.intent_timeline),"G12 accepted windows fit focused chart "+suffix);await shoot("plans","race")
	view.close_session_workspace();view.open_topic(2);await click(view.focus_button);await settle()
	var radio=view.radio_inspector;await shoot("radio-live","race")
	if not radio.older.disabled:
		await scroll_to(radio.older);check(reachable(radio.older),"G13 native scrolling reaches Older");await click(radio.older);var frozen=radio.frozen.duplicate(true);var focus=root.gui_get_focus_owner()
		for i in range(8):view.refresh()
		check(radio.history_mode and frozen==radio.frozen and root.gui_get_focus_owner()==focus,"G13 history and focus survive refresh "+suffix)
		await shoot("radio-history","race")
	check(signature==race_fingerprint(),"G16 all analytical navigation and native chart inputs preserve race, commands, pause and RNG "+suffix)
	for state in ["service","rejoined"]:
		await restore_state(state);await open_box();await click(view.focus_button);await settle()
		header_and_drivers(state+suffix)
		for id in [3,6]:check(reachable(view.team_panel.cancel_stop_buttons[id]),"G11 service cancellation remains reachable (disabled after entry) "+suffix)
		await shoot("pit-"+state,state)
	await restore_state("weather");view.open_weather(3);await click(view.focus_button);await settle()
	check(reachable(view.weather_panel.box) and reachable(view.weather_panel.hold),"G07 weather action footer remains visible "+suffix)
	check(view.weather_panel.advice.outlook.observed.mean>0,"G07 weather capture has physically observed water")
	check(view.weather_panel.outlook_chart.mode=="cases" and view.weather_panel.outlook_chart.categories==["Now","Drier","Trend","Wetter"],"G07 independent cases are not a future trace")
	await shoot("weather","weather")
	view.close_session_workspace();view.open_topic(5);await click(view.focus_button);await settle();await shoot("surface","weather")
	view.close_session_workspace();view.open_topic(view.recovery_page_index);await settle()
	check(reachable(view.recovery_panel.protect_button) and reachable(view.recovery_panel.retire_button),"G16 recovery choices stay outside long rules "+suffix)
	await shoot("recovery","weather")
	for state in ["qualifying-results","results"]:
		await restore_state(state);view.open_results_workspace();await settle()
		for page in range(4):
			await click(view.results_workspace.buttons[page]);await settle()
			check(reachable(view.results_workspace.next_button),"G14 Next remains separate from long result evidence "+suffix)
			if page==1:
				check(view.results_workspace.laps.series.size()>0,"G14 result lap chart is populated by actual session laps")
				await click(view.results_workspace.compare)
			if state=="results" and page==2:
				var results=view.results_workspace
				check(results.pit_visits.size()>=2,"G14 result retains both drivers' correlated physical pit visits")
				await scroll_to(results.pit_visit_selector);var before=race_fingerprint()
				await choose(results.pit_visit_selector,mini(1,results.pit_visits.size()-1))
				check(results.pit_visit_detail.text.contains("MEASURED VISIT") and before==race_fingerprint(),"G14 native visit selection reports recorded evidence without a command")
			await shoot(state+"-"+str(page),state)
	Storage.write_json("res://reports/ui-finish-populated-progress.json",{"inspected":inspected,"checks":checks,"errors":failures})

func primary_profile(profile: Array) -> void:
	# Complete the cross-product of supported text preferences on primary tasks,
	# plus both wide profiles, using the same physically generated source states.
	root.size=Vector2i(profile[0],profile[1]);root.content_scale_size=root.size
	app.settings.pitwall_text_scale=profile[2]
	var tag="matrix-%d-" % roundi(profile[2]*100)
	await restore_state("race");view.close_detail();await settle()
	header_and_drivers(tag+str(profile));var before=race_fingerprint()
	for id in [3,6]:check(reachable(view.decision_controls[id].box),"G16 both native pit actions fit "+tag+str(profile))
	await shoot(tag+"race","race")
	await click(view.car_cards[3].name_label);await settle()
	await click(view.decision_drawer.box)
	check(view.decision_drawer.stage=="CONFIRM" and before==race_fingerprint(),"G16 native staging is still observation at "+tag+str(profile))
	check(reachable(view.decision_drawer.box) and reachable(view.decision_drawer.cancel),"G16 Confirm and Back remain outside scrolling at "+tag+str(profile))
	await shoot(tag+"confirmation","race")
	view.close_detail();view.open_strategy(3);await click(view.focus_button);await settle()
	header_and_drivers(tag+"strategy")
	check(reachable(view.strategy_desk.box_now),"G16 strategy action stays fixed "+tag+str(profile))
	await shoot(tag+"strategy","race")
	check(before==race_fingerprint(),"G16 cross-profile review cannot issue a command "+tag+str(profile))
	await restore_state("practice-results");view.open_practice_workspace();await settle()
	for id in [3,6]:
		check(reachable(view.practice_workspace.panels[id].summary),"G16 both populated practice summaries fit "+tag+str(profile))
	check(reachable(view.practice_workspace.finish),"G16 practice continuation stays fixed "+tag+str(profile))
	await shoot(tag+"practice","practice-results")
	await restore_state("results");view.open_results_workspace();await click(view.results_workspace.buttons[1]);await settle()
	var chart=view.results_workspace.laps;chart.grab_focus();await key(KEY_HOME)
	var at=chart.cursor;before=race_fingerprint()
	root.size=Vector2i(maxi(1100,profile[0]-40),maxi(720,profile[1]-40));root.content_scale_size=root.size;await settle(8)
	root.size=Vector2i(profile[0],profile[1]);root.content_scale_size=root.size;await settle(8)
	check(root.gui_get_focus_owner()==chart and chart.cursor==at,"G16 live resize preserves chart focus and selected evidence "+tag+str(profile))
	check(reachable(chart) and reachable(view.results_workspace.next_button),"G16 populated result chart and fixed Next fit "+tag+str(profile))
	check(before==race_fingerprint(),"G16 resizing focused results leaves the original race unchanged "+tag+str(profile))
	await shoot(tag+"results","results")

func run() -> void:
	root.size=Vector2i(1440,900);root.content_scale_size=root.size
	game=load("res://scenes/main.tscn").instantiate();root.add_child(game);app=root.get_node("App");await settle();app.settings.pitwall_text_scale=1.0
	await generate_lineage()
	Storage.write_json("res://reports/physical-provenance.json",provenance)
	for profile in [[1440,900,1.0],[1280,800,1.15],[1100,720,1.3]]:await render_profile(profile)
	root.size=Vector2i(1920,1080);root.content_scale_size=root.size;app.settings.pitwall_text_scale=1.0
	await restore_state("race");view.close_detail();await settle();header_and_drivers("wide");await shoot("race","race")
	for profile in [[1440,900,1.15],[1440,900,1.3],[1280,800,1.0],[1280,800,1.3],[1100,720,1.0],[1100,720,1.15],[1920,1080,1.0],[1920,1080,1.3]]:await primary_profile(profile)
	var report={"passed":failures.is_empty(),"checks":checks,"errors":failures,"captures":captures,"screenshots":captures.size(),"physical_states":provenance,"inspected":inspected,"engine":Engine.get_version_info().string}
	Storage.write_json("res://reports/ui-finish-populated.json",report)
	print("UI_FINISH_POPULATED ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
