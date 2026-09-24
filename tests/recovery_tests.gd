extends SceneTree
## RW-14/15 adversarial contracts. Fixtures may assign initial conditions, never winning outcomes.
var checks = 0
var failures: Array[String] = []
var geometry: TrackGeometry
var metrics: Dictionary = {}
func _initialize() -> void: call_deferred("run")
func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); push_error(message)
func run() -> void:
	var started = Time.get_ticks_msec()
	geometry = TrackGeometry.new(Storage.read_catalog().data[7])
	test_stages_and_exposure()
	test_observational_forecasts()
	test_commands_and_authority()
	test_physical_service()
	test_shared_repair_and_terminal_edges()
	test_control_procedure()
	test_physical_restrictions()
	test_migration_and_validation()
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures, "metrics": metrics,
		"engine": Engine.get_version_info().string, "cpu": OS.get_processor_name(), "elapsed_seconds": (Time.get_ticks_msec() - started) / 1000.0,
		"limitations": "Deterministic contract fixtures, not calibrated failure probabilities, broad balance or human playtesting."}
	Storage.write_json("res://reports/recovery-tests.json", report); print("RECOVERY_TESTS ", JSON.stringify(report)); quit(0 if failures.is_empty() else 1)

func fixture(laps: int = 12, scenario: String = "dry") -> RecoveryRaceSim:
	var sim = RecoveryRaceSim.new(geometry, {"laps": laps, "scenario": scenario, "intensity": "calm", "seed": 2026})
	sim.command("prepare_race"); sim.command("formation")
	for c in sim.cars: c.formation_done = true
	sim.step(); sim.command("lights")
	for i in range(125): sim.step()
	for id in [3, 6]: sim.command("delegation", {"id": id, "channel": "pit", "owner": "player"})
	return sim

func request(advice: Dictionary) -> Dictionary:
	return {"id": advice.driver_id, "time": advice.time, "key": advice.key, "gate": advice.gate.distance}

func synchronize(sim: RecoveryRaceSim) -> void:
	for c in sim.cars: sim.observe_reliability(c)

func test_stages_and_exposure() -> void:
	var sim = fixture(); var c = sim.cars[3]; var r = sim.reliability(3)
	check(RaceReliability.stage(c, r) == "normal", "A sound new car starts in normal operation")
	for entry in [[6, "warning"], [24, "degraded"], [60, "critical"]]:
		c.damage = entry[0]; sim.observe_reliability(c)
		check(r.stage == entry[1], "Aggregate damage exposes stage " + entry[1])
	var count = sim.strategy_state.records.size()
	for i in range(100): sim.observe_reliability(c)
	check(sim.strategy_state.records.size() == count, "A persistent critical condition does not produce per-tick warning spam")
	c.damage = 0; c.health = 23; sim.observe_reliability(c)
	check(r.stage == "critical", "Low remaining lifetime health remains critical without repairable damage")
	c.health = 100; c.engine_temperature = 118; sim.observe_reliability(c)
	check(r.stage == "warning", "Thermal warning precedes scalar damage")
	c.engine_temperature = 112; sim.observe_reliability(c)
	check(r.stage == "warning", "Thermal warning hysteresis avoids threshold flicker")
	c.engine_temperature = 107; sim.observe_reliability(c)
	check(r.stage == "normal", "Cooling genuinely resolves a thermal-only warning")
	var a = c.duplicate(true); var b = c.duplicate(true)
	a.engine_temperature = 123; b.engine_temperature = 123; a.engine = 2; b.engine = 0
	var ra = r.duplicate(true); var rb = r.duplicate(true)
	for i in range(1200): RaceReliability.advance(ra, a, RaceSim.STEP, true); RaceReliability.advance(rb, b, RaceSim.STEP, true)
	check(ra.faults > rb.faults and a.damage > b.damage, "Sustained engine attack spends more exposure than saving under the same thermal fixture")
	var calm = c.duplicate(true); calm.engine_temperature = 150; calm.engine = 2
	var quiet = r.duplicate(true)
	for i in range(600): RaceReliability.advance(quiet, calm, RaceSim.STEP, false)
	check(quiet.faults == 0 and calm.damage == 0, "Disclosed calm mode suppresses random scalar faults")
	var critical = c.duplicate(true); critical.damage = 75; critical.health = 20; critical.engine_temperature = 130; critical.engine = 2
	var rc = r.duplicate(true); var premature = false; var terminal = false
	for i in range(2000):
		var result = RaceReliability.advance(rc, critical, RaceSim.STEP, true)
		if result.get("retire", false):
			premature = float(i + 1) * RaceSim.STEP < RaceReliability.MIN_CRITICAL_SECONDS
			terminal = true; break
	check(terminal and not premature, "Progressive failure respects a critical reaction interval instead of a sudden healthy-car retirement roll")
	var original = sim.rng_state; var weather_rng = sim.weather_state.model.rng
	var service = sim.reliability_state.service_stream.rng
	for i in range(20): sim.service_random_value()
	check(sim.rng_state == original and sim.weather_state.model.rng == weather_rng and sim.reliability_state.service_stream.rng != service, "Service draws cannot reshuffle driving or weather randomness")
	metrics.attack_faults = ra.faults; metrics.saving_faults = rb.faults

