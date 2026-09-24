class_name RivalStyles
extends RefCounted
## RW-18: pure, bounded preferences over the existing forecast's legal candidates.
## Diagnostic scores are private. Public presentation receives profiles and actual stops only.
const VERSION = 1
const HISTORY_LIMIT = 48
const KEYS = ["position", "undercut", "conserve", "adaptive"]
const WEIGHTS = ["pit_cost", "offset", "traffic", "extend", "cover", "uncertainty"]
const PROFILES = {
	"position": {"label": "Track-position protector", "summary": "Usually keeps a place rather than paying for a marginal tyre offset; may cover a threatening observed stop.", "weights": [2.4, 0.4, 0.3, -0.2, 2.2, 1.5]},
	"undercut": {"label": "Opportunistic undercutter", "summary": "Looks for a feasible early stop when traffic and its own tyre offset make clear air worthwhile.", "weights": [0.1, 2.0, 1.7, 0.8, 1.3, 0.5]},
	"conserve": {"label": "Long-stint conservator", "summary": "Usually extends usable tyres and avoids an expensive rejoin; emergencies still take priority.", "weights": [2.0, 0.4, -0.5, -2.5, 0.5, 1.5]},
	"adaptive": {"label": "Adaptive risk-taker", "summary": "Accepts a bounded, uncertain opportunity even without traffic ahead; still rejects unsafe or unaffordable options.", "weights": [0.2, 1.2, 0.7, -0.3, 1.0, 0.0]}
}

static func profile(style: String) -> Dictionary:
	var weights: Dictionary = {}
	for i in range(WEIGHTS.size()): weights[WEIGHTS[i]] = PROFILES[style].weights[i]
	return weights

static func create(cars: Array, enabled: bool) -> Dictionary:
	var teams: Array = []; var drivers: Array = []
	for c in cars:
		if not c.player and c.team not in teams: teams.append(c.team)
		var style = KEYS[teams.find(c.team) % KEYS.size()] if enabled and not c.player else "legacy"
		drivers.append({"driver_id": int(c.id), "style": style, "weights": profile(style) if style != "legacy" else {}, "hold_gate": -1.0, "reviews": 0})
	return {"version": VERSION, "enabled": enabled, "drivers": drivers, "history": []}

static func context(s: Dictionary, stops: Array, comparison: Dictionary) -> Dictionary:
	var current = RaceForecaster.set_by_id(s, s.own.set_id)
	var replacement = RaceForecaster.replacement(s)
	var fresh_gain = maxf(0, RaceForecaster.lap_time(s, current, current.life) - RaceForecaster.lap_time(s, replacement, replacement.life)) if not current.is_empty() and not replacement.is_empty() else 0.0
	var velocity = s.length / maxf(10, s.reference_lap)
	var ahead = false; var behind = false; var rank = 1
	for other in s.public:
		if other.dnf or other.finished or other.route != "track": continue
		var gap = (other.distance - s.own.distance) / velocity
		if gap > 0: rank += 1
		if other.id == s.teammate.get("id", -1): continue
		# Absolute race distance, not 2D proximity: lapped or grade-separated traffic
		# cannot be mistaken for a contest for this place.
		if gap > 0 and gap <= 2.5: ahead = true
		if gap < 0 and gap >= -2.5: behind = true
	var traffic_cost = comparison.pit.traffic.size() * 0.8 + comparison.pit.queue
	var event_id = ""; var cover = 0.0
	for i in range(stops.size() - 1, -1, -1):
		var event = stops[i]
		if event.driver_id in [s.own.id, s.teammate.get("id", -1)]: continue
		var age = s.time - event.time
		if age < 0 or age > minf(40, s.reference_lap): continue
		var visible = s.public.filter(func(car): return car.id == event.driver_id and not car.dnf and not car.finished)
		if visible.is_empty(): continue
		var gap = (s.own.distance - velocity * age - event.distance) / velocity
		if gap < 0 or gap > 8: continue
		event_id = event.event_id
		cover = clampf((fresh_gain * 2 - comparison.pit.warmup - traffic_cost - gap) / 2, 0, 1)
		break
	return {"traffic_ahead": ahead, "threat_behind": behind, "fresh_lap_gain": fresh_gain, "traffic_cost": traffic_cost,
		"position_loss": maxf(0, comparison.pit.position - rank), "cover": cover, "public_event": event_id,
		"remaining": maxf(0, s.laps - s.own.distance / s.length), "life": current.get("life", 0)}

