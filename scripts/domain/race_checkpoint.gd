class_name RaceCheckpoint
extends RefCounted
## Reject malformed indexes and nested telemetry before a checkpoint reaches a view.
static func valid(data: Dictionary) -> bool:
	if not integral(data.get("selected_id"), 0, 11): return false
	if data.get("vehicle") not in ["Formula", "GT", "Touring", "Kart"]: return false
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
		for entry in [["grid", 1, 12], ["id", 0, 11], ["pace", 0, 2], ["engine", 0, 2], ["yield_to", -1, 11], ["setup", 1, 9], ["completed", 0, 101]]:
			if not integral(c.get(entry[0]), entry[1], entry[2]): return false
		if c.get("grid") in grids: return false
		grids.append(c.get("grid"))
		if not TyreInventory.valid(c, int(data.get("laps", 12))): return false
		for entry in [["speed", 0, 200], ["tyre", 0, 100], ["temperature", 0, 200], ["fuel", 0, 200], ["health", 0, 100], ["damage", 0, 1000], ["lane", -40, 40], ["pit_d", 0, 10000000]]:
			if not number(c.get(entry[0]), entry[1], entry[2]): return false
		for key in ["sectors", "qual_sectors"]:
			if not numbers(c.get(key), 3): return false
		if c.get("pit_stage") not in ["", "entry", "service", "exit"]: return false
		if c.get("service_compound") not in ["S", "M", "H", "I", "W"]: return false
		if not c.get("telemetry") is Array or c.telemetry.size() > 120: return false
		for sample in c.telemetry:
			if not numbers(sample, 5, true): return false
		for key in ["history", "qual_history"]:
			if not c.get(key) is Array or c[key].size() > 110: return false
			for lap in c[key]:
				if not lap is Dictionary or not number(lap.get("time"), 0, 10000000): return false
				if lap.has("sectors") and not numbers(lap.sectors, 3): return false
	for team in data.pit_boxes:
		if not team is String or not integral(data.pit_boxes[team], 0, 11): return false
		var owner = data.cars[int(data.pit_boxes[team])]
		if owner.get("team") != team or owner.get("route") != "pit" or owner.get("pit_stage") != "service" or owner.get("dnf") == true: return false
	for c in data.cars:
		if c.get("pit_stage") == "service" and not c.get("dnf", false):
			if data.pit_boxes.get(c.get("team"), -1) != c.get("id"): return false
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
