class_name TyreInventory
extends RefCounted
## Twelve driver-owned sets, matching the prototype allocation. Aggregate thermal model.
## Condition belongs to the set: remounting never repairs tread or resets temperature.
const ALLOCATION = {"S": 3, "M": 3, "H": 2, "I": 2, "W": 2}

static func initialize(car: Dictionary) -> void:
	car.tyre_sets = []
	for compound in ALLOCATION:
		for i in range(ALLOCATION[compound]):
			var label = compound + str(i + 1)
			car.tyre_sets.append({"id": str(int(car.id)) + "-" + label, "label": label, "compound": compound, "life": 100.0, "temperature": 65.0, "laps": 0.0, "mounts": 0, "used": false})
	car.set_id = str(int(car.id)) + "-" + car.compound + "1"
	car.next_set_id = ""; car.service_set_id = ""; car.scheduled_lap = -1; car.stints = []
	var mounted = find(car, car.set_id)
	mounted.life = car.tyre; mounted.temperature = car.temperature; mounted.mounts = 1; mounted.used = true

static func find(car: Dictionary, id: String) -> Dictionary:
	for item in car.get("tyre_sets", []):
		if item.id == id: return item
	return {}

static func sync(car: Dictionary, distance_laps: float = 0.0) -> void:
	var item = find(car, car.get("set_id", ""))
	if item.is_empty() or item.compound != car.compound: return
	item.life = car.tyre; item.temperature = car.temperature; item.laps += maxf(0, distance_laps)

static func choose(car: Dictionary, compound: String, exclude_mounted: bool = false) -> Dictionary:
	var best: Dictionary = {}
	for item in car.get("tyre_sets", []):
		if item.compound != compound or item.life <= 1 or exclude_mounted and item.id == car.set_id: continue
		if best.is_empty() or item.life > best.life or item.life == best.life and item.mounts < best.mounts: best = item
	return best

static func planned(car: Dictionary, exclude_mounted: bool = false) -> Dictionary:
	if not car.next_set_id.is_empty():
		var item = find(car, car.next_set_id)
		if item.is_empty() or item.compound != car.next_compound or item.life <= 1 or exclude_mounted and item.id == car.set_id: return {}
		return item
	return choose(car, car.next_compound, exclude_mounted)

static func mount(car: Dictionary, id: String) -> bool:
	sync(car)
	var item = find(car, id)
	if item.is_empty() or item.life <= 1: return false
	if car.set_id != id: item.mounts += 1; item.used = true
	car.set_id = id; car.compound = item.compound; car.tyre = item.life; car.temperature = item.temperature
	return true

static func cool_spares(car: Dictionary, dt: float) -> void:
	for item in car.tyre_sets:
		if item.id != car.set_id: item.temperature = lerpf(item.temperature, 24.0, minf(1, dt * 0.006))

static func valid(car: Dictionary, laps: int) -> bool:
	for key in ["compound", "next_compound", "pit_stage", "service_compound"]:
		if not car.get(key) is String: return false
	if not TrackDocument.valid_number(car.get("tyre"), 0, 100) or not TrackDocument.valid_number(car.get("temperature"), 0, 200): return false
	if not car.get("tyre_sets") is Array or car.tyre_sets.size() != 12: return false
	if not car.get("set_id") is String or not car.get("next_set_id") is String or not car.get("service_set_id") is String: return false
	if not RaceCheckpoint.integral(car.get("scheduled_lap"), -1, laps - 1) or car.scheduled_lap == 0: return false
	if car.scheduled_lap > 0 and (car.get("pit_order") != true or car.get("route") not in ["track", "pit"] or not TrackDocument.valid_number(car.get("pit_gate"), 0, 100000000)): return false
	var expected: Array[String] = []
	for compound in ALLOCATION:
		for i in range(ALLOCATION[compound]): expected.append(str(int(car.id)) + "-" + compound + str(i + 1))
	for index in range(12):
		var item = car.tyre_sets[index]
		if not item is Dictionary or item.get("id") != expected[index]: return false
		if item.get("label") != expected[index].get_slice("-", 1) or item.get("compound") != item.get("label", "").left(1): return false
		if not TrackDocument.valid_number(item.get("life"), 0, 100) or not TrackDocument.valid_number(item.get("temperature"), 0, 200): return false
		if not TrackDocument.valid_number(item.get("laps"), 0, 10000) or not RaceCheckpoint.integral(item.get("mounts"), 0, 100000) or not item.get("used") is bool: return false
	if car.set_id not in expected or not car.next_set_id.is_empty() and car.next_set_id not in expected or not car.service_set_id.is_empty() and car.service_set_id not in expected: return false
	var current = find(car, car.set_id)
	if current.compound != car.compound or absf(current.life - car.tyre) > 0.00001 or absf(current.temperature - car.temperature) > 0.00001: return false
	if not car.next_set_id.is_empty() and find(car, car.next_set_id).compound != car.next_compound: return false
	if car.pit_stage == "service" and not car.service_set_id.is_empty() and find(car, car.service_set_id).compound != car.service_compound: return false
	if not car.get("stints") is Array or car.stints.size() > 110: return false
	for stint in car.stints:
		if not stint is Dictionary or stint.get("set_id") not in expected or not TrackDocument.valid_number(stint.get("from"), 0, 102) or not TrackDocument.valid_number(stint.get("to"), -1, 102): return false
		if stint.to != -1 and stint.to < stint.from: return false
	return true
