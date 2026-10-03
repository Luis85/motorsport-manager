class_name RivalStyles
extends "res://scripts/domain/weekend/rival_style_validation.gd"


static func context(s: Dictionary, stops: Array, comparison: Dictionary) -> Dictionary:
	var tuning = RaceTuningDefinition.competition_values(s).rivals
	var current = RaceForecaster.set_by_id(s, s.own.set_id)
	var replacement = RaceForecaster.replacement(s)
	var fresh_gain = (
		maxf(
			0,
			(
				RaceForecaster.lap_time(s, current, current.life)
				- RaceForecaster.lap_time(s, replacement, replacement.life)
			)
		)
		if not current.is_empty() and not replacement.is_empty()
		else 0.0
	)
	var velocity = s.length / maxf(10, s.reference_lap)
	var ahead = false
	var behind = false
	var rank = 1
	for other in s.public:
		if other.dnf or other.finished or other.route != "track":
			continue
		var gap = (other.distance - s.own.distance) / velocity
		if gap > 0:
			rank += 1
		if other.id == s.teammate.get("id", -1):
			continue
		# Absolute race distance, not 2D proximity: lapped or grade-separated traffic
		# cannot be mistaken for a contest for this place.
		if gap > 0 and gap <= tuning.nearby_gap_seconds:
			ahead = true
		if gap < 0 and gap >= -tuning.nearby_gap_seconds:
			behind = true
	var traffic_cost = (
		comparison.pit.traffic.size() * tuning.traffic_seconds_per_car + comparison.pit.queue
	)
	var event_id = ""
	var cover = 0.0
	for i in range(stops.size() - 1, -1, -1):
		var event = stops[i]
		if event.driver_id in [s.own.id, s.teammate.get("id", -1)]:
			continue
		var age = s.time - event.time
		if age < 0 or age > minf(tuning.observation_age_seconds, s.reference_lap):
			continue
		var visible = s.public.filter(
			func(car): return car.id == event.driver_id and not car.dnf and not car.finished
		)
		if visible.is_empty():
			continue
		var gap = (s.own.distance - velocity * age - event.distance) / velocity
		if gap < 0 or gap > tuning.cover_gap_seconds:
			continue
		event_id = event.event_id
		cover = clampf(
			(
				(fresh_gain * tuning.offset_laps - comparison.pit.warmup - traffic_cost - gap)
				/ tuning.cover_scale_seconds
			),
			0,
			1
		)
		break
	return {
		"traffic_ahead": ahead,
		"threat_behind": behind,
		"fresh_lap_gain": fresh_gain,
		"traffic_cost": traffic_cost,
		"position_loss": maxf(0, comparison.pit.position - rank),
		"cover": cover,
		"public_event": event_id,
		"remaining": maxf(0, s.laps - s.own.distance / s.length),
		"life": current.get("life", 0)
	}


static func decide(
	s: Dictionary, stops: Array, driver: Dictionary, comparison: Dictionary
) -> Dictionary:
	var profiles = definitions(RaceTuningDefinition.competition_values(s))
	var tuning = RaceTuningDefinition.competition_values(s).rivals
	if (
		driver.style not in profiles
		or s.phase != "race"
		or s.flag != "GREEN"
		or s.own.route != "track"
		or s.own.pit_order
		or s.own.dnf
		or s.own.finished
	):
		return {}
	var c = context(s, stops, comparison)
	var weights = driver.weights
	var replacement = RaceForecaster.replacement(s)
	var legal: Array = []
	var best_seconds = INF
	for option in comparison.options.slice(0, 3):
		if not option.available or option.id not in ["current", "box", "extend"]:
			continue
		if option.risk == "high" or s.fuel_margin < 0:
			continue
		if option.id == "box" and (replacement.is_empty() or s.gate.distance >= s.laps * s.length):
			continue
		if (
			option.id == "extend"
			and (c.remaining < tuning.extend_remaining_laps or c.life < tuning.extend_tread)
		):
			continue
		legal.append(option)
		best_seconds = minf(best_seconds, option.seconds)
	if legal.is_empty():
		return {}
	# A tendency cannot turn a plainly expensive strategy into a sensible one.
	# Four estimated seconds is a disclosed tuning bound, not calibrated uncertainty.
	var shortlist: Array = []
	var selected: Dictionary = {}
	var best_score = INF
	for option in legal:
		if option.seconds > best_seconds + tuning.shortlist_seconds:
			continue
		var bias = _candidate_bias(option, weights, c, tuning)
		var score = option.seconds - best_seconds + bias
		shortlist.append(
			{
				"id": option.id,
				"seconds": float(option.seconds),
				"risk": option.risk,
				"preference": bias,
				"score": score
			}
		)
		if score < best_score:
			best_score = score
			selected = option
	if selected.is_empty():
		return {}
	return {
		"driver_id": int(s.own.id),
		"time": float(s.time),
		"style": driver.style,
		"choice": selected.id,
		"set_id": replacement.get("id", "") if selected.id == "box" else "",
		"gate": float(s.gate.distance),
		"hold_gate":
		(
			maxf(s.gate.distance, selected.stops[0].at * s.length - s.length)
			if selected.id == "extend"
			else -1.0
		),
		"context": c,
		"candidates": shortlist,
		"reason":
		(
			"%s preference among %d feasible, near-best alternatives; no outcome guarantee."
			% [profiles[driver.style].label, shortlist.size()]
		)
	}


