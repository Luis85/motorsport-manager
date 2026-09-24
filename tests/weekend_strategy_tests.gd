extends SceneTree
## Independent Stage-A suite; baseline tests continue exercising unchanged movement contracts.
var checks = 0
var failures: Array[String] = []
var geometry: TrackGeometry

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, description: String) -> void:
	checks += 1
	if not condition: failures.append(description); push_error(description)

func run() -> void:
	geometry = TrackGeometry.new(Storage.read_catalog().data[7])
	test_records()
	test_forecasts()
	test_commands_and_ownership()
	test_persistence_and_execution()
	test_forecast_edges_and_decisions()
	test_scenario_content()
	finish()

func test_records() -> void:
	var sim = RaceSim.new(geometry, {"laps": 24, "scenario": "dry"})
	var car = sim.cars[3]
	var plan = StrategyPlan.draft(car, sim.laps)
	check(StrategyPlan.validate(plan, car, sim.laps).is_empty(), "Template produces a valid driver-owned plan")
	check(plan.stops.size() == 1, "Balanced template has an approved-window proposal")
	check(not car.pit_order, "Drafting never orders a physical stop")
	var invalid = plan.duplicate(true); invalid.driver_id = 6
	check(not StrategyPlan.validate(invalid, car, sim.laps).is_empty(), "A teammate's draft cannot target this driver")
	invalid = plan.duplicate(true); invalid.stops[0].set_id = plan.starting_set
	check(not StrategyPlan.validate(invalid, car, sim.laps).is_empty(), "A plan cannot duplicate its starting set")
	invalid = plan.duplicate(true); invalid.stops[0].from_lap = sim.laps
	check(not StrategyPlan.validate(invalid, car, sim.laps).is_empty(), "A final-lap window is rejected")
	invalid = plan.duplicate(true); invalid.stops.append(invalid.stops[0].duplicate(true))
	check(not StrategyPlan.validate(invalid, car, sim.laps).is_empty(), "Overlapping or duplicated stops are rejected")
	check(StrategyPlan.validate(StrategyPlan.draft(car, sim.laps, "no_stop"), car, sim.laps).is_empty(), "No-stop is an explicit legal plan")
	var state = RaceJournal.create(sim.cars)
	check(RaceJournal.valid(state, sim.cars, sim.laps), "New policy state validates")
	var first = RaceJournal.append(state, sim, "command", 3, {"action": "approve_plan"})
	var second = RaceJournal.append(state, sim, "pit_exit", 3, {"visit_seconds": 22.0, "predicted_low": 20.0, "predicted_high": 24.0, "residual": 0.0}, first)
	check(first != second and state.records[1].related_id == first, "Stable journal identifiers link decisions and measured consequences")
	check(RaceJournal.valid(JSON.parse_string(JSON.stringify(state)), sim.cars, sim.laps), "Policy and journal survive JSON serialization")
	check("Measured pit visit" in "\n".join(RaceJournal.debrief(state)), "Debrief distinguishes measured visit from model estimates")
	invalid = state.duplicate(true); invalid.policies[3].owners.pit = "mystery"
	check(not RaceJournal.valid(invalid, sim.cars, sim.laps), "Invalid ownership is rejected on restore")
	invalid = state.duplicate(true); invalid.records[1].id = first
	check(not RaceJournal.valid(invalid, sim.cars, sim.laps), "Duplicate journal IDs are rejected")

