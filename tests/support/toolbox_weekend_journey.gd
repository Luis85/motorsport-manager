extends RefCounted
## Drive a real authored weekend exclusively through its public developer facet.


static func finish(weekends: DeveloperWeekends, session: String, check: Callable) -> bool:
	var player_ids: Array = weekends.query(session).result.player_ids
	for id in player_ids:
		if not _command(weekends, session, "auto", {"id": id, "value": false}, check):
			return false
	if not _command(weekends, session, "qualify", {}, check):
		return false
	for id in player_ids:
		if not _command(weekends, session, "send", {"id": id}, check):
			return false
	var measured = false
	for index in range(100):
		measured = true
		for id in player_ids:
			var car = weekends.query(session, "car", {"id": id}).result
			measured = measured and car.qual_best > 0
		if measured:
			break
		if not _ticks(weekends, session, check):
			return false
	check.call(measured, "Both managed drivers record physically measured qualifying laps")
	if not measured or not _command(weekends, session, "close_qualifying", {}, check):
		return false
	if not _until(weekends, session, "qualifying_results", check):
		return false
	if not _command(weekends, session, "prepare_race", {}, check):
		return false
	if not _command(weekends, session, "formation", {}, check):
		return false
	if not _until(weekends, session, "grid_ready", check):
		return false
	if not _command(weekends, session, "lights", {}, check):
		return false
	if not _until(weekends, session, "results", check):
		return false
	for id in player_ids:
		var car = weekends.query(session, "car", {"id": id}).result
		check.call(
			car.finished and not car.dnf, "Managed driver physically finishes the authored race"
		)
	return true


static func _command(
	weekends: DeveloperWeekends,
	session: String,
	action: String,
	payload: Dictionary,
	check: Callable
) -> bool:
	var result = weekends.command(session, action, payload)
	check.call(
		result.ok, "Physical SDK journey accepts " + action + ": " + str(result.get("error", ""))
	)
	return result.ok


static func _ticks(weekends: DeveloperWeekends, session: String, check: Callable) -> bool:
	var result = weekends.step_ticks(session, 200)
	var advanced = result.ok and result.result.completed > 0
	check.call(advanced, "Physical SDK journey spends real fixed ticks without forced phases")
	return advanced


static func _until(
	weekends: DeveloperWeekends, session: String, phase: String, check: Callable
) -> bool:
	for index in range(350):
		if weekends.query(session).result.phase == phase:
			return true
		if not _ticks(weekends, session, check):
			break
	check.call(false, "Physical SDK journey reaches bounded phase " + phase)
	return false
