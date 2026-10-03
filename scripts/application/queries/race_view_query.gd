class_name RaceViewQuery
extends RaceViewToolsQuery
## Public presentation facade; state, analysis and draft helpers have separate owners.


func _init(simulation: RaceSim) -> void:
	_source = weakref(simulation)
	_track = simulation.track.detached_copy()
	visuals = RaceVisualSource.new(simulation)
	charts = RaceChartQuery.new(simulation)


func available() -> bool:
	return _source.get_ref() != null


static func format_time(seconds: float) -> String:
	return RaceSim.format_time(seconds)


static func from_record(record: RaceRecord) -> RaceViewQuery:
	var source = record.source.get_ref() if record != null and record.source != null else null
	return RaceViewQuery.new(source) if source else null


func player_ids() -> Array:
	var source: RaceSim = _source.get_ref()
	return source.player_ids() if source != null else []


func teammate_id(id: int) -> int:
	var players = player_ids()
	return (
		players[1]
		if not players.is_empty() and players[0] == id
		else (players[0] if not players.is_empty() else -1)
	)


func player_labels() -> Array:
	return player_ids().map(func(id): return car(id).short + " · " + car(id).name)


func pit_box_occupant(id: int) -> int:
	var simulation = _source.get_ref() if _source != null else null
	if simulation == null or id < 0 or id >= simulation.cars.size():
		return -1
	return int(simulation.pit_boxes.get(simulation.cars[id].team_identity(), -1))


func public_rival_field() -> String:
	var source: RaceSim = _source.get_ref()
	if source == null:
		return "Rival field unavailable."
	return RivalStyles.public_field(
		source.rival_styles,
		source.cars,
		source.rival_state.stops,
		source.cars.map(func(c): return c.team_identity()),
		source.tuning.competition
	)


func tyre_info(compound: String) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return source.tyre_rules.spec(compound).duplicate(true) if source != null else {}


func compound_choices() -> Array:
	var source: RaceSim = _source.get_ref()
	if source == null:
		return []
	return source.tyre_rules.compounds().map(
		func(id):
			return {
				"id": id,
				"name": source.tyre_rules.spec(id).name,
				"short": source.tyre_rules.spec(id).short
			}
	)


func set_label(car: Dictionary, identity: String) -> String:
	return str(
		TyreInventory.find_in(car.get("tyre_sets", []), identity).get("label", "Unavailable set")
	)


func setup_profile() -> Dictionary:
	var source: RaceSim = _source.get_ref()
	if source == null:
		return {}
	return {
		"specs": source.setup_definition.specs().duplicate(true),
		"defaults": source.setup_definition.defaults().duplicate(true)
	}


func control_observation() -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return (
		WeekendRaceControl.public_view(
			source.control_state, source.total_time, source.tuning.operations.control
		)
		if source != null and source.enhanced()
		else {}
	)


func rival_profile_label(id: int) -> String:
	var source: RaceSim = _source.get_ref()
	if source == null or id < 0 or id >= source.cars.size() or source.rival_styles.is_empty():
		return "Rival profile unavailable"
	var style: String = source.rival_styles.drivers[id].style
	return str(
		RivalStyles.definitions(source.tuning.competition).get(style, {}).get(
			"label", "Classic rival"
		)
	)