func test_forecasts() -> void:
	var sim = RaceSim.new(geometry, {"laps": 24, "scenario": "dry", "seed": 21})
	sim.phase = "race"
	var car = sim.cars[3]
	car.distance = geometry.length * 4.2; car.speed = 40.0
	var before = JSON.stringify(sim.snapshot()); var rng = sim.rng_state
	var source = RaceForecaster.capture(sim, 3)
	var forecast = RaceForecaster.evaluate(source)
	check(forecast.options.size() == 3, "Current, immediate and extended alternatives are available")
	check(before == JSON.stringify(sim.snapshot()) and rng == sim.rng_state, "Forecasts change neither authoritative state nor live RNG")
	check(forecast.tick == roundi(sim.total_time / RaceSim.STEP) and not forecast.key.is_empty(), "Forecast identifies its source tick and material hash")
	check(not RaceForecaster.stale(sim, forecast), "Fresh forecast is current")
	sim.cars[0].route = "pit"
	check(RaceForecaster.stale(sim, forecast), "Observed rival stop invalidates the rejoin assumption")
	sim.cars[0].route = "track"; sim.flag = "SAFETY CAR"
	check(RaceForecaster.stale(sim, forecast), "Flag changes invalidate the forecast")
	sim.flag = "GREEN"; sim.total_time += 6
	check(RaceForecaster.stale(sim, forecast), "An old snapshot cannot masquerade as current advice")
	var fair = true
	for rival in source.public:
		for key in ["tyre_sets", "fuel", "temperature", "next_set_id", "pit_gate", "pit_order", "rng_state"]:
			if rival.has(key): fair = false
	check(fair and not source.has("weather_future"), "Rival information boundary excludes private stock, plans and hidden weather")
	source.own.inventory[0].life = 2
	check(sim.cars[3].tyre_sets[0].life != 2, "Information snapshot owns a deep copy of the player's inventory")
	var stop = forecast.options[1]
	check(stop.pit_cost > 0 and stop.warmup_cost > 0, "An additional stop pays its full net pit cost and warm-up")
	check(forecast.pit.position_low <= forecast.pit.position_high and forecast.pit.visit_low < forecast.pit.visit_high, "Rejoin and visit estimates are bounded ranges")
	var snapshot = RaceForecaster.capture(sim, 3)
	snapshot.own.distance = snapshot.gate.distance
	snapshot.own.box_d = 0; snapshot.teammate = {}
	var empty = RaceForecaster.pit_prediction(snapshot)
	snapshot.teammate = {"route": "pit", "pit_stage": "service", "pit_timer": 8.0, "damage": 0.0, "repair": true}
	var stacked = RaceForecaster.pit_prediction(snapshot)
	check(stacked.queue > 0 and stacked.loss > empty.loss, "Shared-box occupancy creates a real predicted waiting cost")
	car.distance = geometry.pit_entry - 1; car.speed = 60
	var gate = RaceForecaster.reachable_gate(sim, car)
	check(gate.deferred and gate.distance > geometry.pit_entry, "An unsafe immediate call previews the next reachable gate")
	var expected = gate.distance
	sim.queue_pit(car)
	check(absf(car.pit_gate - expected) < 0.00001, "Rejoin preview and physical pit command use the same gate")
	sim.phase = "qualifying"; car.route = "garage"; sim.clock = sim.qual_duration - 1
	check(not RaceForecaster.qualifying_release(sim, car).can_start_hotlap, "Release advice never advertises a last-second flying lap")
	sim.phase = "race_preparation"; car.fuel = float(sim.laps)
	check(RaceForecaster.fuel_margin(sim, car) < 0, "Fuel projection explicitly includes formation reserve")

func race_fixture(laps: int = 8) -> StrategyRaceSim:
	var sim = StrategyRaceSim.new(geometry, {"laps": laps, "scenario": "dry", "intensity": "calm", "seed": 112})
	sim.command("prepare_race"); sim.command("formation")
	for car in sim.cars: car.formation_done = true
	sim.step(); sim.command("lights")
	for i in range(121): sim.step()
	return sim

func ticks(sim: RaceSim, count: int) -> void:
	for i in range(count): sim.step()

