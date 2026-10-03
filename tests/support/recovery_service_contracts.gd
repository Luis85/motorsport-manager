extends "res://tests/support/recovery_authority_contracts.gd"


func test_physical_service() -> void:
	var sim = fixture()
	var c = sim.cars[3]
	c.damage = 40
	c.health = 70
	synchronize(sim)
	# Exhaust spare stock: a genuine repair-only service must not invent or mount a set.
	for item in c.tyre_sets:
		if item.id != c.set_id:
			item.life = 0
			WheelTyres.adopt_aggregate(item)
	var fitted = c.set_id
	var mounts = TyreInventory.find(c, fitted).mounts
	var stints = c.stints.size()
	var advice = sim.recovery_advice(3)
	check(
		advice.repair_available and sim.command("recovery_repair", request(advice)),
		"Repair-only remains legal with no replacement stock"
	)
	var comparison = sim.forecast(3)
	check(
		(
			comparison.replacement_id.is_empty()
			and not comparison.options[0].available
			and "Repair-only" in comparison.options[0].title
		),
		"Strategy comparison cannot invent a tyre change for an accepted repair-only transaction"
	)
	check(
		c.set_id == fitted and c.damage == 40 and c.pit_order,
		"An accepted repair order repairs nothing before reaching the box"
	)
	var pending = RecoveryRaceSim.restore_recovery(
		JSON.parse_string(JSON.stringify(sim.snapshot(), "", false, true))
	)
	check(
		pending != null and pending.reliability(3).repair_only,
		"Pending repair-only order survives a version-eight JSON checkpoint"
	)
	var seen_service = false
	var completed = false
	var frozen_valid = false
	var unchanged = false
	for i in range(6500):
		sim.step()
		if c.pit_stage == "service" and not seen_service:
			seen_service = true
			var loaded = RecoveryRaceSim.restore_recovery(
				JSON.parse_string(JSON.stringify(sim.snapshot(), "", false, true))
			)
			frozen_valid = (
				loaded != null
				and equivalent(loaded.reliability(3).service, sim.reliability(3).service)
				and (
					loaded.reliability_state.service_stream.rng
					== sim.reliability_state.service_stream.rng
				)
			)
			check(
				"no tyre change" in sim.pit_status(c),
				"Physical repair-only service does not claim tyres are being fitted"
			)
			var before = JSON.stringify(sim.snapshot())
			unchanged = (
				not sim.command("repair", {"id": 3, "value": false})
				and before == JSON.stringify(sim.snapshot())
			)
		if c.pit_stops == 1 and c.route == "track":
			completed = true
			break
	check(seen_service and completed, "Repair-only physically drives entry, service and safe exit")
	check(frozen_valid, "Frozen service job, repair cost and service RNG survive JSON restore")
	check(unchanged, "A service repair choice cannot change after physical entry")
	check(
		c.damage == 0 and c.health <= 70,
		"Completed repair removes scalar damage without replenishing lifetime health"
	)
	check(
		(
			c.set_id == fitted
			and TyreInventory.find(c, fitted).mounts == mounts
			and c.stints.size() == stints
			and c.tyre < 100
		),
		"Repair-only retains set identity, mounts, existing stint and real wear"
	)
	check(
		sim.events.any(func(e): return "same retained tyre set" in e.text),
		"Repair-only exit acknowledgement describes retained tyres, not a new cold set"
	)
	check(
		not sim.reliability(3).repair_only and sim.reliability(3).service.is_empty(),
		"Pit exit clears the completed repair transaction"
	)
	check(
		RecoveryRaceSim.restore_recovery(sim.snapshot()) != null,
		"Completed repair, finite stock and evidence form a valid checkpoint"
	)
	var visits = sim.strategy_state.records.filter(
		func(record): return record.kind == "pit_exit" and record.driver_id == 3
	)
	check(
		visits.size() == 1 and visits[0].evidence.has("visit_seconds"),
		"Repair-only produces exactly one measured pit-visit record"
	)
	if not visits.is_empty():
		metrics.repair_visit = visits[0].evidence
	check(
		(
			"Measured service" in sim.recovery_debrief()
			and "not alternate results" in sim.recovery_debrief()
		),
		"Debrief separates measured repair work from alternate-result claims"
	)


