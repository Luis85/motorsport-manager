class_name RaceCheckpoint
extends RefCounted
## Reject malformed indexes and nested telemetry before a checkpoint reaches a view.
const MAX_SPEED_MPS = 200.0
static func valid(data: Dictionary) -> bool:
	if data.has("tuning_definition") and RaceTuningDefinition.from_record(data.tuning_definition) == null: return false
	if not WeekendDefinition.agrees_with_snapshot(data): return false
	if data.has("mechanic_definition") and MechanicProfileDefinition.from_record(data.mechanic_definition) == null: return false
	var setup_profile = SetupDefinition.legacy()
	if data.has("setup_definition"):
		setup_profile = SetupDefinition.from_record(data.setup_definition)
		if setup_profile == null: return false
	var tyres = RaceTyreRules.legacy()
	if data.has("tyre_definition"):
		tyres = RaceTyreRules.from_snapshot(data.tyre_definition)
		if tyres == null: return false
	var roster: RosterDefinition
	if data.has("roster_definition"):
		roster = RosterDefinition.decode_snapshot(data.roster_definition)
		if roster == null: return false
	var count = roster.count if roster != null else 12
	if not data.get("cars") is Array or data.cars.size() != count: return false
	if data.has("performance_profiles") 			and not RacePerformanceProfile.validate_set(data.performance_profiles, count).is_empty():
		return false
	if not integral(data.get("selected_id"), 0, count - 1): return false
	if data.has("vehicle_definition"):
		if not data.vehicle_definition is Dictionary: return false
		var definition = VehicleDefinition.from_record(data.vehicle_definition)
		if definition == null or definition.id != data.get("vehicle"): return false
	elif data.get("vehicle") not in VehicleDefinition.LEGACY: return false
	if data.get("scenario") not in ["dry", "wet", "changeable"] or data.get("intensity") not in ["calm", "standard", "volatile"]: return false
	if data.get("flag") not in ["GREEN", "YELLOW", "SAFETY CAR", "RESTART"]: return false
	if not integral(data.get("yellow_sector"), -1, 2): return false
	if not number(data.get("accumulator"), 0, 10): return false
	for key in ["clock", "total_time", "race_time", "flag_until"]:
		if not number(data.get(key), 0, 100000000): return false
	if not data.get("events") is Array or data.events.size() > 2000: return false
	if not data.get("commands") is Array or data.commands.size() > 50000: return false
	for event in data.events:
		if not event is Dictionary or not event.get("text") is String or not number(event.get("time"), 0, 100000000): return false
	if not data.get("stats") is Dictionary or not data.get("pit_boxes") is Dictionary: return false
	for key in ["passes", "incidents", "pits", "blue_flags"]:
		if not integral(data.stats.get(key), 0, 100000000): return false
	for command in data.commands:
		if not command is Dictionary or not command.get("action") is String or not command.get("payload") is Dictionary or not number(command.get("tick"), 0, 100000000): return false
	var grids: Array = []
	for c in data.cars:
		if not c is Dictionary: return false
		for entry in [["grid", 1, count], ["id", 0, count - 1], ["pace", 0, 2], ["engine", 0, 2], ["yield_to", -1, count - 1], ["setup", 1, 9], ["completed", 0, 101]]:
			if not integral(c.get(entry[0]), entry[1], entry[2]): return false
		if c.get("grid") in grids: return false
		grids.append(c.get("grid"))
		if not CarSetup.valid(c, setup_profile): return false
		if not TyreInventory.valid(c, int(data.get("laps", 12)), tyres): return false
		for entry in [["speed", 0, MAX_SPEED_MPS], ["tyre", 0, 100], ["temperature", 0, 200], ["fuel", 0, 200], ["health", 0, 100], ["damage", 0, 1000], ["lane", -40, 40], ["pit_d", 0, 10000000]]:
			if not number(c.get(entry[0]), entry[1], entry[2]): return false
		for key in ["sectors", "qual_sectors"]:
			if not numbers(c.get(key), 3): return false
		if c.get("pit_stage") not in ["", "entry", "service", "exit"]: return false
		if c.get("service_compound") not in tyres.compounds(): return false
		if not c.get("telemetry") is Array or c.telemetry.size() > 120: return false
		for sample in c.telemetry:
			if not numbers(sample, 5, true): return false
		for key in ["history", "qual_history"]:
			if not c.get(key) is Array or c[key].size() > 110: return false
			for lap in c[key]:
				if not lap is Dictionary or not number(lap.get("time"), 0, 10000000): return false
				if lap.has("sectors") and not numbers(lap.sectors, 3): return false
	for team in data.pit_boxes:
		if not team is String or not integral(data.pit_boxes[team], 0, count - 1): return false
		var owner = data.cars[int(data.pit_boxes[team])]
		if team_key(owner, roster) != team or owner.get("route") != "pit" or owner.get("pit_stage") != "service" or owner.get("dnf") == true: return false
	for c in data.cars:
		if c.get("pit_stage") == "service" and not c.get("dnf", false):
			if data.pit_boxes.get(team_key(c, roster), -1) != c.get("id"): return false
	return true

