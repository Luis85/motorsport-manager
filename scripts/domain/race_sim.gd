class_name RaceSim
extends RefCounted
## Fixed-step, seeded simulation. No UI, wall-clock or scene-tree dependencies.
signal event_posted(entry: Dictionary)
const STEP = 0.05
const ACTIVE = ["practice", "qualifying", "formation", "lights", "race"]
const TYRES = LegacyTyreContent.PERFORMANCE
const ROSTER = LegacyRoster.ROWS
const CAR_V2 = {"yield_to": -1, "yield_side": 0.0, "yield_clock": 0.0, "qual_history": [], "qual_sectors": [0.0, 0.0, 0.0], "qual_sector_start": 0.0, "invalid_reason": "", "throttle": 0.0, "braking": 0.0, "pit_deferred": false, "pit_lap": false, "service_compound": "M", "service_repair": true}
var tuning: RaceTuningDefinition = RaceTuningDefinition.legacy()
var weekend_definition: WeekendDefinition
var setup_definition: SetupDefinition = SetupDefinition.legacy()
var tyre_rules: RaceTyreRules = RaceTyreRules.legacy()
var roster_definition: RosterDefinition
var track: TrackGeometry
var cars: Array[RaceCar] = []
var phase = "briefing"
var clock = 0.0
var total_time = 0.0
var race_time = 0.0
var accumulator = 0.0
var speed = 1
var paused = false
var laps = 12
var qual_duration = 480.0
var qual_closed = false
var scenario = "changeable"
var intensity = "standard"
var rng_state = 7314
var seed_value = 7314
var flag = "GREEN"
var flag_until = 0.0
var yellow_sector = -1
var rain = 0.0
var water: Array = []
var rubber: Array = []
var surface: Array = []
var surface_accumulator = 0.0
var weather_name = "Clear skies"
var events: Array = []
var commands: Array = []
var pit_boxes: Dictionary = {}
var chequered = false
var finish_count = 0
var fastest = 0.0
var selected_id = 3
var last_error = ""
var stats = {"passes": 0, "incidents": 0, "pits": 0, "blue_flags": 0}

signal input_accepted(action: String, payload: Dictionary, context: Dictionary)
signal fixed_step_completed
var strategy_state: Dictionary = {}
var battle_state: Dictionary = {}
var team_state: Dictionary = {}
var rival_state: Dictionary = {}
var weather_state: Dictionary = {}
var reliability_state: Dictionary = {}
var control_state: Dictionary = {}
var practice_state: Dictionary = {}
var rival_styles: Dictionary = {}
var duel_state: Dictionary = {}
var mechanics: RaceMechanics

func _init(geometry: TrackGeometry = null, options: Dictionary = {}, roster: RosterDefinition = null) -> void:
	if roster != null:
		options = options.duplicate(true)
		options.roster_definition = roster.to_snapshot()
	mechanics = RaceMechanics.new(self)
	if geometry == null: return
	track = TrackGeometry.new(geometry.document, geometry.preset, false, geometry.vehicle_definition if not geometry.authored_vehicle().is_empty() else null) if geometry.preview_only else geometry.detached_copy()
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
	post("weekend", "%s · %d racing laps · %s" % [track.document.name, laps, track.preset])

func random_value() -> float:
	rng_state = (1664525 * rng_state + 1013904223) & 0xffffffff
	return float(rng_state) / 4294967296.0

func post(kind: String, text: String) -> void:
	var entry = {"time": total_time, "session_time": clock, "phase": phase, "kind": kind, "text": text}
	events.append(entry)
	if events.size() > 2000: events.pop_front()
	event_posted.emit(RaceStateValue.read_only(entry))

func transition(next: String) -> void:
	phase = next; clock = 0.0; accumulator = 0.0; paused = false
	post("session", next.replace("_", " ").capitalize())

func _base_command(action: String, payload: Dictionary = {}) -> bool:
	last_error = ""
	# Target validation precedes every base command, including clock/unknown input.
	var target = payload.get("id", selected_id)
	if not RaceCheckpoint.integral(target, 0, cars.size() - 1): return fail("Unknown driver.")
	var car = cars[int(target)]
	var error = ""
	if action in RaceSessionOrders.ACTIONS:
		error = RaceSessionOrders.apply(self, action, payload)
	elif action in RaceDriverOrders.ACTIONS or action in RacePitOrders.ACTIONS:
		if not car.player: return fail("You manage the two %s drivers only." % player_team_label())
		if car.dnf or car.finished: return fail("This car is no longer running.")
		if action in RacePitOrders.ACTIONS:
			error = RacePitOrders.apply(self, car, action, payload)
		else:
			error = RaceDriverOrders.apply(self, car, action, payload)
		if not error.is_empty(): return fail(error)
		post("radio", "%s · %s %s" % [car.short, action.replace("_", " "), str(payload.get("value", ""))])
	else:
		return fail("Unknown command: " + action)
	if not error.is_empty(): return fail(error)
	commands.append({"tick": snappedf(total_time, STEP), "action": action, "payload": payload.duplicate(true)})
	return true
