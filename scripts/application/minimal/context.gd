class_name MinimalDriverContext
extends RefCounted
## Read-only, bounded race context. Stress is an authored current-demand estimate,
## NOT a persisted psychological state, an incident probability or a pace modifier.
const STRESS_VERSION = "current-demand-v1"


static func stress(sim: RaceSim, car: RaceCar, tyre_life: float, punctured: bool) -> Dictionary:
	var inactive = (
		car.dnf
		or car.finished
		or sim.phase not in RaceSim.ACTIVE
		or car.route == "garage"
		or sim.phase == "lights"
		or (car.route == "pit" and car.speed <= 0.1)
	)
	if inactive:
		return {
			"value": -1,
			"text": "—",
			"band": "Unavailable",
			"cause": "",
			"note": "Not driving",
			"reason":
			(
				"No active driving demand is estimated in the garage, after retirement "
				+ "or after the finish."
			),
			"factors": [],
			"version": STRESS_VERSION
		}
	var demand: Dictionary = sim.tuning.balance.presentation
	var score = demand.demand_base
	var factors: Array = []
	if car.pace == 2:
		factors.append({"label": "Push", "points": demand.demand_push})
	elif car.pace == 0:
		score = demand.demand_calm_base
	_append_traffic(sim, car, factors)
	if punctured:
		factors.append({"label": "Puncture", "points": demand.demand_puncture})
	elif tyre_life >= 0 and tyre_life < demand.demand_tread_threshold_percent:
		factors.append(
			{
				"label": "Low tread",
				"points":
				(
					demand.demand_tread_points
					* (1.0 - tyre_life / demand.demand_tread_threshold_percent)
				)
			}
		)
	if car.damage > 0:
		factors.append(
			{
				"label": "Damage",
				"points":
				minf(demand.demand_damage_max, car.damage * demand.demand_damage_per_percent)
			}
		)
	if car.route == "track":
		var water = float(sim.surface_at(car).get("water", 0))
		if water > demand.demand_water_threshold:
			factors.append(
				{
					"label": "Wet track",
					"points": minf(demand.demand_water_points, water * demand.demand_water_points)
				}
			)
	if car.loss > 0:
		factors.append({"label": "Recovering", "points": demand.demand_recovery})
	for factor in factors:
		score += factor.points
	score = clampf(score, 0, 100)
	var band = (
		"High"
		if score >= demand.demand_high
		else ("Raised" if score >= demand.demand_raised else "Low")
	)
	factors.sort_custom(func(a, b): return a.points > b.points)
	var cause = (
		str(factors[0].label)
		if not factors.is_empty()
		else ("Calm pace" if car.pace == 0 else "Clear running")
	)
	var evidence: Array[String] = []
	for factor in factors:
		evidence.append("%s +%.0f" % [factor.label, factor.points])
	return {
		"value": score,
		"text": "~%d/100" % roundi(score),
		"band": band,
		"cause": cause,
		"note": band + " · " + cause,
		"reason":
		(
			(
				"Estimated current driving demand, not measured emotion or mistake "
				+ "probability. Base %d; %s. No performance effect or accumulated stress "
				+ "history."
			)
			% [
				demand.demand_calm_base if car.pace == 0 else demand.demand_base,
				", ".join(evidence) if not evidence.is_empty() else "no added demand"
			]
		),
		"factors": factors,
		"version": STRESS_VERSION
	}


static func lap_context(sim: RaceSim, car: RaceCar) -> Dictionary:
	var best = 0.0
	var last = 0.0
	var label = "LAST LAP"
	if sim.phase in ["practice", "practice_results"]:
		best = MinimalRaceTiming.practice_best(sim, car.id)
		for run in sim.practice_driver(car.id).get("runs", []):
			for sample in run.get("samples", []):
				if float(sample.get("seconds", 0.0)) > 0:
					last = sample.seconds
	elif sim.phase in ["qualifying", "qualifying_results"]:
		best = car.qual_best
		for lap in car.qual_history:
			if lap.get("valid", false):
				last = lap.get("time", 0.0)
	elif sim.phase in ["race", "results"]:
		best = car.best_lap
		last = car.last_lap
		if not car.history.is_empty() and car.history.back().get("pit_lap", false):
			label = "LAST · PIT LAP"
	elif sim.phase in ["race_preparation", "formation", "grid_ready", "lights"]:
		label = "QUALIFYING"
		best = car.qual_best
		last = best
	return {
		"label": label,
		"last": MinimalRaceTiming.format_time(last),
		"best": MinimalRaceTiming.format_time(best)
	}


static func gap_text(sim: RaceSim, front: RaceCar, back: RaceCar) -> String:
	var distance = maxf(0, front.distance - back.distance)
	if distance >= sim.track.length:
		return "%d L" % int(distance / sim.track.length)
	if front.speed <= 0.1:
		return "—"
	return "~%.1fs" % (distance / front.speed)


static func race_context(sim: RaceSim, car: RaceCar) -> String:
	if car.dnf:
		return "Retired · " + car.retire_reason
	if car.finished:
		return "%d laps completed · %d stops" % [car.completed, car.pit_stops]
	if sim.phase != "race":
		if sim.phase in ["practice", "practice_results", "qualifying", "qualifying_results"]:
			return (
				("Best measured  " if sim.phase.begins_with("practice") else "Best valid lap  ")
				+ lap_context(sim, car).best
			)
		return "Grid P%d · %s" % [car.grid, MinimalRaceTiming.state(sim, car)]
	if car.route == "pit":
		return "Pit lane · " + str(car.pit_stage).capitalize() + " · %d stops" % car.pit_stops
	var field = sim.standings().filter(func(c): return not c.dnf)
	var rank = field.find(car)
	if rank < 0:
		return "Race position unavailable"
	var ahead = "Leading"
	var behind = "No car behind"
	if rank > 0:
		var other = field[rank - 1]
		ahead = (
			"Ahead %s %s"
			% [other.short, "finished" if other.finished else gap_text(sim, other, car)]
		)
	if rank < field.size() - 1:
		var other = field[rank + 1]
		behind = (
			"Behind %s %s"
			% [other.short, "finished" if other.finished else gap_text(sim, car, other)]
		)
	return ahead + "   ·   " + behind


static func _append_traffic(sim: RaceSim, car: RaceCar, factors: Array) -> void:
	# Along-route distance, never projected screen proximity; only live track cars.
	if car.route == "track" and sim.phase != "formation" and not sim.neutral(car):
		var nearest = INF
		for other in sim.cars:
			if other.id == car.id or other.dnf or other.finished or other.route != "track":
				continue
			var gap = absf(
				(
					fposmod(
						other.distance - car.distance + sim.track.length * 0.5, sim.track.length
					)
					- sim.track.length * 0.5
				)
			)
			nearest = minf(nearest, gap)
		var demand: Dictionary = sim.tuning.balance.presentation
		if nearest < demand.demand_traffic_distance_m:
			factors.append(
				{
					"label": "Traffic",
					"points":
					(
						demand.demand_traffic_points
						* (1.0 - nearest / demand.demand_traffic_distance_m)
					)
				}
			)
