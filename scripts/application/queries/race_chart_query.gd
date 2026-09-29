class_name RaceChartQuery
extends RefCounted
## Read-only chart projections shared by retained diagnostic workspaces.
var _source: WeakRef

func _init(simulation: RaceSim) -> void:
	_source = weakref(simulation)

static func stints(simulation: RaceSim) -> Dictionary:
	var cars: Dictionary = {}
	for id in simulation.player_ids():
		var car: RaceCar = simulation.cars[id]
		cars[id] = {}
		for key in ["name", "short", "stints", "distance", "pit_stops", "finished", "dnf"]:
			cars[id][key] = RaceStateValue.copy(car[key])
	return {"cars": cars, "set_styles": set_styles(simulation), "player_ids": simulation.player_ids(), "laps": simulation.laps, "track": {"length": simulation.track.length}}

static func strategy(simulation: RaceSim, id: int, forecast: Dictionary, initial_set: String = "") -> Array:
	var car: RaceCar = simulation.cars[id]
	return [forecast.get("options", []).duplicate(true), simulation.laps,
		maxf(0, car.distance / simulation.track.length) if simulation.phase == "race" else 0.0,
		car.set_id if initial_set.is_empty() else initial_set, set_styles(simulation)]

func selected_stints() -> Dictionary:
	var simulation: RaceSim = _source.get_ref()
	if simulation == null:
		return {}
	var car: RaceCar = simulation.cars[simulation.selected_id]
	var items: Array = []
	for stint in car.stints:
		var fitted = TyreInventory.find(car, stint.set_id)
		items.append({"from": stint.from, "to": stint.to,
			"compound": fitted.get("compound", ""), "label": fitted.get("label", ""), "color": car.tyre_rules.spec(fitted.get("compound", "")).get("color", "9cae94")})
	return {"stints": items, "distance": car.distance, "scheduled_lap": car.scheduled_lap,
		"pit_gate": car.pit_gate, "laps": simulation.laps, "length": simulation.track.length}

func intentions() -> Dictionary:
	var simulation: RaceSim = _source.get_ref()
	if simulation == null:
		return {}
	var reading = stints(simulation)
	var lanes: Array = []
	for id in simulation.player_ids():
		var policy = simulation.policy(id)
		var items: Array = []
		for index in range(policy.plan.get("stops", []).size()):
			var stop: Dictionary = policy.plan.stops[index]
			var gate_fraction = simulation.track.pit_entry / simulation.track.length
			items.append({"kind": "pit", "from": stop.from_lap - 1 + gate_fraction,
				"to": stop.to_lap - 1 + gate_fraction, "set": stop.set_id,
				"past": index < policy.next_stop,
				"text": "Accepted window L%d–%d · %s · %s / owner %s" % [stop.from_lap,
					stop.to_lap, stop.set_id, "consumed" if index < policy.next_stop else policy.plan_status, policy.owners.pit]})
		for channel in ["pace", "engine"]:
			if not policy.overrides.has(channel):
				continue
			var intent: Dictionary = policy.overrides[channel]
			items.append({"kind": channel, "from": maxf(0, simulation.cars[id].distance / simulation.track.length),
				"to": intent.until_distance / simulation.track.length, "set": "", "past": false,
				"text": "Active %s override · value %d · until %.2f distance laps · handback to %s" % [channel,
					intent.value, intent.until_distance / simulation.track.length, policy.owners[channel]]})
		if items.is_empty():
			items.append({"kind": "none", "from": 0.0, "to": 0.0, "set": "", "past": false,
				"text": "No accepted windows or bounded overrides. Current owners: " + StrategyPlan.ownership_text(policy)})
		lanes.append(items)
	reading.lanes = lanes
	return reading

func surface(channel: String, station: int, lane: int) -> Dictionary:
	var simulation: RaceSim = _source.get_ref()
	if simulation == null:
		return {}
	station = clampi(station, 0, RaceSurface.STATIONS - 1)
	lane = clampi(lane, 0, RaceSurface.LANES - 1)
	var cell: Dictionary = simulation.surface[station].lanes[lane].duplicate(true)
	cell.grip = RaceSurface.grip(cell)
	cell.metres = (station + 0.5) * simulation.track.length / RaceSurface.STATIONS
	return {"cell": cell, "values": RaceVisualSource.new(simulation).surface_values(channel)}

static func set_styles(simulation: RaceSim) -> Dictionary:
	var styles: Dictionary = {}
	for car in simulation.cars:
		if not car.player: continue
		for item in car.tyre_sets:
			styles[item.id] = {"label": item.label, "color": car.tyre_rules.spec(item.compound).color}
	return styles
