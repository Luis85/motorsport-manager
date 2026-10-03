extends SceneTree
## RW-14/15 adversarial contracts. Fixtures may assign initial conditions, never winning outcomes.
var checks = 0
var failures: Array[String] = []
var geometry: TrackGeometry
var metrics: Dictionary = {}


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)


func fixture(laps: int = 12, scenario: String = "dry") -> RecoveryRaceSim:
	var sim = RecoveryRaceSim.new(
		geometry, {"laps": laps, "scenario": scenario, "intensity": "calm", "seed": 2026}
	)
	sim.command("prepare_race")
	sim.command("formation")
	for c in sim.cars:
		c.formation_done = true
	sim.step()
	sim.command("lights")
	for i in range(125):
		sim.step()
	for id in [3, 6]:
		sim.command("delegation", {"id": id, "channel": "pit", "owner": "player"})
	return sim


func request(advice: Dictionary) -> Dictionary:
	return {
		"id": advice.driver_id, "time": advice.time, "key": advice.key, "gate": advice.gate.distance
	}


func synchronize(sim: RecoveryRaceSim) -> void:
	for c in sim.cars:
		sim.observe_reliability(c)


func test_stages_and_exposure() -> void:
	var sim = fixture()
	var c = sim.cars[3]
	var r = sim.reliability(3)
	check(RaceReliability.stage(c, r) == "normal", "A sound new car starts in normal operation")
	for entry in [[6, "warning"], [24, "degraded"], [60, "critical"]]:
		c.damage = entry[0]
		sim.observe_reliability(c)
		check(r.stage == entry[1], "Aggregate damage exposes stage " + entry[1])
	var count = sim.strategy_state.records.size()
	for i in range(100):
		sim.observe_reliability(c)
	check(
		sim.strategy_state.records.size() == count,
		"A persistent critical condition does not produce per-tick warning spam"
	)
	c.damage = 0
	c.health = 23
	sim.observe_reliability(c)
	check(
		r.stage == "critical",
		"Low remaining lifetime health remains critical without repairable damage"
	)
	c.health = 100
	c.engine_temperature = 118
	sim.observe_reliability(c)
	check(r.stage == "warning", "Thermal warning precedes scalar damage")
	c.engine_temperature = 112
	sim.observe_reliability(c)
	check(r.stage == "warning", "Thermal warning hysteresis avoids threshold flicker")
	c.engine_temperature = 107
	sim.observe_reliability(c)
	check(r.stage == "normal", "Cooling genuinely resolves a thermal-only warning")
	var a = c.detached_copy()
	var b = c.detached_copy()
	a.engine_temperature = 123
	b.engine_temperature = 123
	a.engine = 2
	b.engine = 0
	var ra = r.duplicate(true)
	var rb = r.duplicate(true)
	for i in range(1200):
		RaceReliability.advance(ra, a, RaceSim.STEP, true)
		RaceReliability.advance(rb, b, RaceSim.STEP, true)
	check(
		ra.faults > rb.faults and a.damage > b.damage,
		"Sustained engine attack spends more exposure than saving under the same thermal fixture"
	)
	var calm = c.detached_copy()
	calm.engine_temperature = 150
	calm.engine = 2
	var quiet = r.duplicate(true)
	for i in range(600):
		RaceReliability.advance(quiet, calm, RaceSim.STEP, false)
	check(
		quiet.faults == 0 and calm.damage == 0,
		"Disclosed calm mode suppresses random scalar faults"
	)
	var critical = c.detached_copy()
	critical.damage = 75
	critical.health = 20
	critical.engine_temperature = 130
	critical.engine = 2
	var rc = r.duplicate(true)
	var premature = false
	var terminal = false
	for i in range(2000):
		var result = RaceReliability.advance(rc, critical, RaceSim.STEP, true)
		if result.get("retire", false):
			premature = float(i + 1) * RaceSim.STEP < RaceReliability.MIN_CRITICAL_SECONDS
			terminal = true
			break
	check(
		terminal and not premature,
		"Progressive failure respects a critical reaction interval instead of a sudden healthy-car retirement roll"
	)
	var original = sim.rng_state
	var weather_rng = sim.weather_state.model.rng
	var service = sim.reliability_state.service_stream.rng
	for i in range(20):
		sim.service_random_value()
	check(
		(
			sim.rng_state == original
			and sim.weather_state.model.rng == weather_rng
			and sim.reliability_state.service_stream.rng != service
		),
		"Service draws cannot reshuffle driving or weather randomness"
	)
	metrics.attack_faults = ra.faults
	metrics.saving_faults = rb.faults


func test_observational_forecasts() -> void:
	var sim = fixture()
	sim.cars[3].damage = 40
	sim.cars[3].health = 55
	synchronize(sim)
	var before = JSON.stringify(sim.snapshot())
	var advice = sim.recovery_advice(3)
	var started = Time.get_ticks_usec()
	for i in range(20):
		check(
			sim.recovery_advice(3) == advice, "Identical recovery queries are deterministic %d" % i
		)
	metrics.twenty_forecasts_ms = (Time.get_ticks_usec() - started) / 1000.0
	check(
		before == JSON.stringify(sim.snapshot()),
		"Recovery comparisons do not mutate cars, journal, policies or random streams"
	)
	check(
		advice.repaired_lap < advice.current_lap and advice.protected_lap >= advice.current_lap,
		"Repair/saving comparisons expose pace trade-offs rather than a free performance buff"
	)
	check(
		is_equal_approx(advice.repair_seconds, 5.6) and advice.payback_laps > 0,
		"Repair work and full-stop break-even are shown separately"
	)
	var r = sim.reliability(3)
	r.fault_threshold = 50
	r.terminal_threshold = 70
	r.rng = 123
	sim.weather_state.model.target = 1
	sim.weather_state.model.remaining = 100
	check(
		sim.recovery_advice(3) == advice,
		"Hidden fault thresholds and future weather cannot affect recovery advice"
	)
	for key in ["rng", "fault_threshold", "terminal_threshold", "critical_load"]:
		check(not advice.observed.has(key), "Public recovery evidence excludes " + key)
	var revised = sim.recovery_advice(3)
	sim.cars[3].health -= 6
	check(
		sim.recovery_stale(revised),
		"Material remaining-health changes invalidate a displayed recovery choice"
	)
	revised = sim.recovery_advice(3)
	sim.total_time += 6
	check(sim.recovery_stale(revised), "Old recovery cards cannot silently become current orders")
	var saved = sim.recovery_advice(6)
	sim.control_state.revision += 1
	check(sim.recovery_stale(saved), "A revised control procedure invalidates an open comparison")


