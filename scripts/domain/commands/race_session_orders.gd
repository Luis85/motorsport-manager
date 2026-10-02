class_name RaceSessionOrders
extends RefCounted
## Session approvals and clock controls. Aggregate owns validation and recording.
## Empty error means accepted; the aggregate alone posts radio and appends history.
const ACTIONS = ["qualify", "close_qualifying", "prepare_race", "formation", "lights", "pause", "speed"]

static func apply(simulation: RaceSimFoundation, action: String, payload: Dictionary) -> String:
	match action:
		"qualify": return _qualify(simulation)
		"close_qualifying": return _close_qualifying(simulation)
		"prepare_race": return _prepare_race(simulation)
		"formation": return _formation(simulation)
		"lights": return _lights(simulation)
		"pause": return _pause(simulation)
		"speed": return _speed(simulation, payload)
	return "Unknown command: " + action

static func _qualify(simulation: RaceSimFoundation) -> String:
	if simulation.phase != "briefing": return "Qualifying is only available at the briefing."
	simulation.transition("qualifying")
	for car in simulation.cars:
		car.route = "garage"
		if car.auto: car.next_compound = simulation.tyre_rules.qualifying_start(simulation.average(simulation.water)); car.next_set_id = ""
	return ""

static func _close_qualifying(simulation: RaceSimFoundation) -> String:
	if simulation.phase != "qualifying" or simulation.qual_closed: return "Qualifying is not open."
	simulation.qual_closed = true; simulation.post("flag", "Qualifying chequered: active flying laps may finish; no new runs.")
	return ""

static func _prepare_race(simulation: RaceSimFoundation) -> String:
	if simulation.phase not in ["briefing", "qualifying_results"]: return "Finish the current session first."
	simulation.transition("race_preparation")
	for car in simulation.cars:
		car.route = "track"; car.distance = -(car.grid - 1) * simulation.track.grid_spacing; car.previous_distance = car.distance
		car.lane = (-1 if car.grid % 2 else 1) * 2.0
		car.next_compound = simulation.recommended_compound(); car.next_set_id = ""
		car.fuel = simulation.tuning.race_fuel(simulation.laps); car.stints.clear(); car.scheduled_lap = -1
		car.last_lap = 0.0; car.best_lap = 0.0; car.lap_start = 0.0; car.pit_lap = false
		car.sectors = [0.0, 0.0, 0.0]; car.sector_start = 0.0; car.yield_to = -1; car.yield_side = 0.0; car.blue = false
	return ""

static func _formation(simulation: RaceSimFoundation) -> String:
	if simulation.phase != "race_preparation": return "Prepare the race before formation."
	for car in simulation.cars:
		if TyreInventory.planned(car).is_empty(): return car.short + ": select a usable starting set before formation."
	for car in simulation.cars:
		var item = TyreInventory.planned(car); TyreInventory.mount(car, item.id)
		car.next_set_id = ""; car.formation_done = false; car.speed = 0.0; car.pit_order = false
	simulation.transition("formation")
	return ""

static func _lights(simulation: RaceSimFoundation) -> String:
	if simulation.phase != "grid_ready": return "All cars must complete formation first."
	simulation.transition("lights")
	return ""

static func _pause(simulation: RaceSimFoundation) -> String:
	if simulation.phase not in RaceSimFoundation.ACTIVE: return "No live session to pause."
	simulation.paused = not simulation.paused
	return ""

static func _speed(simulation: RaceSimFoundation, payload: Dictionary) -> String:
	if not RaceCheckpoint.integral(payload.get("value", 1), 1, 16): return "Invalid simulation speed."
	var value = int(payload.get("value", 1))
	if value not in [1, 2, 4, 8, 16]: return "Invalid simulation speed."
	simulation.speed = value
	return ""