func fail(message: String) -> bool:
	last_error = message
	return false

func advance(real_delta: float) -> void:
	# Compatibility API for existing headless callers. Production scheduling is
	# owned by RaceSessionRunner, never by a visual node.
	RaceStepClock.advance(self, real_delta)

func _base_step() -> void:
	if paused or phase not in ACTIVE: return
	clock += STEP; total_time += STEP
	if phase == "lights":
		if clock >= 6.0:
			transition("race"); race_time = 0.0
			for c in cars:
				c.distance = -(c.grid - 1) * track.grid_spacing; c.previous_distance = c.distance; c.speed = 0.0; c.lap_start = 0.0; c.sector_start = 0.0
			for c in cars: record_stint(c)
			post("flag", "Lights out. Race distance and timing start now.")
		return
	if phase == "race": race_time = clock
	update_surface()
	if phase == "qualifying" and clock >= qual_duration and not qual_closed:
		qual_closed = true; post("flag", "Qualifying chequered. Completing existing flying laps.")
	update_flags()
	var old: Array = []
	for c in cars: old.append({"distance": c.distance, "lane": c.lane, "speed": c.speed, "route": c.route, "pit_d": c.pit_d, "pit_stage": c.pit_stage, "qual_state": c.qual_state}); c.crossed_at = -1.0
	for c in cars:
		c.previous_distance = c.distance; c.previous_pit_d = c.pit_d; c.previous_lane = c.lane; c.previous_route = c.route
		if c.dnf or c.finished: continue
		c.ai_clock -= STEP
		if c.ai_clock <= 0:
			c.ai_clock = 1.5; TyreInventory.cool_spares(c, 1.5); engineer(c)
		if c.route == "garage":
			var stored_set = TyreInventory.find(c, c.set_id)
			WheelTyres.cool(stored_set, STEP, tyre_rules.spec(stored_set.compound)); c.tyre = stored_set.life; c.temperature = stored_set.temperature
			if phase == "qualifying" and not qual_closed and c.auto and c.qual_runs < 2 and clock >= c.next_qual: leave_garage(c)
			continue
		if c.route == "pit": update_pit(c, old); continue
		if phase == "formation" and c.formation_done: continue
		if c.loss > 0:
			c.loss = maxf(0.0, c.loss - STEP); c.speed = 0.0; continue
		move_car(c, old)
	if phase == "qualifying":
		var settled = true
		for c in cars:
			if c.route != "garage" and not c.dnf: settled = false
		if qual_closed and settled: finish_qualifying()
	if phase == "formation":
		var ready = true
		for c in cars:
			if not c.formation_done: ready = false
		if ready: transition("grid_ready")
	if phase == "race":
		resolve_finishes()
		var done = true
		for c in cars:
			if not c.finished and not c.dnf: done = false
		if done: transition("results"); post("finish", "Weekend complete. Classification and event log are ready.")

func _base_update_flags() -> void:
	# Legacy procedure remains unchanged; newer rulesets override this tick-boundary seam.
	if flag != "GREEN" and clock >= flag_until:
		if flag == "SAFETY CAR": flag = "RESTART"; flag_until = clock + tuning.operations.control.ending_seconds
		else: flag = "GREEN"; yellow_sector = -1
		post("flag", flag)

func _base_forecast_parameters(_driver_id: int) -> Dictionary:
	# Allow-listed observable model parameters; never expose a random stream or future event.
	return {}

func _base_neutral_speed_limit(_c: RaceCar, _sample: Dictionary) -> float:
	return tuning.operations.control.local_yellow_speed_mps if flag == "YELLOW" else tuning.operations.control.legacy_neutral_speed_mps

func _base_constrain_progress(_c: RaceCar, next: float, _old: Array, _nearest: int) -> float:
	return next

func average(values: Array) -> float:
	var sum = 0.0
	for value in values: sum += value
	return sum / maxf(1, values.size())

