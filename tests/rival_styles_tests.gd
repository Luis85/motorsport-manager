extends SceneTree
## Pure paired choices, integrated orders, fairness and versioned continuation.
var checks = 0
var failures: Array[String] = []
var geometry: TrackGeometry
var metrics: Dictionary = {}
func _initialize(): call_deferred("run")
func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); push_error(message)
func fixture(life: float = 37) -> PracticeRaceSim:
	var sim = PracticeRaceSim.new(geometry,{"laps":12,"scenario":"dry","seed":7314,"intensity":"calm"})
	sim.phase="race"; sim.practice_state.status="skipped"
	for c in sim.cars:
		c.distance=600+(12-c.id)*65; c.previous_distance=c.distance; c.speed=40.0
		c.fuel=14.4
	var c=sim.cars[1]; var set=TyreInventory.find(c,c.set_id)
	for wheel in set.wheels.values(): wheel.life=life; wheel.core=89.0; wheel.surface=89.0
	WheelTyres.publish(set); c.tyre=set.life; c.temperature=set.temperature
	return sim
func decision(s: Dictionary, f: Dictionary, style: String, stops: Array = []) -> Dictionary:
	return RivalStyles.decide(s, stops, {"style":style,"weights":RivalStyles.profile(style)},f)
func same(a: Variant,b: Variant) -> bool:
	if a is Dictionary and b is Dictionary:
		if a.size()!=b.size(): return false
		for key in a:
			if not b.has(key) or not same(a[key],b[key]): return false
		return true
	if a is Array and b is Array:
		if a.size()!=b.size(): return false
		for i in range(a.size()):
			if not same(a[i],b[i]): return false
		return true
	if (a is int or a is float) and (b is int or b is float): return absf(float(a)-float(b))<0.00000001
	return a==b
