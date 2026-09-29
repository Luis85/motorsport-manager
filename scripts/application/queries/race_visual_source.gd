class_name RaceVisualSource
extends RaceVisualPort
## Adapts the authoritative aggregate to a small detached render frame.
## No widgets, input, storage or wall clock; no reference to live cars escapes this adapter.
var _source: WeakRef

func _init(simulation: RaceSim) -> void:
	_source = weakref(simulation)

func capture() -> Dictionary:
	var simulation: RaceSim = _source.get_ref()
	if simulation == null:
		return {}
	var alpha = 1.0
	if simulation.phase in RaceSim.ACTIVE and not simulation.paused:
		alpha = clampf(simulation.accumulator / RaceSim.STEP, 0.0, 1.0)
	var cars: Array = []
	for car in simulation.cars:
		cars.append({
			"id": int(car.id), "short": str(car.short), "color": str(car.color),
			"dnf": bool(car.dnf), "finished": bool(car.finished), "blue": bool(car.blue),
			"position": simulation.car_position(car, alpha).p,
			"current_position": simulation.car_position(car).p,
		})
	var contest: Dictionary = {}
	if (simulation is RaceSim and simulation.has_mechanic("strategy")):
		var record = RaceContestReadModel.observed_contest(simulation, simulation.selected_id)
		if not record.is_empty():
			var first: Dictionary = cars[int(record.driver_id)]
			var second: Dictionary = cars[int(record.target_id)]
			contest = {
				"first": first.current_position, "second": second.current_position,
				"caption": "%s / %s · %s" % [first.short, second.short, str(record.phase).capitalize()],
			}
	return {
		"phase": simulation.phase, "clock": simulation.clock,
		"total_time": simulation.total_time, "selected_id": simulation.selected_id,
		"cars": cars, "contest": contest,
	}

func surface_values(channel: String) -> Array:
	var simulation: RaceSim = _source.get_ref()
	if simulation == null or channel not in ["water", "grip", "temperature", "rubber", "dust", "marbles", "oil", "debris"]:
		return []
	var values: Array = []
	for station in simulation.surface:
		var lanes: Array = []
		for cell in station.lanes:
			var value: float = cell.get(channel, 0.0)
			if channel == "grip":
				value = RaceSurface.grip(cell, simulation.tuning.environment.surface.grip) / simulation.tuning.environment.surface.grip.maximum
			elif channel == "temperature":
				value /= 60.0
			lanes.append(value)
		values.append(lanes)
	return values

func rejoin(forecast: Dictionary) -> Dictionary:
	var simulation: RaceSim = _source.get_ref()
	if not (simulation is RaceSim and simulation.has_mechanic("strategy")) or simulation.phase != "race" or forecast.is_empty():
		return {}
	var id = int(forecast.get("driver_id", -1))
	if id < 0 or id >= simulation.cars.size():
		return {}
	var car: RaceCar = simulation.cars[id]
	if car.route != "track" or car.finished or car.dnf:
		return {}
	if RaceForecaster.stale(simulation, forecast, int(simulation.policy(id).revision)):
		return {}
	var track = simulation.track
	var pit: Dictionary = forecast.pit
	var half_band = minf(track.length * 0.04, track.length / track.estimate * (pit.visit_high - pit.visit_low) * 0.5)
	var points = PackedVector2Array()
	for i in range(25):
		points.append(track.sample(track.pit_exit - half_band + half_band * 2 * i / 24.0).p)
	return {
		"centre": track.sample(track.pit_exit).p, "points": points,
		"label": "%s REJOIN ~P%d–%d" % [car.short, pit.position_low, pit.position_high],
	}

func detached_track() -> TrackGeometry:
	var simulation: RaceSim = _source.get_ref()
	return simulation.track.detached_copy() if simulation != null else null