func _base_update_surface() -> void:
	var training = WeekendWeather.training(scenario, phase, clock, track.estimate * laps, tuning.environment.training)
	var label: String = training.label
	rain = training.rain
	if label != weather_name: weather_name = label; post("weather", label + ". Surface water changes gradually.")
	surface_accumulator += STEP
	if surface_accumulator + 0.0000001 >= RaceSurface.INTERVAL:
		surface_accumulator = maxf(0, surface_accumulator - RaceSurface.INTERVAL)
		RaceSurface.evolve(surface, rain, RaceSurface.INTERVAL, total_time, tuning.environment.surface)
		RaceSurface.profiles(surface, water, rubber)

func surface_at(c: RaceCar) -> Dictionary:
	return RaceSurface.sample(surface, c.distance / track.length, c.lane, tuning.environment.surface)

func recommended_compound() -> String:
	var wet = average(water)
	return tyre_rules.recommended(wet)

func _base_engineer(c: RaceCar) -> void:
	if not c.auto or phase != "race" or c.route != "track" or c.dnf or c.finished: return
	var remaining = maxf(0, laps - c.distance / track.length)
	var emergency = not WheelTyres.usable(TyreInventory.find(c, c.set_id))
	c.pace = 0 if emergency or c.tyre < tuning.competition.policy.conserve_tread or flag != "GREEN" else 1
	c.engine = 0 if emergency or c.fuel < remaining * tuning.competition.policy.fuel_reserve_factor else 1
	var recommended = recommended_compound()
	var ordinary_stop = remaining > tuning.competition.policy.stop_remaining_laps and c.distance > track.length * tuning.competition.policy.stop_start_laps and (c.tyre < tuning.competition.policy.stop_tread or c.compound != recommended and (tyre_rules.wet(recommended) or tyre_rules.wet(c.compound)) or c.damage > tuning.competition.policy.repair_damage)
	if not emergency and not ordinary_stop: return
	# A failed tyre is not a routine strategy stop: first-lap and late-lap gates
	# must not suppress recovery. Only delegated control may revise a future stop.
	if c.pit_order and (not emergency or c.scheduled_lap < 0): return
	var replacement = TyreInventory.choose(c, recommended, true)
	if replacement.is_empty(): replacement = TyreInventory.choose(c, c.compound, true)
	if replacement.is_empty() and emergency:
		for compound in tyre_rules.compounds():
			replacement = TyreInventory.choose(c, compound, true)
			if not replacement.is_empty(): break
	if replacement.is_empty():
		c.intent = "No sound replacement available; protecting the car"
		return
	c.next_compound = replacement.compound; c.next_set_id = replacement.id
	c.scheduled_lap = -1; queue_pit(c)
	post("pit", "%s: engineer calls %s tyres%s." % [c.short, c.next_compound, " for a damaged tyre; next safe entry" if emergency else ""])

func grip(c: RaceCar, _cell: int, local: Dictionary = {}) -> float:
	if local.is_empty(): local = surface_at(c)
	var wet = local.water
	var match_factor = 1.0
	match_factor = TyreSurfaceResponse.factor(tyre_rules.spec(c.compound), wet)
	var wheel_factor = WheelTyres.grip(TyreInventory.find(c, c.set_id), tyre_rules.spec(c.compound))
	return clampf(local.grip * tyre_rules.spec(c.compound).grip * match_factor * wheel_factor, 0.16, 1.1)

func _base_neutral(c: RaceCar) -> bool:
	return phase == "formation" or flag in ["SAFETY CAR", "RESTART"] or flag == "YELLOW" and track.sector_at(c.distance) == yellow_sector