func run() -> void:
	geometry=TrackGeometry.new(Storage.read_catalog().data[7])
	var sim=fixture(); var source=RaceForecaster.capture(sim,1); var forecast=RaceForecaster.evaluate(source)
	var before=JSON.stringify(sim.snapshot()); var choices=[]
	for style in RivalStyles.KEYS:
		var d=decision(source,forecast,style); choices.append(d.get("choice","none"))
		check(not d.is_empty() and d.candidates.all(func(c):return c.risk!="high"),style+" only considers feasible non-high-risk candidates")
	check(choices==["extend","box","extend","box"],"Identical actual forecast supports distinct contextual rival choices")
	check(before==JSON.stringify(sim.snapshot()),"Style evaluation consumes neither state nor randomness")
	metrics.actual_forecast_choices=choices; metrics.actual_options=forecast.options
	var conservative=decision(source,forecast,"conserve")
	check(conservative.hold_gate>conservative.gate,"Two-lap comparison skips the matching two entry gates, not just one")
	# Controlled score fixtures isolate personality/context from the physical forecast.
	var isolated=source.duplicate(true); isolated.public=[]
	var comparison=forecast.duplicate(true); comparison.pit.traffic=[]; comparison.pit.queue=0; comparison.pit.position=1
	comparison.options[0].seconds=100; comparison.options[0].risk="lower"
	comparison.options[1].seconds=100.5; comparison.options[1].risk="moderate"
	comparison.options[2].seconds=110
	check(decision(isolated,comparison,"adaptive").choice=="box" and decision(isolated,comparison,"position").choice=="current","Adaptive profile can accept a bounded moderate-risk opportunity that protector declines")
	comparison.options[1].seconds=120
	for style in RivalStyles.KEYS: check(decision(isolated,comparison,style).choice=="current",style+" declines an obviously expensive extra stop")
	for flag in ["YELLOW","SAFETY CAR","RESTART"]:
		var blocked=source.duplicate(true); blocked.flag=flag
		check(decision(blocked,forecast,"adaptive").is_empty(),"Restriction prevents discretionary style order: "+flag)
	for key in ["pit_order","dnf","finished"]:
		var blocked=source.duplicate(true); blocked.own[key]=true
		check(decision(blocked,forecast,"undercut").is_empty(),"Unavailable car is excluded: "+key)
	var blocked=source.duplicate(true); blocked.fuel_margin=-1
	check(decision(blocked,forecast,"adaptive").is_empty(),"Style never ranks an unaffordable fuel plan")
	blocked=source.duplicate(true); blocked.phase="qualifying"
	check(decision(blocked,forecast,"conserve").is_empty(),"Race style cannot order a qualifying stop")
	var no_stock=source.duplicate(true); no_stock.own.inventory=no_stock.own.inventory.filter(func(item):return item.id==no_stock.own.set_id)
	check(decision(no_stock,RaceForecaster.evaluate(no_stock),"undercut").is_empty(),"Worn current set plus no replacement cannot fabricate a viable option")
	var visible=source.duplicate(true); visible.time=10
	var event={"event_id":"0:1","driver_id":0,"short":"VAL","time":10.0,"distance":visible.own.distance,"lap_seconds":visible.reference_lap}
	check(decision(visible,forecast,"position",[event]).context.public_event=="0:1","Only an actual observed stop can enter cover evidence")
	visible.public[0].dnf=true
	check(decision(visible,forecast,"position",[event]).context.public_event.is_empty(),"Retired rival is not an undercut threat")
	# Private player policies and future weather do not enter the allow-listed snapshot.
	var expected=decision(source,forecast,"undercut")
	sim.policy(3).plan={"secret":"not submitted"}; sim.cars[3].fuel=1.23; sim.cars[3].health=55; sim.weather_state.rng_state=7
	var changed=RaceForecaster.capture(sim,1)
	check(source==changed and expected==decision(changed,RaceForecaster.evaluate(changed),"undercut"),"Private player condition/plan and hidden weather RNG cannot influence rival choices")
	sim=fixture(); var c=sim.cars[1]
	sim.rival_styles.drivers[1].style="undercut"; sim.rival_styles.drivers[1].weights=RivalStyles.profile("undercut")
	var fitted=c.set_id; var stock=JSON.stringify(c.tyre_sets); var events=sim.events.size()
	check(sim.review_rival_style(c,RaceForecaster.capture(sim,1),sim.forecast(1)),"Existing simulation seam executes a contextual rival review")
	check(c.pit_order and c.route=="track" and c.set_id==fitted and JSON.stringify(c.tyre_sets)==stock,"Accepted rival stop remains an order, not instant fitting or free stock")
	check(sim.events.size()==events,"Private rival order and scoring are not broadcast before a physical entry")
	check(sim.rival_styles.history.size()==1 and RivalStyles.valid(sim.rival_styles,sim.cars,sim.total_time),"Private diagnostic record is bounded and schema-valid")
	var saved=JSON.parse_string(JSON.stringify(sim.snapshot(),"",false,true)); var loaded=PracticeRaceSim.restore_practice(saved)
	check(loaded!=null,"Checkpoint v10 restores pending rival order, preferences and diagnostic evidence")
	if loaded!=null:
		for i in range(600): sim.step(); loaded.step()
		check(same(sim.snapshot(),loaded.snapshot()) and sim.rng_state==loaded.rng_state,"Fixed-step continuation matches across JSON save/load")
		check(sim.rival_state.stops.any(func(e):return e.driver_id==1),"Rival entry becomes public only through physical movement")
	# Persisted tuning and malformed records are not silently replaced.
	for mutation in ["weights","recipient","choice","time","hold","set"]:
		var bad=saved.duplicate(true)
		match mutation:
			"weights": bad.rival_styles.drivers[1].weights.offset=99
			"recipient": bad.rival_styles.drivers[1].driver_id=6
			"choice": bad.rival_styles.history[0].choice="win"
			"time": bad.rival_styles.history[0].time=9999
			"hold": bad.rival_styles.history[0].hold_gate=-2
			"set": bad.rival_styles.history[0].set_id="6-M1"
		check(PracticeRaceSim.restore_practice(bad)==null,"Invalid rival checkpoint rejected before replacement: "+mutation)
	var legacy=fixture(90).snapshot(); legacy.version=9; legacy.erase("rival_styles")
	loaded=PracticeRaceSim.restore_practice(legacy)
	check(loaded!=null and not loaded.rival_styles.enabled and loaded.rival_styles.history.is_empty(),"Version-nine saves acquire disabled profiles, not changed race behavior")
	var classic=fixture(90); classic.rival_styles=RivalStyles.create(classic.cars,false)
	if loaded!=null:
		for i in range(120): loaded.step(); classic.step()
		check(same(loaded.snapshot(),classic.snapshot()),"Migrated v9 continues the same classic policy without invented evidence")
	for style in RivalStyles.KEYS:
		sim=fixture(50); c=sim.cars[1]; sim.rival_styles.drivers[1].style=style; sim.rival_styles.drivers[1].weights=RivalStyles.profile(style)
		TyreInventory.find(c,c.set_id).wheels.FL.punctured=true
		sim.engineer(c)
		check(c.pit_order and c.next_set_id.begins_with("1-"),style+" still handles puncture with own legal stock")
		sim=fixture(37); c=sim.cars[1]; sim.policy(1).owners.pit="player"; sim.engineer(c)
		check(not c.pit_order and sim.rival_styles.history.is_empty(),"Manual pit ownership is not replaced by "+style)
	sim=fixture(90)
	for i in range(70):
		sim.total_time=i
		var s=RaceForecaster.capture(sim,1); var d=decision(s,RaceForecaster.evaluate(s),sim.rival_styles.drivers[1].style)
		if not d.is_empty(): RivalStyles.record(sim.rival_styles,d)
	check(sim.rival_styles.history.size()==RivalStyles.HISTORY_LIMIT and RivalStyles.valid(sim.rival_styles,sim.cars,sim.total_time),"Diagnostic retention stays bounded across long running")
	check(not RivalStyles.public_field(sim.rival_styles,sim.cars,sim.rival_state.stops).contains("score"+":"),"Public field excludes exact diagnostic score data")
	var report={"passed":failures.is_empty(),"checks":checks,"failures":failures,"metrics":metrics}
	Storage.write_json("res://reports/rival-styles-tests.json",report); print("RIVAL_STYLES ",JSON.stringify(report)); quit(0 if failures.is_empty() else 1)
