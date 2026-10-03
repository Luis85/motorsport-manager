extends "res://scripts/domain/weekend/race_forecast_physics.gd"
## Bounded comparison of captured race strategy candidates.


static func evaluate_candidate(
	s: Dictionary, id: String, title: String, stops: Array
) -> Dictionary:
	var rules: Dictionary = RaceTuningDefinition.balance_values(s).forecast
	var current = set_by_id(s, s.own.starting_set)
	if current.is_empty():
		return {
			"id": id,
			"title": title,
			"available": false,
			"reason": "The starting set is unavailable."
		}
	var life = float(current.life)
	var used_sets = [current.id]
	var last_stop = -1.0
	for stop in stops:
		if stop.at <= last_stop or stop.at >= s.laps or stop.set_id in used_sets:
			return {
				"id": id,
				"title": title,
				"available": false,
				"reason": "The proposed stops are not ordered or reuse the same tyre set."
			}
		last_stop = stop.at
		used_sets.append(stop.set_id)
	var progress = maxf(0, s.own.distance / s.length) if s.phase == "race" else 0.0
	var seconds = 0.0
	var index = 0
	var minimum_life = limiting_life(current, life)
	var traffic_cost = 0.0
	var pit_cost = 0.0
	var warmup = 0.0
	while progress < s.laps - 0.00001:
		if index < stops.size() and progress >= stops[index].at - 0.00001:
			current = set_by_id(s, stops[index].set_id)
			if current.is_empty() or not WheelTyres.usable(current):
				return {
					"id": id,
					"title": title,
					"available": false,
					"reason": "Replacement set is unavailable."
				}
			life = current.life
			var pit = pit_prediction(s, stops[index].at * s.length)
			pit_cost += pit.loss
			warmup += pit.warmup
			traffic_cost += pit.traffic.size() * rules.traffic_seconds_per_car
			index += 1
		var step = minf(0.5, s.laps - progress)
		if index < stops.size():
			step = minf(step, maxf(0.00001, stops[index].at - progress))
		var wear = wear_rate(s, current)
		seconds += lap_time(s, current, life - wear * step * 0.5) * step
		life = maxf(0, life - wear * step)
		minimum_life = minf(minimum_life, limiting_life(current, life))
		progress += step
	seconds += pit_cost + warmup + traffic_cost
	var confidence = rules.base_uncertainty
	var priors = s.get("model_context", {}).get("practice", {})
	var matched = priors.get(set_by_id(s, s.own.starting_set).get("compound", ""), {})
	if not matched.is_empty():
		confidence = float(matched.uncertainty)
		for stop in stops:
			confidence = maxf(
				confidence,
				priors.get(set_by_id(s, stop.set_id).get("compound", ""), {}).get(
					"uncertainty", rules.base_uncertainty
				)
			)
	var uncertainty = (
		maxf(rules.minimum_uncertainty_seconds, seconds * confidence)
		+ stops.size() * RaceTuningDefinition.forecast_values(s).service.uncertainty_seconds
		+ traffic_cost
	)
	var risk = (
		"high"
		if minimum_life < rules.high_risk_tread or s.fuel_margin < 0
		else ("moderate" if minimum_life < rules.moderate_risk_tread else "lower")
	)
	return {
		"id": id,
		"title": title,
		"available": true,
		"seconds": seconds,
		"low": maxf(0, seconds - uncertainty),
		"high": seconds + uncertainty,
		"risk": risk,
		"minimum_life": minimum_life,
		"fuel_margin": s.fuel_margin,
		"stops": stops.duplicate(true),
		"pit_cost": pit_cost,
		"warmup_cost": warmup,
		"traffic_cost": traffic_cost
	}


static func evaluate(s: Dictionary) -> Dictionary:
	var rules: Dictionary = RaceTuningDefinition.balance_values(s).forecast
	var planned: Array = []
	var progress = maxf(0, s.own.distance / s.length) if s.phase == "race" else 0.0
	if s.own.pit_order:
		var item = replacement(s)
		if not item.is_empty():
			planned.append({"at": s.own.pit_gate / s.length, "set_id": item.id})
	else:
		for stop in s.plan.get("stops", []):
			var at = maxf(
				float(stop.from_lap - 1) + s.pit_entry / s.length, s.gate.distance / s.length
			)
			var latest = float(stop.to_lap - 1) + s.pit_entry / s.length
			if at <= latest and at >= progress:
				planned.append({"at": at, "set_id": stop.set_id})
	var options: Array = [evaluate_candidate(s, "current", "Keep current plan", planned)]
	if s.own.route == "pit":
		options = [
			{
				"id": "current",
				"title": "Physical pit visit in progress",
				"available": false,
				"reason": "Service is committed. Compare future stints after rejoining."
			}
		]
	var replacement_set = replacement(s)
	var repair_pending = s.get("model_context", {}).get("repair_only", false) and s.own.pit_order
	if repair_pending:
		options = [
			{
				"id": "current",
				"title": "Repair-only visit ordered",
				"available": false,
				"reason":
				(
					"The fitted set is retained. Cancel before entry to change the transaction, or "
					+ "compare future tyre stints after rejoining."
				)
			}
		]
		replacement_set = {}
	var pit = pit_prediction(s)
	if (
		not replacement_set.is_empty()
		and s.gate.distance < s.laps * s.length
		and s.own.route == "track"
	):
		var now = s.gate.distance / s.length
		var later = minf(
			s.laps - rules.extend_laps + s.pit_entry / s.length, now + rules.extend_laps
		)
		var box_stops: Array = [{"at": now, "set_id": replacement_set.id}]
		var extend_stops: Array = [{"at": later, "set_id": replacement_set.id}]
		# Compare a revised first stop, preserving subsequent authorized stints.
		for i in range(1, planned.size()):
			if planned[i].set_id != replacement_set.id and planned[i].at > now:
				box_stops.append(planned[i])
			if planned[i].set_id != replacement_set.id and planned[i].at > later:
				extend_stops.append(planned[i])
		options.append(evaluate_candidate(s, "box", "Stop at next safe entry", box_stops))
		if later > now:
			options.append(
				evaluate_candidate(
					s,
					"extend",
					(
						"Extend two laps"
						if rules.extend_laps == 2
						else "Extend %d laps" % rules.extend_laps
					),
					extend_stops
				)
			)
	for option in options:
		if option.available:
			option.gain = options[0].get("seconds", option.seconds) - option.seconds
	return {
		"tick": s.tick,
		"time": s.time,
		"key": s.key,
		"driver_id": int(s.own.id),
		"model_version": MODEL_VERSION,
		"scope": s.scope,
		"options": options,
		"pit": pit,
		"gate": s.gate,
		"replacement_id": replacement_set.get("id", ""),
		"fuel_margin": s.fuel_margin,
		"practice_evidence": s.get("model_context", {}).get("practice", {}).duplicate(true),
		"assumptions":
		[
			"Estimate, not a calibrated probability band.",
			(
				"Practice: "
				+ (
					"no matching samples; baseline model."
					if s.get("model_context", {}).get("practice", {}).is_empty()
					else "matching measured laps inform bounded pace/wear estimates, never car performance."
				)
			),
			"Observed rival pace continues; unknown rival stops may change rejoin order.",
			"Current water persists; future weather is not available to this model.",
			(
				"Current pace and engine modes are held for comparison; future owner responses and "
				+ "override handback are not predicted."
			),
			(
				"Working-temperature approximation retains all four wheels’ damage; warm-up is priced "
				+ "separately. No incident or exact finishing-position prediction."
			),
			"Remaining-time estimates include each additional stop's full net pit loss."
		]
	}