func test_commands_and_authority() -> void:
	var sim = fixture()
	sim.speed = 8
	sim.cars[3].damage = 40
	synchronize(sim)
	var advice = sim.recovery_advice(3)
	var before = JSON.stringify(sim.snapshot())
	for corrupt in [
		{"id": 0}, {"key": "old"}, {"time": -1}, {"gate": advice.gate.distance + sim.track.length}
	]:
		var payload = request(advice)
		payload.merge(corrupt, true)
		check(
			(
				not sim.command("recovery_repair", payload)
				and before == JSON.stringify(sim.snapshot())
			),
			"Invalid recovery input is rejected atomically: " + str(corrupt.keys())
		)
	check(
		sim.command("recovery_protect", request(advice)),
		"A current recovery card can order two laps of engine saving"
	)
	check(
		sim.cars[3].engine == 0 and sim.cars[3].pace == 1 and sim.policy(3).owners.pit == "player",
		"Protect changes engine intent only, preserving pace and pit authority"
	)
	check(
		sim.policy(3).overrides.has("engine") and sim.policy(3).owners.engine == "engineer",
		"Protect records an explicit return to the prior engine owner"
	)
	check(
		not sim.paused and sim.speed == 8,
		"Recovery advice and protection do not seize time controls"
	)
	var c = sim.cars[3]
	c.distance = sim.policy(3).overrides.engine.until_distance
	sim.step()
	check(
		not sim.policy(3).overrides.has("engine") and sim.policy(3).owners.engine == "engineer",
		"Protect expires through the existing distance-based handback"
	)
	var manual = fixture()
	manual.cars[3].damage = 60
	synchronize(manual)
	check(
		manual.command(
			"recovery_authority",
			{"id": 3, "revision": manual.reliability(3).revision, "value": "repair", "budget": 12}
		),
		"Emergency repair permission is explicit and bounded"
	)
	manual.engineer(manual.cars[3])
	check(not manual.cars[3].pit_order, "Emergency permission cannot override manual pit ownership")
	manual.command("delegation", {"id": 3, "channel": "pit", "owner": "engineer"})
	manual.engineer(manual.cars[3])
	check(
		manual.cars[3].pit_order and manual.reliability(3).repair_only,
		"Critical repair is executed only inside authorized ownership and work budget"
	)
	var denied = fixture()
	denied.cars[3].damage = 60
	synchronize(denied)
	denied.command("delegation", {"id": 3, "channel": "pit", "owner": "engineer"})
	denied.engineer(denied.cars[3])
	check(
		not denied.cars[3].pit_order,
		"Advice-only default cannot fall through to the old damage-triggered automatic stop"
	)
	denied.command(
		"recovery_authority",
		{"id": 3, "revision": denied.reliability(3).revision, "value": "repair", "budget": 2}
	)
	denied.engineer(denied.cars[3])
	check(not denied.cars[3].pit_order, "Repair authority cannot exceed its repair-work budget")
	var plan = StrategyPlan.draft(denied.cars[3], denied.laps, "no_stop")
	plan.starting_set = denied.cars[3].set_id
	plan.allow_emergency = false
	denied.command("approve_plan", {"id": 3, "revision": 0, "plan": plan})
	denied.command(
		"recovery_authority",
		{"id": 3, "revision": denied.reliability(3).revision, "value": "repair", "budget": 12}
	)
	denied.engineer(denied.cars[3])
	check(
		not denied.cars[3].pit_order and denied.policy(3).plan == plan,
		"An approved plan forbidding emergencies remains binding"
	)
	var final_lap = fixture()
	final_lap.cars[3].damage = 40
	final_lap.cars[3].distance = final_lap.laps * geometry.length - 1
	check(
		not final_lap.recovery_advice(3).repair_available,
		"No impossible rescue is offered after the last reachable entry"
	)
	var puncture = fixture()
	puncture.cars[3].damage = 40
	TyreInventory.find(puncture.cars[3], puncture.cars[3].set_id).wheels.FL.punctured = true
	check(
		not puncture.recovery_advice(3).repair_available,
		"Repair-only cannot masquerade as recovery from an unusable fitted wheel"
	)
	var retirement = fixture()
	before = JSON.stringify(retirement.snapshot())
	check(
		(
			not retirement.command("recovery_retire", request(retirement.recovery_advice(3)))
			and before == JSON.stringify(retirement.snapshot())
		),
		"Retirement requires an explicit confirmation"
	)
	var payload = request(retirement.recovery_advice(3))
	payload.confirm = true
	check(
		(
			retirement.command("recovery_retire", payload)
			and retirement.cars[3].dnf
			and not retirement.cars[6].dnf
		),
		"Confirmed retirement targets only the named driver"
	)


func equivalent(a: Variant, b: Variant) -> bool:
	return preload("res://tests/support/state_comparison.gd").equivalent(a, b, 0.00000001)
