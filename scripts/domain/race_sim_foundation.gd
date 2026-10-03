class_name RaceSimFoundation
extends "res://scripts/domain/race_sim_port.gd"
## Authoritative race state, deterministic utilities and stable base API shared by
## the fixed-step core and final mechanic-dispatch aggregate.
signal event_posted(entry: Dictionary)
signal input_accepted(action: String, payload: Dictionary, context: Dictionary)
signal fixed_step_completed

const TYRES = LegacyTyreContent.PERFORMANCE
const ROSTER = LegacyRoster.ROWS
const CAR_V2 = {
	"yield_to": -1,
	"yield_side": 0.0,
	"yield_clock": 0.0,
	"qual_history": [],
	"qual_sectors": [0.0, 0.0, 0.0],
	"qual_sector_start": 0.0,
	"invalid_reason": "",
	"throttle": 0.0,
	"braking": 0.0,
	"pit_deferred": false,
	"pit_lap": false,
	"service_compound": "M",
	"service_repair": true
}
var mechanic_definition: MechanicProfileDefinition
var weekend_definition: WeekendDefinition
var roster_definition: RosterDefinition
var race_time = 0.0
var qual_duration = 480.0
var scenario = "changeable"
var intensity = "standard"
var rng_state = 7314
var seed_value = 7314
var flag = "GREEN"
var flag_until = 0.0
var yellow_sector = -1
var rain = 0.0
var rubber: Array = []
var surface: Array = []
var surface_accumulator = 0.0
var weather_name = "Clear skies"
var events: Array = []
var commands: Array = []
var selected_id = 3
var last_error = ""

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
var performance_profiles: Array = []


func performance_profile(car: RaceCar) -> Dictionary:
	if car == null or performance_profiles.is_empty():
		return RacePerformanceProfile.baseline()
	if car.id < 0 or car.id >= performance_profiles.size():
		return {}
	return performance_profiles[car.id].duplicate(true)


func _performance_factor(car: RaceCar, key: String) -> float:
	if performance_profiles.is_empty():
		return 1.0
	return float(performance_profiles[car.id][key + "_bps"]) / RacePerformanceProfile.BASE_BPS


func _performance_line_factor(car: RaceCar, curvature: float) -> float:
	if performance_profiles.is_empty():
		return 1.0
	var straight = (_performance_factor(car, "top") + _performance_factor(car, "accel")) * 0.5
	var corner = (_performance_factor(car, "lat") + _performance_factor(car, "brake")) * 0.5
	return lerpf(straight, corner, clampf(absf(curvature) * 100.0, 0.0, 1.0))


func random_value() -> float:
	rng_state = (1664525 * rng_state + 1013904223) & 0xffffffff
	return float(rng_state) / 4294967296.0


func post(kind: String, text: String) -> void:
	var entry = {
		"time": total_time, "session_time": clock, "phase": phase, "kind": kind, "text": text
	}
	events.append(entry)
	if events.size() > 2000:
		events.pop_front()
	event_posted.emit(RaceStateValue.read_only(entry))


func transition(next: String) -> void:
	phase = next
	clock = 0.0
	accumulator = 0.0
	paused = false
	post("session", next.replace("_", " ").capitalize())


func fail(message: String) -> bool:
	last_error = message
	return false


func advance(real_delta: float) -> void:
	# Compatibility API for existing headless callers. Production scheduling is
	# owned by RaceSessionRunner, never by a visual node.
	RaceStepClock.advance(self, real_delta)


func average(values: Array) -> float:
	var sum = 0.0
	for value in values:
		sum += value
	return sum / maxf(1, values.size())


func surface_at(c: RaceCar) -> Dictionary:
	return RaceSurface.sample(
		surface, c.distance / track.length, c.lane, tuning.environment.surface
	)


func recommended_compound() -> String:
	var wet = average(water)
	return tyre_rules.recommended(wet)


func finish_qualifying() -> void:
	RaceTiming.finish_qualifying(self)