func _base_move_car(c: RaceCar, old: Array) -> void:
	var s = track.sample(c.distance)
	var cell = int(fposmod(c.distance / track.length, 1) * 96)
	var local = surface_at(c)
	var g = grip(c, cell, local)
	var effects = CarSetup.effects(c, local.water)
	var handling = (1.0 + (c.skill - tuning.pace.skill_reference) * tuning.pace.skill_factor) * lerpf(1.0, effects.corner, clampf(absf(s.curvature) * 100, 0, 1))
	handling *= 1.0 + (c.wet_skill - tuning.competition.movement.wet_skill_reference) * tuning.competition.movement.wet_skill_factor * local.water
	var desired = s.speed * sqrt(g) * handling * (1 - c.damage * tuning.condition.damage_speed_loss) * tuning.pace.speed_modes[c.pace]
	desired *= tuning.pace.engine_modes[c.engine]
	desired *= (1.0 - maxf(0, tuning.condition.health_reference - c.health) * tuning.condition.health_speed_loss) / (1.0 + c.fuel * tuning.fuel.runtime_mass_factor)
	if absf(s.curvature) < tuning.competition.movement.straight_curvature_per_m: desired *= effects.straight
	desired *= 1.0 - maxf(0, c.engine_temperature - tuning.condition.heat_reference_c) * tuning.condition.heat_speed_loss
	if not WheelTyres.usable(TyreInventory.find(c, c.set_id)): desired = minf(desired, tuning.competition.movement.damaged_tyre_speed_mps)
	var target_lane = s.line
	if is_run_session() and c.qual_state != "hotlap": desired = minf(desired * tuning.competition.movement.run_transit_factor, tuning.competition.movement.run_transit_speed_mps)
	if phase == "formation":
		desired = minf(desired * tuning.competition.movement.formation_speed_factor, tuning.competition.movement.formation_speed_mps)
		var goal = track.length - (c.grid - 1) * track.grid_spacing
		var remaining = maxf(0, goal - c.distance)
		desired = minf(desired, sqrt(2 * 6 * remaining))
		if remaining < 100: target_lane = (-1 if c.grid % 2 else 1) * 2.0
		if clock < (c.grid - 1) * tuning.competition.movement.formation_release_seconds: desired = 0.0
	if neutral(c): desired = minf(desired, neutral_speed_limit(c, s))
	if phase == "race" and clock < tuning.competition.movement.start_reaction_seconds + (100 - c.skill) * tuning.competition.movement.start_skill_seconds: desired = 0.0
	if phase == "race" and clock < 3.0: target_lane = (-1 if c.grid % 2 else 1) * 2.0
	var nearest_id = -1; var ahead_distance = INF
	var was_blue = c.blue
	var courtesy_target = update_yield(c, old)
	c.blue = c.yield_to >= 0 and phase == "race"
	if c.yield_to >= 0:
		target_lane = courtesy_target
		if absf(c.lane - old[c.yield_to].lane) > 2.6: desired = minf(desired, tuning.competition.movement.yield_speed_mps)
	for other in cars:
		if other.id == c.id or other.dnf or other.finished or old[other.id].route != "track": continue
		var delta = fposmod(old[other.id].distance - old[c.id].distance, track.length)
		if delta > 0.005 and delta < ahead_distance: ahead_distance = delta; nearest_id = other.id
	if c.blue and not was_blue:
		stats.blue_flags += 1; post("flag", c.short + " yields under blue flags.")
	var passing = false
	if nearest_id >= 0 and ahead_distance < tuning.competition.movement.wake_distance_m:
		if phase == "race" and not neutral(c): desired *= tuning.competition.movement.slipstream_factor if absf(s.curvature) < tuning.competition.movement.slipstream_curvature_per_m else tuning.competition.movement.dirty_air_factor
	var traffic = traffic_instruction(c, old, nearest_id, ahead_distance, desired, target_lane, s, local)
	desired = traffic.desired; target_lane = traffic.lane
	if traffic.attempt and nearest_id >= 0: passing = absf(c.lane - old[nearest_id].lane) >= 2.6
	if nearest_id >= 0 and ahead_distance < tuning.competition.movement.wake_distance_m and not passing and ahead_distance < maxf(12, c.speed * tuning.competition.movement.following_headway_seconds):
		desired = minf(desired, maxf(0, old[nearest_id].speed + (ahead_distance - 7) * tuning.competition.movement.following_response_per_second))
	# Do not sweep across an occupied lateral lane.
	for other in cars:
		if other.id == c.id or other.dnf or old[other.id].route != "track": continue
		var longitudinal = fposmod(old[other.id].distance - old[c.id].distance + track.length * 0.5, track.length) - track.length * 0.5
		if absf(longitudinal) < 7:
			var separation: float = c.lane - old[other.id].lane
			var clearance = track.vehicle_definition.width_m + 0.25
			# Keep occupied lanes separated without ever displacing an already overlapping car.
			if separation > 0: target_lane = maxf(target_lane, minf(c.lane, old[other.id].lane + clearance))
			elif separation < 0: target_lane = minf(target_lane, maxf(c.lane, old[other.id].lane - clearance))
	c.lane = move_toward(c.lane, clampf(target_lane, -s.w * 0.5 + 1.1, s.w * 0.5 - 1.1), STEP * tuning.competition.movement.lateral_speed_mps)
	var limits = track.vehicle_definition.parameters()
	var grade = (track.sample(c.distance + 10).h - track.sample(c.distance - 10).h) / 20.0
	var accel = maxf(1.0, limits.accel * g * effects.traction - 9.81 * grade)
	var brake = maxf(2.0, limits.brake * g * effects.brake + 9.81 * grade)
	var must_pit = phase == "race" and c.pit_order or is_run_session() and c.qual_state == "inlap"
	if must_pit:
		if c.pit_gate <= c.distance: plan_pit_gate(c)
		desired = minf(desired, sqrt(track.pit_limit ** 2 + 2.0 * brake * maxf(0, c.pit_gate - c.distance - 5)))
	# A wet/worn car must brake *before* the corner, not chase a dry envelope through it.
	var lookahead = minf(300, c.speed * c.speed / (2 * brake) + 25)
	var scan = 15.0
	while scan <= lookahead:
		var future = track.sample(c.distance + scan / s.path_scale)
		var corner_speed = minf(limits.top, sqrt(maxf(3, limits.lat * g) / maxf(0.00001, absf(future.curvature))))
		desired = minf(desired, sqrt(corner_speed * corner_speed + 2 * brake * scan))
		scan += 20
	if is_run_session() and c.qual_state == "hotlap" and neutral(c):
		c.hot_valid = false; c.invalid_reason = "Neutralized sector during the flying lap"
	var old_speed = c.speed
	c.speed = move_toward(c.speed, clampf(desired, 0, RaceCheckpoint.MAX_SPEED_MPS), STEP * (accel if desired > c.speed else brake))
	var next = c.distance + c.speed * STEP / s.path_scale
	if nearest_id >= 0 and (neutral(c) or traffic.block_pass or absf(c.lane - old[nearest_id].lane) < 2.6):
		# Snapshot-based longitudinal constraint: never teleport ahead through a car.
		var limit = c.distance + ahead_distance - 6.2 + old[nearest_id].speed * STEP / maxf(0.1, track.sample(old[nearest_id].distance).path_scale)
		if next > limit: next = maxf(c.distance, limit); c.speed = maxf(0, (next - c.distance) * s.path_scale / STEP)
	var permitted_next = constrain_progress(c, next, old, nearest_id)
	if permitted_next < next:
		next = maxf(c.distance, permitted_next); c.speed = maxf(0, (next - c.distance) * s.path_scale / STEP)
	if phase == "formation":
		var goal = track.length - (c.grid - 1) * track.grid_spacing
		if next >= goal - 0.2:
			next = goal; c.speed = 0.0; c.formation_done = true
	var gate = c.pit_gate
	if must_pit and next >= gate:
		next = gate
		c.pit_cycle = int(round((gate - track.pit_entry) / track.length)); c.pit_d = 0.0; c.pit_stage = "entry"; c.route = "pit"
		c.speed = minf(c.speed, track.pit_limit); c.pit_lap = true; c.yield_to = -1; c.blue = false
		post("pit", c.short + " enters the pit lane.")
	c.throttle = clampf((c.speed - old_speed) / maxf(0.001, STEP * accel), 0, 1)
	c.braking = clampf((old_speed - c.speed) / maxf(0.001, STEP * brake), 0, 1)
	var moved = maxf(0, next - c.distance)
	var old_distance = c.distance
	c.distance = next
	wear_car(c, moved * s.path_scale, cell, effects, local)
	if c.previous_route == "track":
		var touched = RaceSurface.deposit(surface, track.length, c, old_distance, next, s.curvature, tuning.environment.surface)
		if not touched.is_empty(): RaceSurface.profiles(surface, water, rubber, touched)
	if phase == "race": race_crossings(c, old_distance, next)
	elif is_run_session(): qualifying_crossings(c, old_distance, next)
	if passing and nearest_id >= 0 and ahead_distance < moved - old[nearest_id].speed * STEP / track.sample(old[nearest_id].distance).path_scale and phase == "race":
		record_track_pass(c, cars[nearest_id])
	c.intent = "Blue flag · yielding" if c.blue else (pit_status(c) if c.pit_order else ("Formation · hold order" if phase == "formation" else (c.qual_state.capitalize() if is_run_session() else "Racing")))
	if phase == "race" and intensity != "calm" and not neutral(c) and c.route == "track":
		var incidents: Dictionary = tuning.operations.incidents
		var risk = incidents.base_exposure_per_second * (1 + (100 - c.consistency) * incidents.consistency_factor) * (1 + (100 - c.reliability) * incidents.reliability_factor) * (incidents.push_factor if c.pace == 2 else 1.0) * (1 + local.water * incidents.water_factor + maxf(0, incidents.low_tread_reference - c.tyre) * incidents.low_tread_factor)
		risk *= {"patient": incidents.patient_factor, "balanced": incidents.balanced_factor, "assertive": incidents.assertive_factor}[c.battle_mode]
		if random_value() < risk * STEP * (incidents.volatile_factor if intensity == "volatile" else 1): incident(c)
	if total_time - c.last_trace >= 1:
		c.last_trace = total_time
		c.telemetry.append([total_time, c.speed * 3.6, c.tyre, c.fuel, (c.speed - old_speed) / STEP])
		if c.telemetry.size() > 120: c.telemetry.pop_front()

