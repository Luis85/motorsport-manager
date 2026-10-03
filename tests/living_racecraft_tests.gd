extends "res://tests/support/living_racecraft_track_contracts.gd"


func run() -> void:
	track = TrackGeometry.new(Storage.read_catalog().data[1])
	test_commands()
	test_battle()
	test_yield()
	test_priority()
	test_rivals()
	test_persistence()
	test_battle_edges()
	test_physical_pit_priority()
	test_physical_rival_response()
	var report = {
		"passed": failures.is_empty(), "checks": checks, "failures": failures, "metrics": metrics
	}
	Storage.write_json("res://reports/living-racecraft-tests.json", report)
	print("LIVING_RACECRAFT_SUMMARY " + JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)


func plan_now(sim: StrategyRaceSim, id: int, width: int = 1) -> Dictionary:
	var car = sim.cars[id]
	var gate = RaceForecaster.reachable_gate(sim, car)
	var draft = StrategyPlan.draft(car, sim.laps)
	draft.starting_set = car.set_id
	var tyre_set = TyreInventory.choose(car, "H", true)
	draft.stops = [{"from_lap": gate.lap, "to_lap": gate.lap + width, "set_id": tyre_set.id}]
	draft.branches = []
	check(
		sim.command("approve_plan", {"id": id, "revision": sim.policy(id).revision, "plan": draft}),
		"Test stop window is validated before priority evaluation"
	)
	return draft.stops[0]


func test_priority() -> void:
	var sim = fixture()
	var window = plan_now(sim, 6)
	plan_now(sim, 3)
	var before = JSON.stringify(sim.snapshot())
	var preview = TeamOrders.preview(sim)
	check(JSON.stringify(sim.snapshot()) == before, "Shared-box preview is observational")
	check(
		preview.queue > 0 and preview.first.id == 3,
		"A close double-stack estimates a physical waiting cost"
	)
	order(sim, "pit_priority")
	check(
		TeamOrders.defer_stop(sim, sim.cars[6], window),
		"Priority can defer the uncommitted second car within its approved window"
	)
	var gate = sim.team_state.pit_priority.deferred_gate
	check(
		gate >= 0 and not sim.cars[6].pit_order,
		"Staggering records a skipped gate, not a fabricated pit entry"
	)
	check(sim.policy(6).plan.stops[0] == window, "Priority never rewrites the approved stop window")
	check(
		TeamOrders.defer_stop(sim, sim.cars[6], window),
		"Repeated engineer evaluation retains the same one-entry deferral"
	)
	check(
		(
			(
				sim
				. strategy_state
				. records
				. filter(func(e): return e.kind == "team_priority_defer")
				. size()
			)
			== 1
		),
		"A double-stack deferral produces one acknowledgement"
	)
	sim.cars[6].distance = gate + 2
	sim.cars[6].previous_distance = sim.cars[6].distance
	check(
		not TeamOrders.defer_stop(sim, sim.cars[6], window),
		"The next reachable entry releases the one-entry deferral"
	)
	sim = fixture()
	window = plan_now(sim, 6, 0)
	plan_now(sim, 3, 0)
	order(sim, "pit_priority")
	check(
		(
			not TeamOrders.defer_stop(sim, sim.cars[6], window)
			and sim.team_state.pit_priority.status == "queue"
		),
		"A last allowed stop window accepts queue risk rather than being silently " + "extended"
	)
	sim = fixture()
	window = plan_now(sim, 6)
	plan_now(sim, 3)
	order(sim, "pit_priority")
	sim.cars[6].tyre = 15
	check(
		not TeamOrders.defer_stop(sim, sim.cars[6], window),
		"Emergency resource protection takes precedence over priority"
	)
	sim = fixture()
	window = plan_now(sim, 6)
	plan_now(sim, 3)
	order(sim, "pit_priority")
	TyreInventory.find(sim.cars[6], sim.cars[6].set_id).wheels.FL.life = 12
	check(
		not TeamOrders.defer_stop(sim, sim.cars[6], window),
		"The weakest wheel, not only the average, can veto a deferral"
	)
	sim = fixture()
	order(sim, "pit_priority")
	sim.engineer(sim.cars[6])
	check(
		not sim.cars[6].pit_order and sim.policy(6).owners.pit == "player",
		"Pit priority cannot take over manual pit ownership"
	)


