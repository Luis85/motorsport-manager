class_name RaceForecaster
extends RefCounted
## Bounded, observational coarse model. Never stores a RaceSim reference or samples RNG.
const MODEL_VERSION = 1
const MAX_AGE = 5.0

static func fuel_margin(sim: RaceSim, car: Dictionary) -> float:
	var remaining = maxf(0, sim.laps - maxf(0, car.distance) / sim.track.length) if sim.phase in ["race", "results"] else float(sim.laps)
	var formation = 0.6 if sim.phase in ["briefing", "qualifying", "qualifying_results", "race_preparation"] else (0.6 * maxf(0, 1 - car.distance / sim.track.length) if sim.phase == "formation" else 0.0)
	# Qualifying has a separate four-lap fuel load. Do not call it a race shortfall.
	var available = float(sim.laps) * 1.13 + 1.5 if sim.phase in ["qualifying", "qualifying_results"] else float(car.fuel)
	return available - remaining * [0.84, 1.0, 1.14][car.engine] - formation

static func reachable_gate(sim: RaceSim, car: Dictionary) -> Dictionary:
	var gate = (floor((car.distance - sim.track.pit_entry) / sim.track.length) + 1) * sim.track.length + sim.track.pit_entry
	var stopping = maxf(0, car.speed ** 2 - sim.track.pit_limit ** 2) / (2 * TrackGeometry.PRESETS[sim.track.preset].brake * 0.5) + 8
	var deferred = gate - car.distance < stopping
	if deferred: gate += sim.track.length
	return {"distance": gate, "lap": int(round((gate - sim.track.pit_entry) / sim.track.length)) + 1,
		"deferred": deferred, "deadline": maxf(0, gate - car.distance - stopping) / maxf(5, car.speed)}

static func material_key(sim: RaceSim, driver_id: int, revision: int = 0) -> String:
	var c = sim.cars[driver_id]
	var facts: Array = [sim.phase, sim.flag, sim.yellow_sector, int(sim.average(sim.water) * 20), c.set_id,
		c.next_set_id, c.next_compound, c.pit_order, c.pit_gate, c.pace, c.engine, c.repair, int(c.damage), int(c.tyre / 5), int(fuel_margin(sim, c) * 5), reachable_gate(sim, c).distance, revision]
	facts.append(sim.forecast_parameters(driver_id).get("key", []))
	if sim is StrategyRaceSim and c.player: facts.append([sim.team_state.revision, sim.team_state.pit_priority.get("deferred_gate", -1)])
	for item in c.tyre_sets: facts.append([item.id, WheelTyres.usable(item)])
	for other in sim.cars:
		facts.append([other.id, other.route, other.pit_stops, other.dnf, other.finished])
		if other.team == c.team: facts.append([other.pit_order, other.pit_gate, other.pit_stage, int(other.pit_timer)])
	return JSON.stringify(facts).sha256_text()

static func capture(sim: RaceSim, driver_id: int, plan: Dictionary = {}, revision: int = 0) -> Dictionary:
	var c = sim.cars[driver_id]
	var own: Dictionary = {}
	for key in ["id", "short", "team", "distance", "speed", "compound", "set_id", "next_set_id", "next_compound", "tyre", "temperature", "fuel", "damage", "health", "pace", "engine", "skill", "route", "pit_order", "pit_gate", "scheduled_lap", "box_d", "repair", "dnf", "finished"]: own[key] = c[key]
	own.inventory = c.tyre_sets.duplicate(true)
	own.starting_set = plan.get("starting_set", c.set_id) if sim.phase in ["briefing", "qualifying", "qualifying_results", "race_preparation"] else c.set_id
	own.projected_fuel = float(sim.laps) * 1.13 + 1.5 if sim.phase in ["qualifying", "qualifying_results"] else float(c.fuel)
	own.wear = RaceSim.TYRES[c.compound].wear * [0.78, 1.0, 1.25][c.pace] * 1.05
	if not c.stints.is_empty():
		var stint = c.stints.back()
		var travelled = c.distance / sim.track.length - float(stint.get("from", 0))
		# Actual aggregate depletion is useful after enough running; tiny samples amplify noise.
		if travelled > 0.5 and stint.has("start_life"):
			own.wear = clampf((stint.start_life - c.tyre) / travelled, own.wear * 0.5, own.wear * 2.5)
	var public: Array = []
	var teammate: Dictionary = {}
	for other in sim.cars:
		if other.id == c.id: continue
		var lap_seconds = sim.track.estimate
		var sum = 0.0; var count = 0
		for i in range(other.history.size() - 1, maxi(-1, other.history.size() - 4), -1):
			var lap = other.history[i]
			if not lap.get("pit_lap", false) and lap.time > 0: sum += lap.time; count += 1
		if count > 0: lap_seconds = sum / count
		public.append({"id": int(other.id), "short": other.short, "distance": other.distance, "route": other.route,
			"compound": other.compound, "stops": other.pit_stops, "dnf": other.dnf, "finished": other.finished,
			"lap_seconds": maxf(10, lap_seconds)})
		# A team's own accepted orders are known to its strategist. Rival plans are never copied.
		if other.team == c.team:
			teammate = {"id": int(other.id), "distance": other.distance, "speed": other.speed, "pit_order": other.pit_order,
				"pit_gate": other.pit_gate, "route": other.route, "pit_d": other.pit_d, "box_d": other.box_d,
				"pit_stage": other.pit_stage, "pit_timer": other.pit_timer, "damage": other.damage, "repair": other.repair}
	var gate = reachable_gate(sim, c)
	return {"tick": roundi(sim.total_time / RaceSim.STEP), "time": sim.total_time, "phase": sim.phase,
		"key": material_key(sim, driver_id, revision), "model_version": MODEL_VERSION, "scope": "own private + observed rival timing",
		"own": own, "public": public, "teammate": teammate, "plan": plan.duplicate(true), "laps": sim.laps,
		"length": sim.track.length, "reference_lap": sim.track.estimate, "pit_length": sim.track.pit_length,
		"pit_limit": sim.track.pit_limit, "pit_entry": sim.track.pit_entry, "pit_exit": sim.track.pit_exit,
		"water": sim.average(sim.water), "flag": sim.flag, "gate": gate, "fuel_margin": fuel_margin(sim, c),
		"model_context": sim.forecast_parameters(driver_id)}