func test_observational_forecasts() -> void:
	var sim = fixture(); sim.cars[3].damage = 40; sim.cars[3].health = 55; synchronize(sim)
	var before = JSON.stringify(sim.snapshot()); var advice = sim.recovery_advice(3)
	var started = Time.get_ticks_usec()
	for i in range(20): check(sim.recovery_advice(3) == advice, "Identical recovery queries are deterministic %d" % i)
	metrics.twenty_forecasts_ms = (Time.get_ticks_usec() - started) / 1000.0
	check(before == JSON.stringify(sim.snapshot()), "Recovery comparisons do not mutate cars, journal, policies or random streams")
	check(advice.repaired_lap < advice.current_lap and advice.protected_lap >= advice.current_lap, "Repair/saving comparisons expose pace trade-offs rather than a free performance buff")
	check(is_equal_approx(advice.repair_seconds, 5.6) and advice.payback_laps > 0, "Repair work and full-stop break-even are shown separately")
	var r = sim.reliability(3); r.fault_threshold = 50; r.terminal_threshold = 70; r.rng = 123
	sim.weather_state.model.target = 1; sim.weather_state.model.remaining = 100
	check(sim.recovery_advice(3) == advice, "Hidden fault thresholds and future weather cannot affect recovery advice")
	for key in ["rng", "fault_threshold", "terminal_threshold", "critical_load"]: check(not advice.observed.has(key), "Public recovery evidence excludes " + key)
	var revised = sim.recovery_advice(3); sim.cars[3].health -= 6
	check(sim.recovery_stale(revised), "Material remaining-health changes invalidate a displayed recovery choice")
	revised = sim.recovery_advice(3); sim.total_time += 6
	check(sim.recovery_stale(revised), "Old recovery cards cannot silently become current orders")
	var saved = sim.recovery_advice(6); sim.control_state.revision += 1
	check(sim.recovery_stale(saved), "A revised control procedure invalidates an open comparison")