func _base_traffic_instruction(c: RaceCar, old: Array, nearest: int, gap: float, desired: float, lane: float, sample: Dictionary, local: Dictionary) -> Dictionary:
	var result = {"desired": desired, "lane": lane, "attempt": false, "block_pass": false}
	var battle: Dictionary = tuning.competition.battle
	if nearest < 0 or gap >= battle.prepare_distance_m: return result
	if c.yield_to < 0 and not neutral(c) and phase != "formation" and absf(sample.curvature) < battle.maximum_curvature_per_m and sample.w > battle.minimum_road_width_m and desired > old[nearest].speed + battle[c.battle_mode + "_speed_advantage_mps"] and not (c.battle_mode == "patient" and local.water > battle.patient_maximum_water):
		var side = -1 if old[nearest].lane >= 0 else 1
		result.lane = clampf(old[nearest].lane + side * 3.0, -sample.w * 0.5 + 1.4, sample.w * 0.5 - 1.4)
		result.attempt = true
	return result

func _base_record_track_pass(c: RaceCar, other: RaceCar) -> void:
	stats.passes += 1; post("pass", "%s passes %s on track." % [c.short, other.short])

func _base_wear_car(c: RaceCar, distance: float, cell: int, effects: Dictionary = {}, local: Dictionary = {}) -> void:
	RaceVehicleCondition.wear_car(self, c, distance, cell, effects, local)

