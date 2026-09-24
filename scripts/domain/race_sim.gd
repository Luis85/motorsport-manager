class_name RaceSim
extends RefCounted
## Fixed-step, seeded simulation. No UI, wall-clock or scene-tree dependencies.
signal event_posted(entry: Dictionary)
const STEP = 0.05
const ACTIVE = ["practice", "qualifying", "formation", "lights", "race"]
const TYRES = {"S": {"grip": 1.035, "wear": 5.5}, "M": {"grip": 1.0, "wear": 3.6}, "H": {"grip": 0.98, "wear": 2.4}, "I": {"grip": 0.95, "wear": 4.0}, "W": {"grip": 0.91, "wear": 4.5}}
const ROSTER = [
	["VAL", "Nico Valenti", "Volpe", "c46356", 91, 87, 82, 85, 3],
	["REI", "Felix Reinhardt", "Aster", "d5d6c8", 88, 95, 81, 91, 4],
	["BEL", "Julien Bellamy", "Veridian", "69a283", 88, 90, 92, 88, 5],
	["MER", "Daniel Mercer", "Obsidian", "e2bb69", 88, 96, 85, 91, 8],
	["SOR", "Erik Soren", "Nordstar", "79a9c4", 86, 89, 83, 87, 11],
	["ROS", "Matteo Rossi", "Volpe", "c46356", 84, 78, 78, 83, 6],
	["MOR", "Lucas Moreau", "Obsidian", "79b4a3", 85, 85, 96, 90, 9],
	["TAN", "Kenji Tanaka", "Nordstar", "79a9c4", 82, 91, 87, 89, 12],
	["DAR", "Alex Darcy", "Kestrel", "ac98c0", 83, 80, 81, 82, 14],
	["KIE", "Jonas Kiefer", "Aster", "d5d6c8", 81, 92, 79, 92, 7],
	["COS", "Rafael Costa", "Veridian", "69a283", 82, 85, 89, 86, 15],
	["HAR", "Theo Hart", "Kestrel", "ac98c0", 79, 74, 76, 81, 16]]
const CAR_V2 = {"yield_to": -1, "yield_side": 0.0, "yield_clock": 0.0, "qual_history": [], "qual_sectors": [0.0, 0.0, 0.0], "qual_sector_start": 0.0, "invalid_reason": "", "throttle": 0.0, "braking": 0.0, "pit_deferred": false, "pit_lap": false, "service_compound": "M", "service_repair": true}
var track: TrackGeometry
var cars: Array = []
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

func _init(geometry: TrackGeometry = null, options: Dictionary = {}) -> void:
	if geometry == null: return
	track = TrackGeometry.new(geometry.document, geometry.preset) if geometry.preview_only else geometry
	laps = clampi(int(options.get("laps", 12)), 1, 100)
	qual_duration = maxf(float(options.get("qual_duration", 480)), track.estimate * 3.5)
	scenario = options.get("scenario", "changeable")
	weather_name = "Steady rain" if scenario == "wet" else "Clear skies"
	intensity = options.get("intensity", "standard")
	seed_value = int(options.get("seed", 7314)) & 0xffffffff
	rng_state = seed_value
	for i in range(96): water.append(0.6 if scenario == "wet" else 0.0); rubber.append(0.12)
	surface = RaceSurface.create(track, water, rubber)
	for i in range(ROSTER.size()):
		var r = ROSTER[i]
		cars.append({"id": i, "short": r[0], "name": r[1], "team": r[2], "color": r[3], "skill": r[4], "consistency": r[5], "wet_skill": r[6], "reliability": r[7], "number": r[8], "player": r[2] == "Obsidian", "grid": i + 1, "distance": -i * track.grid_spacing, "previous_distance": -i * track.grid_spacing, "speed": 0.0, "lane": (-1 if i % 2 == 0 else 1) * 2.0, "route": "track", "pace": 1, "engine": 1, "auto": true, "compound": "I" if scenario == "wet" else "M", "tyre": 100.0, "temperature": 65.0, "fuel": float(laps) * 1.13 + 1.5, "health": 100.0, "damage": 0.0, "qual_state": "garage", "qual_runs": 0, "next_qual": 2.0 + i * 3.8, "qual_best": 0.0, "qual_laps": 0, "hot_start": 0.0, "hot_valid": true, "lap_start": 0.0, "last_lap": 0.0, "best_lap": 0.0, "completed": 0, "sectors": [0.0, 0.0, 0.0], "sector_start": 0.0, "pit_order": false, "next_compound": "M", "repair": true, "pit_d": 0.0, "pit_cycle": 0, "pit_stage": "", "pit_timer": 0.0, "pit_stops": 0, "box_d": track.pit_length * (0.30 + ["Volpe", "Aster", "Veridian", "Obsidian", "Nordstar", "Kestrel"].find(r[2]) * 0.055), "loss": 0.0, "dnf": false, "retire_reason": "", "finished": false, "finish_position": 0, "finish_time": 0.0, "formation_done": false, "blue": false, "ai_clock": 0.0, "intent": "Ready for the weekend", "history": [], "setup": 5, "telemetry": [], "last_trace": 0.0, "pit_gate": -1.0, "crossed_at": -1.0, "previous_pit_d": 0.0, "previous_lane": 0.0, "previous_route": "track"})
	for car in cars:
		car.merge(CAR_V2.duplicate(true)); TyreInventory.initialize(car); CarSetup.initialize(car)
	post("weekend", "%s · %d racing laps · %s" % [track.document.name, laps, track.preset])

func random_value() -> float:
	rng_state = (1664525 * rng_state + 1013904223) & 0xffffffff
	return float(rng_state) / 4294967296.0

func post(kind: String, text: String) -> void:
	var entry = {"time": total_time, "session_time": clock, "phase": phase, "kind": kind, "text": text}
	events.append(entry)
	if events.size() > 2000: events.pop_front()
	event_posted.emit(entry)

func transition(next: String) -> void:
	phase = next; clock = 0.0; accumulator = 0.0; paused = false
	post("session", next.replace("_", " ").capitalize())

