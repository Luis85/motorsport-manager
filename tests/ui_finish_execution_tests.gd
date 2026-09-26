extends "res://tests/ui_finish_observation_tests.gd"
## WP10 / WP12: native commands, unchanged physical movement and read-only evidence.
## Boundary assignments are named explicitly; they are not ordinary race results.

func pad(button: JoyButton) -> void:
	for down in [true,false]:
		var event=InputEventJoypadButton.new();event.button_index=button;event.pressed=down
		Input.parse_input_event(event);await settle(2)

func physical_race() -> void:
	model=PracticeRaceSim.new(TrackGeometry.new(app.library[7]),{"laps":12,"scenario":"dry","intensity":"calm","seed":7314})
	check(model.command("prepare_race"),"G11 supported generated-grid preparation, not fabricated race progress")
	model.paused=true;await reset()
	await click(view.primary_button)
	check(model.phase=="formation","G11 native approval starts real formation")
	check(await advance_until(func():return model.phase=="grid_ready",160),"G11 all cars physically reach their grid slots")
	view.refresh();await settle();await click(view.primary_button)
	check(await advance_until(func():return model.phase=="race",10),"G11 native approval starts lights and the race")
	view.refresh();await settle()

func open_box() -> void:
	view.open_topic(8);view.team_panel.show_topic(2);view.refresh();await settle()