func test_rivals() -> void:
	var sim = fixture([0, 3], 20)
	var snapshot = RaceForecaster.capture(sim, 0)
	var comparison = RaceForecaster.evaluate(snapshot)
	var replacement = RaceForecaster.replacement(snapshot)
	check(not replacement.is_empty(), "Rival has legal finite replacement stock")
	var current = RaceForecaster.set_by_id(snapshot, snapshot.own.set_id)
	current.life = 20.0
	WheelTyres.adopt_aggregate(current)
	comparison.options[1].available = true
	comparison.options[1].gain = 10.0
	comparison.options[1].risk = "low"
	comparison.pit.traffic = []
	comparison.pit.queue = 0.0
	comparison.pit.warmup = 0.0
	var event = {
		"event_id": "3:1",
		"driver_id": 3,
		"short": "MER",
		"time": snapshot.time,
		"distance": snapshot.own.distance - 0.5 * snapshot.length / snapshot.reference_lap,
		"lap_seconds": snapshot.reference_lap
	}
	var memory = RivalStrategy.create(sim.cars).drivers[0]
	var before = JSON.stringify(snapshot)
	var saved = JSON.stringify(sim.snapshot())
	var response = RivalStrategy.response(snapshot, [event], memory, comparison)
	check(
		response.get("kind") == "cover",
		"Public stop and a sufficient estimated tyre advantage produce a cover response"
	)
	check(response.get("set_id") == replacement.id, "Cover chooses a real driver-owned replacement")
	check(
		JSON.stringify(snapshot) == before and JSON.stringify(sim.snapshot()) == saved,
		"Response evaluation mutates neither snapshot nor live race/RNG"
	)
	if not response.is_empty():
		memory.event_id = response.event_id
	check(
		RivalStrategy.response(snapshot, [event], memory, comparison).is_empty(),
		"The same observed stop is not repeatedly answered"
	)
	memory.event_id = ""
	snapshot.flag = "YELLOW"
	check(
		RivalStrategy.response(snapshot, [event], memory, comparison).is_empty(),
		"Strategic battle response defers under a restricted flag"
	)
	snapshot.flag = "GREEN"
	current.life = 80.0
	WheelTyres.adopt_aggregate(current)
	comparison.pit.traffic = ["BEL", "ROS"]
	comparison.options[2].available = true
	comparison.options[2].seconds = comparison.options[1].seconds - 2
	response = RivalStrategy.response(snapshot, [event], memory, comparison)
	check(
		response.get("kind") == "overcut" and response.get("hold_gate") == snapshot.gate.distance,
		"Usable tyres and rejoin traffic can produce an explicit one-entry overcut"
	)
	var rival_snapshot = RaceForecaster.capture(sim, 0)
	sim.policy(3).plan = {"secret_future_stop": 8}
	sim.cars[3].next_set_id = "secret"
	check(
		JSON.stringify(rival_snapshot) == JSON.stringify(RaceForecaster.capture(sim, 0)),
		"Private player plans and intended sets are not visible to a rival forecast"
	)