func test_commands_and_authority() -> void:
	var sim = fixture(); sim.speed = 8; sim.cars[3].damage = 40; synchronize(sim)
	var advice = sim.recovery_advice(3); var before = JSON.stringify(sim.snapshot())
	for corrupt in [{"id":0}, {"key":"old"}, {"time":-1}, {"gate":advice.gate.distance + sim.track.length}]:
		var payload = request(advice); payload.merge(corrupt, true)
		check(not sim.command("recovery_repair", payload) and before == JSON.stringify(sim.snapshot()), "Invalid recovery input is rejected atomically: " + str(corrupt.keys()))
	check(sim.command("recovery_protect", request(advice)), "A current recovery card can order two laps of engine saving")
	check(sim.cars[3].engine == 0 and sim.cars[3].pace == 1 and sim.policy(3).owners.pit == "player", "Protect changes engine intent only, preserving pace and pit authority")
	check(sim.policy(3).overrides.has("engine") and sim.policy(3).owners.engine == "engineer", "Protect records an explicit return to the prior engine owner")
	check(not sim.paused and sim.speed == 8, "Recovery advice and protection do not seize time controls")
	var c = sim.cars[3]
	c.distance = sim.policy(3).overrides.engine.until_distance; sim.step()
	check(not sim.policy(3).overrides.has("engine") and sim.policy(3).owners.engine == "engineer", "Protect expires through the existing distance-based handback")
	var manual = fixture(); manual.cars[3].damage = 60; synchronize(manual)
	check(manual.command("recovery_authority", {"id":3,"revision":manual.reliability(3).revision,"value":"repair","budget":12}), "Emergency repair permission is explicit and bounded")
	manual.engineer(manual.cars[3])
	check(not manual.cars[3].pit_order, "Emergency permission cannot override manual pit ownership")
	manual.command("delegation", {"id":3,"channel":"pit","owner":"engineer"})
	manual.engineer(manual.cars[3])
	check(manual.cars[3].pit_order and manual.reliability(3).repair_only, "Critical repair is executed only inside authorized ownership and work budget")
	var denied = fixture(); denied.cars[3].damage = 60; synchronize(denied)
	denied.command("delegation", {"id":3,"channel":"pit","owner":"engineer"}); denied.engineer(denied.cars[3])
	check(not denied.cars[3].pit_order, "Advice-only default cannot fall through to the old damage-triggered automatic stop")
	denied.command("recovery_authority", {"id":3,"revision":denied.reliability(3).revision,"value":"repair","budget":2})
	denied.engineer(denied.cars[3])
	check(not denied.cars[3].pit_order, "Repair authority cannot exceed its repair-work budget")
	var plan = StrategyPlan.draft(denied.cars[3], denied.laps, "no_stop"); plan.starting_set = denied.cars[3].set_id; plan.allow_emergency = false
	denied.command("approve_plan", {"id":3,"revision":0,"plan":plan})
	denied.command("recovery_authority", {"id":3,"revision":denied.reliability(3).revision,"value":"repair","budget":12}); denied.engineer(denied.cars[3])
	check(not denied.cars[3].pit_order and denied.policy(3).plan == plan, "An approved plan forbidding emergencies remains binding")
	var final_lap = fixture(); final_lap.cars[3].damage = 40; final_lap.cars[3].distance = final_lap.laps * geometry.length - 1
	check(not final_lap.recovery_advice(3).repair_available, "No impossible rescue is offered after the last reachable entry")
	var puncture = fixture(); puncture.cars[3].damage = 40
	TyreInventory.find(puncture.cars[3], puncture.cars[3].set_id).wheels.FL.punctured = true
	check(not puncture.recovery_advice(3).repair_available, "Repair-only cannot masquerade as recovery from an unusable fitted wheel")
	var retirement = fixture(); before = JSON.stringify(retirement.snapshot())
	check(not retirement.command("recovery_retire", request(retirement.recovery_advice(3))) and before == JSON.stringify(retirement.snapshot()), "Retirement requires an explicit confirmation")
	var payload = request(retirement.recovery_advice(3)); payload.confirm = true
	check(retirement.command("recovery_retire", payload) and retirement.cars[3].dnf and not retirement.cars[6].dnf, "Confirmed retirement targets only the named driver")