func command(action: String, payload: Dictionary = {}) -> bool:
	last_error = ""
	var id = int(payload.get("id", selected_id))
	if id < 0 or id >= cars.size(): return fail("Unknown driver.")
	var c = cars[id]
	match action:
		"qualify":
			if phase != "briefing": return fail("Qualifying is only available at the briefing.")
			transition("qualifying")
			for car in cars:
				car.route = "garage"
				if car.auto: car.next_compound = "I" if average(water) > 0.25 else "S"; car.next_set_id = ""
		"close_qualifying":
			if phase != "qualifying" or qual_closed: return fail("Qualifying is not open.")
			qual_closed = true; post("flag", "Qualifying chequered: active flying laps may finish; no new runs.")
		"prepare_race":
			if phase not in ["briefing", "qualifying_results"]: return fail("Finish the current session first.")
			transition("race_preparation")
			for car in cars:
				car.route = "track"; car.distance = -(car.grid - 1) * track.grid_spacing; car.previous_distance = car.distance
				car.lane = (-1 if car.grid % 2 else 1) * 2.0
				car.next_compound = recommended_compound(); car.next_set_id = ""
				car.fuel = laps * 1.13 + 1.5; car.stints.clear(); car.scheduled_lap = -1
				car.last_lap = 0.0; car.best_lap = 0.0; car.lap_start = 0.0; car.pit_lap = false
				car.sectors = [0.0, 0.0, 0.0]; car.sector_start = 0.0; car.yield_to = -1; car.yield_side = 0.0; car.blue = false
		"formation":
			if phase != "race_preparation": return fail("Prepare the race before formation.")
			for car in cars:
				if TyreInventory.planned(car).is_empty(): return fail(car.short + ": select a usable starting set before formation.")
			for car in cars:
				var item = TyreInventory.planned(car); TyreInventory.mount(car, item.id)
				car.next_set_id = ""; car.formation_done = false; car.speed = 0.0; car.pit_order = false
			transition("formation")
		"lights":
			if phase != "grid_ready": return fail("All cars must complete formation first.")
			transition("lights")
		"pause":
			if phase not in ACTIVE: return fail("No live session to pause.")
			paused = not paused
		"speed":
			var value = int(payload.get("value", 1))
			if value not in [1, 2, 4, 8, 16]: return fail("Invalid simulation speed.")
			speed = value
		"pace", "engine", "auto", "compound", "pit", "cancel_pit", "send", "recall", "setup", "repair", "select_set", "schedule_pit", "cancel_schedule", "setup_all", "brake_bias", "battle_mode":
			if not c.player: return fail("You manage the two Obsidian drivers only.")
			if c.dnf or c.finished: return fail("This car is no longer running.")
			match action:
				"pace", "engine":
					var value = int(payload.get("value", 1))
					if value < 0 or value > 2: return fail("Invalid driving mode.")
					c[action] = value; c.auto = false
				"select_set":
					if c.route == "pit": return fail("The tyre plan is locked until pit exit.")
					var item = TyreInventory.find(c, str(payload.get("set_id", "")))
					if not WheelTyres.usable(item): return fail("That set is exhausted or does not belong to this driver.")
					if phase == "race" and item.id == c.set_id: return fail("Choose a different set for the next stop.")
					c.next_compound = item.compound; c.next_set_id = item.id
				"schedule_pit":
					if phase != "race" or c.route != "track" or c.pit_order: return fail("Schedule an on-track car with no existing pit order.")
					var lap = payload.get("lap", -1)
					if not RaceCheckpoint.integral(lap, 1, laps - 1): return fail("Choose a racing lap before the final lap.")
					var gate = (int(lap) - 1) * track.length + track.pit_entry
					var stopping = maxf(0, c.speed ** 2 - track.pit_limit ** 2) / (2 * TrackGeometry.PRESETS[track.preset].brake * 0.5) + 12
					if gate - c.distance <= stopping: return fail("Too late for that lap's pit entry; choose a later lap.")
					if TyreInventory.planned(c, true).is_empty(): return fail("No usable replacement set. Select another compound or set.")
					c.scheduled_lap = int(lap); c.pit_gate = gate; c.pit_order = true; c.pit_deferred = false; c.auto = false
				"cancel_schedule":
					if c.scheduled_lap < 1 or c.route != "track": return fail("There is no cancellable scheduled stop.")
					c.scheduled_lap = -1; c.pit_order = false; c.pit_gate = -1.0; c.pit_deferred = false
				"repair": c.repair = bool(payload.get("value", true))
				"auto": c.auto = bool(payload.get("value", not c.auto))
				"compound":
					var value = str(payload.get("value", "M"))
					if not TYRES.has(value): return fail("Unknown tyre compound.")
					if c.route == "pit": return fail("The tyre plan is locked until pit exit.")
					if TyreInventory.choose(c, value, phase == "race").is_empty(): return fail("No usable set of that compound remains.")
					c.next_compound = value; c.next_set_id = ""
				"pit":
					if phase != "race" or c.route != "track": return fail("Pit calls require a car racing on track.")
					if TyreInventory.planned(c, true).is_empty(): return fail("No usable replacement set. Select another compound or set.")
					c.scheduled_lap = -1; queue_pit(c); c.auto = false
				"cancel_pit":
					if c.route != "track": return fail("Already committed to the pit lane.")
					c.pit_order = false; c.pit_gate = -1.0; c.pit_deferred = false; c.scheduled_lap = -1
				"send":
					if phase != "qualifying" or qual_closed or c.route != "garage": return fail("Garage release unavailable.")
					if TyreInventory.planned(c).is_empty(): return fail("No usable set selected for this run.")
					leave_garage(c)
				"recall":
					if phase != "qualifying" or c.route != "track": return fail("Only an on-track qualifying car can be recalled.")
					c.qual_state = "inlap"; c.hot_valid = false; c.invalid_reason = "Recalled by the pit wall"
				"setup", "setup_all":
					if phase not in ["briefing", "race_preparation"] and not (is_run_session() and c.route == "garage"): return fail("Mechanical setup changes require the garage or race preparation.")
					var changes = {"wing": payload.get("value", 5)} if action == "setup" else payload.get("values", {})
					if not changes is Dictionary or changes.is_empty(): return fail("Choose at least one setup adjustment.")
					for key in changes:
						if not CarSetup.SPECS.has(key) or not RaceCheckpoint.integral(changes[key], CarSetup.SPECS[key][0], CarSetup.SPECS[key][1]): return fail("Setup value is outside the available range.")
					for key in changes: c.car_setup[key] = int(changes[key])
					c.setup = c.car_setup.wing
				"brake_bias":
					if phase != "race" or c.route != "track": return fail("Live brake bias is available on the racing track.")
					if not RaceCheckpoint.integral(payload.get("value"), 52, 62): return fail("Brake bias must be 52–62% front.")
					c.car_setup.bias = int(payload.value)
				"battle_mode":
					if payload.get("value") not in ["patient", "balanced", "assertive"]: return fail("Choose patient, balanced or assertive racecraft.")
					c.battle_mode = payload.value
			post("radio", "%s · %s %s" % [c.short, action.replace("_", " "), str(payload.get("value", ""))])
		_: return fail("Unknown command: " + action)
	commands.append({"tick": snappedf(total_time, STEP), "action": action, "payload": payload.duplicate(true)})
	return true