func _base_qualifying_crossings(c: RaceCar, before: float, after: float) -> void:
	RaceTiming.qualifying_crossings(self, c, before, after)

func finish_qualifying() -> void:
	RaceTiming.finish_qualifying(self)

func _base_is_run_session() -> bool:
	return phase == "qualifying"

func _base_leave_garage(c: RaceCar) -> void:
	RacePitService.leave_garage(self, c)

func depart_on_planned_set(c: RaceCar) -> void:
	# Shared physical departure; eligibility is owned by the session orchestrator.
	var item = TyreInventory.planned(c)
	if item.is_empty(): c.next_qual = clock + 60; c.intent = "No usable tyre set; choose a replacement"; return
	TyreInventory.mount(c, item.id)
	c.route = "pit"; c.pit_stage = "exit"; c.pit_d = c.box_d
	c.pit_cycle = 0; c.pit_gate = -1.0; c.qual_state = "outlap"; c.qual_runs += 1; c.fuel = tuning.fuel.qualifying_load_laps; c.speed = 0.0
	c.distance = track.pit_entry + (track.pit_exit - track.pit_entry) * c.pit_d / track.pit_length
	post(phase, "%s leaves the garage for run %d." % [c.short, c.qual_runs])

func _base_update_pit(c: RaceCar, old: Array = []) -> void:
	RacePitService.update_pit(self, c, old)

func _base_pit_exit_message(c: RaceCar) -> String:
	return c.short + " rejoins on cold tyres."

func _base_service_random_value() -> float:
	return random_value()

func _base_begin_service(c: RaceCar) -> void:
	RacePitService.begin_service(self, c)

func _base_complete_service(c: RaceCar) -> void:
	RacePitService.complete_service(self, c)

func race_crossings(c: RaceCar, before: float, after: float) -> void:
	RaceTiming.race_crossings(self, c, before, after)

func resolve_finishes() -> void:
	RaceTiming.resolve_finishes(self)

func queue_pit(c: RaceCar) -> void:
	RacePitService.queue_pit(self, c)

func _base_plan_pit_gate(c: RaceCar) -> void:
	RacePitService.plan_pit_gate(self, c)