func test_physical_service() -> void:
	var sim = fixture(); var c = sim.cars[3]
	c.damage = 40; c.health = 70; synchronize(sim)
	# Exhaust spare stock: a genuine repair-only service must not invent or mount a set.
	for item in c.tyre_sets:
		if item.id != c.set_id:
			item.life = 0; WheelTyres.adopt_aggregate(item)
	var fitted = c.set_id; var mounts = TyreInventory.find(c, fitted).mounts; var stints = c.stints.size()
	var advice = sim.recovery_advice(3)
	check(advice.repair_available and sim.command("recovery_repair", request(advice)), "Repair-only remains legal with no replacement stock")
	var comparison = sim.forecast(3)
	check(comparison.replacement_id.is_empty() and not comparison.options[0].available and "Repair-only" in comparison.options[0].title, "Strategy comparison cannot invent a tyre change for an accepted repair-only transaction")
	check(c.set_id == fitted and c.damage == 40 and c.pit_order, "An accepted repair order repairs nothing before reaching the box")
	var pending = RecoveryRaceSim.restore_recovery(JSON.parse_string(JSON.stringify(sim.snapshot(), "", false, true)))
	check(pending != null and pending.reliability(3).repair_only, "Pending repair-only order survives a version-eight JSON checkpoint")
	var seen_service = false; var completed = false; var frozen_valid = false; var unchanged = false
	for i in range(6500):
		sim.step()
		if c.pit_stage == "service" and not seen_service:
			seen_service = true
			var loaded = RecoveryRaceSim.restore_recovery(JSON.parse_string(JSON.stringify(sim.snapshot(), "", false, true)))
			frozen_valid = loaded != null and equivalent(loaded.reliability(3).service, sim.reliability(3).service) and loaded.reliability_state.service_stream.rng == sim.reliability_state.service_stream.rng
			check("no tyre change" in sim.pit_status(c), "Physical repair-only service does not claim tyres are being fitted")
			var before = JSON.stringify(sim.snapshot())
			unchanged = not sim.command("repair", {"id":3,"value":false}) and before == JSON.stringify(sim.snapshot())
		if c.pit_stops == 1 and c.route == "track": completed = true; break
	check(seen_service and completed, "Repair-only physically drives entry, service and safe exit")
	check(frozen_valid, "Frozen service job, repair cost and service RNG survive JSON restore")
	check(unchanged, "A service repair choice cannot change after physical entry")
	check(c.damage == 0 and c.health <= 70, "Completed repair removes scalar damage without replenishing lifetime health")
	check(c.set_id == fitted and TyreInventory.find(c, fitted).mounts == mounts and c.stints.size() == stints and c.tyre < 100, "Repair-only retains set identity, mounts, existing stint and real wear")
	check(sim.events.any(func(e): return "same retained tyre set" in e.text), "Repair-only exit acknowledgement describes retained tyres, not a new cold set")
	check(not sim.reliability(3).repair_only and sim.reliability(3).service.is_empty(), "Pit exit clears the completed repair transaction")
	check(RecoveryRaceSim.restore_recovery(sim.snapshot()) != null, "Completed repair, finite stock and evidence form a valid checkpoint")
	var visits = sim.strategy_state.records.filter(func(record): return record.kind == "pit_exit" and record.driver_id == 3)
	check(visits.size() == 1 and visits[0].evidence.has("visit_seconds"), "Repair-only produces exactly one measured pit-visit record")
	if not visits.is_empty(): metrics.repair_visit = visits[0].evidence
	check("Measured service" in sim.recovery_debrief() and "not alternate results" in sim.recovery_debrief(), "Debrief separates measured repair work from alternate-result claims")