func fail(message: String) -> bool:
	last_error = message
	return false

func advance(real_delta: float) -> void:
	if paused or phase not in ACTIVE: return
	accumulator += clampf(real_delta, 0, 0.25) * speed
	var ticks = 0
	while accumulator + 0.0000001 >= STEP and phase in ACTIVE and ticks < 100:
		accumulator = maxf(0, accumulator - STEP)
		step(); ticks += 1

func step() -> void:
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
			WheelTyres.cool(stored_set, STEP); c.tyre = stored_set.life; c.temperature = stored_set.temperature
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

func update_flags() -> void:
	# Legacy procedure remains unchanged; newer rulesets override this tick-boundary seam.
	if flag != "GREEN" and clock >= flag_until:
		if flag == "SAFETY CAR": flag = "RESTART"; flag_until = clock + 8.0
		else: flag = "GREEN"; yellow_sector = -1
		post("flag", flag)

func forecast_parameters(_driver_id: int) -> Dictionary:
	# Allow-listed observable model parameters; never expose a random stream or future event.
	return {}

func neutral_speed_limit(_c: Dictionary, _sample: Dictionary) -> float:
	return 25.0 if flag == "YELLOW" else 30.0

func constrain_progress(_c: Dictionary, next: float, _old: Array, _nearest: int) -> float:
	return next

func average(values: Array) -> float:
	var sum = 0.0
	for value in values: sum += value
	return sum / maxf(1, values.size())

func update_surface() -> void:
	var target = 0.0; var label = "Clear skies"
	if scenario == "wet":
		target = 0.65 if phase != "race" or clock < 170 else (0.18 if clock < 280 else 0.0)
		label = "Steady rain" if target > 0.4 else ("Rain easing" if target > 0 else "Drying line")
	elif scenario == "changeable" and phase == "race":
		var expected = track.estimate * laps
		var fraction = clock / maxf(120, expected)
		target = 0.8 if fraction > 0.32 and fraction < 0.61 else (0.2 if fraction > 0.25 and fraction < 0.7 else 0.0)
		label = "Heavy shower" if target > 0.5 else ("Light rain" if target > 0 else "Clear skies")
	rain = target
	if label != weather_name: weather_name = label; post("weather", label + ". Surface water changes gradually.")
	surface_accumulator += STEP
	if surface_accumulator + 0.0000001 >= RaceSurface.INTERVAL:
		surface_accumulator = maxf(0, surface_accumulator - RaceSurface.INTERVAL)
		RaceSurface.evolve(surface, rain, RaceSurface.INTERVAL, total_time)
		RaceSurface.profiles(surface, water, rubber)

func surface_at(c: Dictionary) -> Dictionary:
	return RaceSurface.sample(surface, c.distance / track.length, c.lane)

func recommended_compound() -> String:
	var wet = average(water)
	return "W" if wet > 0.68 else ("I" if wet > 0.24 else "M")

func engineer(c: Dictionary) -> void:
	if not c.auto or phase != "race" or c.route != "track" or c.dnf or c.finished: return
	var remaining = maxf(0, laps - c.distance / track.length)
	var emergency = not WheelTyres.usable(TyreInventory.find(c, c.set_id))
	c.pace = 0 if emergency or c.tyre < 30 or flag != "GREEN" else 1
	c.engine = 0 if emergency or c.fuel < remaining * 1.03 else 1
	var recommended = recommended_compound()
	var ordinary_stop = remaining > 0.8 and c.distance > track.length * 0.25 and (c.tyre < 25 or c.compound != recommended and (recommended in ["I", "W"] or c.compound in ["I", "W"]) or c.damage > 24)
	if not emergency and not ordinary_stop: return
	# A failed tyre is not a routine strategy stop: first-lap and late-lap gates
	# must not suppress recovery. Only delegated control may revise a future stop.
	if c.pit_order and (not emergency or c.scheduled_lap < 0): return
	var replacement = TyreInventory.choose(c, recommended, true)
	if replacement.is_empty(): replacement = TyreInventory.choose(c, c.compound, true)
	if replacement.is_empty() and emergency:
		for compound in TYRES:
			replacement = TyreInventory.choose(c, compound, true)
			if not replacement.is_empty(): break
	if replacement.is_empty():
		c.intent = "No sound replacement available; protecting the car"
		return
	c.next_compound = replacement.compound; c.next_set_id = replacement.id
	c.scheduled_lap = -1; queue_pit(c)
	post("pit", "%s: engineer calls %s tyres%s." % [c.short, c.next_compound, " for a damaged tyre; next safe entry" if emergency else ""])

func grip(c: Dictionary, _cell: int, local: Dictionary = {}) -> float:
	if local.is_empty(): local = surface_at(c)
	var wet = local.water
	var match_factor = 1.0
	if c.compound in ["S", "M", "H"]: match_factor = maxf(0.4, 1 - maxf(0, wet - 0.07) * 0.85)
	elif c.compound == "I": match_factor = 0.88 + wet * 0.2 - maxf(0, wet - 0.72) * 0.7
	else: match_factor = 0.77 + wet * 0.33
	var wheel_factor = WheelTyres.grip(TyreInventory.find(c, c.set_id))
	return clampf(local.grip * TYRES[c.compound].grip * match_factor * wheel_factor, 0.16, 1.1)

func neutral(c: Dictionary) -> bool:
	return phase == "formation" or flag in ["SAFETY CAR", "RESTART"] or flag == "YELLOW" and track.sector_at(c.distance) == yellow_sector

