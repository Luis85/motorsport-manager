class_name RaceDriverOrders
extends RefCounted
## Existing driver modes, garage setup and qualifying run orders. No history owner.
## Empty error means accepted; the aggregate alone posts radio and appends history.
const ACTIONS = ["pace", "engine", "repair", "auto", "send", "recall", "setup", "setup_all", "brake_bias", "battle_mode"]

static func apply(simulation: RaceSimPort, car: RaceCar, action: String, payload: Dictionary) -> String:
	match action:
		"pace", "engine": return _pace(car, action, payload)
		"repair": return _repair(car, payload)
		"auto": return _auto(car, payload)
		"send": return _send(simulation, car)
		"recall": return _recall(simulation, car)
		"setup", "setup_all": return _setup(simulation, car, action, payload)
		"brake_bias": return _brake_bias(simulation, car, payload)
		"battle_mode": return _battle_mode(car, payload)
	return "Unknown command: " + action

static func _pace(car: RaceCar, action: String, payload: Dictionary) -> String:
	if not RaceCheckpoint.integral(payload.get("value", 1), 0, 2): return "Invalid driving mode."
	var value = int(payload.get("value", 1))
	car[action] = value; car.auto = false
	return ""

static func _repair(car: RaceCar, payload: Dictionary) -> String:
	if not payload.get("value", true) is bool: return "Choose an explicit repair state."
	car.repair = payload.get("value", true)
	return ""

static func _auto(car: RaceCar, payload: Dictionary) -> String:
	if not payload.get("value", not car.auto) is bool: return "Choose an explicit delegation state."
	car.auto = payload.get("value", not car.auto)
	return ""

static func _send(simulation: RaceSimPort, car: RaceCar) -> String:
	if simulation.phase != "qualifying" or simulation.qual_closed or car.route != "garage": return "Garage release unavailable."
	if TyreInventory.planned(car).is_empty(): return "No usable set selected for this run."
	simulation.leave_garage(car)
	return ""

static func _recall(simulation: RaceSimPort, car: RaceCar) -> String:
	if simulation.phase != "qualifying" or car.route != "track": return "Only an on-track qualifying car can be recalled."
	car.qual_state = "inlap"; car.hot_valid = false; car.invalid_reason = "Recalled by the pit wall"
	return ""

static func _setup(simulation: RaceSimPort, car: RaceCar, action: String, payload: Dictionary) -> String:
	if simulation.phase not in ["briefing", "race_preparation"] and not (simulation.is_run_session() and car.route == "garage"): return "Mechanical setup changes require the garage or race preparation."
	var changes = {"wing": payload.get("value", simulation.setup_definition.defaults().wing)} if action == "setup" else payload.get("values", {})
	if not changes is Dictionary or changes.is_empty(): return "Choose at least one setup adjustment."
	for key in changes:
		if not simulation.setup_definition.specs().has(key) or not RaceCheckpoint.integral(changes[key], simulation.setup_definition.specs()[key][0], simulation.setup_definition.specs()[key][1]): return "Setup value is outside the available range."
	for key in changes: car.car_setup[key] = int(changes[key])
	car.setup = car.car_setup.wing
	return ""

static func _brake_bias(simulation: RaceSimPort, car: RaceCar, payload: Dictionary) -> String:
	if simulation.phase != "race" or car.route != "track": return "Live brake bias is available on the racing track."
	if not RaceCheckpoint.integral(payload.get("value"), simulation.setup_definition.specs().bias[0], simulation.setup_definition.specs().bias[1]): return "Brake bias is outside the selected setup profile."
	car.car_setup.bias = int(payload.value)
	return ""

static func _battle_mode(car: RaceCar, payload: Dictionary) -> String:
	if payload.get("value") not in ["patient", "balanced", "assertive"]: return "Choose patient, balanced or assertive racecraft."
	car.battle_mode = payload.value
	return ""