func test_commands_and_ownership() -> void:
	var sim = StrategyRaceSim.new(geometry, {"laps": 8, "scenario": "dry"})
	var before = JSON.stringify(sim.snapshot())
	check(not sim.command("pace", {"value": 2}), "A command without an explicit driver is rejected")
	check(not sim.command("pace", {"id": 3.7, "value": 2}), "Fractional driver IDs cannot redirect a command")
	check(not sim.command("pace", {"id": 0, "value": 2}), "Rival car permissions are enforced in the new command layer")
	check(not sim.command("pace", {"id": 3, "value": 2.9}), "Invalid resource values are not silently clamped")
	check(before == JSON.stringify(sim.snapshot()), "Rejected commands preserve gameplay, journal and random state")
	sim.command("prepare_race")
	var car = sim.cars[3]; var old_set = car.set_id
	var draft = StrategyPlan.draft(car, sim.laps)
	check(sim.command("approve_plan", {"id": 3, "revision": 0, "plan": draft}), "A validated strategy is explicitly approved")
	check(car.set_id == old_set and not car.pit_order, "Approval neither fits a set nor creates a physical order")
	check(sim.policy(3).owners.pit == "engineer" and sim.policy(3).revision == 1, "Approved windows have explicit ownership and version")
	before = JSON.stringify(sim.snapshot())
	check(not sim.command("approve_plan", {"id": 3, "revision": 0, "plan": draft}), "Stale drafts cannot replace an approved strategy")
	check(before == JSON.stringify(sim.snapshot()), "A stale draft is rejected atomically")
	check(sim.command("formation") and car.set_id == draft.starting_set, "Formation physically fits the approved starting set")
	for other in sim.cars: other.formation_done = true
	sim.step(); sim.command("lights"); ticks(sim, 121)
	var pit_plan = JSON.stringify(sim.policy(3).plan)
	sim.command("engine", {"id": 3, "value": 2})
	check(sim.policy(3).owners.engine == "player" and sim.policy(3).owners.pit == "engineer", "Manual engine policy does not take pit ownership")
	check(sim.command("resource_intent", {"id": 3, "channel": "pace", "value": 2, "laps": 2}), "A bounded two-lap push is accepted")
	var until_distance = sim.policy(3).overrides.pace.until_distance
	check(car.pace == 2 and car.engine == 2 and sim.policy(3).owners.pit == "engineer", "A push preserves the independent engine and pit owners")
	sim.engineer(car)
	check(car.pace == 2 and car.engine == 2, "The engineer does not wrestle away temporary or manual resources")
	car.distance = until_distance; car.previous_distance = car.distance
	sim.step()
	check(not sim.policy(3).overrides.has("pace") and sim.policy(3).owners.pace == "engineer", "A temporary push hands back at its declared distance")
	check(car.engine == 2 and sim.policy(3).owners.engine == "player" and JSON.stringify(sim.policy(3).plan) == pit_plan, "Pace handback neither changes a manual engine nor rewrites a pit plan")
	check("control returned" in "\n".join(RaceJournal.debrief(sim.strategy_state)), "Handback has a recoverable acknowledgement")
	sim.command("pace", {"id": 3, "value": 0})
	sim.command("resource_intent", {"id": 3, "channel": "pace", "value": 2, "laps": 1})
	car.distance = sim.policy(3).overrides.pace.until_distance; car.previous_distance = car.distance
	sim.step()
	check(car.pace == 0 and sim.policy(3).owners.pace == "player", "A temporary override also restores a player's previous manual mode")
	sim.command("delegation", {"id": 3, "channel": "pit", "owner": "player"})
	car.tyre = 0; TyreInventory.sync(car)
	sim.engineer(car)
	check(not car.pit_order, "A puncture warning cannot silently take over manually owned pits")
	var paused = sim.paused; var speed = sim.speed
	sim.block_plan(car, "Test warning")
	check(sim.paused == paused and sim.speed == speed, "Warnings never pause or change playback speed")
	var notices = sim.strategy_state.records.size()
	sim.block_plan(car, "Test warning")
	check(notices == sim.strategy_state.records.size(), "An unchanged blocked-plan warning is deduplicated")