func test_shared_repair_and_terminal_edges() -> void:
	var sim = fixture()
	for id in [3, 6]:
		sim.cars[id].damage = 40
		sim.observe_reliability(sim.cars[id])
		check(
			sim.command("recovery_repair", request(sim.recovery_advice(id))),
			"Both cars can request physical repair-only service: %d" % id
		)
	var before = JSON.stringify(sim.snapshot())
	var preview = TeamOrders.preview(sim)
	check(
		before == JSON.stringify(sim.snapshot()) and preview.first.service > 2.5,
		"Shared repair-box preview is observational and prices repair work"
	)
	var occupied = {}
	var overlap = false
	var seen = {}
	var frozen_checked = false
	for i in range(4500):
		sim.step()
		var occupants = sim.cars.filter(
			func(c): return c.team == "Obsidian" and c.pit_stage == "service"
		)
		if occupants.size() > 1:
			overlap = true
		for c in occupants:
			seen[c.id] = true
		if not occupants.is_empty() and not frozen_checked:
			var bad = sim.snapshot()
			var id = int(occupants[0].id)
			bad.reliability_state.drivers[id].service.erase("health_before")
			check(
				RecoveryRaceSim.restore_recovery(bad) == null,
				"Missing frozen repair state is rejected before replacing a running service"
			)
			frozen_checked = true
		if (
			sim.cars[3].pit_stops == 1
			and sim.cars[6].pit_stops == 1
			and sim.cars[3].route == "track"
			and sim.cars[6].route == "track"
		):
			break
	check(
		not overlap and seen.has(3) and seen.has(6),
		"Two repair-only cars use the physical box serially, never simultaneously"
	)
	check(
		(
			sim.cars[3].damage == 0
			and sim.cars[6].damage == 0
			and sim.cars[3].pit_stops == 1
			and sim.cars[6].pit_stops == 1
		),
		"Both queued repairs complete exactly once"
	)
	var bad_record = sim.snapshot()
	for record in bad_record.strategy_state.records:
		if record.kind == "recovery_service" and record.evidence.stage == "completed":
			record.evidence.erase("health_before")
			break
	check(
		RecoveryRaceSim.restore_recovery(bad_record) == null,
		"Incomplete measured service evidence cannot reach the debrief"
	)
	var exhausted = fixture()
	for c in exhausted.cars:
		exhausted.retire(c, "Test-only all-retired fixture")
	exhausted.step()
	check(
		exhausted.phase == "results" and exhausted.cars.all(func(c): return c.dnf),
		"All-retired field settles without waiting for virtual clearance"
	)
	check(
		RecoveryRaceSim.restore_recovery(exhausted.snapshot()) != null,
		"All-retired classification and control state restore"
	)
	check(
		not exhausted.recovery_advice(3).repair_available,
		"A retired car is never advertised as a feasible repair opportunity"
	)
	var short = RecoveryScenarios.build(
		ScenarioCatalog.read("recovery")[1], Storage.read_catalog().data
	)
	var advice = short.recovery_advice(3)
	check(
		advice.payback_laps > short.laps,
		"A small-damage short-race fixture makes staying out a credible choice"
	)