func move_car(c: Dictionary, old: Array) -> void:
	var s = track.sample(c.distance)
	var cell = int(fposmod(c.distance / track.length, 1) * 96)
	var local = surface_at(c)
	var g = grip(c, cell, local)
	var effects = CarSetup.effects(c, local.water)
	var handling = (1.0 + (c.skill - 85) * 0.002) * lerpf(1.0, effects.corner, clampf(absf(s.curvature) * 100, 0, 1))
	handling *= 1.0 + (c.wet_skill - 85) * 0.004 * local.water
	var desired = s.speed * sqrt(g) * handling * (1 - c.damage * 0.003) * (0.988 if c.pace == 0 else (1.01 if c.pace == 2 else 1.0))
	desired *= (0.974 if c.engine == 0 else (1.014 if c.engine == 2 else 1.0))
	desired *= (1.0 - maxf(0, 65 - c.health) * 0.002) / (1.0 + c.fuel * 0.0007)
	if absf(s.curvature) < 0.005: desired *= effects.straight
	desired *= 1.0 - maxf(0, c.engine_temperature - 115) * 0.003
	if not WheelTyres.usable(TyreInventory.find(c, c.set_id)): desired = minf(desired, 27.0)
	var target_lane = s.line
	if is_run_session() and c.qual_state != "hotlap": desired = minf(desired * 0.76, 48)
	if phase == "formation":
		desired = minf(desired * 0.65, 30)
		var goal = track.length - (c.grid - 1) * track.grid_spacing
		var remaining = maxf(0, goal - c.distance)
		desired = minf(desired, sqrt(2 * 6 * remaining))
		if remaining < 100: target_lane = (-1 if c.grid % 2 else 1) * 2.0
		if clock < (c.grid - 1) * 0.22: desired = 0.0
	if neutral(c): desired = minf(desired, neutral_speed_limit(c, s))
	if phase == "race" and clock < 0.15 + (100 - c.skill) * 0.008: desired = 0.0
	if phase == "race" and clock < 3.0: target_lane = (-1 if c.grid % 2 else 1) * 2.0
	var nearest_id = -1; var ahead_distance = INF
	var was_blue = c.blue
	var courtesy_target = update_yield(c, old)
	c.blue = c.yield_to >= 0 and phase == "race"
	if c.yield_to >= 0:
		target_lane = courtesy_target
		if absf(c.lane - old[c.yield_to].lane) > 2.6: desired = minf(desired, 43)
	for other in cars:
		if other.id == c.id or other.dnf or other.finished or old[other.id].route != "track": continue
		var delta = fposmod(old[other.id].distance - old[c.id].distance, track.length)
		if delta > 0.005 and delta < ahead_distance: ahead_distance = delta; nearest_id = other.id
	if c.blue and not was_blue:
		stats.blue_flags += 1; post("flag", c.short + " yields under blue flags.")
	var passing = false
	if nearest_id >= 0 and ahead_distance < 75:
		if phase == "race" and not neutral(c): desired *= 1.022 if absf(s.curvature) < 0.004 else 0.991
	var traffic = traffic_instruction(c, old, nearest_id, ahead_distance, desired, target_lane, s, local)
	desired = traffic.desired; target_lane = traffic.lane
	if traffic.attempt and nearest_id >= 0: passing = absf(c.lane - old[nearest_id].lane) >= 2.6
	if nearest_id >= 0 and ahead_distance < 75 and not passing and ahead_distance < maxf(12, c.speed * 0.8):
		desired = minf(desired, maxf(0, old[nearest_id].speed + (ahead_distance - 7) * 0.7))
	# Do not sweep across an occupied lateral lane.
	for other in cars:
		if other.id == c.id or other.dnf or old[other.id].route != "track": continue
		var longitudinal = fposmod(old[other.id].distance - old[c.id].distance + track.length * 0.5, track.length) - track.length * 0.5
		if absf(longitudinal) < 7:
			var separation: float = c.lane - old[other.id].lane
			var clearance = TrackGeometry.PRESETS[track.preset].width + 0.25
			# Keep occupied lanes separated without ever displacing an already overlapping car.
			if separation > 0: target_lane = maxf(target_lane, minf(c.lane, old[other.id].lane + clearance))
			elif separation < 0: target_lane = minf(target_lane, maxf(c.lane, old[other.id].lane - clearance))
	c.lane = move_toward(c.lane, clampf(target_lane, -s.w * 0.5 + 1.1, s.w * 0.5 - 1.1), STEP * 1.8)
	var limits = TrackGeometry.PRESETS[track.preset]
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
	c.speed = move_toward(c.speed, maxf(0, desired), STEP * (accel if desired > c.speed else brake))
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
		var touched = RaceSurface.deposit(surface, track.length, c, old_distance, next, s.curvature)
		if not touched.is_empty(): RaceSurface.profiles(surface, water, rubber, touched)
	if phase == "race": race_crossings(c, old_distance, next)
	elif is_run_session(): qualifying_crossings(c, old_distance, next)
	if passing and nearest_id >= 0 and ahead_distance < moved - old[nearest_id].speed * STEP / track.sample(old[nearest_id].distance).path_scale and phase == "race":
		record_track_pass(c, cars[nearest_id])
	c.intent = "Blue flag · yielding" if c.blue else (pit_status(c) if c.pit_order else ("Formation · hold order" if phase == "formation" else (c.qual_state.capitalize() if is_run_session() else "Racing")))
	if phase == "race" and intensity != "calm" and not neutral(c) and c.route == "track":
		var risk = 0.000018 * (1 + (100 - c.consistency) * 0.055) * (1 + (100 - c.reliability) * 0.015) * (1.5 if c.pace == 2 else 1.0) * (1 + local.water * 3.5 + maxf(0, 25 - c.tyre) * 0.06)
		risk *= {"patient": 0.9, "balanced": 1.0, "assertive": 1.12}[c.battle_mode]
		if random_value() < risk * STEP * (2.2 if intensity == "volatile" else 1): incident(c)
	if total_time - c.last_trace >= 1:
		c.last_trace = total_time
		c.telemetry.append([total_time, c.speed * 3.6, c.tyre, c.fuel, (c.speed - old_speed) / STEP])
		if c.telemetry.size() > 120: c.telemetry.pop_front()

