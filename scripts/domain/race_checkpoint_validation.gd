extends RefCounted
## Reject malformed indexes and nested telemetry before a checkpoint reaches a view.
const MAX_SPEED_MPS = 200.0
## Nested checkpoint policy, telemetry and pit-box ownership validation.


static func _valid_session_history(data: Dictionary) -> bool:
	for key in ["clock", "total_time", "race_time", "flag_until"]:
		if not number(data.get(key), 0, 100000000):
			return false
	if not data.get("events") is Array or data.events.size() > 2000:
		return false
	if not data.get("commands") is Array or data.commands.size() > 50000:
		return false
	for event in data.events:
		if (
			not event is Dictionary
			or not event.get("text") is String
			or not number(event.get("time"), 0, 100000000)
		):
			return false
	if not data.get("stats") is Dictionary or not data.get("pit_boxes") is Dictionary:
		return false
	for key in ["passes", "incidents", "pits", "blue_flags"]:
		if not integral(data.stats.get(key), 0, 100000000):
			return false
	for command in data.commands:
		if (
			not command is Dictionary
			or not command.get("action") is String
			or not command.get("payload") is Dictionary
			or not number(command.get("tick"), 0, 100000000)
		):
			return false
	return true


static func _valid_car_indices(c: Dictionary, count: int) -> bool:
	for entry in [
		["grid", 1, count],
		["id", 0, count - 1],
		["pace", 0, 2],
		["engine", 0, 2],
		["yield_to", -1, count - 1],
		["setup", 1, 9],
		["completed", 0, 101]
	]:
		if not integral(c.get(entry[0]), entry[1], entry[2]):
			return false
	return true


static func _valid_car_condition(c: Dictionary, tyres: RaceTyreRules) -> bool:
	for entry in [
		["speed", 0, MAX_SPEED_MPS],
		["tyre", 0, 100],
		["temperature", 0, 200],
		["fuel", 0, 200],
		["health", 0, 100],
		["damage", 0, 1000],
		["lane", -40, 40],
		["pit_d", 0, 10000000]
	]:
		if not number(c.get(entry[0]), entry[1], entry[2]):
			return false
	if not _valid_car_history(c, tyres):
		return false
	return true


static func _valid_car_history(c: Dictionary, tyres: RaceTyreRules) -> bool:
	for key in ["sectors", "qual_sectors"]:
		if not numbers(c.get(key), 3):
			return false
	if c.get("pit_stage") not in ["", "entry", "service", "exit"]:
		return false
	if c.get("service_compound") not in tyres.compounds():
		return false
	if not c.get("telemetry") is Array or c.telemetry.size() > 120:
		return false
	for sample in c.telemetry:
		if not numbers(sample, 5, true):
			return false
	for key in ["history", "qual_history"]:
		if not c.get(key) is Array or c[key].size() > 110:
			return false
		for lap in c[key]:
			if not lap is Dictionary or not number(lap.get("time"), 0, 10000000):
				return false
			if lap.has("sectors") and not numbers(lap.sectors, 3):
				return false
	return true


static func _valid_pit_ownership(data: Dictionary, roster: RosterDefinition, count: int) -> bool:
	for team in data.pit_boxes:
		if not team is String or not integral(data.pit_boxes[team], 0, count - 1):
			return false
		var owner = data.cars[int(data.pit_boxes[team])]
		if (
			team_key(owner, roster) != team
			or owner.get("route") != "pit"
			or owner.get("pit_stage") != "service"
			or owner.get("dnf") == true
		):
			return false
	for c in data.cars:
		if c.get("pit_stage") == "service" and not c.get("dnf", false):
			if data.pit_boxes.get(team_key(c, roster), -1) != c.get("id"):
				return false
	return true


static func _valid_content_definitions(data: Dictionary) -> bool:
	if (
		data.has("tuning_definition")
		and RaceTuningDefinition.from_record(data.tuning_definition) == null
	):
		return false
	if not WeekendDefinition.agrees_with_snapshot(data):
		return false
	if (
		data.has("mechanic_definition")
		and MechanicProfileDefinition.from_record(data.mechanic_definition) == null
	):
		return false
	return true


static func _valid_session_policy(data: Dictionary) -> bool:
	if data.has("vehicle_definition"):
		if not data.vehicle_definition is Dictionary:
			return false
		var definition = VehicleDefinition.from_record(data.vehicle_definition)
		if definition == null or definition.id != data.get("vehicle"):
			return false
	elif data.get("vehicle") not in VehicleDefinition.LEGACY:
		return false
	if (
		data.get("scenario") not in ["dry", "wet", "changeable"]
		or data.get("intensity") not in ["calm", "standard", "volatile"]
	):
		return false
	if data.get("flag") not in ["GREEN", "YELLOW", "SAFETY CAR", "RESTART"]:
		return false
	return true


static func number(value: Variant, low: float, high: float) -> bool:
	return TrackDocument.valid_number(value, low, high)


static func integral(value: Variant, low: int, high: int) -> bool:
	return number(value, low, high) and value == floor(value)


static func numbers(value: Variant, count: int, signed: bool = false) -> bool:
	if not value is Array or value.size() != count:
		return false
	for item in value:
		if not number(item, -100000000 if signed else 0, 100000000):
			return false
	return true


## Prepare detached legacy base records only; this is not complete restore acceptance.
## Profile readers retain their own version/state validation before entering this path.
## Defaults and supported compounds are values, not access to a running aggregate.


static func team_key(car: Dictionary, roster: RosterDefinition) -> String:
	if roster == null:
		return str(car.get("team", ""))
	if not integral(car.get("id"), 0, roster.count - 1):
		return ""
	return roster.entrant(int(car.id)).team_id