func test_shared_repair_and_terminal_edges() -> void:
	var sim = fixture()
	for id in [3,6]:
		sim.cars[id].damage = 40; sim.observe_reliability(sim.cars[id])
		check(sim.command("recovery_repair", request(sim.recovery_advice(id))), "Both cars can request physical repair-only service: %d" % id)
	var before = JSON.stringify(sim.snapshot()); var preview = TeamOrders.preview(sim)
	check(before == JSON.stringify(sim.snapshot()) and preview.first.service > 2.5, "Shared repair-box preview is observational and prices repair work")
	var occupied = {}; var overlap = false; var seen = {}; var frozen_checked = false
	for i in range(4500):
		sim.step()
		var occupants = sim.cars.filter(func(c): return c.team == "Obsidian" and c.pit_stage == "service")
		if occupants.size() > 1: overlap = true
		for c in occupants: seen[c.id] = true
		if not occupants.is_empty() and not frozen_checked:
			var bad = sim.snapshot(); var id = int(occupants[0].id)
			bad.reliability_state.drivers[id].service.erase("health_before")
			check(RecoveryRaceSim.restore_recovery(bad) == null, "Missing frozen repair state is rejected before replacing a running service")
			frozen_checked = true
		if sim.cars[3].pit_stops == 1 and sim.cars[6].pit_stops == 1 and sim.cars[3].route == "track" and sim.cars[6].route == "track": break
	check(not overlap and seen.has(3) and seen.has(6), "Two repair-only cars use the physical box serially, never simultaneously")
	check(sim.cars[3].damage == 0 and sim.cars[6].damage == 0 and sim.cars[3].pit_stops == 1 and sim.cars[6].pit_stops == 1, "Both queued repairs complete exactly once")
	var bad_record = sim.snapshot()
	for record in bad_record.strategy_state.records:
		if record.kind == "recovery_service" and record.evidence.stage == "completed": record.evidence.erase("health_before"); break
	check(RecoveryRaceSim.restore_recovery(bad_record) == null, "Incomplete measured service evidence cannot reach the debrief")
	var exhausted = fixture()
	for c in exhausted.cars: exhausted.retire(c, "Test-only all-retired fixture")
	exhausted.step()
	check(exhausted.phase == "results" and exhausted.cars.all(func(c): return c.dnf), "All-retired field settles without waiting for virtual clearance")
	check(RecoveryRaceSim.restore_recovery(exhausted.snapshot()) != null, "All-retired classification and control state restore")
	check(not exhausted.recovery_advice(3).repair_available, "A retired car is never advertised as a feasible repair opportunity")
	var short = RecoveryScenarios.build(RecoveryScenarios.catalog()[1], Storage.read_catalog().data)
	var advice = short.recovery_advice(3)
	check(advice.payback_laps > short.laps, "A small-damage short-race fixture makes staying out a credible choice")

func test_control_procedure() -> void:
	var state = WeekendRaceControl.create()
	WeekendRaceControl.enqueue(state, 6, 1, true, 38, 0, "rw-1", "Clearance needed")
	check(state.state == "green" and state.pending.size() == 1, "A hazard request cannot change rules halfway through the field loop")
	WeekendRaceControl.enqueue(state, 6, 1, true, 38, 0, "rw-1", "Duplicate")
	check(state.pending.size() == 1, "Repeated hazard source is idempotent")
	var event = WeekendRaceControl.tick(state, 0.05)
	check(state.state == "virtual" and event.effective_time == 0.05, "Virtual deployment is published at the next authoritative boundary")
	WeekendRaceControl.tick(state, 38.05)
	check(state.state == "ending" and is_equal_approx(state.until, 46.05), "Virtual clearance leads to an explicit eight-second no-passing ending")
	WeekendRaceControl.enqueue(state, 3, 0, true, 25, 40, "rw-2", "New obstruction")
	WeekendRaceControl.tick(state, 40.05)
	check(state.state == "virtual" and state.until > 46.05, "A new global hazard cancels an announced release")
	WeekendRaceControl.tick(state, state.until); WeekendRaceControl.tick(state, state.until)
	check(state.state == "green" and state.until == 0, "The global restriction eventually releases without position resets")
	for sector in [2, 0, 1]: WeekendRaceControl.enqueue(state, sector, sector, false, 18, 100, "zone-%d" % sector, "Local recovery")
	WeekendRaceControl.tick(state, 100.05)
	check(state.zones.size() == 3 and state.zones[0].sector == 0, "Simultaneous local yellows are preserved in stable order, not last-car-wins")
	check(WeekendRaceControl.restricted(state, 300, 298, 302), "Local-yellow interval checks handle the start-line wrap")
	WeekendRaceControl.tick(state, 120)
	check(state.zones.is_empty() and WeekendRaceControl.flag_value(state) == "GREEN", "Expired local zones release independently")
	WeekendRaceControl.enqueue(state, 3, 1, false, 18, 120, "sector-1", "Local recovery"); WeekendRaceControl.tick(state, 120.05)
	check(not WeekendRaceControl.restricted(state, 300, 50, 51) and WeekendRaceControl.restricted(state, 300, 99, 101), "Local restrictions affect the swept affected sector, not the whole circuit")
	check(WeekendRaceControl.valid(state, 120.05), "Control state and queued sources remain valid")
	var sim = fixture(); sim.speed = 8
	var weather = sim.weather_advice(3); var strategy = sim.forecast(3); var before = sim.cars[3].distance
	sim.retire(sim.cars[0], "Barrier impact")
	check(sim.flag == "GREEN" and sim.control_state.pending.size() == 1, "Real on-track retirement queues control without a mid-tick flag switch")
	sim.step()
	check(sim.flag == "VIRTUAL" and not sim.paused and sim.speed == 8 and sim.cars[3].distance >= before, "Uniform virtual deployment never pauses, slows playback, or rewinds a car")
	check(sim.weather_stale(weather) and RaceForecaster.stale(sim, strategy, int(sim.policy(3).revision)), "New sporting restrictions invalidate weather and ordinary strategy comparisons")
	var virtual_pit = RaceForecaster.pit_prediction(RaceForecaster.capture(sim, 3))
	var source = RaceForecaster.capture(sim, 3); source.model_context.neutral_factor = 1.0
	var green_pit = RaceForecaster.pit_prediction(source)
	check(virtual_pit.loss < green_pit.loss and virtual_pit.visit == green_pit.visit, "Virtual pace changes relative pit loss, not physical service/transit duration")
	metrics.virtual_pit_loss = virtual_pit.loss; metrics.green_pit_loss = green_pit.loss