static func number(value: Variant, low: float, high: float) -> bool:
	return TrackDocument.valid_number(value, low, high)

static func integral(value: Variant, low: int, high: int) -> bool:
	return number(value, low, high) and value == floor(value)

static func numbers(value: Variant, count: int, signed: bool = false) -> bool:
	if not value is Array or value.size() != count: return false
	for item in value:
		if not number(item, -100000000 if signed else 0, 100000000): return false
	return true

## Prepare detached legacy base records only; this is not complete restore acceptance.
## Profile readers retain their own version/state validation before entering this path.
## Defaults and supported compounds are values, not access to a running aggregate.
static func prepare_base(data: Dictionary, entrant_defaults: Dictionary, compounds: Dictionary) -> Dictionary:
	if data.get("kind") != "motorsport-manager-weekend" or not RaceCheckpoint.integral(data.get("version"), 1, 4): return {}
	if not TrackDocument.validate(data.get("track")).is_empty() or not data.get("cars") is Array: return {}
	var count = 12
	if data.has("roster_definition"):
		if data.version < 4: return {}
		var roster = RosterDefinition.decode_snapshot(data.roster_definition)
		if roster == null: return {}
		count = roster.count
	if data.cars.size() != count: return {}
	if data.get("phase") not in ["practice", "practice_results", "briefing", "qualifying", "qualifying_results", "race_preparation", "formation", "grid_ready", "lights", "race", "results"]: return {}
	if not data.get("water") is Array or data.water.size() != 96 or not data.get("rubber") is Array or data.rubber.size() != 96: return {}
	if (data.has("tuning_definition") or data.has("weekend_definition")) and data.version < 4: return {}
	if data.has("mechanic_definition") and data.version < 4: return {}
	if data.has("setup_definition") and data.version < 4: return {}
	if data.has("tyre_definition") and data.version < 4: return {}
	if data.has("vehicle_definition") and data.version < 4: return {}
	data = data.duplicate(true)
	if data.version == 1:
		for c in data.cars:
			if not c is Dictionary: return {}
			c.merge(entrant_defaults.duplicate(true))
			# Legacy service had no frozen plan: retain its accepted next compound/repair choice.
			c.service_compound = c.get("next_compound", "M"); c.service_repair = c.get("repair", true)
			c.pit_lap = c.get("route") == "pit"
	if data.version < 3:
		for c in data.cars:
			if not c is Dictionary or not c.get("compound") in compounds: return {}
			if not RaceCheckpoint.integral(c.get("id"), 0, 11) or not TrackDocument.valid_number(c.get("tyre"), 0, 100) or not TrackDocument.valid_number(c.get("temperature"), 0, 200): return {}
			if not c.has("tyre_sets"): TyreInventory.initialize_record(c)
			if not c.get("service_set_id", "") is String: return {}
			if c.get("pit_stage") == "service" and c.get("service_set_id", "").is_empty():
				if not c.get("service_compound") in compounds: return {}
				var item = TyreInventory.choose_from(c.tyre_sets, c.set_id, c.service_compound, true)
				c.service_set_id = item.get("id", "")
	if data.version < 4:
		for car in data.cars:
			if not car is Dictionary or not car.get("tyre_sets") is Array: return {}
			for item in car.tyre_sets:
				if not item is Dictionary or not TrackDocument.valid_number(item.get("life"), 0, 100) or not TrackDocument.valid_number(item.get("temperature"), 0, 200): return {}
				WheelTyres.initialize(item)
			CarSetup.initialize_record(car)
	if data.version < 4:
		var legacy_geometry = TrackGeometry.new(data.track, data.get("vehicle", "Formula"))
		for values in [data.water, data.rubber]:
			for value in values:
				if not TrackDocument.valid_number(value, 0, 1): return {}
		data.surface = RaceSurface.create(legacy_geometry, data.water, data.rubber); data.surface_accumulator = 0.0
	return data

static func team_key(car: Dictionary, roster: RosterDefinition) -> String:
	if roster == null: return str(car.get("team", ""))
	if not integral(car.get("id"), 0, roster.count - 1): return ""
	return roster.entrant(int(car.id)).team_id
