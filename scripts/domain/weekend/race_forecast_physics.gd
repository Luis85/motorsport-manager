extends RefCounted
## Bounded, observational coarse model. Never stores a RaceSim reference or samples RNG.
const MODEL_VERSION = 1
const MAX_AGE = 5.0
## Pure finite-stock, pit-time, lap-time and wear projections.


static func set_by_id(s: Dictionary, id: String) -> Dictionary:
	for item in s.own.inventory:
		if item.id == id:
			return item
	return {}


static func replacement(s: Dictionary) -> Dictionary:
	var wanted = s.own.next_compound
	var wet = s.water
	var selection: Dictionary = s.get("tyre_context", {}).get(
		"selection", LegacyTyreContent.SELECTION
	)
	if wet > selection.wet_threshold:
		wanted = selection.wet
	elif wet > selection.intermediate_threshold:
		wanted = selection.intermediate
	elif tyre_spec(s, wanted).family != "slick":
		wanted = selection.dry
	var best: Dictionary = {}
	for item in s.own.inventory:
		if item.id == s.own.starting_set or not WheelTyres.usable(item):
			continue
		if item.id == s.own.next_set_id:
			return item
		if item.compound != wanted:
			continue
		if best.is_empty() or item.life > best.life:
			best = item
	return best


static func pit_prediction(s: Dictionary, gate: float = -1) -> Dictionary:
	var tuning = RaceTuningDefinition.forecast_values(s).service
	var own = s.own
	if gate < 0:
		gate = s.gate.distance
	var context = s.get("model_context", {})
	var profile_lap = (
		s.reference_lap * RacePerformanceProfile.forecast_lap_factor(s.own.performance_profile)
	)
	var running_lap = profile_lap / float(context.get("neutral_factor", 1.0))
	var mean_speed = s.length / maxf(10, running_lap)
	var entry_eta = maxf(0, gate - own.distance) / mean_speed
	var service = (
		RaceTuningDefinition.mean_service(tuning, context.get("repair_only", false))
		+ (own.damage * tuning.repair_seconds_per_damage if own.repair else 0.0)
	)
	var arrival = entry_eta + own.box_d / s.pit_limit + tuning.arrival_allowance_seconds
	var queue = 0.0
	var mate = s.teammate
	if not mate.is_empty():
		var other_arrival = INF
		if mate.route == "pit":
			if mate.pit_stage == "service":
				queue = maxf(0, mate.pit_timer - arrival)
			elif mate.pit_stage == "entry":
				other_arrival = maxf(0, mate.box_d - mate.pit_d) / s.pit_limit
		elif mate.pit_order:
			other_arrival = (
				maxf(0, mate.pit_gate - mate.distance) / mean_speed
				+ mate.box_d / s.pit_limit
				+ tuning.arrival_allowance_seconds
			)
		var mate_service = (
			RaceTuningDefinition.mean_service(tuning, context.get("teammate_repair_only", false))
			+ (mate.damage * tuning.repair_seconds_per_damage if mate.repair else 0.0)
		)
		if other_arrival <= arrival:
			queue = maxf(0, other_arrival + mate_service - arrival)
	var visit = s.pit_length / s.pit_limit + service + tuning.transit_allowance_seconds + queue
	var uncertainty = (
		tuning.uncertainty_seconds + (tuning.queue_uncertainty_seconds if queue > 0 else 0.0)
	)
	var skipped = (s.pit_exit - s.pit_entry) / s.length * running_lap
	var exit_station = gate + s.pit_exit - s.pit_entry
	var position = 1
	var lower_position = 1
	var upper_position = 1
	var traffic: Array[String] = []
	for other in s.public:
		if other.dnf:
			continue
		var velocity = (
			s.length / maxf(other.lap_seconds, running_lap)
			if context.get("neutral_factor", 1.0) < 1
			else s.length / other.lap_seconds
		)
		var projected = other.distance + velocity * (entry_eta + visit)
		if other.finished or projected > exit_station:
			position += 1
		if other.finished or projected - velocity * uncertainty > exit_station:
			lower_position += 1
		if other.finished or projected + velocity * uncertainty > exit_station:
			upper_position += 1
		if (
			not other.finished
			and projected >= exit_station - 30
			and projected < exit_station + velocity * 2.5
		):
			traffic.append(other.short)
	return {
		"visit": visit,
		"visit_low": maxf(service, visit - uncertainty),
		"visit_high": visit + uncertainty,
		"loss": maxf(0, visit - skipped),
		"loss_low": maxf(0, visit - skipped - uncertainty),
		"loss_high": maxf(0, visit - skipped + uncertainty),
		"queue": queue,
		"position": position,
		"position_low": lower_position,
		"position_high": upper_position,
		"traffic": traffic,
		"exit_station": exit_station,
		"gate": gate,
		"entry_eta": entry_eta,
		"warmup": 0.0 if context.get("repair_only", false) else tuning.warmup_seconds,
		"assumptions":
		context.get(
			"rule_summary", "Current conditions held constant; no future incidents predicted."
		)
	}