func test_persistence() -> void:
	var sim = fixture()
	order(sim, "hold")
	ticks(sim, 20)
	var saved = sim.snapshot()
	check(saved.version == 6, "Version 6 stores battles, team instructions and public-stop memory")
	var copy = StrategyRaceSim.restore_weekend(saved)
	check(copy != null, "New battle/team checkpoint validates")
	if copy:
		ticks(sim, 80)
		ticks(copy, 80)
		check(
			JSON.stringify(sim.snapshot()) == JSON.stringify(copy.snapshot()),
			"An in-memory restore continues the same fixed-step battle and team state"
		)
	var disk = StrategyRaceSim.restore_weekend(JSON.parse_string(JSON.stringify(saved)))
	check(disk != null, "New state restores through a JSON disk round trip")
	var legacy = saved.duplicate(true)
	legacy.version = 5
	for key in ["battle_state", "team_state", "rival_state"]:
		legacy.erase(key)
	var migrated = StrategyRaceSim.restore_weekend(legacy)
	check(
		(
			migrated != null
			and migrated.team_state.track_order.is_empty()
			and migrated.battle_state.sequence == 0
		),
		"Version 5 migration creates no invented historical battle or team instruction"
	)
	check(
		migrated != null and migrated.strategy_state.records == legacy.strategy_state.records,
		"Legacy strategy decisions survive migration intact"
	)
	for key in ["battle_state", "team_state", "rival_state"]:
		var invalid = saved.duplicate(true)
		invalid[key] = {"version": 99}
		check(
			StrategyRaceSim.restore_weekend(invalid) == null,
			"Unsupported new subsystem version is rejected: " + key
		)
	var bad = saved.duplicate(true)
	bad.battle_state.drivers[3].target_id = 3
	check(StrategyRaceSim.restore_weekend(bad) == null, "A self-targeting battle is rejected")
	bad = saved.duplicate(true)
	bad.team_state.track_order.teammate_id = 0
	check(
		StrategyRaceSim.restore_weekend(bad) == null,
		"An opposing car cannot be smuggled into a saved team instruction"
	)
	bad = saved.duplicate(true)
	bad.team_state.track_order.until_distance = INF
	check(
		StrategyRaceSim.restore_weekend(bad) == null, "A non-finite saved team expiry is rejected"
	)


func test_battle_edges() -> void:
	var sim = fixture([0, 3], 20)
	sim.cars[0].engine = 0
	sim.cars[3].engine = 2
	ticks(sim, 20)
	var identity = sim.battle_state.drivers[3].id
	check(not identity.is_empty(), "Battle acquires a persistent target before an attack")
	var saved = sim.snapshot()
	var resumed = StrategyRaceSim.restore_weekend(JSON.parse_string(JSON.stringify(saved)))
	check(
		resumed != null and resumed.battle_state.drivers[3].id == identity,
		"JSON restore preserves an active contest's identity and phase"
	)
	sim.flag = "YELLOW"
	sim.yellow_sector = track.sector_at(sim.cars[3].distance)
	sim.flag_until = 1000
	ticks(sim, 1)
	check(
		sim.battle_state.drivers[3].phase == "recover" and sim.stats.passes == 0,
		"An intervening local yellow aborts a committed approach without inventing a pass"
	)
	sim = fixture([0, 3], 20)
	ticks(sim, 2)
	sim.cars[0].route = "pit"
	RacecraftController.after_step(sim)
	check(
		sim.battle_state.drivers[3].phase == "recover",
		"A target entering the pits ends the on-track contest"
	)
	sim = fixture([0, 3], 20)
	sim.cars[0].distance += track.length
	sim.cars[0].previous_distance = sim.cars[0].distance
	ticks(sim, 2)
	check(
		sim.battle_state.drivers[3].target_id == -1,
		"A lapped-car encounter is not misclassified as a same-lap battle"
	)
	var wide = track
	var document = track.document.duplicate(true)
	for node in document.nodes:
		node.w = 6.0
	track = TrackGeometry.new(document)
	sim = fixture([0, 3], 20)
	sim.cars[0].engine = 0
	sim.cars[3].engine = 2
	sim.cars[3].pace = 2
	ticks(sim, 240)
	check(
		sim.cars[3].distance < sim.cars[0].distance and sim.stats.passes == 0,
		"Narrow-road geometry prevents an otherwise tempting attack"
	)
	track = wide
	sim = fixture([3, 6, 0], 20)
	sim.cars[0].distance = 108
	sim.cars[0].previous_distance = 108
	order(sim, "yield")
	ticks(sim, 1)
	check(
		sim.team_state.track_order.status == "waiting",
		"Nearby unrelated traffic blocks deliberate yielding"
	)


