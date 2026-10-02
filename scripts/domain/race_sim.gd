class_name RaceSim
extends RaceSimOperations
## Fixed-step, seeded simulation. No UI, wall-clock or scene-tree dependencies.
func _init(geometry: TrackGeometry = null, options: Dictionary = {}, roster: RosterDefinition = null) -> void:
	if roster != null:
		options = options.duplicate(true)
		options.roster_definition = roster.to_snapshot()
	mechanics = RaceMechanics.new(self)
	if geometry == null: return
	track = TrackGeometry.new(geometry.document, geometry.preset, false, geometry.vehicle_definition if not geometry.authored_vehicle().is_empty() else null) if geometry.preview_only else geometry.detached_copy()
	if options.has("mechanic_definition"):
		mechanic_definition = MechanicProfileDefinition.from_record(options.mechanic_definition)
		if mechanic_definition == null:
			last_error = "Invalid frozen mechanic profile."
			return
	if options.has("tuning_definition"):
		tuning = RaceTuningDefinition.from_record(options.tuning_definition)
		if tuning == null:
			last_error = "Invalid frozen race tuning."
			return
	if options.has("weekend_definition"):
		weekend_definition = WeekendDefinition.from_record(options.weekend_definition)
		if weekend_definition == null:
			last_error = "Invalid frozen weekend definition."
			return
	laps = clampi(int(options.get("laps", 12)), 1, 100)
	qual_duration = maxf(float(options.get("qual_duration", 480)), track.estimate * tuning.sessions.qualifying_reference_laps)
	scenario = options.get("scenario", "changeable")
	weather_name = "Steady rain" if scenario == "wet" else "Clear skies"
	intensity = options.get("intensity", "standard")
	seed_value = int(options.get("seed", 7314)) & 0xffffffff
	rng_state = seed_value
	for i in range(RaceSurface.STATIONS):
		water.append(tuning.environment.surface.initial.wet_water if scenario == "wet" else tuning.environment.surface.initial.dry_water)
		rubber.append(tuning.environment.surface.initial.rubber)
	surface = RaceSurface.create(track, water, rubber, tuning.environment.surface)
	if options.has("setup_definition"):
		setup_definition = SetupDefinition.from_record(options.setup_definition)
		if setup_definition == null:
			last_error = "Invalid frozen setup definition."
			return
	if options.has("tyre_definition"):
		tyre_rules = RaceTyreRules.from_snapshot(options.tyre_definition)
		if tyre_rules == null:
			last_error = "Invalid frozen tyre rules."
			return
	if options.has("roster_definition"):
		roster_definition = RosterDefinition.decode_snapshot(options.roster_definition)
		if roster_definition == null:
			last_error = "Invalid frozen roster definition."
			return
		for i in range(roster_definition.count):
			cars.append(RaceEntrantFactory.from_definition(roster_definition.entrant(i), i, track, laps, scenario, tyre_rules, setup_definition, tuning))
		selected_id = int(player_ids()[0])
		track.pit_box_markers = roster_definition.pit_markers()
	else:
		for i in range(ROSTER.size()):
			cars.append(RaceEntrantFactory.create(ROSTER[i], i, track, laps, scenario, tyre_rules, setup_definition, tuning))
	if options.has("performance_profiles"):
		var error = RacePerformanceProfile.validate_set(options.performance_profiles, cars.size())
		if not error.is_empty():
			last_error = error
			return
		performance_profiles = options.performance_profiles.duplicate(true)
	post("weekend", "%s · %d racing laps · %s" % [track.document.name, laps, track.preset])