static func set_by_id(s: Dictionary, id: String) -> Dictionary:
	for item in s.own.inventory:
		if item.id == id: return item
	return {}

static func replacement(s: Dictionary) -> Dictionary:
	var wanted = s.own.next_compound
	var wet = s.water
	if wet > 0.68: wanted = "W"
	elif wet > 0.24: wanted = "I"
	elif wanted in ["I", "W"]: wanted = "M"
	var best: Dictionary = {}
	for item in s.own.inventory:
		if item.id == s.own.starting_set or not WheelTyres.usable(item): continue
		if item.id == s.own.next_set_id: return item
		if item.compound != wanted: continue
		if best.is_empty() or item.life > best.life: best = item
	return best

static func pit_prediction(s: Dictionary, gate: float = -1) -> Dictionary:
	var own = s.own
	if gate < 0: gate = s.gate.distance
	var context = s.get("model_context", {})
	var running_lap = s.reference_lap / float(context.get("neutral_factor", 1.0))
	var mean_speed = s.length / maxf(10, running_lap)
	var entry_eta = maxf(0, gate - own.distance) / mean_speed
	var service = (2.5 if context.get("repair_only", false) else 3.75) + (own.damage * 0.14 if own.repair else 0.0)
	var arrival = entry_eta + own.box_d / s.pit_limit + 1.5
	var queue = 0.0
	var mate = s.teammate
	if not mate.is_empty():
		var other_arrival = INF
		if mate.route == "pit":
			if mate.pit_stage == "service": queue = maxf(0, mate.pit_timer - arrival)
			elif mate.pit_stage == "entry": other_arrival = maxf(0, mate.box_d - mate.pit_d) / s.pit_limit
		elif mate.pit_order:
			other_arrival = maxf(0, mate.pit_gate - mate.distance) / mean_speed + mate.box_d / s.pit_limit + 1.5
		var mate_service = (2.5 if context.get("teammate_repair_only", false) else 3.75) + (mate.damage * 0.14 if mate.repair else 0.0)
		if other_arrival <= arrival: queue = maxf(0, other_arrival + mate_service - arrival)
	var visit = s.pit_length / s.pit_limit + service + 3.0 + queue
	var uncertainty = 2.25 + (2.0 if queue > 0 else 0.0)
	var skipped = (s.pit_exit - s.pit_entry) / s.length * running_lap
	var exit_station = gate + s.pit_exit - s.pit_entry
	var position = 1; var lower_position = 1; var upper_position = 1
	var traffic: Array[String] = []
	for other in s.public:
		if other.dnf: continue
		var velocity = s.length / maxf(other.lap_seconds, running_lap) if context.get("neutral_factor", 1.0) < 1 else s.length / other.lap_seconds
		var projected = other.distance + velocity * (entry_eta + visit)
		if other.finished or projected > exit_station: position += 1
		if other.finished or projected - velocity * uncertainty > exit_station: lower_position += 1
		if other.finished or projected + velocity * uncertainty > exit_station: upper_position += 1
		if not other.finished and projected >= exit_station - 30 and projected < exit_station + velocity * 2.5: traffic.append(other.short)
	return {"visit": visit, "visit_low": maxf(service, visit - uncertainty), "visit_high": visit + uncertainty,
		"loss": maxf(0, visit - skipped), "loss_low": maxf(0, visit - skipped - uncertainty), "loss_high": maxf(0, visit - skipped + uncertainty),
		"queue": queue, "position": position, "position_low": lower_position, "position_high": upper_position,
		"traffic": traffic, "exit_station": exit_station, "gate": gate, "entry_eta": entry_eta, "warmup": 0.0 if context.get("repair_only", false) else 1.5,
		"assumptions": context.get("rule_summary", "Current conditions held constant; no future incidents predicted.")}