func test_persistence_and_execution() -> void:
	var sim = race_fixture()
	check(sim.phase == "race", "Strategy extension retains session approval gates")
	var car = sim.cars[3]
	sim.command("resource_intent", {"id": 3, "channel": "pace", "value": 2, "laps": 2})
	var fresh = TyreInventory.choose(car, "H", true)
	sim.command("select_set", {"id": 3, "set_id": fresh.id})
	var f = sim.forecast(3)
	check(sim.command("pit", {"id": 3, "forecast_key": f.key, "forecast_time": f.time, "expected_gate": f.gate.distance}), "A current comparison commits to its exact physical gate")
	check(sim.policy(3).owners.pit == "player" and sim.policy(3).overrides.has("pace"), "A manual stop does not cancel a temporary push")
	var saved = sim.snapshot()
	var disk = JSON.parse_string(JSON.stringify(saved, "", false, true))
	check(saved.version == 6 and RaceJournal.valid(saved.strategy_state, sim.cars, sim.laps), "Version 6 stores valid journal, plan and active intent data")
	var restored = StrategyRaceSim.restore_weekend(saved)
	check(restored != null, "A live strategy checkpoint restores successfully")
	if restored == null: return
	check(restored.cars[3].pit_gate == car.pit_gate and restored.policy(3).overrides == sim.policy(3).overrides, "Pending gate and active override survive restore")
	ticks(sim, 1800); ticks(restored, 1800)
	check(JSON.stringify(sim.snapshot()) == JSON.stringify(restored.snapshot()), "Save/reload does not reroll movement, service, forecasts or evidence")
	var observational = StrategyRaceSim.restore_weekend(saved)
	for i in range(1800):
		if i % 100 == 0: observational.forecast(3); observational.forecast(6)
		observational.step()
	check(JSON.stringify(sim.snapshot()) == JSON.stringify(observational.snapshot()), "Reading multiple strategy panels cannot affect fixed-step results")
	var disk_restored = StrategyRaceSim.restore_weekend(disk)
	check(disk_restored != null, "Full-precision JSON checkpoint restores")
	if disk_restored != null:
		ticks(disk_restored, 1800)
		check(equivalent(sim.snapshot(), disk_restored.snapshot()) and sim.rng_state == disk_restored.rng_state, "JSON round-trip keeps equivalent state within 1e-8 and exactly the same random stream")
	var saw_entry = false; var saw_exit = false
	for record in sim.strategy_state.records:
		if record.kind == "pit_entry" and record.driver_id == 3: saw_entry = true
		if record.kind == "pit_exit" and record.driver_id == 3:
			saw_exit = true
			check(record.evidence.has("predicted_low") and record.evidence.visit_seconds > 0, "Measured pit duration is linked to the decision-time prediction")
	check(saw_entry and saw_exit and car.set_id == fresh.id, "A stop is ordered, entered, physically serviced and journalled through rejoin")
	var invalid = saved.duplicate(true); invalid.strategy_state.policies[3].owners.pit = "unexpected"
	check(StrategyRaceSim.restore_weekend(invalid) == null, "Malformed ownership cannot replace the live weekend")
	invalid = saved.duplicate(true); invalid.strategy_state.policies[3].order_forecast.visit = "invalid"
	check(StrategyRaceSim.restore_weekend(invalid) == null, "Malformed forecast evidence is rejected before restore")
	var old = RaceSim.new(geometry, {"laps": 8, "scenario": "dry"})
	old.cars[3].auto = false
	var migrated = StrategyRaceSim.restore_weekend(JSON.parse_string(JSON.stringify(old.snapshot())))
	check(migrated != null and migrated.policy(3).owners.pit == "player" and migrated.policy(6).owners.pace == "engineer", "Version 4 migrates legacy manual/automatic states compatibly")
	check(migrated.strategy_state.records.is_empty(), "Migration does not fabricate historical decisions or estimates")
	var late = race_fixture()
	var initial = late.forecast(3)
	late.cars[0].route = "pit"
	before_rejected_forecast(late, initial)
	var race = race_fixture(4)
	for other in race.cars: race.retire(other, "Adversarial all-retired fixture")
	race.step()
	check(race.phase == "results" and race.strategy_state.records.back().kind == "result", "An all-retired field still emits a stable completed result")