static func restore(data: Dictionary) -> RaceSim:
	data = RaceCheckpoint.prepare_base(data, CAR_V2, TYRES)
	if data.is_empty(): return null
	if not RaceSurface.valid(data.get("surface"), data.water, data.rubber): return null
	if not TrackDocument.valid_number(data.get("surface_accumulator"), 0, RaceSurface.INTERVAL): return null
	if not RaceCheckpoint.valid(data): return null
	var definition: VehicleDefinition
	if data.has("vehicle_definition"):
		definition = VehicleDefinition.from_record(data.vehicle_definition)
	var sim = RaceSim.new(TrackGeometry.new(data.track, data.get("vehicle", "Formula"), false, definition), RaceContentSnapshot.options(data))
	var baseline = RaceCar.records(sim.cars)
	for i in range(sim.cars.size()):
		var c = data.cars[i]
		if not c is Dictionary or c.get("id") != i: return null
		for identity in (["short", "name", "team", "color", "number", "player"] + (["skill", "consistency", "wet_skill", "reliability", "box_d"] if sim.roster_definition != null else [])):
			if c.get(identity) != baseline[i][identity]: return null
		for key in baseline[i]:
			if not c.has(key): return null
			var expected = baseline[i][key]
			if typeof(expected) in [TYPE_FLOAT, TYPE_INT]:
				if typeof(c[key]) not in [TYPE_FLOAT, TYPE_INT] or not is_finite(c[key]) or absf(c[key]) > 100000000: return null
			elif typeof(c[key]) != typeof(expected): return null
		if sim.tyre_rules.spec(c.compound).is_empty() or sim.tyre_rules.spec(c.next_compound).is_empty() or c.pace < 0 or c.pace > 2 or c.engine < 0 or c.engine > 2: return null
		if c.route not in ["track", "pit", "garage"] or c.qual_state not in ["garage", "outlap", "hotlap", "inlap"]: return null
	for key in sim.snapshot():
		if key in ["kind", "version", "track", "vehicle", "cars", "vehicle_definition", "roster_definition", "tyre_definition", "setup_definition", "tuning_definition", "weekend_definition", "mechanic_definition", "performance_profiles"]: continue
		if not data.has(key): return null
		var expected = sim.get(key)
		if typeof(expected) in [TYPE_FLOAT, TYPE_INT]:
			if typeof(data[key]) not in [TYPE_FLOAT, TYPE_INT] or not is_finite(data[key]) or absf(data[key]) > 10000000000: return null
		elif typeof(data[key]) != typeof(expected): return null
		if key in ["water", "rubber"]:
			for value in data[key]:
				if typeof(value) not in [TYPE_FLOAT, TYPE_INT] or not is_finite(value) or value < 0 or value > 1: return null
		sim.set(key, int(data[key]) if key in ["speed", "laps", "rng_state", "seed_value", "yellow_sector", "finish_count", "selected_id"] else RaceStateValue.copy(data[key]))
	if sim.speed not in [1, 2, 4, 8, 16] or sim.laps < 1 or sim.laps > 100: return null
	sim.cars.clear()
	for record in data.cars:
		var car = RaceCar.from_record(record)
		if car == null:
			return null
		if sim.roster_definition != null: car.entry_definition = sim.roster_definition.entrant(car.id)
		car.tyre_rules = sim.tyre_rules
		car.setup_definition = sim.setup_definition
		sim.cars.append(car)
	return sim

## Stable aggregate entry points; providers are resolved once at construction.
func policy(id: int) -> Dictionary:
	return mechanics.invoke("policy", [id])

func active_plan(id: int) -> Dictionary:
	return mechanics.invoke("active_plan", [id])

func forecast(id: int, draft: Dictionary = {}) -> Dictionary:
	return mechanics.invoke("forecast", [id, draft])

func sync_ownership(c: RaceCar) -> void:
	mechanics.invoke("sync_ownership", [c])

func command(action: String, payload: Dictionary = {}) -> bool:
	# Validate before copying, provider execution or accepted-input recording.
	# Cyclic collections and engine Objects are not command/replay values.
	if not RaceStateValue.serializable(payload):
		return fail("Command payload must contain finite serialized values within the record bounds.")
	return mechanics.invoke("command", [action, payload.duplicate(true)])

func policy_command(action: String, payload: Dictionary) -> bool:
	return mechanics.invoke("policy_command", [action, payload])

func manage_resources(c: RaceCar, only_channel: String = "") -> void:
	mechanics.invoke("manage_resources", [c, only_channel])

func engineer(c: RaceCar) -> void:
	mechanics.invoke("engineer", [c])

func contextual_rival(_car: RaceCar) -> bool:
	return mechanics.invoke("contextual_rival", [_car])

func review_rival_style(_car: RaceCar, _snapshot: Dictionary, _comparison: Dictionary) -> bool:
	return mechanics.invoke("review_rival_style", [_car, _snapshot, _comparison])

func order_stop(c: RaceCar, item: Dictionary, reason: String) -> void:
	mechanics.invoke("order_stop", [c, item, reason])

func block_plan(c: RaceCar, reason: String) -> void:
	mechanics.invoke("block_plan", [c, reason])

func leave_garage(c: RaceCar) -> void:
	mechanics.invoke("leave_garage", [c])

func record_stint(c: RaceCar) -> void:
	mechanics.invoke("record_stint", [c])

func step() -> void:
	mechanics.invoke("step", [])

func snapshot() -> Dictionary:
	return mechanics.invoke("snapshot", [])

func traffic_instruction(c: RaceCar, old: Array, nearest: int, gap: float, desired: float, lane: float, sample: Dictionary, local: Dictionary) -> Dictionary:
	return mechanics.invoke("traffic_instruction", [c, old, nearest, gap, desired, lane, sample, local])

func record_track_pass(c: RaceCar, other: RaceCar) -> void:
	mechanics.invoke("record_track_pass", [c, other])

func move_car(c: RaceCar, old: Array) -> void:
	mechanics.invoke("move_car", [c, old])

func observe_warnings(c: RaceCar) -> void:
	mechanics.invoke("observe_warnings", [c])

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

func enhanced() -> bool:
	return mechanics.invoke("enhanced", [])

func reliability(id: int) -> Dictionary:
	return mechanics.invoke("reliability", [id])