func isolate_pair(sim: RecoveryRaceSim) -> void:
	for c in sim.cars:
		if c.id not in [3, 6]: c.dnf = true; c.speed = 0.0
	sim.cars[3].distance = 100; sim.cars[6].distance = 101
	sim.cars[3].lane = -2; sim.cars[6].lane = 2; sim.cars[3].speed = 65; sim.cars[6].speed = 3
	sim.cars[3].engine = 2; sim.cars[6].engine = 0

func test_physical_restrictions() -> void:
	var sim = fixture(); isolate_pair(sim)
	WeekendRaceControl.enqueue(sim.control_state, 0, 0, true, 38, sim.total_time, "fixture-hazard", "Adversarial side-by-side deployment")
	var legal = true; var forward = true; var both_moved = true
	for i in range(400):
		var a = sim.cars[3].distance; var b = sim.cars[6].distance
		sim.step()
		legal = legal and sim.cars[3].distance <= sim.cars[6].distance
		forward = forward and sim.cars[3].distance >= a and sim.cars[6].distance >= b
	both_moved = sim.cars[3].distance > 100 and sim.cars[6].distance > 101
	check(legal and forward and both_moved, "A faster alongside follower cannot pass or rewind under virtual neutralization")
	check(sim.stats.passes == 0, "No prohibited pass is credited by the battle journal")
	var a = fixture(); var b = fixture()
	# Large gaps are not deliberately closed by a catch-up state or a grid reset.
	for s in [a, b]:
		for c in s.cars:
			if c.id not in [3, 6]: c.dnf = true; c.speed = 0.0
		s.cars[3].distance = 100; s.cars[6].distance = 100 + s.track.length * 0.5
		WeekendRaceControl.enqueue(s.control_state, 0, 0, true, 38, s.total_time, "spread", "Spread-out field")
	b.speed = 16
	for i in range(200):
		a.step(); b.step()
		if i % 30 == 0: b.recovery_advice(3); b.weather_advice(6)
	check(a.cars == b.cars and a.control_state == b.control_state and a.reliability_state == b.reliability_state, "Equivalent fixed steps ignore playback speed and observation frequency")
	check(a.cars[6].distance - a.cars[3].distance > geometry.length * 0.25, "Virtual running does not collapse a spread field into a safety-car train")
	var entry = fixture(); var c = entry.cars[3]; c.damage = 40; synchronize(entry)
	entry.command("recovery_repair", request(entry.recovery_advice(3)))
	c.distance = c.pit_gate - 0.2; c.speed = 20
	entry.retire(entry.cars[0], "Barrier impact"); entry.step()
	check(c.route == "pit" and entry.flag == "VIRTUAL", "Pit entry and neutralization in the same step retain physical entry legality")
	var records = entry.strategy_state.records
	var control_index = -1; var entry_index = -1
	for i in range(records.size()):
		if records[i].kind == "race_control": control_index = i
		if records[i].kind == "pit_entry" and records[i].driver_id == 3: entry_index = i
	check(control_index >= 0 and entry_index > control_index, "Control is journaled before same-step physical pit entry")
	var loaded = RecoveryRaceSim.restore_recovery(JSON.parse_string(JSON.stringify(entry.snapshot(), "", false, true)))
	check(loaded != null and loaded.flag == "VIRTUAL", "A new virtual procedure restores through the explicitly versioned adapter")
	if loaded != null:
		for i in range(200): entry.step(); loaded.step()
		check(equivalent(entry.cars, loaded.cars) and equivalent(entry.control_state, loaded.control_state) and equivalent(entry.reliability_state, loaded.reliability_state), "Virtual deployment plus committed pit continuation survives JSON restore")

