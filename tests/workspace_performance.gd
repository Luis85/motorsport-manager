extends SceneTree
## Identical harness runs on baseline and revised source. No frame-rate threshold.
var game
var view
var results:Array=[]
var checks=0
var failures:Array[String]=[]
func _initialize():call_deferred("run")
func check(value:bool,message:String):
	checks+=1
	if not value:failures.append(message);push_error(message)
func settle():
	for i in range(6):await process_frame
func measure(label:String,work:Callable,count:int=40):
	for i in range(5):work.call()
	var values:Array=[]
	for i in range(count):
		var start=Time.get_ticks_usec();work.call();values.append(Time.get_ticks_usec()-start)
	values.sort();results.append({"workload":label,"samples":count,"median_us":values[count/2],"p95_us":values[mini(count-1,int(count*0.95))]})
func fingerprint(sim):
	var state=sim.snapshot();state.erase("version");state.erase("rival_styles")
	return JSON.stringify(state).sha256_text()
func run():
	root.size=Vector2i(1440,900);root.content_scale_size=root.size
	game=load("res://scenes/main.tscn").instantiate();root.add_child(game);await settle()
	var app=root.get_node("App");app.settings.pitwall_text_scale=1.0
	var sim=PracticeScenarios.build(PracticeScenarios.catalog()[0],app.library)
	check(sim.command("practice_start"),"Benchmark uses approved physical practice")
	var preparation_steps=0
	for run_index in range(3):
		for id in [3,6]:
			var plan={"objective":"tyre_life","set_id":"%d-M1"%id,"laps":2,"baseline":"current"}
			var p=sim.run_preview(id,plan)
			check(sim.command("practice_run",{"id":id,"plan":plan,"revision":p.revision,"time":p.time,"key":p.key}),"Benchmark releases actual run")
		for i in range(10000):
			if sim.practice_driver(3).active.is_empty() and sim.practice_driver(6).active.is_empty():break
			sim.step();preparation_steps+=1
	check(sim.practice_driver(3).runs.size()==3 and sim.practice_driver(6).runs.size()==3,"Populated notebook has three real runs per player")
	check(sim.command("practice_end"),"Benchmark explicitly ends practice")
	for i in range(10000):
		if sim.phase=="practice_results":break
		sim.step();preparation_steps+=1
	check(sim.command("practice_finish"),"Practice notebook retains physical costs")
	# A declared synthetic race presentation state avoids conflating preparation cost
	# with refresh cost. It is not shipped content or sporting-result evidence.
	sim.phase="race";sim.paused=true
	for c in sim.cars:
		c.route="track";c.distance=300+(12-c.id)*24;c.previous_distance=c.distance;c.speed=40
	# Explicit diagnostic load, not fabricated incident or decision history.
	for i in range(1000):RaceJournal.append(sim.strategy_state,sim,"benchmark_load",-1,{"index":i})
	app.weekend=sim;game.show_weekend();view=game.content.get_child(0);view.set_process(false);await settle()
	var original=JSON.stringify(sim.snapshot());var start_hash=fingerprint(sim)
	for target in [["strategy",6],["weather",9],["recovery",10],["practice",view.practice_page_index],["debrief",7]]:
		view.open_topic(target[1]);view.refresh();await settle();measure(target[0]+" / populated paused refresh",view.refresh)
	measure("uncached practice-informed forecast",func():sim.forecast(3),20)
	check(original==JSON.stringify(sim.snapshot()),"Every measured observation leaves state and random streams unchanged")
	var source=sim.snapshot();var only=PracticeRaceSim.restore_practice(source)
	only.paused=false;var initial_sim_time=only.total_time
	var clock=Time.get_ticks_usec()
	for i in range(1000):only.step()
	var duration=(Time.get_ticks_usec()-clock)/1000000.0
	check(absf(only.total_time-initial_sim_time-50.0)<0.000001,"Simulation-only benchmark executes all 1000 steps rather than timing a paused no-op")
	var simulation={"steps":1000,"simulated_seconds":50.0,"wall_seconds":duration,"achieved_sim_seconds_per_wall_second":50/duration,"outcome_hash":fingerprint(only)}
	var active:Array=[]
	for factor in [1,16]:
		sim=PracticeRaceSim.restore_practice(source);app.weekend=sim;game.show_weekend();view=game.content.get_child(0);view.set_process(false);view.open_topic(6);await settle()
		sim.command("speed",{"value":factor});sim.paused=false
		var shadow=PracticeRaceSim.restore_practice(sim.snapshot());var initial_time=sim.total_time;clock=Time.get_ticks_usec()
		for frame in range(120):
			sim.advance(1.0/60.0)
			if frame%12==0:view.refresh()
			await process_frame
		var elapsed=(Time.get_ticks_usec()-clock)/1000000.0
		for frame in range(120):shadow.advance(1.0/60.0)
		var same=JSON.stringify(sim.snapshot())==JSON.stringify(shadow.snapshot())
		check(same,"Controlled native %dx workload matches unrendered fixed-step continuation"%factor)
		active.append({"selected_speed":factor,"input_frames":120,"input_delta_seconds":1.0/60.0,"fixed_steps":roundi((sim.total_time-initial_time)/RaceSim.STEP),"simulated_seconds":sim.total_time-initial_time,"wall_seconds":elapsed,"achieved_sim_seconds_per_wall_second":(sim.total_time-initial_time)/elapsed,"matches_headless":same,"outcome_hash":fingerprint(sim)})
	var report={"passed":failures.is_empty(),"checks":checks,"failures":failures,"engine":Engine.get_version_info().string,"cpu":OS.get_processor_name(),"renderer":RenderingServer.get_video_adapter_name(),"viewport":"1440x900","text_scale":1.0,"seed":2026,"track":sim.track.document.name,"rivals":"classic on both revisions","preparation_steps":preparation_steps,"journal_load":1000,"initial_hash":start_hash,"results":results,"simulation":simulation,"active":active,"limitations":"Same disclosed synthetic race state following actual practice; 120 controlled input frames, not uninterrupted real-time play. Software-rendered machine-specific throughput; no FPS guarantee or forecast calibration. Existing Monaco benchmark is separate."}
	Storage.write_json("res://reports/workspace-performance.json",report);print("WORKSPACE_PERFORMANCE ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
