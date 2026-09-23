class_name WheelTyres
extends RefCounted
## Native adaptation of prototype OMMTyres: condition belongs to four contact patches.
## Pressure is normalized to the cold reference, not a claimed bar/psi reading.
const KEYS = ["FL", "FR", "RL", "RR"]
const OPTIMUM = {"S": 84.0, "M": 89.0, "H": 94.0, "I": 73.0, "W": 65.0}

static func initialize(item: Dictionary) -> void:
	item.wheels = {}
	item.heat_cycles = 0; item.heated = false
	for key in KEYS:
		item.wheels[key] = {"life": float(item.life), "surface": float(item.temperature), "core": float(item.temperature), "pressure": 1.0, "load": 1.0, "grain": 0.0, "blister": 0.0, "flat": 0.0, "punctured": false}
	publish(item)

static func average(item: Dictionary, key: String) -> float:
	var value = 0.0
	for wheel in KEYS: value += item.wheels[wheel][key]
	return value * 0.25

static func publish(item: Dictionary) -> void:
	item.life = average(item, "life"); item.temperature = average(item, "surface")

static func adopt_aggregate(item: Dictionary) -> void:
	# Explicit adapter for old aggregate fixtures/imports; ordinary simulation uses publish.
	if not item.has("wheels"): initialize(item); return
	var life = average(item, "life"); var surface = average(item, "surface")
	if absf(item.life - life) > 0.000001:
		for wheel in KEYS: item.wheels[wheel].life = float(item.life)
	if absf(item.temperature - surface) > 0.000001:
		for wheel in KEYS:
			item.wheels[wheel].surface = float(item.temperature); item.wheels[wheel].core = float(item.temperature)

static func usable(item: Dictionary) -> bool:
	if item.is_empty() or item.life <= 1: return false
	if item.has("wheels"):
		for key in KEYS:
			if item.wheels[key].punctured or item.wheels[key].life <= 0: return false
	return true

static func grip_wheel(w: Dictionary, compound: String) -> float:
	var optimum = OPTIMUM[compound]
	var thermal = clampf(1 - maxf(0, absf(w.surface - optimum) - 14) * 0.005 - maxf(0, optimum - 19 - w.core) * 0.003, 0.66, 1)
	var tread = clampf(1 - (100 - w.life) * 0.0012 - maxf(0, 25 - w.life) ** 2 * 0.00032, 0.5, 1)
	return thermal * tread * clampf(1 - w.grain * 0.0022 - w.blister * 0.0032 - w.flat * 0.0025, 0.52, 1) * (0.38 if w.punctured else 1.0)

static func grip(item: Dictionary) -> float:
	var total = 0.0
	for key in KEYS: total += grip_wheel(item.wheels[key], item.compound)
	return total / 4.0

static func update(item: Dictionary, input: Dictionary, dt: float) -> void:
	var optimum = OPTIMUM[item.compound]
	var corner = clampf(input.speed * input.speed * absf(input.curve) / 25.0, 0, 1.5)
	var moving: bool = input.speed > 1
	for key in KEYS:
		var w = item.wheels[key]; var front: bool = key[0] == "F"
		var outside = 1.0 if (key[1] == "L") == (input.curve < 0) else -1.0
		var axle = 1 + (input.bias - 0.56) * (3 if front else -3) + (input.brake * 0.15 if front else input.throttle * 0.10)
		w.load = clampf(axle * (1 + outside * corner * 0.22), 0.55, 1.7)
		var slide = clampf(input.slip + (input.brake * 0.11 if front else input.throttle * 0.10) + maxf(0, optimum - 15 - w.core) * 0.005, 0, 1.5)
		var target = 24.0
		if moving:
			target = (69.0 if input.neutral else 76 + corner * 19 + 14 * (input.push - 1) + slide * 23 + (input.brake * 12 if front else input.throttle * 8)) - input.water * 24
		w.surface = clampf(lerpf(w.surface, target, 1 - exp(-dt * (0.085 if moving else 0.018))), 0, 160)
		w.core = clampf(lerpf(w.core, w.surface, 1 - exp(-dt * 0.021)), 0, 155)
		w.pressure = clampf(1 + (w.core - 65) * 0.003, 0.8, 1.32)
		var grain = maxf(0, optimum - 12 - w.core) * slide * 0.0028 * (1 + (100 - input.care) * 0.009) if moving else 0.0
		var cleaning = dt * 0.017 if moving and w.core > optimum - 17 and w.core < optimum + 18 else 0.0
		w.grain = clampf(w.grain + grain * dt - cleaning, 0, 100)
		w.blister = clampf(w.blister + maxf(0, w.core - optimum - 20) * slide * dt * 0.009, 0, 100)
		w.life = maxf(0, w.life - input.wear * w.load * (1 + w.grain * 0.0015 + w.blister * 0.0035 + w.flat * 0.002))
		if w.punctured: w.life = maxf(0, w.life - input.lap * 20)
	item.laps += input.lap
	var core = average(item, "core")
	if core > optimum - 12 and not item.heated: item.heated = true; item.heat_cycles += 1
	if core < 45: item.heated = false
	publish(item)

static func cool(item: Dictionary, dt: float) -> void:
	adopt_aggregate(item)
	for key in KEYS:
		var w = item.wheels[key]
		w.surface = lerpf(w.surface, 24, 1 - exp(-dt * 0.012))
		w.core = lerpf(w.core, w.surface, 1 - exp(-dt * 0.006))
		w.pressure = clampf(1 + (w.core - 65) * 0.003, 0.8, 1.32)
	if average(item, "core") < 45: item.heated = false
	publish(item)

static func lockup(item: Dictionary, bias: float, severity: float) -> String:
	var key = "FL" if bias >= 0.56 else "RL"
	item.wheels[key].flat = clampf(item.wheels[key].flat + severity, 0, 100)
	item.wheels[key].surface = minf(160, item.wheels[key].surface + 8)
	publish(item)
	return key

static func valid(item: Dictionary) -> bool:
	if not item.get("wheels") is Dictionary or item.wheels.size() != 4: return false
	if not RaceCheckpoint.integral(item.get("heat_cycles"), 0, 100000) or not item.get("heated") is bool: return false
	for key in KEYS:
		var w = item.wheels.get(key)
		if not w is Dictionary: return false
		for field in ["life", "grain", "blister", "flat"]:
			if not TrackDocument.valid_number(w.get(field), 0, 100): return false
		for field in ["surface", "core"]:
			if not TrackDocument.valid_number(w.get(field), 0, 200): return false
		if not TrackDocument.valid_number(w.get("pressure"), 0.5, 2) or not TrackDocument.valid_number(w.get("load"), 0, 4) or not w.get("punctured") is bool: return false
	return absf(item.life - average(item, "life")) < 0.00001 and absf(item.temperature - average(item, "surface")) < 0.00001
