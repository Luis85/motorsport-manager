class_name WeatherRaceSim
extends RaceSim
## Compatibility construction/restore profile. Runtime rules live in composed mechanics.
const CHECKPOINT_VERSION = 7

func _init(geometry: TrackGeometry = null, options: Dictionary = {}, roster: RosterDefinition = null) -> void:
	super(geometry, options, roster)
	if not last_error.is_empty(): return
	mechanics.configure(RaceMechanicProfiles.build("weather"))
	mechanics.install(geometry, options)

static func new_weather_state(seed: int, scenario_name: String, mode: String, count: int = 12) -> Dictionary:
	var notices: Array = []; var held: Array = []; var reviews: Array = []
	for i in range(count): notices.append(""); held.append(""); reviews.append(0.0)
	return {"version": 1, "model": WeekendWeather.create(seed, scenario_name, mode), "history": [],
		"next_sample": 0.0, "notices": notices, "held": held, "reviews": reviews}

static func valid_weather(state: Variant, now: float, current_rain: float, count: int = 12) -> bool:
	if not state is Dictionary or state.get("version") != 1 or not WeekendWeather.valid(state.get("model")): return false
	if absf(state.model.rain - current_rain) > 0.00001: return false
	if not state.get("history") is Array or state.history.size() > WeekendWeather.HISTORY_LIMIT: return false
	var previous = -1.0
	for observation in state.history:
		if not WeekendWeather.observation_valid(observation, now) or observation.time <= previous: return false
		previous = observation.time
	if not RaceCheckpoint.number(state.get("next_sample"), maxf(0, previous), now + WeekendWeather.SAMPLE_INTERVAL + 0.0001): return false
	for key in ["notices", "held", "reviews"]:
		if not state.get(key) is Array or state[key].size() != count: return false
	for i in range(count):
		if not state.notices[i] is String or state.notices[i].length() > 256 or not state.held[i] is String or state.held[i].length() > 64: return false
		if not RaceCheckpoint.number(state.reviews[i], 0, now + 19): return false
	return true

static func valid_weather_records(records: Array, entrants: Array) -> bool:
	for record in records:
		if record.kind not in ["weather_model", "weather_warning", "weather_decision"]: continue
		var e = record.evidence
		if not e.get("reason") is String: return false
		if record.kind == "weather_model":
			if e.get("mode") not in WeekendWeather.MODES or e.get("version") != WeekendWeather.VERSION: return false
			continue
		if not WeekendWeather.observation_valid(e.get("observed"), record.time): return false
		if record.kind == "weather_warning":
			if not e.get("fallback") is String: return false
			continue
		if record.driver_id < 0 or e.get("action") not in ["hold", "box", "delegated_box"]: return false
		if e.action == "hold": continue
		if not e.get("set_id") is String or TyreInventory.find(entrants[int(record.driver_id)], e.set_id).is_empty(): return false
		if not RaceCheckpoint.number(e.get("gain_low"), -100000000, 100000000) or not RaceCheckpoint.number(e.get("gain_high"), e.gain_low, 100000000): return false
		if not e.get("cases") is Array or e.cases.size() != 3 or e.get("model_version") != WeatherStrategy.VERSION: return false
		for item in e.cases:
			if not item is Dictionary or not item.get("name") is String or not RaceCheckpoint.number(item.get("water"), 0, 1): return false
	return true

static func restore_weather(data: Dictionary) -> WeatherRaceSim:
	if not WeekendDefinition.agrees_with_snapshot(data): return null
	if not RaceCheckpoint.integral(data.get("version"), 1, CHECKPOINT_VERSION): return null
	var native = int(data.version) == CHECKPOINT_VERSION
	var legacy = data.duplicate(true)
	if native: legacy.version = 6; legacy.erase("weather_state")
	var base = StrategyRaceSim.restore_weekend(legacy)
	if base == null or not valid_weather_records(base.strategy_state.records, base.cars): return null
	var state: Dictionary
	if native:
		if not valid_weather(data.get("weather_state"), base.total_time, base.rain, base.cars.size()): return null
		state = data.weather_state.duplicate(true)
	else:
		# Migration must not alter the already running weather schedule or invent old observations.
		state = new_weather_state(base.seed_value, base.scenario, "scripted_training", base.cars.size())
		state.model.rain = base.rain; state.next_sample = base.total_time + WeekendWeather.SAMPLE_INTERVAL
	var restored = WeatherRaceSim.new(base.track, base.content_options())
	for key in base.snapshot():
		if key not in ["kind", "version", "track", "vehicle", "vehicle_definition", "roster_definition", "tyre_definition", "setup_definition", "tuning_definition", "weekend_definition"]: restored.set(key, base.get(key))
	restored.weather_state = state
	restored.weather_state.model.rng = int(state.model.rng)
	return restored