func depart_on_planned_set(c: RaceCar) -> void:
	# Shared physical departure; eligibility is owned by the session orchestrator.
	var item = TyreInventory.planned(c)
	if item.is_empty():
		c.next_qual = clock + 60
		c.intent = "No usable tyre set; choose a replacement"
		return
	TyreInventory.mount(c, item.id)
	c.route = "pit"
	c.pit_stage = "exit"
	c.pit_d = c.box_d
	c.pit_cycle = 0
	c.pit_gate = -1.0
	c.qual_state = "outlap"
	c.qual_runs += 1
	c.fuel = tuning.fuel.qualifying_load_laps
	c.speed = 0.0
	c.distance = track.pit_entry + (track.pit_exit - track.pit_entry) * c.pit_d / track.pit_length
	post(phase, "%s leaves the garage for run %d." % [c.short, c.qual_runs])


func race_crossings(c: RaceCar, before: float, after: float) -> void:
	RaceTiming.race_crossings(self, c, before, after)


func resolve_finishes() -> void:
	RaceTiming.resolve_finishes(self)


func queue_pit(c: RaceCar) -> void:
	RacePitService.queue_pit(self, c)


func standings(qualifying: bool = false) -> Array:
	return RaceTiming.standings(self, qualifying)


func car_position(c: RaceCar, alpha: float = 1.0) -> Dictionary:
	if c.route != c.previous_route:
		alpha = 1.0
	if c.route in ["pit", "garage"]:
		var s = track.pit_sample(
			c.box_d if c.route == "garage" else lerpf(c.previous_pit_d, c.pit_d, alpha)
		)
		if c.route == "garage" or c.pit_stage == "service":
			s.p += s.n * (4.0 + c.id % 2 * 2.0)
		return s
	var s = track.sample(lerpf(c.previous_distance, c.distance, alpha))
	s.p += s.n * lerpf(c.previous_lane, c.lane, alpha)
	return s


func strategy_advice(c: RaceCar) -> String:
	var remaining = maxf(0, laps - c.distance / track.length)
	var item = TyreInventory.find(c, c.set_id)
	var reference_wear = tyre_rules.spec(c.compound).wear * tuning.pace.wear_modes[c.pace]
	var estimate = maxf(0, (c.tyre - 20) / reference_wear)
	var next = TyreInventory.planned(c, phase == "race")
	return (
		(
			"Mounted %s · %.1f laps used\nPlan %s\n~%.1f laps to 20%% tread at current "
			+ "pace.\n%.1f race laps remain. Fuel margin ~%.1f laps.\nEstimate excludes future rain, traffic and incidents."
		)
		% [
			item.get("label", "—"),
			item.get("laps", 0),
			(
				(next.label + " · %.0f%%" % next.life)
				if not next.is_empty()
				else "no usable replacement"
			),
			estimate,
			remaining,
			c.fuel - remaining * tuning.fuel.engine_rates[c.engine]
		]
	)


func check_tyre_incident(c: RaceCar) -> void:
	# Conditional damage uses the race PRNG only. Visual updates never call this path.
	var item = TyreInventory.find(c, c.set_id)
	if item.is_empty():
		return
	for key in WheelTyres.KEYS:
		if item.wheels[key].punctured:
			return
	for key in WheelTyres.KEYS:
		var w = item.wheels[key]
		if w.life < 8 and (w.life <= 0.5 or random_value() < (8 - w.life) * 0.004):
			w.punctured = true
			post(
				"tyre",
				(
					"%s: %s puncture on %s. Pace limited; select a sound replacement and box."
					% [c.short, key, item.label]
				)
			)
			return
	if (
		intensity != "calm"
		and c.braking > 0.75
		and WheelTyres.average(item, "core") < 68
		and random_value() < 0.01 * (1.12 if c.battle_mode == "assertive" else 1.0)
	):
		var key = WheelTyres.lockup(
			item, c.car_setup.bias / 100.0, 4.0, tyre_rules.spec(c.compound)
		)
		c.temperature = item.temperature
		c.tyre = item.life
		post("tyre", "%s: cold-tyre lock-up leaves a flat spot on %s." % [c.short, key])
