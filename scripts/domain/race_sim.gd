class_name RaceSim
extends "res://scripts/domain/race_sim_practice_dispatch.gd"


func _init(
	geometry: TrackGeometry = null, options: Dictionary = {}, roster: RosterDefinition = null
) -> void:
	if roster != null:
		options = options.duplicate(true)
		options.roster_definition = roster.to_snapshot()
	mechanics = RaceMechanics.new(self)
	if geometry == null:
		return
	track = (
		TrackGeometry.new(
			geometry.document,
			geometry.preset,
			false,
			geometry.vehicle_definition if not geometry.authored_vehicle().is_empty() else null
		)
		if geometry.preview_only
		else geometry.detached_copy()
	)
	if not _configure_session_definitions(options):
		return
	laps = clampi(int(options.get("laps", 12)), 1, 100)
	qual_duration = maxf(
		float(options.get("qual_duration", 480)),
		track.estimate * tuning.sessions.qualifying_reference_laps
	)
	scenario = options.get("scenario", "changeable")
	weather_name = "Steady rain" if scenario == "wet" else "Clear skies"
	intensity = options.get("intensity", "standard")
	seed_value = int(options.get("seed", 7314)) & 0xffffffff
	rng_state = seed_value
	for i in range(RaceSurface.STATIONS):
		water.append(
			(
				tuning.environment.surface.initial.wet_water
				if scenario == "wet"
				else tuning.environment.surface.initial.dry_water
			)
		)
		rubber.append(tuning.environment.surface.initial.rubber)
	surface = RaceSurface.create(track, water, rubber, tuning.environment.surface)
	if not _configure_entrants(options):
		return
	if options.has("performance_profiles"):
		var error = RacePerformanceProfile.validate_set(options.performance_profiles, cars.size())
		if not error.is_empty():
			last_error = error
			return
		performance_profiles = options.performance_profiles.duplicate(true)
	post("weekend", "%s · %d racing laps · %s" % [track.document.name, laps, track.preset])


static func restore(data: Dictionary) -> RaceSim:
	data = RaceCheckpoint.prepare_base(data, CAR_V2, TYRES)
	if data.is_empty():
		return null
	if not RaceSurface.valid(data.get("surface"), data.water, data.rubber):
		return null
	if not TrackDocument.valid_number(data.get("surface_accumulator"), 0, RaceSurface.INTERVAL):
		return null
	if not RaceCheckpoint.valid(data):
		return null
	var definition: VehicleDefinition
	if data.has("vehicle_definition"):
		definition = VehicleDefinition.from_record(data.vehicle_definition)
	var sim = RaceSim.new(
		TrackGeometry.new(data.track, data.get("vehicle", "Formula"), false, definition),
		RaceContentSnapshot.options(data)
	)
	if not _valid_restored_cars(sim, data):
		return null
	if not _restore_aggregate_values(sim, data):
		return null
	if sim.speed not in [1, 2, 4, 8, 16] or sim.laps < 1 or sim.laps > 100:
		return null
	sim.cars.clear()
	for record in data.cars:
		var car = RaceCar.from_record(record)
		if car == null:
			return null
		if sim.roster_definition != null:
			car.entry_definition = sim.roster_definition.entrant(car.id)
		car.tyre_rules = sim.tyre_rules
		car.setup_definition = sim.setup_definition
		sim.cars.append(car)
	return sim


## Stable aggregate entry points; providers are resolved once at construction.


func command(action: String, payload: Dictionary = {}) -> bool:
	# Validate before copying, provider execution or accepted-input recording.
	# Cyclic collections and engine Objects are not command/replay values.
	if not RaceStateValue.serializable(payload):
		return fail(
			"Command payload must contain finite serialized values within the record bounds."
		)
	return mechanics.invoke("command", [action, payload.duplicate(true)])


func weather_observation() -> Dictionary:
	return mechanics.invoke("weather_observation", [])


func weather_outlook() -> Dictionary:
	return mechanics.invoke("weather_outlook", [])


func weather_advice(id: int) -> Dictionary:
	return mechanics.invoke("weather_advice", [id])


func weather_stale(advice: Dictionary) -> bool:
	return mechanics.invoke("weather_stale", [advice])


func update_surface() -> void:
	mechanics.invoke("update_surface", [])


func weather_issue(id: int) -> String:
	return mechanics.invoke("weather_issue", [id])


func weather_debrief() -> String:
	return mechanics.invoke("weather_debrief", [])


func has_mechanic(identity: String) -> bool:
	return mechanics != null and mechanics.has_mechanic(identity)


func mechanic_catalog() -> Array:
	return mechanics.describe()


func player_team_label() -> String:
	for car in cars:
		if car.player:
			return (
				str(car.entry_definition.values().team)
				if car.entry_definition != null
				else car.team
			)
	return "player-team"


func player_ids() -> Array:
	return cars.filter(func(car): return car.player).map(func(car): return car.id)