func run() -> void:
	root.size=Vector2i(1440,900);root.content_scale_size=root.size
	game=load("res://scenes/main.tscn").instantiate();root.add_child(game)
	app=root.get_node("App");await settle();app.settings.pitwall_text_scale=1.0
	await physical_race()
	# Existing accepted strategy data, not a scheduler created by the timeline.
	for id in [3,6]:
		var plan=StrategyPlan.draft(model.cars[id],model.laps)
		plan.starting_set=model.cars[id].set_id
		check(model.command("approve_plan",{"id":id,"plan":plan,"revision":model.policy(id).revision}),"G12 accepted plan exists for "+model.cars[id].short)
	check(model.command("resource_intent",{"id":3,"channel":"pace","value":2,"laps":2}),"G12 bounded pace intent uses the existing boundary")
	view.open_topic(8);view.team_panel.show_topic(3);view.open_analysis_workspace();await settle()
	var timeline=view.team_panel.intent_timeline
	var before=JSON.stringify(model.snapshot())
	timeline.grab_focus();await key(KEY_RIGHT)
	check(timeline.selected_text().contains("pace override"),"G12 native keyboard inspects the real issued override")
	await pad(JOY_BUTTON_DPAD_DOWN)
	check(timeline.selected_text().contains("Lucas Moreau"),"G12 native D-pad inspects the other owned driver")
	await click(timeline)
	check(before==JSON.stringify(model.snapshot()),"G12 pointer and D-pad timeline inspection never issue a command, change time or RNG")
	check(timeline.lanes[0][0].set==model.policy(3).plan.stops[0].set_id,"G12 timeline retains the accepted finite set identity")
	await capture("accepted-team-timeline","Physical formation and lights; two real approved plans and one bounded override")
	view.close_session_workspace();view.close_detail();await settle()
	# Both commands are staged/confirmed through actual native controls.
	for id in [3,6]:
		view.open_decision(id,true);await settle();await confirm(view.decision_drawer.box)
		check(model.cars[id].pit_order,"G11 native confirmation accepts the named physical stop: "+model.cars[id].short)
	await open_box()
	var service=view.team_panel.service_view
	check(service.describe(3).stage=="APPROACH" and service.describe(6).stage=="APPROACH","G11 both accepted approaches are distinguished from physical service")
	await capture("service-approach","Two native confirmed pit orders after real formation and lights; no position edits")
	var seen: Dictionary={};var queue_seen=false;var service_seen=false;var exit_seen=false
	model.paused=false
	for i in range(10000):
		model.step()
		for id in [3,6]:
			var state=service.describe(id)
			seen[state.stage]=true
			if state.stage=="QUEUE" and not queue_seen:
				queue_seen=true;view.refresh();await capture("service-queue","Observed queue from two physical native-confirmed orders; no queue-duration fabrication")
			if state.stage=="SERVICE" and not service_seen:
				service_seen=true;view.refresh();await settle()
				check(is_equal_approx(state.remaining,model.cars[id].pit_timer),"G11 displayed remaining service seconds equal the physical timer")
				check(model.pit_boxes.get("Obsidian")==id,"G11 service is owned by the actual shared-box occupant")
				check(view.team_panel.cancel_stop_buttons[id].disabled,"G11 cancellation is unavailable after physical entry")
				before=JSON.stringify(model.snapshot());await click(view.team_panel.cancel_stop_buttons[id])
				check(before==JSON.stringify(model.snapshot()),"G11 native activation of disabled committed-stop cancellation does nothing")
				await capture("service-frozen","Physical whole-car service timer and frozen set/repair choice; no individual wheel timing")
			if state.stage=="EXIT":exit_seen=true
		if seen.has("COMPLETE") and model.cars[3].route=="track" and model.cars[6].route=="track" and model.cars[3].pit_stops>0 and model.cars[6].pit_stops>0:break
		if i%400==0:await process_frame
	model.paused=true;view.refresh();await settle()
	check(queue_seen and service_seen and exit_seen,"G11 unchanged movement produced queue, service and exit states")
	for id in [3,6]:
		var state=service.describe(id)
		check(state.stage=="COMPLETE" and not state.exit_id.is_empty(),"G11 only a correlated recorded pit exit completes "+model.cars[id].short)
		var event=model.strategy_state.records.filter(func(item):return item.id==state.exit_id)[0]
		check(is_equal_approx(state.visit_seconds,event.evidence.visit_seconds),"G11 displayed visit duration equals the journal, not the service timer")
		view.open_decision(id);await settle()
		check(view.decision_drawer.stage=="OUTCOME","G01 service and drawer agree on the completed accepted order")
	await open_box();await capture("service-complete","Physically completed entries, services and exits; durations come from correlated journal records")
	view.open_decision(3,true);await settle();await confirm(view.decision_drawer.box);await open_box()
	await click(view.team_panel.cancel_stop_buttons[3])
	check(not model.cars[3].pit_order and service.describe(3).stage=="CANCELED","G11 native cancellation names the new uncommitted approach, not an old visit")
	view.open_decision(3,true);await settle();await confirm(view.decision_drawer.box)
	check(model.command("retire_car",{"id":3,"confirm":true}),"G11 explicit retirement while approaching")
	await open_box()
	check(service.describe(3).stage=="INTERRUPTED" and not service.describe(3).text.contains("Cancel is still available"),"G11 retired approach is interrupted, never an actionable live approach")
	await capture("service-retired-approach","Explicit retirement during a second accepted approach; no invented completed exit")
	# Chart boundary: different history lengths must not transfer an invalid selection.
	model.cars[3].stints=[{"from":0.0,"to":1.0,"set_id":"3-M1"},{"from":1.0,"to":-1.0,"set_id":"3-H1"}]
	model.cars[6].stints=[]
	view.open_results_workspace();view.results_workspace.show_page(2);await settle()
	var stints=view.results_workspace.stint_chart
	stints.show();stints.grab_focus();await key(KEY_RIGHT);await key(KEY_DOWN);await key(KEY_RIGHT)
	check(stints.selected_text().contains("No recorded"),"G14 an empty teammate stint history has a deliberate inspected state")
	# Non-race pit transit is a physical qualifying route, not a race service.
	model=PracticeRaceSim.new(TrackGeometry.new(app.library[7]),{"laps":12,"scenario":"dry","intensity":"calm","seed":7314})
	check(model.command("qualify"),"G11 qualifying approval for service-scope regression")
	model.paused=true;await reset();view.open_decision(3);await settle();await confirm(view.decision_drawer.release)
	await open_box()
	check(view.team_panel.service_view.describe(3).stage=="NOT APPLICABLE","G11 qualifying out-lane transit is not a race pit-service execution")
	await capture("service-qualifying-scope","Real qualifying release; explicitly no race pit-service visit")
	var report={"passed":failures.is_empty(),"checks":checks,"errors":failures,"captures":captures,"screenshots":captures.size(),"engine":Engine.get_version_info().string}
	Storage.write_json("res://reports/ui-finish-execution.json",report)
	print("UI_FINISH_EXECUTION ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