func recovery_advice(id: int) -> Dictionary:
	return mechanics.invoke("recovery_advice", [id])

func recovery_stale(advice: Dictionary) -> bool:
	return mechanics.invoke("recovery_stale", [advice])

func forecast_parameters(_driver_id: int) -> Dictionary:
	return mechanics.invoke("forecast_parameters", [_driver_id])

func log_recovery_command(action: String, payload: Dictionary, reason: String) -> void:
	mechanics.invoke("log_recovery_command", [action, payload, reason])

func issue_repair(c: RaceCar, manual: bool, reason: String) -> void:
	mechanics.invoke("issue_repair", [c, manual, reason])

func wear_car(c: RaceCar, distance: float, cell: int, effects: Dictionary = {}, local: Dictionary = {}) -> void:
	mechanics.invoke("wear_car", [c, distance, cell, effects, local])

func observe_reliability(c: RaceCar) -> void:
	mechanics.invoke("observe_reliability", [c])

func service_random_value() -> float:
	return mechanics.invoke("service_random_value", [])

func begin_service(c: RaceCar) -> void:
	mechanics.invoke("begin_service", [c])

func complete_service(c: RaceCar) -> void:
	mechanics.invoke("complete_service", [c])

func update_pit(c: RaceCar, old: Array = []) -> void:
	mechanics.invoke("update_pit", [c, old])

func pit_exit_message(c: RaceCar) -> String:
	return mechanics.invoke("pit_exit_message", [c])

func pit_status(c: RaceCar) -> String:
	return mechanics.invoke("pit_status", [c])

func update_flags() -> void:
	mechanics.invoke("update_flags", [])

func neutral(c: RaceCar) -> bool:
	return mechanics.invoke("neutral", [c])

func neutral_speed_limit(_c: RaceCar, _sample: Dictionary) -> float:
	return mechanics.invoke("neutral_speed_limit", [_c, _sample])

func constrain_progress(_c: RaceCar, next: float, _old: Array, _nearest: int) -> float:
	return mechanics.invoke("constrain_progress", [_c, next, _old, _nearest])

func update_yield(c: RaceCar, old: Array) -> float:
	return mechanics.invoke("update_yield", [c, old])

func incident(c: RaceCar) -> void:
	mechanics.invoke("incident", [c])

func retire(c: RaceCar, reason: String) -> void:
	mechanics.invoke("retire", [c, reason])

func recovery_debrief() -> String:
	return mechanics.invoke("recovery_debrief", [])

func is_run_session() -> bool:
	return mechanics.invoke("is_run_session", [])

func practice_driver(id: int) -> Dictionary:
	return mechanics.invoke("practice_driver", [id])

func run_preview(id: int, plan: Dictionary) -> Dictionary:
	return mechanics.invoke("run_preview", [id, plan])

func _practice_command(action: String, payload: Dictionary) -> bool:
	return mechanics.invoke("_practice_command", [action, payload])

func record_practice(action: String, id: int, evidence: Dictionary) -> void:
	mechanics.invoke("record_practice", [action, id, evidence])

func launch_run(id: int, plan: Dictionary) -> void:
	mechanics.invoke("launch_run", [id, plan])

func close_practice(reason: String) -> void:
	mechanics.invoke("close_practice", [reason])

func reset_run_counters() -> void:
	mechanics.invoke("reset_run_counters", [])

func qualifying_crossings(c: RaceCar, before: float, after: float) -> void:
	mechanics.invoke("qualifying_crossings", [c, before, after])

func _practice_step() -> void:
	mechanics.invoke("_practice_step", [])

func car_advisories(c: RaceCar) -> Array[String]:
	return mechanics.invoke("car_advisories", [c])

func plan_pit_gate(c: RaceCar) -> void:
	mechanics.invoke("plan_pit_gate", [c])

func has_mechanic(identity: String) -> bool:
	return mechanics != null and mechanics.has_mechanic(identity)

func mechanic_catalog() -> Array:
	return mechanics.describe()

func player_team_label() -> String:
	for car in cars:
		if car.player:
			return str(car.entry_definition.values().team) if car.entry_definition != null else car.team
	return "player-team"

func player_ids() -> Array:
	return cars.filter(func(car): return car.player).map(func(car): return car.id)

func content_options() -> Dictionary:
	var result: Dictionary = {}
	if roster_definition != null: result.roster_definition = roster_definition.to_snapshot()
	if tyre_rules.authored(): result.tyre_definition = tyre_rules.to_snapshot()
	if setup_definition.authored(): result.setup_definition = setup_definition.to_record()
	if tuning.authored(): result.tuning_definition = tuning.to_record()
	if weekend_definition != null: result.weekend_definition = weekend_definition.to_record()
	if mechanic_definition != null: result.mechanic_definition = mechanic_definition.to_record()
	if not performance_profiles.is_empty(): result.performance_profiles = performance_profiles.duplicate(true)
	return RaceContentSnapshot.options(result)