static func decide(s: Dictionary, stops: Array, driver: Dictionary, comparison: Dictionary) -> Dictionary:
	if driver.style not in PROFILES or s.phase != "race" or s.flag != "GREEN" or s.own.route != "track" or s.own.pit_order or s.own.dnf or s.own.finished: return {}
	var c = context(s, stops, comparison); var weights = driver.weights
	var replacement = RaceForecaster.replacement(s)
	var legal: Array = []; var best_seconds = INF
	for option in comparison.options.slice(0, 3):
		if not option.available or option.id not in ["current", "box", "extend"]: continue
		if option.risk == "high" or s.fuel_margin < 0: continue
		if option.id == "box" and (replacement.is_empty() or s.gate.distance >= s.laps * s.length): continue
		if option.id == "extend" and (c.remaining < 3 or c.life < 35): continue
		legal.append(option); best_seconds = minf(best_seconds, option.seconds)
	if legal.is_empty(): return {}
	# A tendency cannot turn a plainly expensive strategy into a sensible one.
	# Four estimated seconds is a disclosed tuning bound, not calibrated uncertainty.
	var shortlist: Array = []; var selected: Dictionary = {}; var best_score = INF
	for option in legal:
		if option.seconds > best_seconds + 4.0: continue
		var bias = 0.0
		if option.id == "box":
			bias = weights.pit_cost * clampf(c.position_loss / 3, 0, 1) - weights.offset * clampf(c.fresh_lap_gain / 2, 0, 1)
			if c.traffic_ahead: bias -= weights.traffic
			bias -= weights.cover * c.cover
			if option.risk == "moderate": bias += weights.uncertainty * 2
		elif option.id == "extend": bias = weights.extend - minf(1.5, c.traffic_cost * 0.25)
		elif c.threat_behind: bias = -weights.pit_cost * 0.25
		bias = clampf(bias, -4, 4)
		var score = option.seconds - best_seconds + bias
		shortlist.append({"id": option.id, "seconds": float(option.seconds), "risk": option.risk, "preference": bias, "score": score})
		if score < best_score:
			best_score = score; selected = option
	if selected.is_empty(): return {}
	return {"driver_id": int(s.own.id), "time": float(s.time), "style": driver.style, "choice": selected.id,
		"set_id": replacement.get("id", "") if selected.id == "box" else "", "gate": float(s.gate.distance),
		"hold_gate": maxf(s.gate.distance, selected.stops[0].at * s.length - s.length) if selected.id == "extend" else -1.0,
		"context": c, "candidates": shortlist, "reason": "%s preference among %d feasible, near-best alternatives; no outcome guarantee." % [PROFILES[driver.style].label, shortlist.size()]}

static func record(state: Dictionary, decision: Dictionary) -> void:
	var driver = state.drivers[decision.driver_id]
	driver.reviews += 1
	driver.hold_gate = decision.hold_gate
	state.history.append(decision.duplicate(true))
	if state.history.size() > HISTORY_LIMIT: state.history.pop_front()

static func public_driver(state: Dictionary, car: Dictionary) -> String:
	if car.player or not state.enabled: return "No expanded public rival profile for this driver."
	var style = PROFILES[state.drivers[int(car.id)].style]
	return "%s · %s\n%s\n\n%s\n\nObserved compound: %s · completed pit stops: %d\nBest measured lap: %s\nLast measured lap: %s\n\nTyre condition, fuel, setup, intended stop and team diagnostics are private. Profiles bias feasible choices; they do not guarantee a response." % [car.name, car.team, style.label, style.summary, car.compound, car.pit_stops, RaceSim.format_time(car.best_lap), RaceSim.format_time(car.last_lap)]

