class_name PracticeEvidence
extends "res://scripts/domain/weekend/practice_evidence_validation.gd"


static func setup_for(car: RaceCar, baseline: String) -> Dictionary:
	var result = car.car_setup.duplicate()
	if not car.setup_definition.authored():
		if baseline == "balanced":
			return LegacySetupContent.DEFAULTS.duplicate()
		if baseline == "low_drag":
			result.wing = 2
			result.cooling = 4
		elif baseline == "stable_wet":
			result.wing = 7
			result.suspension = 3
			result.cooling = 6
		return result
	if baseline != "current":
		var values = car.setup_definition.baseline(baseline)
		if not values.is_empty():
			result = values
	return result


static func create(
	cars: Array, duration: float, status: String = "available", rules: Dictionary = {}
) -> Dictionary:
	if rules.is_empty():
		rules = RacePlanningBalance.defaults().practice
	var drivers: Array = []
	for car in cars:
		drivers.append(
			{
				"id": int(car.id),
				"revision": 0,
				"runs": [],
				"active": {},
				"next_release":
				rules.release_offset_seconds + car.id * rules.release_spacing_seconds
			}
		)
	return {
		"version": VERSION,
		"status": status,
		"duration": duration,
		"closed": false,
		"drivers": drivers
	}


static func state_key(state: Dictionary, car: RaceCar) -> String:
	return (
		JSON
		. stringify(
			[
				state.status,
				state.closed,
				state.drivers[int(car.id)].revision,
				car.route,
				car.set_id,
				car.next_set_id,
				car.car_setup,
				car.pace,
				car.engine
			]
		)
		. sha256_text()
	)


static func observation(sim: RaceSim, car: RaceCar) -> Dictionary:
	return {
		"time": sim.total_time,
		"distance": car.distance,
		"life": car.tyre,
		"fuel": car.fuel,
		"health": car.health,
		"temperature": car.engine_temperature,
		"water": sim.average(sim.water),
		"damage": car.damage,
		"wheels":
		WheelTyres.KEYS.map(func(key): return TyreInventory.find(car, car.set_id).wheels[key].life)
	}


static func prior(
	state: Dictionary, car: RaceCar, water: float, rules: Dictionary = {}
) -> Dictionary:
	if rules.is_empty():
		rules = RacePlanningBalance.defaults().practice
	# Never pool a rival's private measurements, nor transfer a teammate's skill/setup residual.
	var result: Dictionary = {}
	for compound in car.tyre_rules.compounds():
		var samples: Array = []
		for run in state.drivers[int(car.id)].runs:
			if (
				run.compound != compound
				or run.setup != car.car_setup
				or run.pace != car.pace
				or run.engine != car.engine
			):
				continue
			for lap in run.samples:
				if (
					lap.clean
					and absf(lap.water - water) <= rules.matching_water_tolerance
					and absf(lap.health - car.health) <= rules.matching_health_tolerance
					and absf(lap.damage - car.damage) <= rules.matching_damage_tolerance
				):
					samples.append(lap)
		if samples.is_empty():
			continue
		var wear = 0.0
		var pace = 0.0
		for lap in samples:
			wear += lap.wear_ratio
			pace += lap.model_ratio
		wear /= samples.size()
		pace /= samples.size()
		var spread = 0.0
		for lap in samples:
			spread = maxf(spread, absf(lap.model_ratio - pace))
		var weight = float(samples.size()) / (samples.size() + rules.prior_sample_weight)
		result[compound] = {
			"samples": samples.size(),
			"wear_factor":
			lerpf(
				1,
				clampf(wear, rules.prior_minimum_wear_factor, rules.prior_maximum_wear_factor),
				weight
			),
			"lap_factor":
			lerpf(
				1,
				clampf(pace, rules.prior_minimum_lap_factor, rules.prior_maximum_lap_factor),
				weight
			),
			"uncertainty":
			maxf(
				(
					rules.prior_reliable_uncertainty
					if samples.size() >= rules.prior_reliable_samples
					else rules.prior_base_uncertainty
				),
				spread + rules.prior_spread_allowance
			),
			"label":
			(
				"%d matching measured practice laps; bounded blend, not calibrated confidence"
				% samples.size()
			)
		}
	return result


