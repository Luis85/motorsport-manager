class_name WeatherStrategy
extends RefCounted
## Bounded crossover comparison on the same tyre, fuel, pit and public-traffic primitives as Stage A.
const VERSION = 1
const MAX_LAPS = 24.0

static func decision_key(advice: Dictionary) -> String:
	return (str(advice.key) + str(advice.weather_key)).sha256_text()

static func prefer_set(s: Dictionary, candidate_set: Dictionary, existing: Dictionary) -> bool:
	if existing.is_empty(): return true
	var remaining = minf(MAX_LAPS, maxf(0, s.laps - s.gate.distance / s.length))
	var candidate_wear = RaceSim.TYRES[candidate_set.compound].wear * [0.78, 1.0, 1.25][s.own.pace] * 1.05 * remaining
	var existing_wear = RaceSim.TYRES[existing.compound].wear * [0.78, 1.0, 1.25][s.own.pace] * 1.05 * remaining
	var candidate_safe = RaceForecaster.limiting_life(candidate_set, candidate_set.life - candidate_wear) >= 10
	var existing_safe = RaceForecaster.limiting_life(existing, existing.life - existing_wear) >= 10
	if candidate_safe != existing_safe: return candidate_safe
	return RaceForecaster.lap_time(s, candidate_set, candidate_set.life - candidate_wear * 0.5) < RaceForecaster.lap_time(s, existing, existing.life - existing_wear * 0.5)

static func planned_stops(s: Dictionary) -> Array:
	var stops: Array = []
	for stop in s.plan.get("stops", []):
		var at = maxf(float(stop.from_lap - 1) + s.pit_entry / s.length, s.gate.distance / s.length)
		if at <= float(stop.to_lap - 1) + s.pit_entry / s.length: stops.append({"at": at, "set_id": stop.set_id})
	return stops

static func score(source: Dictionary, outlook: Dictionary, stops: Array, target_water: float) -> Dictionary:
	var s = source.duplicate(true)
	var item = RaceForecaster.set_by_id(s, s.own.starting_set)
	if item.is_empty(): return {"available": false, "reason": "Starting set unavailable."}
	var used = [item.id]; var previous = -1.0
	for stop in stops:
		var replacement = RaceForecaster.set_by_id(s, stop.set_id)
		if stop.at <= previous or stop.at >= s.laps or stop.set_id in used or not WheelTyres.usable(replacement):
			return {"available": false, "reason": "The replacement sequence is no longer feasible."}
		previous = stop.at; used.append(stop.set_id)
	var start = maxf(0, s.own.distance / s.length) if s.phase == "race" else 0.0
	var end = minf(s.laps, start + MAX_LAPS)
	var progress = start; var life = float(item.life); var time = 0.0; var index = 0
	var minimum = RaceForecaster.limiting_life(item, life)
	var pit_cost = 0.0; var traffic_cost = 0.0
	while progress < end - 0.00001:
		if index < stops.size() and progress >= stops[index].at - 0.00001:
			item = RaceForecaster.set_by_id(s, stops[index].set_id); life = item.life
			var pit = RaceForecaster.pit_prediction(s, stops[index].at * s.length)
			pit_cost += pit.loss + pit.warmup; traffic_cost += pit.traffic.size() * 0.8; index += 1
		var step = minf(0.5, end - progress)
		if index < stops.size(): step = minf(step, maxf(0.00001, stops[index].at - progress))
		var fraction = minf(1, (progress - start + step * 0.5) * s.reference_lap / outlook.horizon_seconds)
		# Retain part of the observed wettest-sector offset; never assume the line is uniformly dry.
		var contrast = maxf(0, outlook.observed.sectors[outlook.worst_sector] - outlook.observed.mean) * 0.5
		s.water = clampf(lerpf(outlook.observed.mean, target_water, fraction) + contrast, 0, 1)
		var wear = RaceSim.TYRES[item.compound].wear * [0.78, 1.0, 1.25][s.own.pace] * 1.05
		if item.id == s.own.set_id: wear = s.own.wear
		if item.compound in ["I", "W"] and s.water < 0.15: wear *= 2.2
		time += RaceForecaster.lap_time(s, item, life - wear * step * 0.5) * step
		life = maxf(0, life - wear * step); minimum = minf(minimum, RaceForecaster.limiting_life(item, life)); progress += step
	return {"available": true, "seconds": time + pit_cost + traffic_cost, "minimum_life": minimum,
		"pit_cost": pit_cost, "traffic_cost": traffic_cost, "risk": "high" if minimum < 10 or s.fuel_margin < 0 else ("moderate" if minimum < 25 else "lower")}

