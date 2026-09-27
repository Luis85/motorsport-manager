extends "res://tests/minimal_ui_tests.gd"
## Full native minimal journey: no phase/position/stock/result injection.
var milestones: Array=[]
var steps=0
func move_until(predicate: Callable, limit: int=24000) -> bool:
	view.refresh()
	if model.phase in RaceSim.ACTIVE and model.paused: await click(view.play_button)
	for i in range(limit):
		if predicate.call():
			if model.phase in RaceSim.ACTIVE: await click(view.pause_button)
			view.refresh(); return true
		model.step(); steps+=1
		if i%200==0: view.refresh(); await process_frame
	view.refresh(); return predicate.call()
func mark(label: String) -> void:
	view.refresh(); await settle(6)
	milestones.append({"label":label,"phase":model.phase,"time":model.total_time})
	for id in [3,6]:
		var card = view.driver_cards[id]; var reading = MinimalDriverReadout.capture(model,id)
		check(inside(card), "Driver card remains visible at actual journey milestone: " + label + "/" + str(id))
		check(card.last_data.set_id == model.cars[id].set_id and card.metrics.tyre.value.text == reading.tyre, "Actual fitted set, not planned replacement, reaches the card: " + label + "/" + str(id))
		check(card.metrics.fuel.value.text == reading.fuel and card.metrics.health.value.text == reading.health, "Actual fuel and health reach the card: " + label + "/" + str(id))
	await capture("minimal-weekend-"+label,"Real full weekend; native commands and production fixed steps; no synthetic grid/result")
	print("MINIMAL_JOURNEY ",label," ",model.phase," ",model.total_time)
func run() -> void:
	root.size=Vector2i(1440,900);root.content_scale_size=root.size
	game=load("res://scenes/main.tscn").instantiate();root.add_child(game);app=root.get_node("App");await settle()
	app.settings.pitwall_layout="minimal";app.settings.pitwall_text_scale=1.0
	model=PracticeRaceSim.new(TrackGeometry.new(app.library[7]),{"laps":6,"qual_duration":240,"scenario":"dry","intensity":"calm","seed":7314,"tactical_duels":true})
	await reset(); await mark("briefing")
	await click(view.primary_button); check(model.phase=="practice","Native Start practice")
	await click(view.send_button); await click(view.driver_buttons[6]); await click(view.send_button)
	check(not model.practice_driver(3).active.is_empty() and not model.practice_driver(6).active.is_empty(),"Both drivers sent with no setup workflow")
	check(await move_until(func():return model.cars[3].qual_state=="hotlap" and model.cars[6].qual_state=="hotlap"),"Both cars reach measured practice running")
	await click(view.push_button); check(model.cars[6].pace==2,"Practice live Push uses selected driver")
	await mark("practice")
	check(await move_until(func():return model.practice_driver(3).active.is_empty() and model.practice_driver(6).active.is_empty()),"Both cars automatically return after run")
	check(MinimalRaceTiming.practice_best(model,3)>0 and MinimalRaceTiming.practice_best(model,6)>0,"Measured practice times retained for both drivers")
	check(model.cars[3].qual_best==0 and model.cars[6].qual_best==0,"Practice cannot fabricate qualifying times")
	await click(view.primary_button)
	check(await move_until(func():return model.phase=="practice_results"),"End practice waits for returns")
	await mark("practice-results")
	await click(view.primary_button);check(model.phase=="qualifying","Native one-action qualifying transition")
	await click(view.driver_buttons[3]); await click(view.send_button)
	await click(view.driver_buttons[6]); await click(view.send_button)
	check(await move_until(func():return model.cars[3].qual_best>0 and model.cars[6].qual_best>0),"Both drivers set actual flying-lap times")
	await mark("qualifying")
	await click(view.primary_button)
	check(await move_until(func():return model.phase=="qualifying_results"),"Qualifying closes after physical returns")
	check(model.cars.all(func(car):return car.route=="garage" or car.dnf),"No car teleports into results")
	await mark("qualifying-results")
	var stock=model.cars[3].tyre_sets.size()
	await click(view.primary_button);check(model.phase=="formation","One explicit Start formation includes real preparation")
	check(model.cars[3].tyre_sets.size()==stock,"Default preparation creates no extra tyres")
	check(await move_until(func():return model.phase=="grid_ready"),"Formation physically completes")
	await mark("grid")
	await click(view.primary_button);check(model.phase=="lights","Native Start race begins lights")
	check(await move_until(func():return model.phase=="race"),"Real lights countdown releases the field")
	# Choose stable race modes through the visible controls, not hidden helpers.
	for id in [3,6]:
		await click(view.driver_buttons[id]); if model.cars[id].pace!=0: await click(view.calm_button)
	check(await move_until(func():return model.cars[3].distance>model.track.length+100),"Actual racing reaches second lap")
	await click(view.driver_buttons[3]); await click(view.box_button)
	check(model.cars[3].pit_order and not model.cars[6].pit_order,"Native Box this lap targets one driver")
	await mark("race")
	check(await move_until(func():return model.cars[3].pit_stops==1 and model.cars[3].route=="track"),"Real shared-box service and exit")
	await mark("after-pit")
	check(await move_until(func():return model.phase=="results",40000),"Complete physical race reaches classification")
	check(model.cars[3].finished and model.cars[6].finished,"Both managed cars finish")
	check(view.send_button.disabled and view.box_button.disabled and view.push_button.disabled and view.engine_control.disabled,"Final controls cannot issue stale orders")
	check(view.primary_button.text=="New weekend","Final next action is unambiguous")
	await mark("results")
	check(PracticeRaceSim.restore_practice(model.snapshot())!=null,"Completed full journey validates as checkpoint")
	var error=app.save_weekend();check(error.is_empty(),"Actual production recording saves: "+error)
	var original=model.snapshot();error=app.load_weekend();check(error.is_empty(),"Actual production recording restores: "+error)
	if error.is_empty():check(RaceRecord.equivalent(app.weekend.cars,model.cars) and app.weekend.rng_state==model.rng_state,"Restored final cars and RNG preserved")
	var report={"passed":failures.is_empty(),"checks":checks,"failures":failures,"steps":steps,"milestones":milestones,"screenshots":captures.size(),"captures":captures}
	Storage.write_json("res://reports/minimal-weekend-ui.json",report);print("MINIMAL_WEEKEND_UI ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