func content_options() -> Dictionary:
	var result: Dictionary = {}
	if roster_definition != null:
		result.roster_definition = roster_definition.to_snapshot()
	if tyre_rules.authored():
		result.tyre_definition = tyre_rules.to_snapshot()
	if setup_definition.authored():
		result.setup_definition = setup_definition.to_record()
	if tuning.authored():
		result.tuning_definition = tuning.to_record()
	if weekend_definition != null:
		result.weekend_definition = weekend_definition.to_record()
	if mechanic_definition != null:
		result.mechanic_definition = mechanic_definition.to_record()
	if not performance_profiles.is_empty():
		result.performance_profiles = performance_profiles.duplicate(true)
	return RaceContentSnapshot.options(result)


func _configure_session_definitions(options: Dictionary) -> bool:
	if options.has("mechanic_definition"):
		mechanic_definition = MechanicProfileDefinition.from_record(options.mechanic_definition)
		if mechanic_definition == null:
			last_error = "Invalid frozen mechanic profile."
			return false
	if options.has("tuning_definition"):
		tuning = RaceTuningDefinition.from_record(options.tuning_definition)
		if tuning == null:
			last_error = "Invalid frozen race tuning."
			return false
	if options.has("weekend_definition"):
		weekend_definition = WeekendDefinition.from_record(options.weekend_definition)
		if weekend_definition == null:
			last_error = "Invalid frozen weekend definition."
			return false
	return true


func _configure_entrants(options: Dictionary) -> bool:
	if options.has("setup_definition"):
		setup_definition = SetupDefinition.from_record(options.setup_definition)
		if setup_definition == null:
			last_error = "Invalid frozen setup definition."
			return false
	if options.has("tyre_definition"):
		tyre_rules = RaceTyreRules.from_snapshot(options.tyre_definition)
		if tyre_rules == null:
			last_error = "Invalid frozen tyre rules."
			return false
	if options.has("roster_definition"):
		roster_definition = RosterDefinition.decode_snapshot(options.roster_definition)
		if roster_definition == null:
			last_error = "Invalid frozen roster definition."
			return false
		for i in range(roster_definition.count):
			cars.append(
				RaceEntrantFactory.from_definition(
					roster_definition.entrant(i),
					i,
					track,
					laps,
					scenario,
					tyre_rules,
					setup_definition,
					tuning
				)
			)
		selected_id = int(player_ids()[0])
		track.pit_box_markers = roster_definition.pit_markers()
	else:
		for i in range(ROSTER.size()):
			cars.append(
				RaceEntrantFactory.create(
					ROSTER[i], i, track, laps, scenario, tyre_rules, setup_definition, tuning
				)
			)
	return true


static func _valid_restored_cars(sim: RaceSim, data: Dictionary) -> bool:
	var baseline = RaceCar.records(sim.cars)
	for i in range(sim.cars.size()):
		var c = data.cars[i]
		if not c is Dictionary or c.get("id") != i:
			return false
		for identity in (
			["short", "name", "team", "color", "number", "player"]
			+ (
				["skill", "consistency", "wet_skill", "reliability", "box_d"]
				if sim.roster_definition != null
				else []
			)
		):
			if c.get(identity) != baseline[i][identity]:
				return false
		if not _valid_record_fields(c, baseline[i]):
			return false
		if (
			sim.tyre_rules.spec(c.compound).is_empty()
			or sim.tyre_rules.spec(c.next_compound).is_empty()
			or c.pace < 0
			or c.pace > 2
			or c.engine < 0
			or c.engine > 2
		):
			return false
		if (
			c.route not in ["track", "pit", "garage"]
			or c.qual_state not in ["garage", "outlap", "hotlap", "inlap"]
		):
			return false
	return true


static func _restore_aggregate_values(sim: RaceSim, data: Dictionary) -> bool:
	for key in sim.snapshot():
		if (
			key
			in [
				"kind",
				"version",
				"track",
				"vehicle",
				"cars",
				"vehicle_definition",
				"roster_definition",
				"tyre_definition",
				"setup_definition",
				"tuning_definition",
				"weekend_definition",
				"mechanic_definition",
				"performance_profiles"
			]
		):
			continue
		if not data.has(key):
			return false
		var expected = sim.get(key)
		if typeof(expected) in [TYPE_FLOAT, TYPE_INT]:
			if (
				typeof(data[key]) not in [TYPE_FLOAT, TYPE_INT]
				or not is_finite(data[key])
				or absf(data[key]) > 10000000000
			):
				return false
		elif typeof(data[key]) != typeof(expected):
			return false
		if key in ["water", "rubber"]:
			for value in data[key]:
				if (
					typeof(value) not in [TYPE_FLOAT, TYPE_INT]
					or not is_finite(value)
					or value < 0
					or value > 1
				):
					return false
		sim.set(
			key,
			(
				int(data[key])
				if (
					key
					in [
						"speed",
						"laps",
						"rng_state",
						"seed_value",
						"yellow_sector",
						"finish_count",
						"selected_id"
					]
				)
				else RaceStateValue.copy(data[key])
			)
		)
	return true


static func _valid_record_fields(record: Dictionary, baseline: Dictionary) -> bool:
	for key in baseline:
		if not record.has(key):
			return false
		var expected = baseline[key]
		if typeof(expected) in [TYPE_FLOAT, TYPE_INT]:
			if (
				typeof(record[key]) not in [TYPE_FLOAT, TYPE_INT]
				or not is_finite(record[key])
				or absf(record[key]) > 100000000
			):
				return false
		elif typeof(record[key]) != typeof(expected):
			return false
	return true