static func lap_time(s: Dictionary, item: Dictionary, life: float) -> float:
	var compound = item.compound
	var wet = s.water
	var match_factor = maxf(0.4, 1 - maxf(0, wet - 0.07) * 0.85)
	if compound == "I": match_factor = 0.88 + wet * 0.2 - maxf(0, wet - 0.72) * 0.7
	elif compound == "W": match_factor = 0.77 + wet * 0.33
	var wheel_grip = 0.0
	for key in WheelTyres.KEYS:
		var wheel = item.wheels[key].duplicate()
		wheel.life = maxf(0, wheel.life - maxf(0, item.life - life))
		# The coarse stint model assumes working temperature after a separately priced
		# warm-up. Retained wear, flat spots, grain, blistering and punctures are real.
		wheel.surface = WheelTyres.OPTIMUM[compound]; wheel.core = wheel.surface
		wheel_grip += WheelTyres.grip_wheel(wheel, compound)
	var grip = wheel_grip * 0.25 * RaceSim.TYRES[compound].grip * match_factor
	var handling = (1 + (s.own.skill - 85) * 0.002) * [0.988, 1.0, 1.01][s.own.pace] * [0.974, 1.0, 1.014][s.own.engine]
	var fuel_mass = 1.0 + maxf(0, s.own.projected_fuel) * 0.00035
	var context = s.get("model_context", {})
	var operation = float(context.get("health_factor", 1.0)) * float(context.get("thermal_factor", 1.0))
	var lap = s.reference_lap * fuel_mass / maxf(0.2, sqrt(grip) * handling * (1 - minf(200, s.own.damage) * 0.003) * operation)
	return maxf(lap, s.reference_lap / float(context.get("neutral_factor", 1.0))) if context.get("neutral_factor", 1.0) < 1 else lap

static func limiting_life(item: Dictionary, average_life: float) -> float:
	var minimum = 100.0
	for key in WheelTyres.KEYS:
		var wheel = item.wheels[key]
		minimum = minf(minimum, 0.0 if wheel.punctured else maxf(0, wheel.life - maxf(0, item.life - average_life)))
	return minimum

static func evaluate_candidate(s: Dictionary, id: String, title: String, stops: Array) -> Dictionary:
	var current = set_by_id(s, s.own.starting_set)
	if current.is_empty(): return {"id": id, "title": title, "available": false, "reason": "The starting set is unavailable."}
	var life = float(current.life)
	var used_sets = [current.id]
	var last_stop = -1.0
	for stop in stops:
		if stop.at <= last_stop or stop.at >= s.laps or stop.set_id in used_sets: return {"id": id, "title": title, "available": false, "reason": "The proposed stops are not ordered or reuse the same tyre set."}
		last_stop = stop.at; used_sets.append(stop.set_id)
	var progress = maxf(0, s.own.distance / s.length) if s.phase == "race" else 0.0
	var seconds = 0.0; var index = 0; var minimum_life = limiting_life(current, life)
	var traffic_cost = 0.0; var pit_cost = 0.0; var warmup = 0.0
	while progress < s.laps - 0.00001:
		if index < stops.size() and progress >= stops[index].at - 0.00001:
			current = set_by_id(s, stops[index].set_id)
			if current.is_empty() or not WheelTyres.usable(current): return {"id": id, "title": title, "available": false, "reason": "Replacement set is unavailable."}
			life = current.life
			var pit = pit_prediction(s, stops[index].at * s.length)
			pit_cost += pit.loss; warmup += pit.warmup
			traffic_cost += pit.traffic.size() * 0.8
			index += 1
		var step = minf(0.5, s.laps - progress)
		if index < stops.size(): step = minf(step, maxf(0.00001, stops[index].at - progress))
		var wear = RaceSim.TYRES[current.compound].wear * [0.78, 1.0, 1.25][s.own.pace] * 1.05
		if current.id == s.own.set_id: wear = s.own.wear
		if current.compound in ["I", "W"] and s.water < 0.15: wear *= 2.2
		seconds += lap_time(s, current, life - wear * step * 0.5) * step
		life = maxf(0, life - wear * step); minimum_life = minf(minimum_life, limiting_life(current, life)); progress += step
	seconds += pit_cost + warmup + traffic_cost
	var uncertainty = maxf(3, seconds * 0.06) + stops.size() * 2.25 + traffic_cost
	var risk = "high" if minimum_life < 10 or s.fuel_margin < 0 else ("moderate" if minimum_life < 25 else "lower")
	return {"id": id, "title": title, "available": true, "seconds": seconds, "low": maxf(0, seconds - uncertainty), "high": seconds + uncertainty,
		"risk": risk, "minimum_life": minimum_life, "fuel_margin": s.fuel_margin, "stops": stops.duplicate(true),
		"pit_cost": pit_cost, "warmup_cost": warmup, "traffic_cost": traffic_cost}

