extends "res://scripts/domain/weekend/rival_style_history.gd"
## RW-18: pure, bounded preferences over the existing forecast's legal candidates.


static func valid(
	state: Variant,
	cars: Array,
	now: float,
	tuning: Dictionary = LegacyCompetition.VALUES,
	pinned: bool = false
) -> bool:
	if (
		not state is Dictionary
		or state.get("version") != VERSION
		or not state.get("enabled") is bool
	):
		return false
	if not state.get("drivers") is Array or state.drivers.size() != cars.size():
		return false
	if not state.get("history") is Array or state.history.size() > HISTORY_LIMIT:
		return false
	var expected = create(cars, state.enabled, tuning) if pinned else {}
	for i in range(cars.size()):
		if not _valid_style_driver(state, cars, i, expected, pinned, tuning):
			return false
	var last = -1.0
	for item in state.history:
		if (
			not item is Dictionary
			or not RaceCheckpoint.integral(item.get("driver_id"), 0, cars.size() - 1)
		):
			return false
		var driver = state.drivers[int(item.driver_id)]
		if (
			not state.enabled
			or driver.style == "legacy"
			or item.get("style") != driver.style
			or driver.reviews == 0
		):
			return false
		if not RaceCheckpoint.number(item.get("time"), 0, now + RaceSim.STEP) or item.time < last:
			return false
		last = item.time
		if not _valid_style_history_item(item, cars):
			return false
	return true


static func definitions(tuning: Dictionary = LegacyCompetition.VALUES) -> Dictionary:
	var result: Dictionary = {}
	for item in tuning.profiles:
		result[item.id] = item
	return result


static func profile(style: String, tuning: Dictionary = LegacyCompetition.VALUES) -> Dictionary:
	var weights: Dictionary = {}
	for i in range(WEIGHTS.size()):
		weights[WEIGHTS[i]] = definitions(tuning)[style].weights[i]
	return weights


static func create(
	cars: Array, enabled: bool, tuning: Dictionary = LegacyCompetition.VALUES
) -> Dictionary:
	var teams: Array = []
	var drivers: Array = []
	var keys = definitions(tuning).keys()
	for c in cars:
		if not c.player and c.team_identity() not in teams:
			teams.append(c.team_identity())
		var style = (
			keys[teams.find(c.team_identity()) % keys.size()]
			if enabled and not c.player
			else "legacy"
		)
		drivers.append(
			{
				"driver_id": int(c.id),
				"style": style,
				"weights": profile(style, tuning) if style != "legacy" else {},
				"hold_gate": -1.0,
				"reviews": 0
			}
		)
	return {"version": VERSION, "enabled": enabled, "drivers": drivers, "history": []}


static func _valid_style_driver(
	state: Dictionary, cars: Array, i: int, expected: Dictionary, pinned: bool, tuning: Dictionary
) -> bool:
	var d = state.drivers[i]
	if not d is Dictionary or d.get("driver_id") != i or not d.get("weights") is Dictionary:
		return false
	if pinned and d.get("style") != expected.drivers[i].style:
		return false
	if (
		not RaceCheckpoint.number(d.get("hold_gate"), -1, 100000000)
		or not RaceCheckpoint.integral(d.get("reviews"), 0, 10000000)
	):
		return false
	if not state.enabled or cars[i].player:
		if (
			d.get("style") != "legacy"
			or not d.weights.is_empty()
			or d.reviews != 0
			or d.hold_gate != -1
		):
			return false
	else:
		if d.get("style") not in definitions(tuning) or d.weights.size() != WEIGHTS.size():
			return false
		for key in WEIGHTS:
			if not RaceCheckpoint.number(d.weights.get(key), -4, 4):
				return false
		if pinned and d.weights != profile(d.style, tuning):
			return false
	return true