static func lap_time(s: Dictionary, item: Dictionary, life: float) -> float:
	var tuning = RaceTuningDefinition.forecast_values(s)
	var compound = item.compound
	var wet = s.water
	var spec = tyre_spec(s, compound)
	var match_factor = TyreSurfaceResponse.factor(spec, wet)
	var wheel_grip = 0.0
	for key in WheelTyres.KEYS:
		var wheel = item.wheels[key].duplicate()
		wheel.life = maxf(0, wheel.life - maxf(0, item.life - life))
		# The coarse stint model assumes working temperature after a separately priced
		# warm-up. Retained wear, flat spots, grain, blistering and punctures are real.
		wheel.surface = spec.optimum
		wheel.core = wheel.surface
		wheel_grip += WheelTyres.grip_wheel(wheel, compound, spec)
	var grip = wheel_grip * 0.25 * spec.grip * match_factor
	var handling = (
		(1 + (s.own.skill - tuning.pace.skill_reference) * tuning.pace.skill_factor)
		* tuning.pace.speed_modes[s.own.pace]
		* tuning.pace.engine_modes[s.own.engine]
	)
	var fuel_mass = 1.0 + maxf(0, s.own.projected_fuel) * tuning.fuel.forecast_mass_factor
	var context = s.get("model_context", {})
	var operation = (
		float(context.get("health_factor", 1.0)) * float(context.get("thermal_factor", 1.0))
	)
	var profile_lap = (
		s.reference_lap * RacePerformanceProfile.forecast_lap_factor(s.own.performance_profile)
	)
	var lap = (
		profile_lap
		* fuel_mass
		/ maxf(
			0.2,
			(
				sqrt(grip)
				* handling
				* (1 - minf(200, s.own.damage) * tuning.condition.damage_speed_loss)
				* operation
			)
		)
	)
	lap *= context.get("practice", {}).get(compound, {}).get("lap_factor", 1.0)
	return (
		maxf(lap, s.reference_lap / float(context.get("neutral_factor", 1.0)))
		if context.get("neutral_factor", 1.0) < 1
		else lap
	)


static func wear_rate(s: Dictionary, item: Dictionary) -> float:
	var tuning = RaceTuningDefinition.forecast_values(s).pace
	var rate = (
		tyre_spec(s, item.compound).wear
		* tuning.wear_modes[s.own.pace]
		* tuning.forecast_wear_factor
	)
	if item.id == s.own.set_id:
		rate = s.own.wear
	if not (item.id == s.own.set_id and s.own.get("measured_race_wear", false)):
		rate *= s.get("model_context", {}).get("practice", {}).get(item.compound, {}).get(
			"wear_factor", 1.0
		)
	var spec = tyre_spec(s, item.compound)
	if spec.family != "slick" and s.water < spec.thermal.wet_dry_water_threshold:
		rate *= spec.thermal.wet_dry_wear_multiplier
	return rate


static func limiting_life(item: Dictionary, average_life: float) -> float:
	var minimum = 100.0
	for key in WheelTyres.KEYS:
		var wheel = item.wheels[key]
		minimum = minf(
			minimum,
			0.0 if wheel.punctured else maxf(0, wheel.life - maxf(0, item.life - average_life))
		)
	return minimum


static func tyre_spec(snapshot: Dictionary, compound: String) -> Dictionary:
	if snapshot.has("tyre_context"):
		return snapshot.tyre_context.compounds.get(compound, {})
	return RaceTyreRules.legacy().spec(compound)


static func weather_family(snapshot: Dictionary, compound: String) -> String:
	var family = tyre_spec(snapshot, compound).get("family", "")
	return "I" if family == "intermediate" else ("W" if family == "wet" else "dry")
