class_name RacecraftController
extends RefCounted
## Persistent intentions; only the existing corridor solver is allowed to move cars.
const PHASES = ["idle", "approach", "prepare", "probe", "commit", "alongside", "resolve", "recover"]
const LABELS = {"idle": "Clear running", "approach": "Closing on", "prepare": "Preparing an attack on", "probe": "Looking for room beside", "commit": "Committing alongside", "alongside": "Alongside", "resolve": "Pass completed on", "recover": "Regrouping after contest with"}
const CLEARANCE = 7.5

static func create(cars: Array) -> Dictionary:
	var drivers: Array = []
	for car in cars:
		drivers.append({"driver_id": int(car.id), "id": "", "target_id": -1, "phase": "idle", "since": 0.0,
			"started": 0.0, "side": 0.0, "overlap": false, "reason": "No active contest."})
	return {"version": 1, "sequence": 0, "drivers": drivers}

static func change(sim, record: Dictionary, phase: String, reason: String) -> void:
	if record.phase == phase:
		record.reason = reason
		return
	record.phase = phase; record.since = sim.total_time; record.reason = reason
	if phase in ["prepare", "commit", "alongside", "recover"]:
		RaceJournal.append(sim.strategy_state, sim, "battle_phase", int(record.driver_id),
			{"battle_id": record.id, "target_id": record.target_id, "phase": phase, "reason": reason})

static func instruction(sim, car: Dictionary, old: Array, nearest: int, fallback: Dictionary, sample: Dictionary, local: Dictionary, blocked: bool) -> Dictionary:
	var record = sim.battle_state.drivers[int(car.id)]
	var result = fallback.duplicate()
	if sim.phase != "race": return result
	var now = sim.total_time
	if record.phase in ["resolve", "recover"]:
		result.attempt = false
		if now - record.since < (2.0 if record.phase == "resolve" else 3.0): return result
		record.phase = "idle"; record.target_id = -1; record.id = ""; record.overlap = false
	# Absolute race distance rejects bridge crossings and lapped-car proximity.
	var candidate_gap = old[nearest].distance - old[int(car.id)].distance if nearest >= 0 else INF
	if record.target_id < 0:
		if nearest < 0 or candidate_gap <= 0 or candidate_gap > 120 or car.blue: return result
		if blocked or sim.neutral(car) or car.pit_order:
			result.attempt = false
			return result
		sim.battle_state.sequence += 1
		record.id = "battle-%d" % int(sim.battle_state.sequence); record.target_id = nearest
		record.started = now; record.since = now; record.phase = "approach"; record.overlap = false
		record.side = -1.0 if old[nearest].lane >= 0 else 1.0
	var target_id = int(record.target_id)
	var target = sim.cars[target_id]
	var gap = old[target_id].distance - old[int(car.id)].distance
	result.attempt = false
	if blocked or sim.neutral(car) or sim.neutral(target) or car.blue or car.pit_order or target.dnf or target.finished or old[target_id].route != "track" or absf(gap) > 180:
		change(sim, record, "recover", "Attempt ended: team instruction, traffic priority, pit commitment or sporting restriction.")
		return result
	if nearest != target_id and gap > CLEARANCE:
		change(sim, record, "recover", "Another car occupies the approach; no shortcut through traffic.")
		return result
	if gap < -CLEARANCE and not record.overlap:
		change(sim, record, "recover", "The target moved behind without a recorded side-by-side pass.")
		return result
	var room = sample.w > 7.5 and absf(sample.curvature) < 0.035 and local.grip > 0.45
	room = room and WheelTyres.usable(TyreInventory.find(car, car.set_id))
	if record.phase == "approach" and gap <= 75:
		change(sim, record, "prepare", "Prepare tyres and identify a usable corridor.")
	elif record.phase == "prepare":
		var preparation = {"patient": 1.5, "balanced": 0.8, "assertive": 0.4}[car.battle_mode]
		if fallback.attempt and room and now - record.since >= preparation:
			change(sim, record, "probe", "A speed advantage and usable road width support a probe.")
	elif record.phase == "probe":
		if not room or not fallback.attempt:
			change(sim, record, "recover", "No sustainable overlap before the next opportunity.")
		elif now - record.since >= 0.25:
			change(sim, record, "commit", "Commit to one corridor; occupied lanes still take priority.")
	if record.phase in ["commit", "alongside"]:
		if not room:
			change(sim, record, "recover", "Road width, grip or curvature no longer supports the maneuver.")
			return result
		result.attempt = true
		result.lane = clampf(old[target_id].lane + record.side * 3.0, -sample.w * 0.5 + 1.4, sample.w * 0.5 - 1.4)
		if absf(gap) <= CLEARANCE and absf(old[int(car.id)].lane - old[target_id].lane) >= 2.6:
			record.overlap = true
			change(sim, record, "alongside", "Measured longitudinal overlap in separate physical corridors.")
		elif now - record.since > 15.0:
			change(sim, record, "recover", "The attack did not create a timely overlap; regroup rather than force it.")
			result.attempt = false
	return result