static func public_field(state: Dictionary, cars: Array, stops: Array) -> String:
	if not state.enabled: return "Classic rival policy retained for this weekend. No expanded profile was added to its saved race."
	var lines: Array[String] = ["RIVAL FIELD · PUBLIC PROFILES", "Tendencies, not promises. Exact plans, own-car estimates and decision scores remain private."]
	var teams: Array = []
	for c in cars:
		if c.player or c.team in teams: continue
		teams.append(c.team)
		var style = PROFILES[state.drivers[c.id].style]
		var pair = cars.filter(func(car): return car.team == c.team).map(func(car): return car.short)
		lines.append("%s / %s · %s\n%s" % [c.team, " + ".join(pair), style.label, style.summary])
	lines.append("OBSERVED PIT ENTRIES · not secret future plans")
	for event in stops.slice(maxi(0, stops.size() - 6)):
		lines.append("%.1fs · %s entered the pits" % [event.time, event.short])
	if stops.is_empty(): lines.append("None observed yet. A profile cannot tell you the next stop lap.")
	return "\n\n".join(lines)

static func valid(state: Variant, cars: Array, now: float) -> bool:
	if not state is Dictionary or state.get("version") != VERSION or not state.get("enabled") is bool: return false
	if not state.get("drivers") is Array or state.drivers.size() != cars.size(): return false
	if not state.get("history") is Array or state.history.size() > HISTORY_LIMIT: return false
	for i in range(cars.size()):
		var d = state.drivers[i]
		if not d is Dictionary or d.get("driver_id") != i or not d.get("weights") is Dictionary: return false
		if not RaceCheckpoint.number(d.get("hold_gate"), -1, 100000000) or not RaceCheckpoint.integral(d.get("reviews"), 0, 10000000): return false
		if not state.enabled or cars[i].player:
			if d.get("style") != "legacy" or not d.weights.is_empty() or d.reviews != 0 or d.hold_gate != -1: return false
		else:
			if d.get("style") not in PROFILES or d.weights.size() != WEIGHTS.size(): return false
			for key in WEIGHTS:
				if not RaceCheckpoint.number(d.weights.get(key), -4, 4): return false
	var last = -1.0
	for item in state.history:
		if not item is Dictionary or not RaceCheckpoint.integral(item.get("driver_id"), 0, cars.size() - 1): return false
		var driver = state.drivers[int(item.driver_id)]
		if not state.enabled or driver.style == "legacy" or item.get("style") != driver.style or driver.reviews == 0: return false
		if not RaceCheckpoint.number(item.get("time"), 0, now + RaceSim.STEP) or item.time < last: return false
		last = item.time
		if item.get("choice") not in ["current", "box", "extend"] or not RaceCheckpoint.number(item.get("gate"), 0, 100000000): return false
		if not RaceCheckpoint.number(item.get("hold_gate"), -1, 100000000): return false
		if item.choice == "extend" and item.hold_gate < item.gate: return false
		if item.choice != "extend" and item.hold_gate != -1: return false
		if not item.get("set_id") is String or not item.get("reason") is String or item.reason.length() > 300: return false
		if item.choice == "box":
			if TyreInventory.find(cars[int(item.driver_id)], item.set_id).is_empty(): return false
		elif not item.set_id.is_empty(): return false
		if not item.get("context") is Dictionary or not item.get("candidates") is Array or item.candidates.is_empty() or item.candidates.size() > 3: return false
		var c = item.context
		for key in ["traffic_ahead", "threat_behind"]:
			if not c.get(key) is bool: return false
		for key in ["fresh_lap_gain", "traffic_cost", "position_loss", "cover", "remaining", "life"]:
			if not RaceCheckpoint.number(c.get(key), 0, 10000000): return false
		if not c.get("public_event") is String or c.public_event.length() > 40: return false
		var ids: Array = []
		for candidate in item.candidates:
			if not candidate is Dictionary or candidate.get("id") not in ["current", "box", "extend"] or candidate.id in ids: return false
			ids.append(candidate.id)
			if candidate.get("risk") not in ["lower", "moderate"]: return false
			if not RaceCheckpoint.number(candidate.get("seconds"), 0, 10000000) or not RaceCheckpoint.number(candidate.get("preference"), -4, 4) or not RaceCheckpoint.number(candidate.get("score"), -4, 8): return false
		if item.choice not in ids: return false
	return true
