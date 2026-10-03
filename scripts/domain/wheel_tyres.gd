class_name WheelTyres
extends RefCounted
## Native adaptation of prototype OMMTyres: condition belongs to four contact patches.
## Pressure is normalized to the cold reference, not a claimed bar/psi reading.
const KEYS = ["FL", "FR", "RL", "RR"]
const OPTIMUM = LegacyTyreContent.OPTIMUM


static func initialize(item: Dictionary) -> void:
	item.wheels = {}
	item.heat_cycles = 0
	item.heated = false
	for key in KEYS:
		item.wheels[key] = {
			"life": float(item.life),
			"surface": float(item.temperature),
			"core": float(item.temperature),
			"pressure": 1.0,
			"load": 1.0,
			"grain": 0.0,
			"blister": 0.0,
			"flat": 0.0,
			"punctured": false
		}
	publish(item)


static func average(item: Dictionary, key: String) -> float:
	var value = 0.0
	for wheel in KEYS:
		value += item.wheels[wheel][key]
	return value * 0.25


static func publish(item: Dictionary) -> void:
	item.life = average(item, "life")
	item.temperature = average(item, "surface")


static func adopt_aggregate(item: Dictionary) -> void:
	# Explicit adapter for old aggregate fixtures/imports; ordinary simulation uses publish.
	if not item.has("wheels"):
		initialize(item)
		return
	var life = average(item, "life")
	var surface = average(item, "surface")
	if absf(item.life - life) > 0.000001:
		for wheel in KEYS:
			item.wheels[wheel].life = float(item.life)
	if absf(item.temperature - surface) > 0.000001:
		for wheel in KEYS:
			item.wheels[wheel].surface = float(item.temperature)
			item.wheels[wheel].core = float(item.temperature)


static func usable(item: Dictionary) -> bool:
	if item.is_empty() or item.life <= 1:
		return false
	if item.has("wheels"):
		for key in KEYS:
			if item.wheels[key].punctured or item.wheels[key].life <= 0:
				return false
	return true


static func grip_wheel(w: Dictionary, compound: String, parameters: Dictionary = {}) -> float:
	var p = parameters if not parameters.is_empty() else RaceTyreRules.legacy().spec(compound)
	var t: Dictionary = p.thermal
	var optimum: float = p.optimum
	var thermal = clampf(
		(
			1
			- maxf(0, absf(w.surface - optimum) - t.working_band_c) * t.surface_grip_loss_per_c
			- maxf(0, optimum - t.core_grip_offset_c - w.core) * t.core_grip_loss_per_c
		),
		t.minimum_thermal_grip,
		1
	)
	var tread = clampf(
		(
			1
			- (100 - w.life) * t.tread_loss_per_percent
			- maxf(0, t.tread_cliff_percent - w.life) ** 2 * t.tread_cliff_quadratic
		),
		t.minimum_tread_grip,
		1
	)
	return (
		thermal
		* tread
		* clampf(
			(
				1
				- w.grain * t.grain_grip_loss
				- w.blister * t.blister_grip_loss
				- w.flat * t.flat_grip_loss
			),
			t.minimum_damage_grip,
			1
		)
		* (t.puncture_grip if w.punctured else 1.0)
	)


static func grip(item: Dictionary, parameters: Dictionary = {}) -> float:
	var total = 0.0
	for key in KEYS:
		total += grip_wheel(item.wheels[key], item.compound, parameters)
	return total / 4.0


