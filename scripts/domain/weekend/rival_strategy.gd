class_name RivalStrategy
extends RefCounted
## Strategic responses consume an allow-listed snapshot and public pit-entry history only.
## No RaceSim reference, player draft, future weather or random generator is accepted.
const STOP_LIMIT = 36

static func create(cars: Array) -> Dictionary:
	var drivers: Array = []
	for car in cars: drivers.append({"driver_id": int(car.id), "event_id": "", "kind": "", "hold_gate": -1.0, "reason": ""})
	return {"version": 1, "stops": [], "drivers": drivers}

static func observe_entry(state: Dictionary, snapshot: Dictionary, driver_id: int) -> void:
	for car in snapshot.public:
		if int(car.id) != driver_id: continue
		state.stops.append({"event_id": "%d:%d" % [driver_id, int(car.stops) + 1], "driver_id": driver_id,
			"short": car.short, "time": snapshot.time, "distance": car.distance, "lap_seconds": car.lap_seconds})
		if state.stops.size() > STOP_LIMIT: state.stops.pop_front()
		return

static func response(snapshot: Dictionary, observations: Array, memory: Dictionary, comparison: Dictionary) -> Dictionary:
	if snapshot.phase != "race" or snapshot.flag != "GREEN" or snapshot.own.pit_order or snapshot.own.route != "track": return {}
	var replacement = RaceForecaster.replacement(snapshot)
	if replacement.is_empty(): return {}
	var box: Dictionary = {}; var extend: Dictionary = {}
	for option in comparison.options:
		if option.id == "box" and option.available: box = option
		if option.id == "extend" and option.available: extend = option
	if box.is_empty() or box.risk == "high": return {}
	var current = RaceForecaster.set_by_id(snapshot, snapshot.own.set_id)
	if current.is_empty(): return {}
	var velocity = snapshot.length / maxf(10, snapshot.reference_lap)
	var remaining = snapshot.laps - maxf(0, snapshot.own.distance / snapshot.length)
	var fresh_gain = RaceForecaster.lap_time(snapshot, current, current.life) - RaceForecaster.lap_time(snapshot, replacement, replacement.life)
	for index in range(observations.size() - 1, -1, -1):
		var event = observations[index]
		if event.driver_id == snapshot.own.id or event.driver_id == snapshot.teammate.get("id", -1) or event.event_id == memory.event_id: continue
		var age = snapshot.time - event.time
		if age < 0 or age > minf(40, snapshot.reference_lap): continue
		var rival: Dictionary = {}
		for observed in snapshot.public:
			if observed.id == event.driver_id: rival = observed; break
		if rival.is_empty() or rival.dnf or rival.finished: continue
		# Reconstruct only a coarse public gap at entry. It is explicitly an estimate.
		var gap_seconds = (snapshot.own.distance - velocity * age - event.distance) / velocity
		if gap_seconds < -4.0 or gap_seconds > 8.0: continue
		var traffic_cost = comparison.pit.traffic.size() * 0.8 + comparison.pit.queue
		var cover_margin = fresh_gain * 2.0 - comparison.pit.warmup - traffic_cost - maxf(0, gap_seconds)
		var evidence = {"public_event": event.event_id, "rival_id": int(event.driver_id), "gap_estimate": gap_seconds,
			"fresh_lap_gain_estimate": fresh_gain, "cover_margin_estimate": cover_margin, "traffic_cost_estimate": traffic_cost}
		if gap_seconds >= 0 and cover_margin > 0.3 and box.gain >= -1.0:
			return {"kind": "cover", "event_id": event.event_id, "set_id": replacement.id, "hold_gate": -1.0,
				"reason": "Cover %s's observed stop: estimated tyre offset threatens the gap; next safe entry only." % event.short, "evidence": evidence}
		var room_to_extend = remaining >= 3 and current.life > 35 and snapshot.fuel_margin >= 0
		if room_to_extend and not extend.is_empty() and (traffic_cost >= 1.5 or extend.seconds <= box.seconds or fresh_gain < 1.5):
			return {"kind": "overcut", "event_id": event.event_id, "set_id": "", "hold_gate": snapshot.gate.distance,
				"reason": "Extend after %s's observed stop: usable tyres or rejoin traffic favor waiting one entry, then review." % event.short, "evidence": evidence}
	return {}

static func valid(state: Variant, cars: Array, now: float) -> bool:
	if not state is Dictionary or state.get("version") != 1: return false
	if not state.get("stops") is Array or state.stops.size() > STOP_LIMIT: return false
	var last_time = -1.0
	for event in state.stops:
		if not event is Dictionary or not RaceCheckpoint.integral(event.get("driver_id"), 0, cars.size() - 1): return false
		if not event.get("event_id") is String or event.event_id.length() > 40 or not event.get("short") is String: return false
		if not RaceCheckpoint.number(event.get("time"), 0, now + RaceSim.STEP) or event.time < last_time: return false
		last_time = event.time
		if not RaceCheckpoint.number(event.get("distance"), -100000, 100000000) or not RaceCheckpoint.number(event.get("lap_seconds"), 1, 10000000): return false
	if not state.get("drivers") is Array or state.drivers.size() != cars.size(): return false
	for i in range(cars.size()):
		var memory = state.drivers[i]
		if not memory is Dictionary or memory.get("driver_id") != i or memory.get("kind") not in ["", "cover", "overcut"]: return false
		if not memory.get("event_id") is String or memory.event_id.length() > 40 or not memory.get("reason") is String or memory.reason.length() > 500: return false
		if not RaceCheckpoint.number(memory.get("hold_gate"), -1, 100000000): return false
	return true
