extends SceneTree
## Commands, persistence, information fairness and actual physical execution.
var checks = 0
var failures: Array[String] = []
var base: Dictionary
func _initialize() -> void: call_deferred("run")
func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); push_error(message)
func fresh() -> PracticeRaceSim: return PracticeRaceSim.restore_practice(base)
func json_copy(value): return JSON.parse_string(JSON.stringify(value, "", false, true))
func draft(sim, kind: String = "undercut") -> Dictionary:
	var p = TacticalForecast.draft(sim, 3, kind)
	p.authority = "execute"; p.avoid_traffic = false; p.tyre_floor = 5.0; p.fuel_reserve = 0.0
	p.target_id = 0
	return p
func approval(sim, plan: Dictionary, id: int = 3) -> Dictionary:
	var f = TacticalForecast.preview(sim, id, plan)
	return {"id": id, "plan": plan, "revision": sim.duel_state.drivers[id].revision,
		"policy_revision": sim.policy(id).revision, "key": f.key, "time": f.time}
func advance(sim, phase: String, limit: int) -> bool:
	for i in range(limit):
		if sim.phase == phase: return true
		sim.step()
	return sim.phase == phase
func run() -> void:
	var sim = PracticeRaceSim.new(TrackGeometry.new(Storage.read_catalog().data[7]), {"laps": 12, "scenario": "dry", "intensity": "calm", "seed": 7314, "tactical_duels": true})
	check(sim.command("prepare_race") and sim.command("formation"), "Normal preparation and physical formation start")
	check(advance(sim, "grid_ready", 10000) and sim.command("lights") and advance(sim, "race", 1000), "Physical grid and lights reach the race")
	for id in [3, 6]: sim.command("auto", {"id": id, "value": false})
	base = sim.snapshot()
	check(base.version == 11 and PracticeRaceSim.restore_practice(json_copy(base)) != null, "New-model checkpoint v11 restores from JSON")
	var plan = draft(sim)
	var before = RaceRecord.fingerprint(sim.snapshot())
	var preview = TacticalForecast.preview(sim, 3, plan)
	TacticalForecast.team_compare(sim)
	check(preview.available, "An explicit dry tactic is feasible: " + preview.reason)
	check(before == RaceRecord.fingerprint(sim.snapshot()), "Drafting and team comparison preserve every authoritative field and RNG")
	var public_preview = JSON.stringify(preview)
	sim.cars[0].fuel = 9876.0; sim.cars[0].health = 1.25
	check(public_preview == JSON.stringify(TacticalForecast.preview(sim, 3, plan)), "Private rival fuel and health cannot leak into a tactical comparison")
	sim = fresh()
	for invalid in [{}, {"kind": []}, {"target_id": 6}, {"set_id": "6-H1"}, {"wait_laps": "two"}, {"fuel_reserve": -1}, {"avoid_traffic": 1}, {"authority": "all"}]:
		var bad = draft(sim)
		if invalid.is_empty(): bad = {}
		else: bad.merge(invalid, true)
		before = RaceRecord.fingerprint(sim.snapshot())
		check(not sim.command("duel_approve", approval(sim, bad)), "Invalid tactical draft is rejected: " + JSON.stringify(invalid))
		check(before == RaceRecord.fingerprint(sim.snapshot()), "Rejected draft is atomic")
	var stale = approval(sim, draft(sim)); stale.time = -1
	check(not sim.command("duel_approve", stale), "Expired or invalid comparison time is rejected")
	stale = approval(sim, draft(sim)); sim.command("pace", {"id": 3, "value": 2})
	check(not sim.command("duel_approve", stale), "A mode change invalidates a previously shown comparison")
	sim = fresh(); plan = draft(sim); plan.authority = "recommend"
	var owners = sim.policy(3).owners.duplicate(true)
	check(sim.command("duel_approve", approval(sim, plan)), "Recommendation-only plan can be accepted")
	for i in range(40): sim.step()
	check(not sim.cars[3].pit_order and owners == sim.policy(3).owners, "Recommendation never borrows control or issues an order")
	check(sim.duel_state.drivers[3].active.status == "preparing", "Recommendation has a persistent watch state")
	check(PracticeRaceSim.restore_practice(json_copy(sim.snapshot())) != null, "Watching a recommendation is saved")
	check(sim.command("duel_cancel", {"id": 3, "revision": sim.duel_state.drivers[3].revision, "plan_id": sim.duel_state.drivers[3].active.id}), "Ending a recommendation is explicit")
	sim = fresh(); owners = sim.policy(3).owners.duplicate(true)
	sim.command("duel_approve", {"id": 3})
	check(not sim.last_error.is_empty(), "Rejected tactical command exposes an actionable error")
	var recorder = RaceRecord.new(); recorder.attach(sim)
	check(sim.command("duel_approve", approval(sim, draft(sim))), "Pit mandate accepted")
	check(sim.last_error.is_empty(), "A successful tactical command clears earlier rejection feedback")
	check(sim.policy(3).owners.pit == "engineer" and sim.policy(3).owners.pace == owners.pace and sim.policy(3).owners.engine == owners.engine, "Only pit authority is borrowed")
	check(not sim.command("duel_approve", approval(sim, draft(sim))), "A second active mandate cannot silently replace the first")
	var checkpoint = json_copy(sim.snapshot())
	check(PracticeRaceSim.restore_practice(checkpoint) != null, "An approved live mandate restores without a new approval")
	for key in ["target_id", "from_lap", "authority", "avoid_traffic"]:
		var bad = json_copy(checkpoint); bad.duel_state.drivers[3].active.plan[key] = []
		check(PracticeRaceSim.restore_practice(bad) == null, "Malformed saved plan rejected before replacement: " + key)
	var bad = json_copy(checkpoint); bad.duel_state.drivers[3].active.borrowed_pits = "yes"
	check(PracticeRaceSim.restore_practice(bad) == null, "Malformed saved authority rejected")
	bad = json_copy(checkpoint); bad.duel_state.drivers[3].active.forecast.gain = "win"
	check(PracticeRaceSim.restore_practice(bad) == null, "Invented saved numerical evidence rejected")
	bad = json_copy(checkpoint); bad.strategy_state.policies[3].owners.pit = "player"
	check(PracticeRaceSim.restore_practice(bad) == null, "Contradictory saved pit ownership rejected")
	for i in range(80): sim.step()
	var replay = RaceReplay.new(); var sealed = json_copy(recorder.seal())
	check(sealed.model == TacticalDuels.MODEL and RaceRecord.validate(sealed).is_empty(), "New recording declares the tactical model and validates: " + RaceRecord.validate(sealed))
	check(replay.load_record(sealed).is_empty(), "Tactical recording loads into independent replay")
	for i in range(6): replay.tick(64)
	check(replay.verified, "Tactical commands reproduce the exact sporting endpoint: " + replay.error)
	var restored = PracticeRaceSim.restore_practice(json_copy(sim.snapshot()))
	check(restored != null, "In-flight tactical state restores")
	if restored != null:
		for i in range(100): sim.step(); restored.step()
		check(RaceRecord.equivalent(sim.snapshot(), restored.snapshot()), "Saved continuation has identical resources, mandate, journal and RNG")
	var runtime_limit = 8000
	for i in range(runtime_limit):
		if sim.duel_state.drivers[3].active.own_exit >= 0: break
		sim.step()
	var active = sim.duel_state.drivers[3].active
	check(active.own_entry >= 0 and active.own_exit > active.own_entry and sim.cars[3].pit_stops == 1, "The mandate produces a real entry, service and physical exit")
	check(sim.cars[3].set_id == active.plan.set_id, "Physical fitting selects a driver-owned replacement")
	check(sim.policy(3).owners.pit == "player", "Pit owner returns after the actual stop, not after merely accepting it")
	check(PracticeRaceSim.restore_practice(json_copy(sim.snapshot())) != null, "The physical pit-exit record validates")
	sim = fresh(); check(sim.command("duel_approve", approval(sim, draft(sim))), "Second mandate accepted for response regression")
	sim.cars[0].route = "pit" # Deliberate boundary fixture: public rival entry before our order.
	sim.engineer(sim.cars[3])
	check(not sim.cars[3].pit_order and sim.duel_state.drivers[3].active.status == "review", "Observed rival-first entry withholds the undercut")
	check(sim.policy(3).owners.pit == "player", "An invalidated mandate restores the previous owner")
	sim = fresh(); check(sim.command("duel_approve", approval(sim, draft(sim))), "Cancellation fixture approved")
	sim.engineer(sim.cars[3]); var gate = sim.cars[3].pit_gate
	check(sim.cars[3].pit_order, "An engineer uses the normal pit-order transaction")
	var record = sim.duel_state.drivers[3].active
	check(sim.command("duel_cancel", {"id": 3, "revision": sim.duel_state.drivers[3].revision, "plan_id": record.id}), "Plan may be ended without cancelling its already accepted stop")
	check(sim.cars[3].pit_order and sim.cars[3].pit_gate == gate, "Ending a mandate preserves the accepted physical gate")
	sim = fresh(); check(sim.command("duel_approve", approval(sim, draft(sim))), "Manual-override fixture approved")
	check(sim.command("delegation", {"id": 3, "channel": "pit", "owner": "player"}), "Player takes back pits")
	check(sim.policy(3).owners.pit == "player" and sim.duel_state.drivers[3].active.status == "abandoned", "Handback cannot overwrite the new manual owner")
	sim = fresh(); plan = draft(sim, "extend")
	check(sim.command("duel_approve", approval(sim, plan)), "Bounded extension can be approved")
	sim.engineer(sim.cars[3])
	check(not sim.cars[3].pit_order and sim.duel_state.drivers[3].active.status == "preparing", "Extension deliberately withholds early discretionary pit calls")
	# Two approved intentions coexist, spend their own finite stock and hand back independently.
	sim = fresh()
	for id in [3, 6]:
		var pairing = TacticalForecast.draft(sim, id, "undercut" if id == 3 else "extend")
		pairing.authority = "execute"; pairing.rival_first = false; pairing.avoid_traffic = false
		pairing.fuel_reserve = 0.0; pairing.tyre_floor = 5.0
		check(sim.command("duel_approve", approval(sim, pairing, id)), "Both named drivers can approve complementary tactics: " + str(id))
	check(PracticeRaceSim.restore_practice(json_copy(sim.snapshot())) != null, "Two simultaneously borrowed pit channels restore together")
	for i in range(12000):
		if TacticalDuels.current(sim, 3).own_exit >= 0 and TacticalDuels.current(sim, 6).own_exit >= 0: break
		sim.step()
	for id in [3, 6]:
		var paired = TacticalDuels.current(sim, id)
		check(paired.own_exit > paired.own_entry and paired.own_entry >= 0, "Complementary tactic completes a real pit visit: " + str(id))
		check(sim.cars[id].set_id == paired.plan.set_id and sim.policy(id).owners.pit == "player", "Each driver's physical set and prior ownership remain independent: " + str(id))
	check(PracticeRaceSim.restore_practice(json_copy(sim.snapshot())) != null, "Combined physical execution produces a valid checkpoint")
	# Replacing one stop must not consume the later stop or borrow its tyre set.
	sim = fresh()
	var ordinary = StrategyPlan.draft(sim.cars[3], sim.laps, "no_stop")
	ordinary.starting_set = sim.cars[3].set_id
	var dry_sets = sim.cars[3].tyre_sets.filter(func(item): return item.compound in ["M", "H"] and item.id != sim.cars[3].set_id and WheelTyres.usable(item))
	var later_set = dry_sets.back().id
	ordinary.stops = [{"from_lap": 2, "to_lap": 2, "set_id": dry_sets[0].id}, {"from_lap": 6, "to_lap": 6, "set_id": later_set}]
	ordinary.branches = []
	check(sim.command("approve_plan", {"id": 3, "revision": sim.policy(3).revision, "plan": ordinary}), "Two normal future stints can be approved: " + sim.last_error)
	var substitution = draft(sim); substitution.set_id = dry_sets[-2].id; substitution.rival_first = false
	check(sim.command("duel_approve", approval(sim, substitution)), "A tactic can replace only the next planned stop with a different owned set")
	for i in range(12000):
		if sim.cars[3].pit_stops >= 2 and sim.cars[3].route == "track": break
		sim.step()
	check(sim.cars[3].pit_stops == 2 and sim.cars[3].set_id == later_set, "The later original stint still executes physically after tactical handback")
	check(sim.policy(3).next_stop == 2 and sim.policy(3).owners.pit == "engineer", "Each approved stop is consumed exactly once; original engineer authority resumes")
	check(PracticeRaceSim.restore_practice(json_copy(sim.snapshot())) != null, "Displaced-next-stop and later-stint continuation validates")
	var legacy = PracticeRaceSim.new(sim.track, {"intensity": "calm"})
	check(legacy.snapshot().version == 10 and not legacy.snapshot().has("duel_state"), "Historical constructor/recipe model retains v10 with no fabricated tactical history")
	var old = PracticeRaceSim.restore_practice(json_copy(legacy.snapshot()))
	check(old != null and RaceRecord.equivalent(old.snapshot(), legacy.snapshot()), "Legacy continuation remains byte-meaning equivalent")
	check(not old.command("duel_approve", {"id": 3}), "Legacy simulation cannot silently enable different rules")
	for recipe in DuelScenarios.catalog():
		var scenario = DuelScenarios.build(recipe, Storage.read_catalog().data)
		check(scenario != null, "Shipped tactical scenario compiles: " + recipe.id)
		if scenario != null:
			check(PracticeRaceSim.restore_practice(json_copy(scenario.snapshot())) != null, "Shipped preparation state validates: " + recipe.id)
			check(scenario.cars.all(func(c): return c.qual_best == 0), "No fabricated qualifying time: " + recipe.id)
	var report = {"passed": failures.is_empty(), "checks": checks, "errors": failures, "engine": Engine.get_version_info().string,
		"scope": "Native domain commands, fixed steps, physical pit service, JSON continuation and replay. Rival-first boundary uses an explicitly synthetic route fixture. No human playtest."}
	Storage.write_json("res://reports/tactical-duel-tests.json", report)
	print("TACTICAL_DUELS ", JSON.stringify(report)); quit(0 if failures.is_empty() else 1)