func traffic_instruction(c: Dictionary, old: Array, nearest: int, gap: float, desired: float, lane: float, sample: Dictionary, local: Dictionary) -> Dictionary:
	var result = {"desired": desired, "lane": lane, "attempt": false, "block_pass": false}
	if nearest < 0 or gap >= 75: return result
	if c.yield_to < 0 and not neutral(c) and phase != "formation" and absf(sample.curvature) < 0.035 and sample.w > 7.5 and desired > old[nearest].speed + ({"patient": 2.0, "balanced": 0.4, "assertive": 0.1}[c.battle_mode]) and not (c.battle_mode == "patient" and local.water > 0.5):
		var side = -1 if old[nearest].lane >= 0 else 1
		result.lane = clampf(old[nearest].lane + side * 3.0, -sample.w * 0.5 + 1.4, sample.w * 0.5 - 1.4)
		result.attempt = true
	return result

func record_track_pass(c: Dictionary, other: Dictionary) -> void:
	stats.passes += 1; post("pass", "%s passes %s on track." % [c.short, other.short])

func wear_car(c: Dictionary, distance: float, cell: int, effects: Dictionary = {}, local: Dictionary = {}) -> void:
	if local.is_empty(): local = surface_at(c)
	var fraction = distance / track.length
	var effort = 0.55 if phase == "formation" else (1.25 if c.pace == 2 else (0.78 if c.pace == 0 else 1.0))
	var mismatch = 2.2 if c.compound in ["I", "W"] and local.water < 0.15 else 1.0
	var item = TyreInventory.find(c, c.set_id)
	var curve = track.sample(c.distance).curvature if c.route == "track" else 0.0
	if effects.is_empty(): effects = CarSetup.effects(c, local.water)
	WheelTyres.update(item, {"speed": c.speed, "curve": curve, "bias": c.car_setup.bias / 100.0, "brake": c.braking, "throttle": c.throttle, "slip": absf(effects.balance), "water": local.water, "push": effort, "neutral": neutral(c), "care": c.consistency, "wear": TYRES[c.compound].wear * fraction * effort * mismatch, "lap": fraction}, STEP)
	c.tyre = item.life; c.temperature = item.temperature
	var engine_target = 91 + c.engine * 8 - (c.car_setup.cooling - 5) * 3 + c.throttle * 12 - local.water * 8
	c.engine_temperature = lerpf(c.engine_temperature, engine_target, 1 - exp(-STEP * 0.035))
	c.brake_temperature = lerpf(c.brake_temperature, 100 + c.braking * 680 + c.speed * 0.6, 1 - exp(-STEP * 0.09))
	if phase == "race" and not neutral(c) and total_time >= c.tyre_event_clock:
		c.tyre_event_clock = total_time + 2.0
		check_tyre_incident(c)
	var fuel_rate = 0.60 if phase == "formation" or is_run_session() and c.qual_state != "hotlap" else ([0.84, 1.0, 1.14][c.engine])
	c.fuel = maxf(0, c.fuel - fraction * fuel_rate)
	c.health = maxf(0, c.health - fraction * (0.4 if c.engine < 2 else 0.65) * (1 + maxf(0, c.engine_temperature - 112) * 0.04))
	TyreInventory.sync(c)
	if c.fuel <= 0.00001 and phase == "race": retire(c, "Out of fuel")

func qualifying_crossings(c: Dictionary, before: float, after: float) -> void:
	if c.qual_state == "hotlap":
		var base_lap = int(floor(before / track.length))
		for i in range(3):
			var gate: float = base_lap * track.length + track.sector_ends[i]
			if before < gate and after >= gate:
				var at = clock - STEP * (after - gate) / maxf(0.000001, after - before)
				c.qual_sectors[i] = maxf(0, at - c.qual_sector_start); c.qual_sector_start = at
				c.sectors = c.qual_sectors.duplicate()
	if floor(before / track.length) == floor(after / track.length): return
	var boundary = floor(after / track.length) * track.length
	var crossed_at = clock - STEP * (after - boundary) / maxf(0.000001, after - before)
	if c.qual_state == "outlap":
		if qual_closed: c.qual_state = "inlap"
		else:
			c.qual_state = "hotlap"; c.hot_start = crossed_at; c.hot_valid = true
			c.invalid_reason = ""; c.qual_sectors = [0.0, 0.0, 0.0]; c.qual_sector_start = crossed_at
	elif c.qual_state == "hotlap":
		var time = crossed_at - c.hot_start
		c.qual_history.append({"run": c.qual_runs, "time": time, "sectors": c.qual_sectors.duplicate(), "valid": c.hot_valid, "reason": c.invalid_reason, "compound": c.compound})
		if c.qual_history.size() > 100: c.qual_history.pop_front()
		if c.hot_valid and time > 1:
			c.qual_laps += 1; c.last_lap = time
			if c.qual_best == 0 or time < c.qual_best: c.qual_best = time
			post("lap", "%s sets %s in qualifying." % [c.short, format_time(time)])
		else: post("lap", "%s flying lap invalid: %s." % [c.short, c.invalid_reason])
		c.qual_state = "inlap"; c.pit_gate = -1.0

func finish_qualifying() -> void:
	var order = standings(true)
	for i in range(order.size()): order[i].grid = i + 1
	transition("qualifying_results")

func is_run_session() -> bool:
	return phase == "qualifying"

func leave_garage(c: Dictionary) -> void:
	depart_on_planned_set(c)

func depart_on_planned_set(c: Dictionary) -> void:
	# Shared physical departure; eligibility is owned by the session orchestrator.
	var item = TyreInventory.planned(c)
	if item.is_empty(): c.next_qual = clock + 60; c.intent = "No usable tyre set; choose a replacement"; return
	TyreInventory.mount(c, item.id)
	c.route = "pit"; c.pit_stage = "exit"; c.pit_d = c.box_d
	c.pit_cycle = 0; c.pit_gate = -1.0; c.qual_state = "outlap"; c.qual_runs += 1; c.fuel = 4.0; c.speed = 0.0
	c.distance = track.pit_entry + (track.pit_exit - track.pit_entry) * c.pit_d / track.pit_length
	post(phase, "%s leaves the garage for run %d." % [c.short, c.qual_runs])

