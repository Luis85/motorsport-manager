extends SceneTree
## Synthetic/adversarial states exercise contracts, not calibrated race balance.
var checks = 0
var failures: Array[String] = []
var track: TrackGeometry
var metrics: Dictionary = {}

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, text: String) -> void:
	checks += 1
	if not value: failures.append(text); push_error(text)

func fixture(ids: Array = [3, 6], gap: float = 20.0) -> StrategyRaceSim:
	var sim = StrategyRaceSim.new(track, {"laps": 12, "scenario": "dry", "intensity": "calm", "seed": 7021})
	sim.phase = "race"
	for car in sim.cars:
		for channel in StrategyPlan.CHANNELS: sim.policy(car.id).owners[channel] = "player"
		sim.sync_ownership(car)
		car.dnf = car.id not in ids; car.retire_reason = "Fixture: inactive" if car.dnf else ""
		car.distance = 100.0 if car.id == ids[0] else 100.0 - gap
		car.previous_distance = car.distance; car.speed = 40.0; car.lane = 0.0; car.previous_lane = 0.0
		var tyre = TyreInventory.find(car, car.set_id)
		for wheel in tyre.wheels.values(): wheel.surface = 89.0; wheel.core = 89.0
		WheelTyres.publish(tyre); car.temperature = tyre.temperature
	return sim

func ticks(sim: StrategyRaceSim, n: int) -> void:
	for i in range(n): sim.step()