func test_physical_pit_priority() -> void:
	var sim = fixture()
	var car = sim.cars[3]
	var mate = sim.cars[6]
	car.distance = track.pit_entry - 320
	car.previous_distance = car.distance
	mate.distance = car.distance - 15
	mate.previous_distance = mate.distance
	var first = plan_now(sim, 3)
	var second = plan_now(sim, 6)
	var old_forecast = sim.forecast(6)
	check(
		order(sim, "pit_priority", 3, 6, 3),
		"Physical priority fixture accepts an explicit bounded priority"
	)
	check(
		RaceForecaster.stale(sim, old_forecast),
		"A team priority change invalidates the player's old pit forecast"
	)
	var expected_first_gate = RaceForecaster.reachable_gate(sim, car).distance
	var restored_during_wait = false
	for i in range(6000):
		sim.step()
		if not restored_during_wait and sim.team_state.pit_priority.status == "staggered":
			var copy = StrategyRaceSim.restore_weekend(sim.snapshot())
			check(
				copy != null and copy.team_state.pit_priority.deferred_gate == expected_first_gate,
				"An active one-entry deferral persists"
			)
			restored_during_wait = true
		if car.pit_stops > 0 and mate.pit_stops > 0:
			break
	var entries = sim.strategy_state.records.filter(
		func(e): return e.kind == "pit_entry" and e.driver_id in [3, 6]
	)
	metrics.priority_entries = entries.map(
		func(e): return {"driver": e.driver_id, "time": e.time, "gate": e.evidence.get("gate", -1)}
	)
	check(
		entries.size() == 2 and entries[0].driver_id == 3 and entries[1].driver_id == 6,
		"Both real pit entries respect staggered opportunity without reordered service"
	)
	check(
		car.pit_stops == 1 and mate.pit_stops == 1, "Each driver completes exactly one real service"
	)
	check(
		car.set_id == first.set_id and mate.set_id == second.set_id,
		"Both services mount their own approved physical sets"
	)
	check(
		sim.team_state.pit_priority.status == "completed",
		"Pit priority ends after both measured services"
	)
	check(
		TeamOrders.preview(sim).queue == 0,
		"A car already releasing is not forecast as waiting for another service"
	)


func test_physical_rival_response() -> void:
	var sim = fixture([0, 3], 30)
	var rival = sim.cars[0]
	var player = sim.cars[3]
	rival.distance = track.pit_entry - 250
	rival.previous_distance = rival.distance
	player.distance = rival.distance - 30
	player.previous_distance = player.distance
	check(sim.command("pit", {"id": 3}), "Rival-response fixture begins with a legal player stop")
	for i in range(600):
		sim.step()
		if player.route == "pit":
			break
	check(
		sim.rival_state.stops.any(func(event): return event.driver_id == 3),
		"Only a real entry publishes the player stop to rival observers"
	)
	var item = TyreInventory.find(rival, rival.set_id)
	item.life = 30
	WheelTyres.adopt_aggregate(item)
	rival.tyre = item.life
	sim.policy(0).owners.pit = "engineer"
	sim.policy(0).next_review = 0
	sim.sync_ownership(rival)
	var before = rival.distance
	sim.engineer(rival)
	metrics.rival_response = sim.rival_state.drivers[0].kind
	check(
		sim.rival_state.drivers[0].kind == "cover",
		"The integrated rival engineer covers a genuinely observed player entry"
	)
	check(
		rival.pit_order and rival.distance == before,
		"Cover creates a legal order, never a position adjustment"
	)
	check(
		sim.strategy_state.records.any(
			func(event): return event.kind == "strategy_response" and event.driver_id == 0
		),
		"Rival response and its public evidence enter the journal"
	)
	var planned_set = rival.next_set_id
	for i in range(6000):
		sim.step()
		if rival.pit_stops > 0:
			break
	check(
		rival.pit_stops == 1 and rival.set_id == planned_set,
		"Cover executes through the physical pit route and finite inventory"
	)
	check(
		StrategyRaceSim.restore_weekend(sim.snapshot()) != null,
		"Observed stops and completed rival response restore after physical execution"
	)