func update_pit(c: Dictionary, old: Array = []) -> void:
	var before = c.distance
	var previous_pit_d = c.pit_d
	c.intent = ("Crew fitting tyres and repairing damage" if c.service_repair else "Crew fitting tyres") if c.pit_stage == "service" else "Pit lane · speed limiter active"
	if c.pit_stage == "entry" and c.pit_d >= c.box_d:
		c.pit_d = c.box_d; c.speed = 0.0
		if is_run_session():
			c.route = "garage"; c.qual_state = "garage"; c.next_qual = clock + 18; c.pit_stage = ""
			post(phase, c.short + " back in the garage."); return
		if not pit_boxes.has(c.team):
			pit_boxes[c.team] = c.id; c.pit_stage = "service"; begin_service(c)
		else: c.intent = "Waiting for teammate's pit box"; return
	if c.pit_stage == "service":
		c.speed = 0.0; c.pit_timer -= STEP
		if c.pit_timer <= 0:
			complete_service(c)
			c.pit_stops += 1; stats.pits += 1; c.pit_stage = "exit"; pit_boxes.erase(c.team)
			post("pit", "%s serviced · %s tyres." % [c.short, c.compound])
		return
	var target = track.pit_limit
	if c.pit_stage == "entry": target = minf(target, sqrt(2 * 8 * maxf(0, c.box_d - c.pit_d)))
	c.speed = move_toward(c.speed, target, STEP * (5 if target > c.speed else 8))
	var next = minf(track.pit_length, c.pit_d + c.speed * STEP)
	if c.pit_stage == "entry": next = minf(next, c.box_d)
	# Use the same pre-tick snapshot as on-track movement. Do not step through a queue.
	for other in cars:
		if other.id == c.id or other.dnf: continue
		var state: Dictionary = old[other.id] if old.size() == cars.size() else other
		if state.route != "pit" or state.pit_stage == "service": continue
		var gap: float = state.pit_d - previous_pit_d
		if gap > 0.001 and gap < 30:
			var limit: float = state.pit_d - 6.5
			if next > limit:
				next = maxf(previous_pit_d, limit); c.speed = maxf(0, (next - previous_pit_d) / STEP)
				c.intent = "Pit lane · queue ahead"
	if next >= track.pit_length:
		var safe = true
		for other in cars:
			if other.id != c.id and other.route == "track" and not other.dnf and not other.finished:
				var behind = fposmod(track.pit_exit - other.distance, track.length)
				if behind < maxf(15, other.speed * 1.2) or track.length - behind < 8: safe = false
		if not safe: c.speed = 0.0; c.intent = "Pit exit · waiting for safe gap"; return
	c.pit_d = next
	wear_car(c, maxf(0, next - previous_pit_d), int(fposmod(c.distance / track.length, 1) * 96))
	c.distance = c.pit_cycle * track.length + track.pit_entry + (track.pit_exit - track.pit_entry) * c.pit_d / track.pit_length
	if phase == "race": race_crossings(c, before, c.distance)
	if next >= track.pit_length:
		c.route = "track"; c.pit_stage = ""; c.pit_order = false; c.pit_gate = -1.0; c.pit_deferred = false; c.lane = track.sample(c.distance).line
		post("pit", pit_exit_message(c))

func pit_exit_message(c: Dictionary) -> String:
	return c.short + " rejoins on cold tyres."

func service_random_value() -> float:
	return random_value()

func begin_service(c: Dictionary) -> void:
	var item = TyreInventory.planned(c, true)
	c.service_set_id = item.get("id", "")
	c.service_compound = c.next_compound; c.service_repair = c.repair
	c.pit_timer = 3.0 + service_random_value() * 1.5 + (c.damage * 0.14 if c.service_repair else 0.0)

func complete_service(c: Dictionary) -> void:
	if not c.service_set_id.is_empty(): TyreInventory.mount(c, c.service_set_id)
	else: post("pit", c.short + ": no replacement available; retaining the current tyres.")
	record_stint(c)
	c.next_set_id = ""; c.scheduled_lap = -1
	if c.service_repair: c.damage = 0.0

func race_crossings(c: Dictionary, before: float, after: float) -> void:
	if c.finished or c.dnf: return
	var base_lap = int(floor(maxf(0, before) / track.length))
	for lap_index in range(base_lap, base_lap + 2):
		for i in range(3):
			var gate = lap_index * track.length + track.sector_ends[i]
			if before < gate and after >= gate:
				var at = clock - STEP * (after - gate) / maxf(0.000001, after - before)
				c.sectors[i] = at - c.sector_start; c.sector_start = at
	if floor(before / track.length) == floor(after / track.length) or after < track.length: return
	c.completed = int(floor(after / track.length))
	var boundary = c.completed * track.length
	var crossed_at = clock - STEP * (after - boundary) / maxf(0.000001, after - before)
	c.last_lap = crossed_at - c.lap_start; c.lap_start = crossed_at
	if not c.pit_lap and (c.best_lap == 0 or c.last_lap < c.best_lap): c.best_lap = c.last_lap
	if not c.pit_lap and (fastest == 0 or c.last_lap < fastest): fastest = c.last_lap
	c.history.append({"lap": c.completed, "time": c.last_lap, "compound": c.compound, "pit_lap": c.pit_lap, "sectors": c.sectors.duplicate()})
	c.pit_lap = c.route == "pit"
	if c.history.size() > 110: c.history.pop_front()
	c.crossed_at = crossed_at

func resolve_finishes() -> void:
	# Resolve every crossing in the tick by interpolated timestamp, not car iteration order.
	var flag_at = -INF if chequered else INF
	if not chequered:
		for c in cars:
			if c.crossed_at >= 0 and c.completed >= laps and not c.dnf: flag_at = minf(flag_at, c.crossed_at)
		if is_finite(flag_at): chequered = true; post("flag", "Chequered flag. Cars finish at their next crossing.")
	if not chequered: return
	var pending: Array = []
	for c in cars:
		if not c.dnf and not c.finished and c.crossed_at >= 0 and c.crossed_at >= flag_at: pending.append(c)
	pending.sort_custom(func(a, b): return a.crossed_at < b.crossed_at if a.crossed_at != b.crossed_at else a.grid < b.grid)
	for c in pending:
		finish_count += 1; c.finished = true; c.finish_position = finish_count; c.finish_time = c.crossed_at; c.speed = 0.0
		post("finish", "%s takes the chequered flag after %d laps." % [c.short, c.completed])
	var classified = standings()
	for i in range(classified.size()):
		if classified[i].finished: classified[i].finish_position = i + 1

func queue_pit(c: Dictionary) -> void:
	c.pit_order = true
	plan_pit_gate(c)