func order(sim: StrategyRaceSim, kind: String, actor: int = 3, mate: int = 6, laps: int = 1) -> bool:
	return sim.command("team_order", {"id": actor, "teammate_id": mate, "kind": kind, "laps": laps, "revision": sim.team_state.revision})

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
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures, "metrics": metrics}
	Storage.write_json("res://reports/living-racecraft-tests.json", report)
	print("LIVING_RACECRAFT_SUMMARY " + JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

func test_commands() -> void:
	var sim = fixture()
	var original = JSON.stringify(sim.snapshot())
	for payload in [
		{"id": 3, "teammate_id": 3, "kind": "hold", "laps": 1, "revision": 0},
		{"id": 3, "teammate_id": 0, "kind": "hold", "laps": 1, "revision": 0},
		{"id": 6, "teammate_id": 3, "kind": "hold", "laps": 1, "revision": 0},
		{"id": 3, "teammate_id": 6, "kind": "teleport", "laps": 1, "revision": 0},
		{"id": 3, "teammate_id": 6, "kind": "hold", "laps": 0, "revision": 0},
		{"id": 3, "teammate_id": 6.2, "kind": "hold", "laps": 1, "revision": 0},
		{"id": 3, "teammate_id": 6, "kind": "hold", "laps": 1, "revision": 4}]:
		check(not sim.command("team_order", payload), "Malformed, stale, opposing or reversed team instruction is rejected")
		check(JSON.stringify(sim.snapshot()) == original, "Rejected team instruction preserves all authoritative state")
	var owners = JSON.stringify(sim.policy(3).owners)
	check(order(sim, "hold"), "Explicit two-driver hold is accepted")
	check(TeamOrders.active(sim.team_state.track_order), "Accepted hold has a visible active state")
	check(sim.cars[3].distance == 100 and sim.cars[6].distance == 80, "Accepting team instructions never changes physical positions")
	check(JSON.stringify(sim.policy(3).owners) == owners, "Team cooperation does not change unrelated control owners")
	check(sim.team_state.track_order.intent_id.begins_with("rw-"), "Team order references the accepted command journal")
	check(not order(sim, "yield"), "Active cooperation cannot be silently replaced")
	var r = sim.team_state.track_order
	check(not sim.command("cancel_team_order", {"id": 3, "slot": "track_order", "revision": 0, "intent_id": r.intent_id}), "Stale cancellation cannot remove the current instruction")
	check(sim.command("cancel_team_order", {"id": 6, "slot": "track_order", "revision": sim.team_state.revision, "intent_id": r.intent_id}), "Either named driver can cancel the current instruction explicitly")
	check(r.status == "cancelled", "Cancellation retains the outcome record")
	check(order(sim, "pit_priority", 6, 3), "Pit priority can name the following car before commitment")
	check(order(sim, "hold"), "Pit and track cooperation use independent slots")
	sim.cars[3].distance = sim.team_state.track_order.until_distance
	TeamOrders.after_step(sim)
	check(sim.team_state.track_order.status == "expired", "Hold expires at its declared distance")
	sim = fixture(); sim.command("pit", {"id": 3})
	original = JSON.stringify(sim.snapshot())
	check(not order(sim, "pit_priority"), "Priority rejects already accepted physical pit orders")
	check(JSON.stringify(sim.snapshot()) == original, "Rejected late priority never changes an accepted gate")
	sim = fixture(); sim.phase = "race_preparation"
	check(not order(sim, "yield"), "Track cooperation is unavailable outside racing")

func test_battle() -> void:
	var sim = fixture([0, 3], 26)
	sim.cars[0].engine = 0; sim.cars[0].pace = 0; sim.cars[0].damage = 12
	sim.cars[3].engine = 2; sim.cars[3].pace = 2; sim.cars[3].battle_mode = "assertive"
	var phases: Array[String] = []; var identity = ""; var min_clearance = INF
	for i in range(700):
		sim.step()
		var battle = sim.battle_state.drivers[3]
		if battle.phase not in phases: phases.append(battle.phase)
		if identity.is_empty() and not battle.id.is_empty(): identity = battle.id
		if absf(sim.cars[0].distance - sim.cars[3].distance) < 6.0: min_clearance = minf(min_clearance, absf(sim.cars[0].lane - sim.cars[3].lane))
		if sim.stats.passes > 0: break
	metrics.phases = phases; metrics.battle_ticks = roundi(sim.total_time / RaceSim.STEP)
	metrics.battle_gap = sim.cars[3].distance - sim.cars[0].distance
	check("prepare" in phases and "probe" in phases and "commit" in phases, "A real attack progresses through preparation, probe and commitment")
	check("alongside" in phases and "resolve" in phases, "A physical pass progresses through alongside and resolved clearance")
	check(sim.stats.passes == 1, "One cleared contest creates one completed-pass event")
	check(min_clearance >= 2.6, "Longitudinal overlap requires separate occupied corridors")
	var completed = sim.strategy_state.records.filter(func(e): return e.kind == "pass_completed")
	check(completed.size() == 1 and completed[0].evidence.battle_id == identity, "One stable battle identity links its measured completion")
	for i in range(20): RacecraftController.after_step(sim)
	check(sim.stats.passes == 1, "Repeated observation cannot duplicate a completed pass")
	# Hold a neutralization throughout the test, so time expiry does not release it.
	sim = fixture([0, 3], 15); sim.flag = "SAFETY CAR"; sim.flag_until = 1000
	sim.cars[0].engine = 0; sim.cars[3].engine = 2
	ticks(sim, 240)
	check(sim.cars[3].distance < sim.cars[0].distance and sim.stats.passes == 0, "Neutralization prevents overtakes despite a resource advantage")
	# Existing relative-position hold constrains only the paired teammate.
	sim = fixture(); sim.cars[6].engine = 2; sim.cars[6].pace = 2; sim.cars[3].engine = 0
	order(sim, "hold"); ticks(sim, 200)
	check(sim.cars[3].distance > sim.cars[6].distance and sim.stats.passes == 0, "A faster teammate respects a live relative-position hold")
	check(not TeamOrders.track_blocks(sim, sim.cars[6], 0), "Holding teammates never forbids passing an unrelated rival")

func test_yield() -> void:
	var sim = fixture(); sim.cars[3].engine = 0; sim.cars[6].engine = 2
	var control = StrategyRaceSim.restore_weekend(sim.snapshot())
	check(control != null, "Physical yield fixture has a valid checkpoint")
	check(order(sim, "yield"), "A nearby following teammate can be allowed through")
	var start = sim.cars[3].distance
	var separation = INF
	for i in range(700):
		sim.step()
		if absf(sim.cars[3].distance - sim.cars[6].distance) < 6: separation = minf(separation, absf(sim.cars[3].lane - sim.cars[6].lane))
		if control: control.step()
		if sim.team_state.track_order.status == "completed": break
	metrics.yield_status = sim.team_state.track_order.status; metrics.yield_gap = sim.cars[6].distance - sim.cars[3].distance
	check(sim.team_state.track_order.status == "completed", "Safe yield completes through physical movement")
	check(sim.cars[6].distance - sim.cars[3].distance > RacecraftController.CLEARANCE, "Cooperation is complete only after the teammate clears the yielding car")
	check(separation >= 2.6, "Yielding never overlaps the teammate in an occupied physical corridor")
	check(sim.cars[3].distance > start, "Yielding continues forward instead of teleporting or stopping the field")
	check(control != null and sim.cars[3].distance < control.cars[3].distance, "A completed yield has a real time/distance cost")
	check(sim.strategy_state.records.any(func(e): return e.kind == "team_order_outcome" and e.evidence.status == "completed"), "Physical cooperation has a journal-linked outcome")
	sim = fixture(); sim.flag = "YELLOW"; sim.yellow_sector = sim.track.sector_at(100); sim.flag_until = 1000
	order(sim, "yield"); ticks(sim, 20)
	check(sim.team_state.track_order.status == "waiting" and sim.cars[3].distance > sim.cars[6].distance, "A yellow-zone yield waits without awarding a pass")
	sim = fixture(); order(sim, "yield"); sim.retire(sim.cars[3], "Fixture retirement"); sim.cars[6].distance = 140; TeamOrders.after_step(sim)
	check(sim.team_state.track_order.status == "expired", "Retirement is never credited as a successful cooperation pass")
	sim = fixture(); order(sim, "yield"); sim.command("pit", {"id": 3}); TeamOrders.after_step(sim)
	check(sim.team_state.track_order.status == "expired" and sim.cars[3].pit_order, "Pit commitment supersedes a track order without losing the pit instruction")

func plan_now(sim: StrategyRaceSim, id: int, width: int = 1) -> Dictionary:
	var car = sim.cars[id]; var gate = RaceForecaster.reachable_gate(sim, car)
	var draft = StrategyPlan.draft(car, sim.laps)
	draft.starting_set = car.set_id
	var set = TyreInventory.choose(car, "H", true)
	draft.stops = [{"from_lap": gate.lap, "to_lap": gate.lap + width, "set_id": set.id}]; draft.branches = []
	check(sim.command("approve_plan", {"id": id, "revision": sim.policy(id).revision, "plan": draft}), "Test stop window is validated before priority evaluation")
	return draft.stops[0]

func test_priority() -> void:
	var sim = fixture(); var window = plan_now(sim, 6); plan_now(sim, 3)
	var before = JSON.stringify(sim.snapshot()); var preview = TeamOrders.preview(sim)
	check(JSON.stringify(sim.snapshot()) == before, "Shared-box preview is observational")
	check(preview.queue > 0 and preview.first.id == 3, "A close double-stack estimates a physical waiting cost")
	order(sim, "pit_priority")
	check(TeamOrders.defer_stop(sim, sim.cars[6], window), "Priority can defer the uncommitted second car within its approved window")
	var gate = sim.team_state.pit_priority.deferred_gate
	check(gate >= 0 and not sim.cars[6].pit_order, "Staggering records a skipped gate, not a fabricated pit entry")
	check(sim.policy(6).plan.stops[0] == window, "Priority never rewrites the approved stop window")
	check(TeamOrders.defer_stop(sim, sim.cars[6], window), "Repeated engineer evaluation retains the same one-entry deferral")
	check(sim.strategy_state.records.filter(func(e): return e.kind == "team_priority_defer").size() == 1, "A double-stack deferral produces one acknowledgement")
	sim.cars[6].distance = gate + 2; sim.cars[6].previous_distance = sim.cars[6].distance
	check(not TeamOrders.defer_stop(sim, sim.cars[6], window), "The next reachable entry releases the one-entry deferral")
	sim = fixture(); window = plan_now(sim, 6, 0); plan_now(sim, 3, 0); order(sim, "pit_priority")
	check(not TeamOrders.defer_stop(sim, sim.cars[6], window) and sim.team_state.pit_priority.status == "queue", "A last allowed stop window accepts queue risk rather than being silently extended")
	sim = fixture(); window = plan_now(sim, 6); plan_now(sim, 3); order(sim, "pit_priority")
	sim.cars[6].tyre = 15
	check(not TeamOrders.defer_stop(sim, sim.cars[6], window), "Emergency resource protection takes precedence over priority")
	sim = fixture(); window = plan_now(sim, 6); plan_now(sim, 3); order(sim, "pit_priority")
	TyreInventory.find(sim.cars[6], sim.cars[6].set_id).wheels.FL.life = 12
	check(not TeamOrders.defer_stop(sim, sim.cars[6], window), "The weakest wheel, not only the average, can veto a deferral")
	sim = fixture(); order(sim, "pit_priority"); sim.engineer(sim.cars[6])
	check(not sim.cars[6].pit_order and sim.policy(6).owners.pit == "player", "Pit priority cannot take over manual pit ownership")

func test_rivals() -> void:
	var sim = fixture([0, 3], 20)
	var snapshot = RaceForecaster.capture(sim, 0)
	var comparison = RaceForecaster.evaluate(snapshot)
	var replacement = RaceForecaster.replacement(snapshot)
	check(not replacement.is_empty(), "Rival has legal finite replacement stock")
	var current = RaceForecaster.set_by_id(snapshot, snapshot.own.set_id)
	current.life = 20.0; WheelTyres.adopt_aggregate(current)
	comparison.options[1].available = true; comparison.options[1].gain = 10.0; comparison.options[1].risk = "low"
	comparison.pit.traffic = []; comparison.pit.queue = 0.0; comparison.pit.warmup = 0.0
	var event = {"event_id": "3:1", "driver_id": 3, "short": "MER", "time": snapshot.time, "distance": snapshot.own.distance - 0.5 * snapshot.length / snapshot.reference_lap, "lap_seconds": snapshot.reference_lap}
	var memory = RivalStrategy.create(sim.cars).drivers[0]
	var before = JSON.stringify(snapshot); var saved = JSON.stringify(sim.snapshot())
	var response = RivalStrategy.response(snapshot, [event], memory, comparison)
	check(response.get("kind") == "cover", "Public stop and a sufficient estimated tyre advantage produce a cover response")
	check(response.get("set_id") == replacement.id, "Cover chooses a real driver-owned replacement")
	check(JSON.stringify(snapshot) == before and JSON.stringify(sim.snapshot()) == saved, "Response evaluation mutates neither snapshot nor live race/RNG")
	if not response.is_empty(): memory.event_id = response.event_id
	check(RivalStrategy.response(snapshot, [event], memory, comparison).is_empty(), "The same observed stop is not repeatedly answered")
	memory.event_id = ""; snapshot.flag = "YELLOW"
	check(RivalStrategy.response(snapshot, [event], memory, comparison).is_empty(), "Strategic battle response defers under a restricted flag")
	snapshot.flag = "GREEN"; current.life = 80.0; WheelTyres.adopt_aggregate(current); comparison.pit.traffic = ["BEL", "ROS"]
	comparison.options[2].available = true; comparison.options[2].seconds = comparison.options[1].seconds - 2
	response = RivalStrategy.response(snapshot, [event], memory, comparison)
	check(response.get("kind") == "overcut" and response.get("hold_gate") == snapshot.gate.distance, "Usable tyres and rejoin traffic can produce an explicit one-entry overcut")
	var rival_snapshot = RaceForecaster.capture(sim, 0)
	sim.policy(3).plan = {"secret_future_stop": 8}; sim.cars[3].next_set_id = "secret"
	check(JSON.stringify(rival_snapshot) == JSON.stringify(RaceForecaster.capture(sim, 0)), "Private player plans and intended sets are not visible to a rival forecast")

func test_persistence() -> void:
	var sim = fixture(); order(sim, "hold"); ticks(sim, 20)
	var saved = sim.snapshot()
	check(saved.version == 6, "Version 6 stores battles, team instructions and public-stop memory")
	var copy = StrategyRaceSim.restore_weekend(saved)
	check(copy != null, "New battle/team checkpoint validates")
	if copy:
		ticks(sim, 80); ticks(copy, 80)
		check(JSON.stringify(sim.snapshot()) == JSON.stringify(copy.snapshot()), "An in-memory restore continues the same fixed-step battle and team state")
	var disk = StrategyRaceSim.restore_weekend(JSON.parse_string(JSON.stringify(saved)))
	check(disk != null, "New state restores through a JSON disk round trip")
	var legacy = saved.duplicate(true); legacy.version = 5
	for key in ["battle_state", "team_state", "rival_state"]: legacy.erase(key)
	var migrated = StrategyRaceSim.restore_weekend(legacy)
	check(migrated != null and migrated.team_state.track_order.is_empty() and migrated.battle_state.sequence == 0, "Version 5 migration creates no invented historical battle or team instruction")
	check(migrated != null and migrated.strategy_state.records == legacy.strategy_state.records, "Legacy strategy decisions survive migration intact")
	for key in ["battle_state", "team_state", "rival_state"]:
		var invalid = saved.duplicate(true); invalid[key] = {"version": 99}
		check(StrategyRaceSim.restore_weekend(invalid) == null, "Unsupported new subsystem version is rejected: " + key)
	var bad = saved.duplicate(true); bad.battle_state.drivers[3].target_id = 3
	check(StrategyRaceSim.restore_weekend(bad) == null, "A self-targeting battle is rejected")
	bad = saved.duplicate(true); bad.team_state.track_order.teammate_id = 0
	check(StrategyRaceSim.restore_weekend(bad) == null, "An opposing car cannot be smuggled into a saved team instruction")
	bad = saved.duplicate(true); bad.team_state.track_order.until_distance = INF
	check(StrategyRaceSim.restore_weekend(bad) == null, "A non-finite saved team expiry is rejected")

func test_battle_edges() -> void:
	var sim = fixture([0, 3], 20)
	sim.cars[0].engine = 0; sim.cars[3].engine = 2; ticks(sim, 20)
	var identity = sim.battle_state.drivers[3].id
	check(not identity.is_empty(), "Battle acquires a persistent target before an attack")
	var saved = sim.snapshot(); var resumed = StrategyRaceSim.restore_weekend(JSON.parse_string(JSON.stringify(saved)))
	check(resumed != null and resumed.battle_state.drivers[3].id == identity, "JSON restore preserves an active contest's identity and phase")
	sim.flag = "YELLOW"; sim.yellow_sector = track.sector_at(sim.cars[3].distance); sim.flag_until = 1000
	ticks(sim, 1)
	check(sim.battle_state.drivers[3].phase == "recover" and sim.stats.passes == 0, "An intervening local yellow aborts a committed approach without inventing a pass")
	sim = fixture([0, 3], 20); ticks(sim, 2); sim.cars[0].route = "pit"; RacecraftController.after_step(sim)
	check(sim.battle_state.drivers[3].phase == "recover", "A target entering the pits ends the on-track contest")
	sim = fixture([0, 3], 20); sim.cars[0].distance += track.length; sim.cars[0].previous_distance = sim.cars[0].distance
	ticks(sim, 2)
	check(sim.battle_state.drivers[3].target_id == -1, "A lapped-car encounter is not misclassified as a same-lap battle")
	var wide = track; var document = track.document.duplicate(true)
	for node in document.nodes: node.w = 6.0
	track = TrackGeometry.new(document)
	sim = fixture([0, 3], 20); sim.cars[0].engine = 0; sim.cars[3].engine = 2; sim.cars[3].pace = 2
	ticks(sim, 240)
	check(sim.cars[3].distance < sim.cars[0].distance and sim.stats.passes == 0, "Narrow-road geometry prevents an otherwise tempting attack")
	track = wide
	sim = fixture([3, 6, 0], 20); sim.cars[0].distance = 108; sim.cars[0].previous_distance = 108
	order(sim, "yield"); ticks(sim, 1)
	check(sim.team_state.track_order.status == "waiting", "Nearby unrelated traffic blocks deliberate yielding")

func test_physical_pit_priority() -> void:
	var sim = fixture(); var car = sim.cars[3]; var mate = sim.cars[6]
	car.distance = track.pit_entry - 320; car.previous_distance = car.distance
	mate.distance = car.distance - 15; mate.previous_distance = mate.distance
	var first = plan_now(sim, 3); var second = plan_now(sim, 6)
	var old_forecast = sim.forecast(6)
	check(order(sim, "pit_priority", 3, 6, 3), "Physical priority fixture accepts an explicit bounded priority")
	check(RaceForecaster.stale(sim, old_forecast), "A team priority change invalidates the player's old pit forecast")
	var expected_first_gate = RaceForecaster.reachable_gate(sim, car).distance
	var restored_during_wait = false
	for i in range(6000):
		sim.step()
		if not restored_during_wait and sim.team_state.pit_priority.status == "staggered":
			var copy = StrategyRaceSim.restore_weekend(sim.snapshot())
			check(copy != null and copy.team_state.pit_priority.deferred_gate == expected_first_gate, "An active one-entry deferral persists")
			restored_during_wait = true
		if car.pit_stops > 0 and mate.pit_stops > 0: break
	var entries = sim.strategy_state.records.filter(func(e): return e.kind == "pit_entry" and e.driver_id in [3, 6])
	metrics.priority_entries = entries.map(func(e): return {"driver": e.driver_id, "time": e.time, "gate": e.evidence.get("gate", -1)})
	check(entries.size() == 2 and entries[0].driver_id == 3 and entries[1].driver_id == 6, "Both real pit entries respect staggered opportunity without reordered service")
	check(car.pit_stops == 1 and mate.pit_stops == 1, "Each driver completes exactly one real service")
	check(car.set_id == first.set_id and mate.set_id == second.set_id, "Both services mount their own approved physical sets")
	check(sim.team_state.pit_priority.status == "completed", "Pit priority ends after both measured services")
	check(TeamOrders.preview(sim).queue == 0, "A car already releasing is not forecast as waiting for another service")

func test_physical_rival_response() -> void:
	var sim = fixture([0, 3], 30)
	var rival = sim.cars[0]; var player = sim.cars[3]
	rival.distance = track.pit_entry - 250; rival.previous_distance = rival.distance
	player.distance = rival.distance - 30; player.previous_distance = player.distance
	check(sim.command("pit", {"id": 3}), "Rival-response fixture begins with a legal player stop")
	for i in range(600):
		sim.step()
		if player.route == "pit": break
	check(sim.rival_state.stops.any(func(event): return event.driver_id == 3), "Only a real entry publishes the player stop to rival observers")
	var item = TyreInventory.find(rival, rival.set_id)
	item.life = 30; WheelTyres.adopt_aggregate(item); rival.tyre = item.life
	sim.policy(0).owners.pit = "engineer"; sim.policy(0).next_review = 0; sim.sync_ownership(rival)
	var before = rival.distance; sim.engineer(rival)
	metrics.rival_response = sim.rival_state.drivers[0].kind
	check(sim.rival_state.drivers[0].kind == "cover", "The integrated rival engineer covers a genuinely observed player entry")
	check(rival.pit_order and rival.distance == before, "Cover creates a legal order, never a position adjustment")
	check(sim.strategy_state.records.any(func(event): return event.kind == "strategy_response" and event.driver_id == 0), "Rival response and its public evidence enter the journal")
	var planned_set = rival.next_set_id
	for i in range(6000):
		sim.step()
		if rival.pit_stops > 0: break
	check(rival.pit_stops == 1 and rival.set_id == planned_set, "Cover executes through the physical pit route and finite inventory")
	check(StrategyRaceSim.restore_weekend(sim.snapshot()) != null, "Observed stops and completed rival response restore after physical execution")