static func after_step(sim) -> void:
	for record in sim.battle_state.drivers:
		if record.target_id < 0 or record.phase in ["idle", "resolve", "recover"]: continue
		var car = sim.cars[int(record.driver_id)]; var target = sim.cars[int(record.target_id)]
		if car.dnf or target.dnf or car.route != "track" or target.route != "track" or sim.neutral(car) or sim.neutral(target):
			change(sim, record, "recover", "Contest ended without a completed legal pass.")
			continue
		if record.overlap and car.distance - target.distance > CLEARANCE:
			change(sim, record, "resolve", "Pass completed with measured longitudinal clearance.")
			sim.stats.passes += 1
			RaceJournal.append(sim.strategy_state, sim, "pass_completed", int(car.id),
				{"battle_id": record.id, "target_id": int(target.id), "clearance": car.distance - target.distance,
				"station": fposmod(car.distance, sim.track.length), "reason": "%s cleared %s after a physical side-by-side contest." % [car.short, target.short]})
			sim.post("pass", "%s passes %s; the battle is resolved." % [car.short, target.short])

static func describe(state: Dictionary, id: int, cars: Array) -> String:
	var record = state.drivers[id]
	if record.target_id < 0: return "Clear running · no active battle"
	return "%s %s · %s" % [LABELS[record.phase], cars[int(record.target_id)].short, record.reason]

static func valid(state: Variant, cars: Array, now: float) -> bool:
	if not state is Dictionary or state.get("version") != 1: return false
	if not RaceCheckpoint.integral(state.get("sequence"), 0, 100000000): return false
	if not state.get("drivers") is Array or state.drivers.size() != cars.size(): return false
	for i in range(cars.size()):
		var record = state.drivers[i]
		if not record is Dictionary or record.get("driver_id") != i or record.get("phase") not in PHASES: return false
		if not RaceCheckpoint.integral(record.get("target_id"), -1, cars.size() - 1) or record.target_id == i: return false
		if not record.get("id") is String or not record.get("reason") is String or record.reason.length() > 500 or not record.get("overlap") is bool: return false
		if not RaceCheckpoint.number(record.get("since"), 0, now + RaceSim.STEP) or not RaceCheckpoint.number(record.get("started"), 0, now + RaceSim.STEP): return false
		if record.started > record.since or record.get("side") not in [-1.0, 0.0, 1.0]: return false
		if record.phase != "idle" and (record.target_id < 0 or not record.id.begins_with("battle-")): return false
		if not record.id.is_empty():
			var sequence = int(record.id.trim_prefix("battle-"))
			if record.id != "battle-%d" % sequence or sequence <= 0 or sequence > state.sequence: return false
	return true
