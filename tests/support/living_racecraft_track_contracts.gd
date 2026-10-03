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
	if not value:
		failures.append(text)
		push_error(text)


func fixture(ids: Array = [3, 6], gap: float = 20.0) -> StrategyRaceSim:
	var sim = StrategyRaceSim.new(
		track, {"laps": 12, "scenario": "dry", "intensity": "calm", "seed": 7021}
	)
	sim.phase = "race"
	for car in sim.cars:
		for channel in StrategyPlan.CHANNELS:
			sim.policy(car.id).owners[channel] = "player"
		sim.sync_ownership(car)
		car.dnf = car.id not in ids
		car.retire_reason = "Fixture: inactive" if car.dnf else ""
		car.distance = 100.0 if car.id == ids[0] else 100.0 - gap
		car.previous_distance = car.distance
		car.speed = 40.0
		car.lane = 0.0
		car.previous_lane = 0.0
		var tyre = TyreInventory.find(car, car.set_id)
		for wheel in tyre.wheels.values():
			wheel.surface = 89.0
			wheel.core = 89.0
		WheelTyres.publish(tyre)
		car.temperature = tyre.temperature
	return sim


func ticks(sim: StrategyRaceSim, n: int) -> void:
	for i in range(n):
		sim.step()


func order(
	sim: StrategyRaceSim, kind: String, actor: int = 3, mate: int = 6, laps: int = 1
) -> bool:
	return sim.command(
		"team_order",
		{
			"id": actor,
			"teammate_id": mate,
			"kind": kind,
			"laps": laps,
			"revision": sim.team_state.revision
		}
	)


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
		{"id": 3, "teammate_id": 6, "kind": "hold", "laps": 1, "revision": 4}
	]:
		check(
			not sim.command("team_order", payload),
			"Malformed, stale, opposing or reversed team instruction is rejected"
		)
		check(
			JSON.stringify(sim.snapshot()) == original,
			"Rejected team instruction preserves all authoritative state"
		)
	var owners = JSON.stringify(sim.policy(3).owners)
	check(order(sim, "hold"), "Explicit two-driver hold is accepted")
	check(TeamOrders.active(sim.team_state.track_order), "Accepted hold has a visible active state")
	check(
		sim.cars[3].distance == 100 and sim.cars[6].distance == 80,
		"Accepting team instructions never changes physical positions"
	)
	check(
		JSON.stringify(sim.policy(3).owners) == owners,
		"Team cooperation does not change unrelated control owners"
	)
	check(
		sim.team_state.track_order.intent_id.begins_with("rw-"),
		"Team order references the accepted command journal"
	)
	check(not order(sim, "yield"), "Active cooperation cannot be silently replaced")
	var r = sim.team_state.track_order
	check(
		not sim.command(
			"cancel_team_order",
			{"id": 3, "slot": "track_order", "revision": 0, "intent_id": r.intent_id}
		),
		"Stale cancellation cannot remove the current instruction"
	)
	check(
		sim.command(
			"cancel_team_order",
			{
				"id": 6,
				"slot": "track_order",
				"revision": sim.team_state.revision,
				"intent_id": r.intent_id
			}
		),
		"Either named driver can cancel the current instruction explicitly"
	)
	check(r.status == "cancelled", "Cancellation retains the outcome record")
	check(
		order(sim, "pit_priority", 6, 3),
		"Pit priority can name the following car before commitment"
	)
	check(order(sim, "hold"), "Pit and track cooperation use independent slots")
	sim.cars[3].distance = sim.team_state.track_order.until_distance
	TeamOrders.after_step(sim)
	check(sim.team_state.track_order.status == "expired", "Hold expires at its declared distance")
	sim = fixture()
	sim.command("pit", {"id": 3})
	original = JSON.stringify(sim.snapshot())
	check(not order(sim, "pit_priority"), "Priority rejects already accepted physical pit orders")
	check(
		JSON.stringify(sim.snapshot()) == original,
		"Rejected late priority never changes an accepted gate"
	)
	sim = fixture()
	sim.phase = "race_preparation"
	check(not order(sim, "yield"), "Track cooperation is unavailable outside racing")