func plan_pit_gate(c: Dictionary) -> void:
	c.pit_deferred = false
	c.pit_gate = (floor((c.distance - track.pit_entry) / track.length) + 1) * track.length + track.pit_entry
	var stopping = maxf(0, c.speed ** 2 - track.pit_limit ** 2) / (2 * TrackGeometry.PRESETS[track.preset].brake * 0.5) + 8
	if c.pit_gate - c.distance < stopping:
		c.pit_gate += track.length; c.pit_deferred = true
		post("pit", c.short + ": too late to brake safely; pit entry deferred one lap.")

func incident(c: Dictionary) -> void:
	RaceSurface.contaminate(surface, c.distance / track.length, c.lane, 0.20, c.health < 50)
	stats.incidents += 1
	var outcome = random_value()
	if outcome < 0.08:
		retire(c, "Barrier impact"); flag = "SAFETY CAR"; flag_until = clock + 38; post("flag", "Safety car deployed for a stranded car.")
	elif outcome < 0.18 and c.health < 95:
		retire(c, "Mechanical failure"); flag = "YELLOW"; yellow_sector = track.sector_at(c.distance); flag_until = clock + 22
	else:
		c.loss = 3 + random_value() * 7; c.damage += 4 + random_value() * 10
		var fitted = TyreInventory.find(c, c.set_id)
		for wheel in WheelTyres.KEYS: fitted.wheels[wheel].life = maxf(0, fitted.wheels[wheel].life - 5)
		WheelTyres.publish(fitted); c.tyre = fitted.life; c.temperature = fitted.temperature
		flag = "YELLOW"; yellow_sector = track.sector_at(c.distance); flag_until = clock + 18
		TyreInventory.sync(c)
		post("incident", c.short + " spins. Local yellow; car recovering.")

func retire(c: Dictionary, reason: String) -> void:
	c.dnf = true; c.speed = 0.0; c.retire_reason = reason; c.completed = int(maxf(0, floor(c.distance / track.length)))
	if pit_boxes.get(c.team, -1) == c.id: pit_boxes.erase(c.team)
	post("retirement", "%s retires: %s." % [c.short, reason])

func standings(qualifying: bool = false) -> Array:
	var order = cars.duplicate()
	order.sort_custom(func(a, b):
		if qualifying:
			if a.qual_best == 0 or b.qual_best == 0:
				if a.qual_best == b.qual_best: return a.grid < b.grid
				return a.qual_best > 0
			return a.qual_best < b.qual_best
		if a.dnf != b.dnf: return not a.dnf
		if a.finished and b.finished:
			if a.completed != b.completed: return a.completed > b.completed
			if a.finish_time != b.finish_time: return a.finish_time < b.finish_time
			return a.grid < b.grid
		if absf(a.distance - b.distance) < 0.0001: return a.grid < b.grid
		return a.distance > b.distance)
	return order

func car_position(c: Dictionary, alpha: float = 1.0) -> Dictionary:
	if c.route != c.previous_route: alpha = 1.0
	if c.route in ["pit", "garage"]:
		var s = track.pit_sample(c.box_d if c.route == "garage" else lerpf(c.previous_pit_d, c.pit_d, alpha))
		if c.route == "garage" or c.pit_stage == "service": s.p += s.n * (4.0 + c.id % 2 * 2.0)
		return s
	var s = track.sample(lerpf(c.previous_distance, c.distance, alpha))
	s.p += s.n * lerpf(c.previous_lane, c.lane, alpha)
	return s

func snapshot() -> Dictionary:
	var saved_cars = cars.duplicate(true)
	for car in saved_cars: TyreInventory.sync(car)
	return {"kind": "motorsport-manager-weekend", "version": 4, "track": track.document.duplicate(true), "vehicle": track.preset, "cars": saved_cars, "phase": phase, "clock": clock, "total_time": total_time, "race_time": race_time, "accumulator": accumulator, "speed": speed, "paused": paused, "laps": laps, "qual_duration": qual_duration, "qual_closed": qual_closed, "scenario": scenario, "intensity": intensity, "rng_state": rng_state, "seed_value": seed_value, "flag": flag, "flag_until": flag_until, "yellow_sector": yellow_sector, "rain": rain, "surface": surface.duplicate(true), "surface_accumulator": surface_accumulator, "water": water.duplicate(), "rubber": rubber.duplicate(), "weather_name": weather_name, "events": events.duplicate(true), "commands": commands.duplicate(true), "pit_boxes": pit_boxes.duplicate(), "chequered": chequered, "finish_count": finish_count, "fastest": fastest, "selected_id": selected_id, "stats": stats.duplicate()}