func _base_incident(c: RaceCar) -> void:
	RaceSurface.contaminate(surface, c.distance / track.length, c.lane, tuning.environment.surface.incident.debris, c.health < tuning.environment.surface.incident.oil_health_threshold, tuning.environment.surface.incident)
	stats.incidents += 1
	var outcome = random_value()
	if outcome < tuning.operations.incidents.barrier_probability:
		retire(c, "Barrier impact"); flag = "SAFETY CAR"; flag_until = clock + tuning.operations.control.retired_car_seconds; post("flag", "Safety car deployed for a stranded car.")
	elif outcome < tuning.operations.incidents.legacy_retirement_threshold and c.health < tuning.operations.incidents.legacy_mechanical_health:
		retire(c, "Mechanical failure"); flag = "YELLOW"; yellow_sector = track.sector_at(c.distance); flag_until = clock + tuning.operations.control.legacy_mechanical_seconds
	else:
		c.loss = tuning.operations.incidents.lost_seconds_base + random_value() * tuning.operations.incidents.lost_seconds_span
		c.damage = minf(1000, c.damage + tuning.operations.incidents.damage_base + random_value() * tuning.operations.incidents.damage_span)
		var fitted = TyreInventory.find(c, c.set_id)
		for wheel in WheelTyres.KEYS: fitted.wheels[wheel].life = maxf(0, fitted.wheels[wheel].life - tuning.operations.incidents.tread_loss)
		WheelTyres.publish(fitted); c.tyre = fitted.life; c.temperature = fitted.temperature
		flag = "YELLOW"; yellow_sector = track.sector_at(c.distance); flag_until = clock + tuning.operations.control.local_incident_seconds
		TyreInventory.sync(c)
		post("incident", c.short + " spins. Local yellow; car recovering.")

func _base_retire(c: RaceCar, reason: String) -> void:
	c.dnf = true; c.speed = 0.0; c.retire_reason = reason; c.completed = int(maxf(0, floor(c.distance / track.length)))
	if pit_boxes.get(c.team_identity(), -1) == c.id: pit_boxes.erase(c.team_identity())
	post("retirement", "%s retires: %s." % [c.short, reason])

func standings(qualifying: bool = false) -> Array:
	return RaceTiming.standings(self, qualifying)

func car_position(c: RaceCar, alpha: float = 1.0) -> Dictionary:
	if c.route != c.previous_route: alpha = 1.0
	if c.route in ["pit", "garage"]:
		var s = track.pit_sample(c.box_d if c.route == "garage" else lerpf(c.previous_pit_d, c.pit_d, alpha))
		if c.route == "garage" or c.pit_stage == "service": s.p += s.n * (4.0 + c.id % 2 * 2.0)
		return s
	var s = track.sample(lerpf(c.previous_distance, c.distance, alpha))
	s.p += s.n * lerpf(c.previous_lane, c.lane, alpha)
	return s

func _base_snapshot() -> Dictionary:
	var saved_cars = RaceCar.records(cars)
	for car in saved_cars: TyreInventory.sync_record(car)
	var result = {"kind": "motorsport-manager-weekend", "version": 4, "track": track.document.duplicate(true), "vehicle": track.preset, "cars": saved_cars, "phase": phase, "clock": clock, "total_time": total_time, "race_time": race_time, "accumulator": accumulator, "speed": speed, "paused": paused, "laps": laps, "qual_duration": qual_duration, "qual_closed": qual_closed, "scenario": scenario, "intensity": intensity, "rng_state": rng_state, "seed_value": seed_value, "flag": flag, "flag_until": flag_until, "yellow_sector": yellow_sector, "rain": rain, "surface": surface.duplicate(true), "surface_accumulator": surface_accumulator, "water": water.duplicate(), "rubber": rubber.duplicate(), "weather_name": weather_name, "events": events.duplicate(true), "commands": commands.duplicate(true), "pit_boxes": pit_boxes.duplicate(), "chequered": chequered, "finish_count": finish_count, "fastest": fastest, "selected_id": selected_id, "stats": stats.duplicate()}
	if not track.authored_vehicle().is_empty():
		result.vehicle_definition = track.authored_vehicle()
	if roster_definition != null:
		result.roster_definition = roster_definition.to_snapshot()
	if tyre_rules.authored(): result.tyre_definition = tyre_rules.to_snapshot()
	if setup_definition.authored(): result.setup_definition = setup_definition.to_record()
	if tuning.authored(): result.tuning_definition = tuning.to_record()
	if weekend_definition != null: result.weekend_definition = weekend_definition.to_record()
	return result

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
		if key in ["kind", "version", "track", "vehicle", "cars", "vehicle_definition", "roster_definition", "tyre_definition", "setup_definition", "tuning_definition", "weekend_definition"]: continue
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

static func format_time(value: float) -> String:
	if value <= 0: return "—"
	return "%d:%06.3f" % [int(value / 60), fmod(value, 60)]