static func record(state: Dictionary, decision: Dictionary) -> void:
	var driver = state.drivers[decision.driver_id]
	driver.reviews += 1
	driver.hold_gate = decision.hold_gate
	state.history.append(decision.duplicate(true))
	if state.history.size() > HISTORY_LIMIT:
		state.history.pop_front()


static func public_driver(
	state: Dictionary, car: RaceCar, tuning: Dictionary = LegacyCompetition.VALUES
) -> String:
	if car.player or not state.enabled:
		return "No expanded public rival profile for this driver."
	var style = definitions(tuning).get(state.drivers[int(car.id)].style, {})
	if style.is_empty():
		return "Rival profile unavailable."
	return (
		(
			"%s · %s\n%s\n\n%s\n\nObserved compound: %s · completed pit stops: %d\nBest measured "
			+ (
				"lap: %s\nLast measured lap: %s\n\nTyre condition, fuel, "
				+ "setup, intended stop and team diagnostics are private. "
				+ "Profiles bias feasible choices; they do not guarantee a "
				+ "response."
			)
		)
		% [
			car.name,
			car.team,
			style.label,
			style.summary,
			car.compound,
			car.pit_stops,
			RaceSim.format_time(car.best_lap),
			RaceSim.format_time(car.last_lap)
		]
	)


static func public_field(
	state: Dictionary,
	cars: Array,
	stops: Array,
	team_ids: Array = [],
	tuning: Dictionary = LegacyCompetition.VALUES
) -> String:
	if not state.enabled:
		return "Classic rival policy retained for this weekend. No expanded profile was added to its saved race."
	var lines: Array[String] = [
		"RIVAL FIELD · PUBLIC PROFILES",
		"Tendencies, not promises. Exact plans, own-car estimates and decision scores remain private."
	]
	var teams: Array = []
	for c in cars:
		var identity = team_ids[c.id] if not team_ids.is_empty() else c.team
		if c.player or identity in teams:
			continue
		teams.append(identity)
		var style = definitions(tuning).get(state.drivers[c.id].style, {})
		if style.is_empty():
			continue
		var pair = (
			cars
			. filter(func(car): return _team_identity(car, team_ids) == identity)
			. map(func(car): return car.short)
		)
		lines.append("%s / %s · %s\n%s" % [c.team, " + ".join(pair), style.label, style.summary])
	lines.append("OBSERVED PIT ENTRIES · not secret future plans")
	for event in stops.slice(maxi(0, stops.size() - 6)):
		lines.append("%.1fs · %s entered the pits" % [event.time, event.short])
	if stops.is_empty():
		lines.append("None observed yet. A profile cannot tell you the next stop lap.")
	return "\n\n".join(lines)


static func _team_identity(car: RaceCar, team_ids: Array) -> String:
	return team_ids[car.id] if not team_ids.is_empty() else car.team


static func _candidate_bias(
	option: Dictionary, weights: Dictionary, c: Dictionary, tuning: Dictionary
) -> float:
	var bias = 0.0
	if option.id == "box":
		bias = (
			weights.pit_cost * clampf(c.position_loss / tuning.position_scale, 0, 1)
			- weights.offset * clampf(c.fresh_lap_gain / tuning.offset_scale_seconds, 0, 1)
		)
		if c.traffic_ahead:
			bias -= weights.traffic
		bias -= weights.cover * c.cover
		if option.risk == "moderate":
			bias += weights.uncertainty * tuning.uncertainty_weight
	elif option.id == "extend":
		bias = (
			weights.extend
			- minf(tuning.extend_credit_seconds, c.traffic_cost * tuning.extend_traffic_factor)
		)
	elif c.threat_behind:
		bias = -weights.pit_cost * tuning.threat_position_factor
	bias = clampf(bias, -4, 4)
	return bias