static func candidate(s: Dictionary, outlook: Dictionary, id: String, title: String, stops: Array) -> Dictionary:
	var cases: Array = []
	for weather_case in outlook.cases:
		var result = score(s, outlook, stops, weather_case.water)
		if not result.available: return {"id": id, "title": title, "available": false, "reason": result.reason}
		cases.append(result)
	var low = INF; var high = 0.0; var risk = "lower"
	for result in cases:
		low = minf(low, result.seconds); high = maxf(high, result.seconds)
		if result.risk == "high": risk = "high"
		elif result.risk == "moderate" and risk != "high": risk = "moderate"
	return {"id": id, "title": title, "available": true, "cases": cases, "seconds": cases[1].seconds,
		"low": maxf(0, low - 3), "high": high + 3, "risk": risk, "stops": stops.duplicate(true)}

static func revised(stops: Array, at: float, set_id: String) -> Array:
	var result: Array = [{"at": at, "set_id": set_id}]
	# Replace only the first window; preserve later compatible windows.
	for i in range(1, stops.size()):
		if stops[i].at > at and stops[i].set_id != set_id: result.append(stops[i])
	return result

static func evaluate(s: Dictionary, outlook: Dictionary) -> Dictionary:
	var planned = planned_stops(s)
	var current = candidate(s, outlook, "current", "Keep approved plan" if not planned.is_empty() else "Stay on fitted set", planned)
	var options: Array = [current]
	var best: Dictionary = {}; var chosen: Dictionary = {}
	var next = s.gate.distance / s.length
	var legal = s.phase == "race" and s.own.route == "track" and not s.own.pit_order and next < s.laps
	if legal:
		# At most one available set per wetness family. No infinite solver or hidden rival stock.
		var families: Dictionary = {}
		for item in s.own.inventory:
			if item.id == s.own.starting_set or not WheelTyres.usable(item): continue
			var family = item.compound if item.compound in ["I", "W"] else "dry"
			if prefer_set(s, item, families.get(family, {})): families[family] = item
		for family in ["dry", "I", "W"]:
			if not families.has(family): continue
			var item = families[family]
			var option = candidate(s, outlook, "box", "Fit " + item.id + " at next safe entry", revised(planned, next, item.id))
			if option.available and (best.is_empty() or option.seconds < best.seconds): best = option; chosen = item
	if not best.is_empty():
		best.set_id = chosen.id; best.compound = chosen.compound; options.append(best)
		if next + 1 < s.laps:
			var wait = candidate(s, outlook, "wait", "Switch one lap later (comparison only)", revised(planned, next + 1, chosen.id))
			options.append(wait)
	for option in options:
		if not option.available or not current.available: continue
		option.gain_low = INF; option.gain_high = -INF
		for i in range(3):
			var gain = current.cases[i].seconds - option.cases[i].seconds
			option.gain_low = minf(option.gain_low, gain - 3); option.gain_high = maxf(option.gain_high, gain + 3)
	var progress = maxf(0, s.own.distance / s.length) if s.phase == "race" else 0.0
	return {"version": VERSION, "driver_id": int(s.own.id), "time": s.time, "key": s.key, "weather_key": outlook.key,
		"outlook": outlook, "options": options, "replacement_id": chosen.get("id", ""), "gate": s.gate,
		"pit": RaceForecaster.pit_prediction(s), "horizon_laps": minf(MAX_LAPS, s.laps - progress),
		"partial_horizon": s.laps - progress > MAX_LAPS, "scope": s.scope + "; " + outlook.scope,
		"limitations": "Estimates, not guaranteed gains. Three gradual-change cases then constant conditions; same modes, finite stock, warm-up, full pit loss and public traffic. Local wettest-sector offset is approximated. Reliability events and unknown rival responses are not predicted. Wait changes no order; later approved windows remain binding."}