static func update(
	item: Dictionary, input: Dictionary, dt: float, parameters: Dictionary = {}
) -> void:
	var p = parameters if not parameters.is_empty() else RaceTyreRules.legacy().spec(item.compound)
	var t: Dictionary = p.thermal
	var operating: Dictionary = p.get("operating", TyreOperatingSchema.LEGACY)
	var optimum: float = p.optimum
	var corner = clampf(
		input.speed * input.speed * absf(input.curve) / t.corner_acceleration_scale_mps2,
		0,
		operating.corner_saturation
	)
	var moving: bool = input.speed > operating.moving_threshold_mps
	for key in KEYS:
		var w = item.wheels[key]
		var front: bool = key[0] == "F"
		var outside = 1.0 if (key[1] == "L") == (input.curve < 0) else -1.0
		var axle = (
			1
			+ (
				(input.bias - operating.reference_brake_bias)
				* (t.brake_bias_load_gain if front else -t.brake_bias_load_gain)
			)
			+ (input.brake * t.brake_load_gain if front else input.throttle * t.throttle_load_gain)
		)
		w.load = clampf(
			axle * (1 + outside * corner * t.lateral_load_gain),
			operating.minimum_load,
			operating.maximum_load
		)
		var slide = clampf(
			(
				input.slip
				+ (
					input.brake * t.brake_slide_gain
					if front
					else input.throttle * t.throttle_slide_gain
				)
				+ maxf(0, optimum - t.cold_slide_offset_c - w.core) * t.cold_slide_gain
			),
			0,
			operating.slide_saturation
		)
		var target: float = t.ambient_c
		if moving:
			target = (
				(
					t.neutral_target_c
					if input.neutral
					else (
						t.moving_target_c
						+ corner * t.corner_heat_gain
						+ t.pace_heat_gain * (input.push - 1)
						+ slide * t.slide_heat_gain
						+ (
							input.brake * t.brake_heat_gain
							if front
							else input.throttle * t.throttle_heat_gain
						)
					)
				)
				- input.water * t.water_cooling_gain
			)
		w.surface = clampf(
			lerpf(
				w.surface,
				target,
				(
					1
					- exp(
						(
							-dt
							* (
								t.moving_surface_rate_per_s
								if moving
								else t.stopped_surface_rate_per_s
							)
						)
					)
				)
			),
			0,
			operating.surface_limit_c
		)
		w.core = clampf(
			lerpf(w.core, w.surface, 1 - exp(-dt * t.core_rate_per_s)), 0, operating.core_limit_c
		)
		w.pressure = clampf(
			1 + (w.core - t.cold_c) * t.pressure_gain_per_c,
			operating.minimum_pressure,
			operating.maximum_pressure
		)
		var grain = (
			(
				maxf(0, optimum - t.grain_offset_c - w.core)
				* slide
				* t.grain_rate
				* (1 + (100 - input.care) * t.care_grain_gain)
			)
			if moving
			else 0.0
		)
		var cleaning = (
			dt * t.clean_rate_per_s
			if (
				moving
				and w.core > optimum - t.clean_lower_offset_c
				and w.core < optimum + t.clean_upper_offset_c
			)
			else 0.0
		)
		w.grain = clampf(w.grain + grain * dt - cleaning, 0, 100)
		w.blister = clampf(
			(
				w.blister
				+ maxf(0, w.core - optimum - t.blister_offset_c) * slide * dt * t.blister_rate
			),
			0,
			100
		)
		w.life = maxf(
			0,
			(
				w.life
				- (
					input.wear
					* w.load
					* (
						1
						+ w.grain * t.grain_wear_gain
						+ w.blister * t.blister_wear_gain
						+ w.flat * t.flat_wear_gain
					)
				)
			)
		)
		if w.punctured:
			w.life = maxf(0, w.life - input.lap * t.puncture_wear_per_lap)
	item.laps += input.lap
	var core = average(item, "core")
	if core > optimum - t.heat_cycle_offset_c and not item.heated:
		item.heated = true
		item.heat_cycles += 1
	if core < t.heat_cycle_reset_c:
		item.heated = false
	publish(item)


static func cool(item: Dictionary, dt: float, parameters: Dictionary = {}) -> void:
	adopt_aggregate(item)
	var p = parameters if not parameters.is_empty() else RaceTyreRules.legacy().spec(item.compound)
	var t: Dictionary = p.thermal
	var operating: Dictionary = p.get("operating", TyreOperatingSchema.LEGACY)
	for key in KEYS:
		var w = item.wheels[key]
		w.surface = lerpf(w.surface, t.ambient_c, 1 - exp(-dt * t.spare_surface_rate_per_s))
		w.core = lerpf(w.core, w.surface, 1 - exp(-dt * t.spare_core_rate_per_s))
		w.pressure = clampf(
			1 + (w.core - t.cold_c) * t.pressure_gain_per_c,
			operating.minimum_pressure,
			operating.maximum_pressure
		)
	if average(item, "core") < t.heat_cycle_reset_c:
		item.heated = false
	publish(item)


static func lockup(
	item: Dictionary, bias: float, severity: float, parameters: Dictionary = {}
) -> String:
	var p = parameters if not parameters.is_empty() else RaceTyreRules.legacy().spec(item.compound)
	var operating: Dictionary = p.get("operating", TyreOperatingSchema.LEGACY)
	var key = "FL" if bias >= operating.lockup_front_bias else "RL"
	item.wheels[key].flat = clampf(item.wheels[key].flat + severity, 0, 100)
	item.wheels[key].surface = minf(
		operating.surface_limit_c, item.wheels[key].surface + p.thermal.lockup_heat_c
	)
	publish(item)
	return key


static func valid(item: Dictionary) -> bool:
	if not item.get("wheels") is Dictionary or item.wheels.size() != 4:
		return false
	if (
		not RaceCheckpoint.integral(item.get("heat_cycles"), 0, 100000)
		or not item.get("heated") is bool
	):
		return false
	for key in KEYS:
		var w = item.wheels.get(key)
		if not w is Dictionary:
			return false
		for field in ["life", "grain", "blister", "flat"]:
			if not TrackDocument.valid_number(w.get(field), 0, 100):
				return false
		for field in ["surface", "core"]:
			if not TrackDocument.valid_number(w.get(field), 0, 200):
				return false
		if (
			not TrackDocument.valid_number(w.get("pressure"), 0.5, 2)
			or not TrackDocument.valid_number(w.get("load"), 0, 4)
			or not w.get("punctured") is bool
		):
			return false
	return (
		absf(item.life - average(item, "life")) < 0.00001
		and absf(item.temperature - average(item, "surface")) < 0.00001
	)