func test_battle() -> void:
	var sim = fixture([0, 3], 26)
	sim.cars[0].engine = 0
	sim.cars[0].pace = 0
	sim.cars[0].damage = 12
	sim.cars[3].engine = 2
	sim.cars[3].pace = 2
	sim.cars[3].battle_mode = "assertive"
	var phases: Array[String] = []
	var identity = ""
	var min_clearance = INF
	for i in range(700):
		sim.step()
		var battle = sim.battle_state.drivers[3]
		if battle.phase not in phases:
			phases.append(battle.phase)
		if identity.is_empty() and not battle.id.is_empty():
			identity = battle.id
		if absf(sim.cars[0].distance - sim.cars[3].distance) < 6.0:
			min_clearance = minf(min_clearance, absf(sim.cars[0].lane - sim.cars[3].lane))
		if sim.stats.passes > 0:
			break
	metrics.phases = phases
	metrics.battle_ticks = roundi(sim.total_time / RaceSim.STEP)
	metrics.battle_gap = sim.cars[3].distance - sim.cars[0].distance
	check(
		"prepare" in phases and "probe" in phases and "commit" in phases,
		"A real attack progresses through preparation, probe and commitment"
	)
	check(
		"alongside" in phases and "resolve" in phases,
		"A physical pass progresses through alongside and resolved clearance"
	)
	check(sim.stats.passes == 1, "One cleared contest creates one completed-pass event")
	check(min_clearance >= 2.6, "Longitudinal overlap requires separate occupied corridors")
	var completed = sim.strategy_state.records.filter(func(e): return e.kind == "pass_completed")
	check(
		completed.size() == 1 and completed[0].evidence.battle_id == identity,
		"One stable battle identity links its measured completion"
	)
	for i in range(20):
		RacecraftController.after_step(sim)
	check(sim.stats.passes == 1, "Repeated observation cannot duplicate a completed pass")
	# Hold a neutralization throughout the test, so time expiry does not release it.
	sim = fixture([0, 3], 15)
	sim.flag = "SAFETY CAR"
	sim.flag_until = 1000
	sim.cars[0].engine = 0
	sim.cars[3].engine = 2
	ticks(sim, 240)
	check(
		sim.cars[3].distance < sim.cars[0].distance and sim.stats.passes == 0,
		"Neutralization prevents overtakes despite a resource advantage"
	)
	# Existing relative-position hold constrains only the paired teammate.
	sim = fixture()
	sim.cars[6].engine = 2
	sim.cars[6].pace = 2
	sim.cars[3].engine = 0
	order(sim, "hold")
	ticks(sim, 200)
	check(
		sim.cars[3].distance > sim.cars[6].distance and sim.stats.passes == 0,
		"A faster teammate respects a live relative-position hold"
	)
	check(
		not TeamOrders.track_blocks(sim, sim.cars[6], 0),
		"Holding teammates never forbids passing an unrelated rival"
	)


func test_yield() -> void:
	var sim = fixture()
	sim.cars[3].engine = 0
	sim.cars[6].engine = 2
	var control = StrategyRaceSim.restore_weekend(sim.snapshot())
	check(control != null, "Physical yield fixture has a valid checkpoint")
	check(order(sim, "yield"), "A nearby following teammate can be allowed through")
	var start = sim.cars[3].distance
	var separation = INF
	for i in range(700):
		sim.step()
		if absf(sim.cars[3].distance - sim.cars[6].distance) < 6:
			separation = minf(separation, absf(sim.cars[3].lane - sim.cars[6].lane))
		if control:
			control.step()
		if sim.team_state.track_order.status == "completed":
			break
	metrics.yield_status = sim.team_state.track_order.status
	metrics.yield_gap = sim.cars[6].distance - sim.cars[3].distance
	check(
		sim.team_state.track_order.status == "completed",
		"Safe yield completes through physical movement"
	)
	check(
		sim.cars[6].distance - sim.cars[3].distance > RacecraftController.CLEARANCE,
		"Cooperation is complete only after the teammate clears the yielding car"
	)
	check(
		separation >= 2.6, "Yielding never overlaps the teammate in an occupied physical corridor"
	)
	check(
		sim.cars[3].distance > start,
		"Yielding continues forward instead of teleporting or stopping the field"
	)
	check(
		control != null and sim.cars[3].distance < control.cars[3].distance,
		"A completed yield has a real time/distance cost"
	)
	check(
		sim.strategy_state.records.any(
			func(e): return e.kind == "team_order_outcome" and e.evidence.status == "completed"
		),
		"Physical cooperation has a journal-linked outcome"
	)
	sim = fixture()
	sim.flag = "YELLOW"
	sim.yellow_sector = sim.track.sector_at(100)
	sim.flag_until = 1000
	order(sim, "yield")
	ticks(sim, 20)
	check(
		(
			sim.team_state.track_order.status == "waiting"
			and sim.cars[3].distance > sim.cars[6].distance
		),
		"A yellow-zone yield waits without awarding a pass"
	)
	sim = fixture()
	order(sim, "yield")
	sim.retire(sim.cars[3], "Fixture retirement")
	sim.cars[6].distance = 140
	TeamOrders.after_step(sim)
	check(
		sim.team_state.track_order.status == "expired",
		"Retirement is never credited as a successful cooperation pass"
	)
	sim = fixture()
	order(sim, "yield")
	sim.command("pit", {"id": 3})
	TeamOrders.after_step(sim)
	check(
		sim.team_state.track_order.status == "expired" and sim.cars[3].pit_order,
		"Pit commitment supersedes a track order without losing the pit instruction"
	)
