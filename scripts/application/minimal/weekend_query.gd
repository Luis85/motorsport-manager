class_name MinimalWeekendQuery
extends RefCounted
## Produces the shipping screen's detached read model at its own refresh cadence.
## No authority, live car dictionaries, inventory resources or simulation methods escape.
var _source: WeakRef

func _init(simulation: RaceSim) -> void:
	_source = weakref(simulation)

func capture() -> Dictionary:
	var simulation: RaceSim = _source.get_ref()
	if simulation == null:
		return {}
	var cars: Array = []
	var readouts: Dictionary = {}
	for car in simulation.cars:
		var identity: Dictionary = {}
		for key in ["id", "short", "name", "number", "color", "player", "pace", "engine", "dnf", "finished", "retire_reason"]:
			identity[key] = car[key]
		identity.state = MinimalRaceTiming.state(simulation, car)
		cars.append(identity)
		if car.player:
			readouts[car.id] = MinimalDriverReadout.capture(simulation, car.id)
	return {
		"phase": simulation.phase, "active": simulation.phase in RaceSim.ACTIVE,
		"paused": simulation.paused, "speed": simulation.speed, "clock": simulation.clock,
		"qual_duration": simulation.qual_duration, "qual_closed": simulation.qual_closed,
		"practice_state": {"duration": simulation.practice_state.duration, "closed": simulation.practice_state.closed},
		"laps": simulation.laps, "flag": simulation.flag,
		"track": {"document": {"name": simulation.track.document.name}, "length": simulation.track.length},
		"leader_distance": simulation.standings()[0].distance,
		"cars": cars, "timing_rows": MinimalRaceTiming.rows(simulation), "readouts": readouts,
	}


func strategy_comparison(driver_id: int) -> Dictionary:
	var simulation: RaceSim = _source.get_ref()
	if simulation == null or simulation.phase != "race" or driver_id < 0 or driver_id >= simulation.cars.size(): return {}
	var car = simulation.cars[driver_id]
	if not car.player or car.dnf or car.finished: return {}
	return simulation.forecast(driver_id).duplicate(true)