func test_migration_and_validation() -> void:
	var sim = fixture(); sim.cars[3].damage = 40; synchronize(sim)
	var data = JSON.parse_string(JSON.stringify(sim.snapshot(), "", false, true))
	check(RecoveryRaceSim.restore_recovery(data) != null and data.version == 8, "Version-eight recovery envelope restores all inherited weather/team state")
	for field in ["rng", "fault_threshold", "terminal_threshold", "critical_load", "repair_budget"]:
		var corrupt = data.duplicate(true); corrupt.reliability_state.drivers[3][field] = -1
		check(RecoveryRaceSim.restore_recovery(corrupt) == null, "Invalid recovery " + field + " rejected")
	var bad = data.duplicate(true); bad.control_state.state = "physical_safety_car"
	check(RecoveryRaceSim.restore_recovery(bad) == null, "Unsupported sporting procedure rejected")
	bad = data.duplicate(true); bad.flag = "VIRTUAL"
	check(RecoveryRaceSim.restore_recovery(bad) == null, "Inconsistent public flag and authoritative control record rejected")
	bad = data.duplicate(true); bad.reliability_state.drivers[3].repair_only = true
	check(RecoveryRaceSim.restore_recovery(bad) == null, "Repair-only cannot exist without its real pending physical order")
	bad = data.duplicate(true); bad.reliability_state.drivers[3].service = {"duration":3}
	check(RecoveryRaceSim.restore_recovery(bad) == null, "Malformed frozen repair job rejected before UI exposure")
	bad = data.duplicate(true)
	for record in bad.strategy_state.records:
		if record.kind == "recovery_stage": record.evidence.observed.erase("health"); break
	check(RecoveryRaceSim.restore_recovery(bad) == null, "Malformed recovery journal observation rejected")
	var old = WeatherRaceSim.new(geometry, {"laps":12,"scenario":"wet","seed":86,"intensity":"calm"})
	old.command("prepare_race"); old.command("formation")
	var migrated = RecoveryRaceSim.restore_recovery(old.snapshot())
	check(migrated != null and not migrated.enhanced() and migrated.weather_state == old.weather_state, "Version-seven migration preserves old model semantics rather than silently adding faults")
	if migrated != null:
		for i in range(200): old.step(); migrated.step()
		check(old.cars == migrated.cars and old.rng_state == migrated.rng_state and old.weather_state == migrated.weather_state, "Legacy migration preserves physical outcomes and random streams")
		check(RecoveryRaceSim.restore_recovery(migrated.snapshot()) != null, "A migrated legacy-mode version-eight checkpoint remains valid")
	for previous in [RaceSim.new(geometry), StrategyRaceSim.new(geometry)]:
		check(RecoveryRaceSim.restore_recovery(previous.snapshot()) != null, "Supported prior native schema still loads: %d" % previous.snapshot().version)

func equivalent(a: Variant, b: Variant) -> bool:
	if a is Dictionary and b is Dictionary:
		if a.size() != b.size(): return false
		for key in a:
			if not b.has(key) or not equivalent(a[key], b[key]): return false
		return true
	if a is Array and b is Array:
		if a.size() != b.size(): return false
		for i in range(a.size()):
			if not equivalent(a[i], b[i]): return false
		return true
	if (a is float or a is int) and (b is float or b is int): return absf(float(a) - float(b)) <= 0.00000001
	return a == b