func before_rejected_forecast(sim: StrategyRaceSim, f: Dictionary) -> void:
	var before = JSON.stringify(sim.snapshot())
	check(not sim.command("pit", {"id": 3, "forecast_key": f.key, "forecast_time": f.time, "expected_gate": f.gate.distance}), "A stale opportunity cannot issue an obsolete pit order")
	check(before == JSON.stringify(sim.snapshot()), "Stale advice rejection neither cancels nor replaces the current plan")

func equivalent(a: Variant, b: Variant) -> bool:
	if typeof(a) in [TYPE_FLOAT, TYPE_INT] and typeof(b) in [TYPE_FLOAT, TYPE_INT]: return absf(float(a) - float(b)) < 0.00000001
	if typeof(a) != typeof(b): return false
	if a is Dictionary:
		if a.size() != b.size(): return false
		for key in a:
			if not b.has(key) or not equivalent(a[key], b[key]): return false
		return true
	if a is Array:
		if a.size() != b.size(): return false
		for i in range(a.size()):
			if not equivalent(a[i], b[i]): return false
		return true
	return a == b

func finish() -> void:
	var result = {"passed": failures.is_empty(), "checks": checks, "failures": failures, "engine": Engine.get_version_info().string}
	DirAccess.make_dir_recursive_absolute("res://reports")
	var file = FileAccess.open("res://reports/weekend-strategy-tests.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(result, "  ")); file.close()
	print("WEEKEND_STRATEGY ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)

func test_forecast_edges_and_decisions() -> void:
	var sim = race_fixture(24)
	var c = sim.cars[3]
	var fitted = TyreInventory.find(c, c.set_id)
	var source = RaceForecaster.capture(sim, 3)
	var clean_time = RaceForecaster.evaluate(source).options[0].seconds
	fitted.wheels.FL.punctured = true
	var broken = RaceForecaster.evaluate(RaceForecaster.capture(sim, 3)).options[0]
	check(broken.seconds > clean_time and broken.risk == "high", "A single punctured wheel is not hidden by aggregate tread or ideal-temperature assumptions")
	fitted.wheels.FL.punctured = false
	var original_phase = sim.phase
	sim.phase = "race_preparation"
	var hard = StrategyPlan.draft(c, sim.laps, "no_stop"); hard.starting_set = "3-H1"
	var soft = hard.duplicate(true); soft.starting_set = "3-S1"
	var before = JSON.stringify(sim.snapshot())
	var hard_estimate = sim.forecast(3, hard).options[0]
	var soft_estimate = sim.forecast(3, soft).options[0]
	check(hard_estimate.seconds != soft_estimate.seconds and hard_estimate.minimum_life > soft_estimate.minimum_life, "Pre-race comparison uses the proposed starting set, not the previously fitted set")
	check(before == JSON.stringify(sim.snapshot()), "Comparing starting compounds cannot fit or refresh a tyre set")
	sim.phase = original_phase
	var live_plan = StrategyPlan.draft(c, sim.laps)
	live_plan.starting_set = c.set_id
	c.distance = 11.1 * geometry.length; c.previous_distance = c.distance
	live_plan.stops = [{"from_lap": 10, "to_lap": 13, "set_id": "3-H1"}]
	var within = sim.forecast(3, live_plan).options[0]
	check(within.available and within.stops.size() == 1 and within.stops[0].at > 11.1, "Forecast retains a stop whose earliest lap passed but authorized window remains reachable")
	var duplicate = RaceForecaster.evaluate_candidate(RaceForecaster.capture(sim, 3), "bad", "Bad plan", [{"at": 12.0, "set_id": "3-H1"}, {"at": 14.0, "set_id": "3-H1"}])
	check(not duplicate.available, "Coarse evaluation rejects duplicate physical set use instead of refreshing stock")
	c.distance = (sim.laps - 1) * geometry.length + geometry.pit_entry - 200; c.previous_distance = c.distance; c.speed = 5
	var last = sim.forecast(3)
	check(last.options.size() >= 2 and last.gate.distance < sim.laps * geometry.length, "A physically reachable final-lap recovery is not hidden behind ordinary stop-window rules")
	c.distance = 2 * geometry.length; c.previous_distance = c.distance; c.speed = 5; c.fuel = 1
	var cards = DecisionFeed.for_driver(sim, 3, sim.policy(3), sim.forecast(3))
	var fuel_card = cards.filter(func(card): return card.issue == "fuel")[0]
	check(sim.command("hold_decision", {"id": 3, "issue": "fuel", "key": fuel_card.key}), "A current fuel warning can be deliberately acknowledged")
	sim.cars[0].pit_stops += 1
	cards = DecisionFeed.for_driver(sim, 3, sim.policy(3), sim.forecast(3))
	fuel_card = cards.filter(func(card): return card.issue == "fuel")[0]
	check(fuel_card.acknowledged, "An unrelated rival stop does not re-nag an acknowledged fuel warning")
	var speed = sim.speed; var paused = sim.paused
	sim.observe_warnings(c); var count = sim.strategy_state.records.size(); sim.observe_warnings(c)
	check(sim.strategy_state.records.size() == count, "Persistent warning journaling deduplicates unchanged critical facts")
	check(sim.strategy_state.records.any(func(record): return record.kind == "warning"), "Critical explanations remain in the journal even after the live card disappears")
	check(speed == sim.speed and paused == sim.paused, "Warning history never takes ownership of time")
	var deadline = DecisionFeed.card(3, "pit", 60, "Pit", "Evidence", "key", "Hold", 18)
	sim.speed = 4; sim.paused = false
	check("4.5s at 4" in DecisionFeed.deadline_text(deadline, sim), "Accelerated deadlines expose both simulated and reading time")
	var expected = sim.forecast(3); var replacement_id = expected.replacement_id
	check(sim.command("pit", {"id": 3, "set_id": replacement_id, "forecast_key": expected.key, "forecast_time": expected.time, "expected_gate": expected.gate.distance}), "Forecast Box atomically accepts the actual predicted set and gate")
	check(c.next_set_id == replacement_id and c.pit_order and sim.policy(3).owners.pit == "player", "Forecast Box commits its named set and changes only pit ownership")
	var other = race_fixture(12)
	var fresh = other.forecast(3)
	before = JSON.stringify(other.snapshot())
	check(not other.command("pit", {"id":3,"set_id":"6-H1","forecast_key":fresh.key,"forecast_time":fresh.time,"expected_gate":fresh.gate.distance}), "An atomic forecast Box cannot borrow the teammate's stock")
	check(before == JSON.stringify(other.snapshot()), "Invalid forecast set rejection is atomic")

func test_scenario_content() -> void:
	var library = Storage.read_catalog().data
	var recipes = WeekendScenarios.catalog()
	check(recipes.size() == 4, "The initial pack contains four playable dry strategy recipes")
	for recipe in recipes:
		check(WeekendScenarios.valid(recipe), "Scenario schema is valid: " + recipe.id)
		var sim = WeekendScenarios.build(recipe, library)
		check(sim != null and sim.phase == "briefing" and sim.scenario == "dry" and sim.intensity == "calm", "Scenario opens at approval-gated briefing with disclosed assists: " + recipe.id)
		if sim == null: continue
		check(sim.policy(3).plan_status == "approved" and sim.policy(6).plan_status == "approved" and not sim.cars[3].pit_order, "Scenario plans are authorized but not physical orders: " + recipe.id)
		check(StrategyRaceSim.restore_weekend(sim.snapshot()) != null, "Scenario provenance and approved plans persist: " + recipe.id)
		check(recipe.title in WeekendScenarios.briefing(sim), "Scenario objective and instructional premise are player-visible: " + recipe.id)
	var bad = recipes[0].duplicate(true); bad.plans[1].driver_id = 3
	check(not WeekendScenarios.valid(bad) and WeekendScenarios.build(bad, library) == null, "Scenario authoring rejects duplicate target drivers transactionally")
