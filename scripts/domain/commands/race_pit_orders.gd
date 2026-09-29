class_name RacePitOrders
extends RefCounted
## Finite tyre selection and pit-order rules. Existing inventory and mechanic hooks remain authoritative.
## Empty error means accepted; the aggregate alone posts radio and appends history.
const ACTIONS = ["select_set", "schedule_pit", "cancel_schedule", "compound", "pit", "cancel_pit"]

static func apply(simulation: RaceSim, car: RaceCar, action: String, payload: Dictionary) -> String:
	match action:
		"select_set": return _select_set(simulation, car, payload)
		"schedule_pit": return _schedule_pit(simulation, car, payload)
		"cancel_schedule": return _cancel_schedule(car)
		"compound": return _compound(simulation, car, payload)
		"pit": return _pit(simulation, car)
		"cancel_pit": return _cancel_pit(car)
	return "Unknown command: " + action

static func _select_set(simulation: RaceSim, car: RaceCar, payload: Dictionary) -> String:
	if car.route == "pit": return "The tyre plan is locked until pit exit."
	var item = TyreInventory.find(car, str(payload.get("set_id", "")))
	if not WheelTyres.usable(item): return "That set is exhausted or does not belong to this driver."
	if simulation.phase == "race" and item.id == car.set_id: return "Choose a different set for the next stop."
	car.next_compound = item.compound; car.next_set_id = item.id
	return ""

static func _schedule_pit(simulation: RaceSim, car: RaceCar, payload: Dictionary) -> String:
	if simulation.phase != "race" or car.route != "track" or car.pit_order: return "Schedule an on-track car with no existing pit order."
	var lap = payload.get("lap", -1)
	if not RaceCheckpoint.integral(lap, 1, simulation.laps - 1): return "Choose a racing lap before the final lap."
	var gate = (int(lap) - 1) * simulation.track.length + simulation.track.pit_entry
	var stopping = maxf(0, car.speed ** 2 - simulation.track.pit_limit ** 2) / (2 * TrackGeometry.PRESETS[simulation.track.preset].brake * 0.5) + 12
	if gate - car.distance <= stopping: return "Too late for that lap's pit entry; choose a later lap."
	if TyreInventory.planned(car, true).is_empty(): return "No usable replacement set. Select another compound or set."
	car.scheduled_lap = int(lap); car.pit_gate = gate; car.pit_order = true; car.pit_deferred = false; car.auto = false
	return ""

static func _cancel_schedule(car: RaceCar) -> String:
	if car.scheduled_lap < 1 or car.route != "track": return "There is no cancellable scheduled stop."
	car.scheduled_lap = -1; car.pit_order = false; car.pit_gate = -1.0; car.pit_deferred = false
	return ""

static func _compound(simulation: RaceSim, car: RaceCar, payload: Dictionary) -> String:
	var value = str(payload.get("value", "M"))
	if not RaceSim.TYRES.has(value): return "Unknown tyre compound."
	if car.route == "pit": return "The tyre plan is locked until pit exit."
	if TyreInventory.choose(car, value, simulation.phase == "race").is_empty(): return "No usable set of that compound remains."
	car.next_compound = value; car.next_set_id = ""
	return ""

static func _pit(simulation: RaceSim, car: RaceCar) -> String:
	if simulation.phase != "race" or car.route != "track": return "Pit calls require a car racing on track."
	if TyreInventory.planned(car, true).is_empty(): return "No usable replacement set. Select another compound or set."
	car.scheduled_lap = -1; simulation.queue_pit(car); car.auto = false
	return ""

static func _cancel_pit(car: RaceCar) -> String:
	if car.route != "track": return "Already committed to the pit lane."
	car.pit_order = false; car.pit_gate = -1.0; car.pit_deferred = false; car.scheduled_lap = -1
	return ""