func _base_update_yield(c: RaceCar, old: Array) -> float:
	# Hysteresis keeps a courtesy manoeuvre stable until the priority car has cleared.
	if neutral(c) or c.route != "track": c.yield_to = -1
	if c.yield_to >= 0:
		var other = cars[c.yield_to]
		var signed_gap = fposmod(old[other.id].distance - old[c.id].distance + track.length * 0.5, track.length) - track.length * 0.5
		if other.dnf or other.finished or old[other.id].route != "track" or signed_gap > 18 or signed_gap < -220 or total_time - c.yield_clock > 20 or is_run_session() and old[other.id].qual_state != "hotlap":
			c.yield_to = -1
	if c.yield_to < 0 and not neutral(c):
		var closest = 150.0
		for other in cars:
			if other.id == c.id or other.dnf or other.finished or old[other.id].route != "track": continue
			var gap = fposmod(old[c.id].distance - old[other.id].distance, track.length)
			var courtesy = is_run_session() and c.qual_state in ["outlap", "inlap"] and old[other.id].qual_state == "hotlap"
			var lapped = phase == "race" and old[other.id].distance - old[c.id].distance > track.length * 0.65
			var closing: float = old[other.id].speed - old[c.id].speed
			if gap > 0.01 and gap < closest and (courtesy or lapped) and closing > -0.5 and (gap < 45 or gap / maxf(0.1, closing) < 7):
				closest = gap; c.yield_to = other.id; c.yield_clock = total_time
				c.yield_side = -1.0 if old[other.id].lane >= 0 else 1.0
	var s = track.sample(c.distance)
	return c.yield_side * maxf(0, s.w * 0.5 - 1.5) if c.yield_to >= 0 else s.line

func _base_pit_status(c: RaceCar) -> String:
	return RacePitService.pit_status(self, c)

func _base_record_stint(c: RaceCar) -> void:
	RacePitService.record_stint(self, c)

func strategy_advice(c: RaceCar) -> String:
	var remaining = maxf(0, laps - c.distance / track.length)
	var item = TyreInventory.find(c, c.set_id)
	var reference_wear = tyre_rules.spec(c.compound).wear * tuning.pace.wear_modes[c.pace]
	var estimate = maxf(0, (c.tyre - 20) / reference_wear)
	var next = TyreInventory.planned(c, phase == "race")
	return "Mounted %s · %.1f laps used\nPlan %s\n~%.1f laps to 20%% tread at current pace.\n%.1f race laps remain. Fuel margin ~%.1f laps.\nEstimate excludes future rain, traffic and incidents." % [item.get("label", "—"), item.get("laps", 0), (next.label + " · %.0f%%" % next.life) if not next.is_empty() else "no usable replacement", estimate, remaining, c.fuel - remaining * tuning.fuel.engine_rates[c.engine]]

func check_tyre_incident(c: RaceCar) -> void:
	# Conditional damage uses the race PRNG only. Visual updates never call this path.
	var item = TyreInventory.find(c, c.set_id)
	if item.is_empty(): return
	for key in WheelTyres.KEYS:
		if item.wheels[key].punctured: return
	for key in WheelTyres.KEYS:
		var w = item.wheels[key]
		if w.life < 8 and (w.life <= 0.5 or random_value() < (8 - w.life) * 0.004):
			w.punctured = true
			post("tyre", "%s: %s puncture on %s. Pace limited; select a sound replacement and box." % [c.short, key, item.label])
			return
	if intensity != "calm" and c.braking > 0.75 and WheelTyres.average(item, "core") < 68 and random_value() < 0.01 * (1.12 if c.battle_mode == "assertive" else 1.0):
		var key = WheelTyres.lockup(item, c.car_setup.bias / 100.0, 4.0, tyre_rules.spec(c.compound))
		c.temperature = item.temperature; c.tyre = item.life
		post("tyre", "%s: cold-tyre lock-up leaves a flat spot on %s." % [c.short, key])

func _base_car_advisories(c: RaceCar) -> Array[String]:
	var messages: Array[String] = []
	var item = TyreInventory.find(c, c.set_id)
	for key in WheelTyres.KEYS:
		var wheel = item.wheels[key]
		if wheel.punctured: messages.append("%s PUNCTURE · plan a replacement and box" % key)
		elif wheel.life < 15: messages.append("%s tread low · %.0f%% remaining" % [key, wheel.life])
		elif wheel.core > tyre_rules.spec(c.compound).optimum + 20: messages.append("%s core hot · conserve pace" % key)
	if c.engine_temperature > tuning.condition.heat_reference_c: messages.append("Engine hot · reduce engine mode")
	if c.fuel < maxf(0, laps - c.distance / track.length): messages.append("Fuel projection short · consider economy mode")
	return messages

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
	return RaceContentSnapshot.options(result)