static func describe(run: Dictionary) -> String:
	var n = run.samples.size()
	var title = (
		"%s · %s · %s · %d/%d measured laps"
		% [run.id, OBJECTIVES[run.objective], run.set_id, n, run.target]
	)
	var lines: Array[String] = [title, run.reason]
	var clean = run.samples.filter(func(lap): return lap.clean)
	if n > 0:
		var times = run.samples.map(func(lap): return lap.seconds)
		var wear = run.samples.map(func(lap): return lap.wear)
		(
			lines
			. append(
				(
					"Measured lap %.2f–%.2fs · average tread loss %.2f–%.2f points/lap · %d clean samples."
					% [times.min(), times.max(), wear.min(), wear.max(), clean.size()]
				)
			)
		)
		if run.objective == "qualifying":
			lines.append(
				"Practice flying laps do not set the qualifying grid. Banker-run evidence only."
			)
		elif run.objective == "wet":
			var wet = run.samples.map(func(lap): return lap.water)
			lines.append(
				(
					"Observed line water %.0f–%.0f%%. %s"
					% [
						wet.min() * 100,
						wet.max() * 100,
						(
							"No wet-condition evidence in this run."
							if wet.max() < 0.15
							else "Rainfall and surface water are different measurements."
						)
					]
				)
			)
		elif run.objective == "setup":
			(
				lines
				. append(
					"Compare only similar driver, tyre, fuel and water conditions. Faster observed laps do not isolate a setup effect."
				)
			)
		else:
			(
				lines
				. append(
					"Matching clean laps inform the tyre forecast. Wear can change with pace, water, damage or setup."
				)
			)
	if not run.get("end", {}).is_empty():
		(
			lines
			. append(
				(
					(
						"Run cost measured: %.2f tread points, %.2f fuel laps, %.2f health points; %.1fs "
						+ "elapsed. Tyre identity and all wear retained."
					)
					% [
						maxf(0, run.start.life - run.end.life),
						maxf(0, run.start.fuel - run.end.fuel),
						maxf(0, run.start.health - run.end.health),
						run.end.time - run.start.time
					]
				)
			)
		)
	if clean.is_empty():
		(
			lines
			. append(
				"No comparable clean full-lap sample: forecasts retain the baseline. Partial running is still recorded."
			)
		)
	return "\n".join(lines)


static func report(state: Dictionary, id: int) -> String:
	var runs = state.drivers[id].runs
	if runs.is_empty():
		return "No practice runs recorded. Skipping is viable: baseline estimates and normal delegation remain available."
	var lines: Array[String] = []
	for run in runs:
		lines.append(describe(run))
	if runs.size() >= 2:
		var a = runs[-2]
		var b = runs[-1]
		if not a.samples.is_empty() and not b.samples.is_empty():
			var ta = 0.0
			var tb = 0.0
			for lap in a.samples:
				ta += lap.seconds
			for lap in b.samples:
				tb += lap.seconds
			(
				lines
				. append(
					(
						(
							"Latest-run comparison: second minus first %+.2fs/lap (measured averages). Different "
							+ (
								"tyres, fuel, traffic, temperature and water may confound "
								+ "this difference. No perfect setup score or automatic "
								+ "change is applied."
							)
						)
						% [tb / b.samples.size() - ta / a.samples.size()]
					)
				)
			)
	(
		lines
		. append(
			(
				"Next decision: retain the proven configuration or schedule a complementary run. "
				+ "Apply any setup change explicitly; more laps are useful only when the conditions answer your question."
			)
		)
	)
	return "\n\n".join(lines)