static func restore(data: Dictionary) -> RaceSim:
	if data.get("kind") != "motorsport-manager-weekend" or not RaceCheckpoint.integral(data.get("version"), 1, 4): return null
	if not TrackDocument.validate(data.get("track")).is_empty() or not data.get("cars") is Array or data.cars.size() != 12: return null
	if data.get("phase") not in ["practice", "practice_results", "briefing", "qualifying", "qualifying_results", "race_preparation", "formation", "grid_ready", "lights", "race", "results"]: return null
	if not data.get("water") is Array or data.water.size() != 96 or not data.get("rubber") is Array or data.rubber.size() != 96: return null
	data = data.duplicate(true)
	if data.version == 1:
		for c in data.cars:
			if not c is Dictionary: return null
			c.merge(CAR_V2.duplicate(true))
			# Legacy service had no frozen plan: retain its accepted next compound/repair choice.
			c.service_compound = c.get("next_compound", "M"); c.service_repair = c.get("repair", true)
			c.pit_lap = c.get("route") == "pit"
	if data.version < 3:
		for c in data.cars:
			if not c is Dictionary or not c.get("compound") in TYRES: return null
			if not RaceCheckpoint.integral(c.get("id"), 0, 11) or not TrackDocument.valid_number(c.get("tyre"), 0, 100) or not TrackDocument.valid_number(c.get("temperature"), 0, 200): return null
			if not c.has("tyre_sets"): TyreInventory.initialize(c)
			if not c.get("service_set_id", "") is String: return null
			if c.get("pit_stage") == "service" and c.get("service_set_id", "").is_empty():
				if not c.get("service_compound") in TYRES: return null
				var item = TyreInventory.choose(c, c.service_compound, true)
				c.service_set_id = item.get("id", "")
	if data.version < 4:
		for car in data.cars:
			if not car is Dictionary or not car.get("tyre_sets") is Array: return null
			for item in car.tyre_sets:
				if not item is Dictionary or not TrackDocument.valid_number(item.get("life"), 0, 100) or not TrackDocument.valid_number(item.get("temperature"), 0, 200): return null
				WheelTyres.initialize(item)
			CarSetup.initialize(car)
	if data.version < 4:
		var legacy_geometry = TrackGeometry.new(data.track, data.get("vehicle", "Formula"))
		for values in [data.water, data.rubber]:
			for value in values:
				if not TrackDocument.valid_number(value, 0, 1): return null
		data.surface = RaceSurface.create(legacy_geometry, data.water, data.rubber); data.surface_accumulator = 0.0
	if not RaceSurface.valid(data.get("surface"), data.water, data.rubber): return null
	if not TrackDocument.valid_number(data.get("surface_accumulator"), 0, RaceSurface.INTERVAL): return null
	if not RaceCheckpoint.valid(data): return null
	var sim = RaceSim.new(TrackGeometry.new(data.track, data.get("vehicle", "Formula")))
	var baseline = sim.cars
	for i in range(12):
		var c = data.cars[i]
		if not c is Dictionary or c.get("id") != i: return null
		for identity in ["short", "name", "team", "color", "number", "player"]:
			if c.get(identity) != baseline[i][identity]: return null
		for key in baseline[i]:
			if not c.has(key): return null
			var expected = baseline[i][key]
			if typeof(expected) in [TYPE_FLOAT, TYPE_INT]:
				if typeof(c[key]) not in [TYPE_FLOAT, TYPE_INT] or not is_finite(c[key]) or absf(c[key]) > 100000000: return null
			elif typeof(c[key]) != typeof(expected): return null
		if not TYRES.has(c.compound) or not TYRES.has(c.next_compound) or c.pace < 0 or c.pace > 2 or c.engine < 0 or c.engine > 2: return null
		if c.route not in ["track", "pit", "garage"] or c.qual_state not in ["garage", "outlap", "hotlap", "inlap"]: return null
	for key in sim.snapshot():
		if key in ["kind", "version", "track", "vehicle", "cars"]: continue
		if not data.has(key): return null
		var expected = sim.get(key)
		if typeof(expected) in [TYPE_FLOAT, TYPE_INT]:
			if typeof(data[key]) not in [TYPE_FLOAT, TYPE_INT] or not is_finite(data[key]) or absf(data[key]) > 10000000000: return null
		elif typeof(data[key]) != typeof(expected): return null
		if key in ["water", "rubber"]:
			for value in data[key]:
				if typeof(value) not in [TYPE_FLOAT, TYPE_INT] or not is_finite(value) or value < 0 or value > 1: return null
		sim.set(key, int(data[key]) if key in ["speed", "laps", "rng_state", "seed_value", "yellow_sector", "finish_count", "selected_id"] else data[key])
	if sim.speed not in [1, 2, 4, 8, 16] or sim.laps < 1 or sim.laps > 100: return null
	sim.cars = data.cars.duplicate(true)
	for c in sim.cars:
		for key in ["id", "grid", "pace", "engine", "qual_runs", "qual_laps", "completed", "pit_cycle", "pit_stops", "finish_position", "setup", "yield_to", "scheduled_lap"]: c[key] = int(c[key])
	return sim

static func format_time(value: float) -> String:
	if value <= 0: return "—"
	return "%d:%06.3f" % [int(value / 60), fmod(value, 60)]

func update_yield(c: Dictionary, old: Array) -> float:
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

func pit_status(c: Dictionary) -> String:
	if c.route == "pit":
		if c.pit_stage == "service": return "Fitting %s · %.1f s remaining\n%s" % [c.service_compound, maxf(0, c.pit_timer), "Repairs included" if c.service_repair else "Tyres only"]
		return c.intent
	if not c.pit_order: return "No pit stop ordered"
	return "%s · entry in %.2f lap" % [("Scheduled lap %d" % c.scheduled_lap) if c.scheduled_lap > 0 else "Deferred to next entry" if c.pit_deferred else "Pit crew ready", maxf(0, c.pit_gate - c.distance) / track.length]


func record_stint(c: Dictionary) -> void:
	var lap = maxf(0, c.distance / track.length)
	if not c.stints.is_empty(): c.stints.back().to = lap
	if c.stints.size() < 110: c.stints.append({"set_id": c.set_id, "from": lap, "to": -1.0})

func strategy_advice(c: Dictionary) -> String:
	var remaining = maxf(0, laps - c.distance / track.length)
	var item = TyreInventory.find(c, c.set_id)
	var reference_wear = TYRES[c.compound].wear * (1.25 if c.pace == 2 else (0.78 if c.pace == 0 else 1.0))
	var estimate = maxf(0, (c.tyre - 20) / reference_wear)
	var next = TyreInventory.planned(c, phase == "race")
	return "Mounted %s · %.1f laps used\nPlan %s\n~%.1f laps to 20%% tread at current pace.\n%.1f race laps remain. Fuel margin ~%.1f laps.\nEstimate excludes future rain, traffic and incidents." % [item.get("label", "—"), item.get("laps", 0), (next.label + " · %.0f%%" % next.life) if not next.is_empty() else "no usable replacement", estimate, remaining, c.fuel - remaining * [0.84, 1.0, 1.14][c.engine]]

func check_tyre_incident(c: Dictionary) -> void:
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
		var key = WheelTyres.lockup(item, c.car_setup.bias / 100.0, 4.0)
		c.temperature = item.temperature; c.tyre = item.life
		post("tyre", "%s: cold-tyre lock-up leaves a flat spot on %s." % [c.short, key])

func car_advisories(c: Dictionary) -> Array[String]:
	var messages: Array[String] = []
	var item = TyreInventory.find(c, c.set_id)
	for key in WheelTyres.KEYS:
		var wheel = item.wheels[key]
		if wheel.punctured: messages.append("%s PUNCTURE · plan a replacement and box" % key)
		elif wheel.life < 15: messages.append("%s tread low · %.0f%% remaining" % [key, wheel.life])
		elif wheel.core > WheelTyres.OPTIMUM[c.compound] + 20: messages.append("%s core hot · conserve pace" % key)
	if c.engine_temperature > 115: messages.append("Engine hot · reduce engine mode")
	if c.fuel < maxf(0, laps - c.distance / track.length): messages.append("Fuel projection short · consider economy mode")
	return messages