static func evaluate(s: Dictionary) -> Dictionary:
	var planned: Array = []
	var progress = maxf(0, s.own.distance / s.length) if s.phase == "race" else 0.0
	if s.own.pit_order:
		var item = replacement(s)
		if not item.is_empty(): planned.append({"at": s.own.pit_gate / s.length, "set_id": item.id})
	else:
		for stop in s.plan.get("stops", []):
			var at = maxf(float(stop.from_lap - 1) + s.pit_entry / s.length, s.gate.distance / s.length)
			var latest = float(stop.to_lap - 1) + s.pit_entry / s.length
			if at <= latest and at >= progress: planned.append({"at": at, "set_id": stop.set_id})
	var options: Array = [evaluate_candidate(s, "current", "Keep current plan", planned)]
	if s.own.route == "pit": options = [{"id": "current", "title": "Physical pit visit in progress", "available": false, "reason": "Service is committed. Compare future stints after rejoining."}]
	var replacement_set = replacement(s)
	var repair_pending = s.get("model_context", {}).get("repair_only", false) and s.own.pit_order
	if repair_pending:
		options = [{"id": "current", "title": "Repair-only visit ordered", "available": false, "reason": "The fitted set is retained. Cancel before entry to change the transaction, or compare future tyre stints after rejoining."}]
		replacement_set = {}
	var pit = pit_prediction(s)
	if not replacement_set.is_empty() and s.gate.distance < s.laps * s.length and s.own.route == "track":
		var now = s.gate.distance / s.length
		var later = minf(s.laps - 2 + s.pit_entry / s.length, now + 2)
		var box_stops: Array = [{"at": now, "set_id": replacement_set.id}]
		var extend_stops: Array = [{"at": later, "set_id": replacement_set.id}]
		# Compare a revised first stop, preserving subsequent authorized stints.
		for i in range(1, planned.size()):
			if planned[i].set_id != replacement_set.id and planned[i].at > now: box_stops.append(planned[i])
			if planned[i].set_id != replacement_set.id and planned[i].at > later: extend_stops.append(planned[i])
		options.append(evaluate_candidate(s, "box", "Stop at next safe entry", box_stops))
		if later > now: options.append(evaluate_candidate(s, "extend", "Extend two laps", extend_stops))
	for option in options:
		if option.available: option.gain = options[0].get("seconds", option.seconds) - option.seconds
	return {"tick": s.tick, "time": s.time, "key": s.key, "driver_id": int(s.own.id), "model_version": MODEL_VERSION,
		"scope": s.scope, "options": options, "pit": pit, "gate": s.gate, "replacement_id": replacement_set.get("id", ""),
		"fuel_margin": s.fuel_margin, "assumptions": ["Estimate, not a calibrated probability band.", "Observed rival pace continues; unknown rival stops may change rejoin order.",
			"Current water persists; future weather is not available to this model.", "Current pace and engine modes are held for comparison; future owner responses and override handback are not predicted.", "Working-temperature approximation retains all four wheels’ damage; warm-up is priced separately. No incident or exact finishing-position prediction.", "Remaining-time estimates include each additional stop's full net pit loss."]}

static func stale(sim: RaceSim, forecast: Dictionary, revision: int = 0) -> bool:
	if forecast.is_empty(): return true
	return sim.total_time - forecast.time > MAX_AGE or forecast.key != material_key(sim, int(forecast.driver_id), revision)

static func qualifying_release(sim: RaceSim, car: Dictionary) -> Dictionary:
	var transit = maxf(0, sim.track.pit_length - car.box_d) / sim.track.pit_limit + 3
	var outlap = sim.track.estimate / 0.76
	var needed = transit + outlap + 5
	return {"required_seconds": needed, "latest_release": sim.qual_duration - needed,
		"can_start_hotlap": sim.phase == "qualifying" and not sim.qual_closed and car.route == "garage" and sim.clock + needed < sim.qual_duration,
		"label": "Estimate includes pit transit, an out-lap and 5s margin; traffic may delay release."}