func test_control_procedure() -> void:
	var state = WeekendRaceControl.create()
	WeekendRaceControl.enqueue(state, 6, 1, true, 38, 0, "rw-1", "Clearance needed")
	check(
		state.state == "green" and state.pending.size() == 1,
		"A hazard request cannot change rules halfway through the field loop"
	)
	WeekendRaceControl.enqueue(state, 6, 1, true, 38, 0, "rw-1", "Duplicate")
	check(state.pending.size() == 1, "Repeated hazard source is idempotent")
	var event = WeekendRaceControl.tick(state, 0.05)
	check(
		state.state == "virtual" and event.effective_time == 0.05,
		"Virtual deployment is published at the next authoritative boundary"
	)
	WeekendRaceControl.tick(state, 38.05)
	check(
		state.state == "ending" and is_equal_approx(state.until, 46.05),
		"Virtual clearance leads to an explicit eight-second no-passing ending"
	)
	WeekendRaceControl.enqueue(state, 3, 0, true, 25, 40, "rw-2", "New obstruction")
	WeekendRaceControl.tick(state, 40.05)
	check(
		state.state == "virtual" and state.until > 46.05,
		"A new global hazard cancels an announced release"
	)
	WeekendRaceControl.tick(state, state.until)
	WeekendRaceControl.tick(state, state.until)
	check(
		state.state == "green" and state.until == 0,
		"The global restriction eventually releases without position resets"
	)
	for sector in [2, 0, 1]:
		WeekendRaceControl.enqueue(
			state, sector, sector, false, 18, 100, "zone-%d" % sector, "Local recovery"
		)
	WeekendRaceControl.tick(state, 100.05)
	check(
		state.zones.size() == 3 and state.zones[0].sector == 0,
		"Simultaneous local yellows are preserved in stable order, not last-car-wins"
	)
	check(
		WeekendRaceControl.restricted(state, 300, 298, 302),
		"Local-yellow interval checks handle the start-line wrap"
	)
	WeekendRaceControl.tick(state, 120)
	check(
		state.zones.is_empty() and WeekendRaceControl.flag_value(state) == "GREEN",
		"Expired local zones release independently"
	)
	WeekendRaceControl.enqueue(state, 3, 1, false, 18, 120, "sector-1", "Local recovery")
	WeekendRaceControl.tick(state, 120.05)
	check(
		(
			not WeekendRaceControl.restricted(state, 300, 50, 51)
			and WeekendRaceControl.restricted(state, 300, 99, 101)
		),
		"Local restrictions affect the swept affected sector, not the whole circuit"
	)
	check(WeekendRaceControl.valid(state, 120.05), "Control state and queued sources remain valid")
	var sim = fixture()
	sim.speed = 8
	var weather = sim.weather_advice(3)
	var strategy = sim.forecast(3)
	var before = sim.cars[3].distance
	sim.retire(sim.cars[0], "Barrier impact")
	check(
		sim.flag == "GREEN" and sim.control_state.pending.size() == 1,
		"Real on-track retirement queues control without a mid-tick flag switch"
	)
	sim.step()
	check(
		(
			sim.flag == "VIRTUAL"
			and not sim.paused
			and sim.speed == 8
			and sim.cars[3].distance >= before
		),
		"Uniform virtual deployment never pauses, slows playback, or rewinds a car"
	)
	check(
		(
			sim.weather_stale(weather)
			and RaceForecaster.stale(sim, strategy, int(sim.policy(3).revision))
		),
		"New sporting restrictions invalidate weather and ordinary strategy comparisons"
	)
	var virtual_pit = RaceForecaster.pit_prediction(RaceForecaster.capture(sim, 3))
	var source = RaceForecaster.capture(sim, 3)
	source.model_context.neutral_factor = 1.0
	var green_pit = RaceForecaster.pit_prediction(source)
	check(
		virtual_pit.loss < green_pit.loss and virtual_pit.visit == green_pit.visit,
		"Virtual pace changes relative pit loss, not physical service/transit duration"
	)
	metrics.virtual_pit_loss = virtual_pit.loss
	metrics.green_pit_loss = green_pit.loss


func isolate_pair(sim: RecoveryRaceSim) -> void:
	for c in sim.cars:
		if c.id not in [3, 6]:
			c.dnf = true
			c.speed = 0.0
	sim.cars[3].distance = 100
	sim.cars[6].distance = 101
	sim.cars[3].lane = -2
	sim.cars[6].lane = 2
	sim.cars[3].speed = 65
	sim.cars[6].speed = 3
	sim.cars[3].engine = 2
	sim.cars[6].engine = 0
