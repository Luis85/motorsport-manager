class_name MinimalRaceLifecycle
extends RefCounted
## Small command adapter. Reads are pure; only explicit player actions issue orders.
## Every mutation goes through the existing recorded simulation command boundary.
var message = ""

var _source: WeakRef
var _simulation: RaceSim:
	get:
		return _source.get_ref() if _source != null else null


func configure(value: RaceSim) -> void:
	_source = weakref(value)


func owned(id: int) -> bool:
	return (
		_simulation != null
		and id >= 0
		and id < _simulation.cars.size()
		and _simulation.cars[id].player
	)


func send_command(action: String, payload: Dictionary = {}) -> bool:
	if _simulation == null:
		message = "This weekend is no longer available."
		return false
	var accepted = _simulation.command(action, payload)
	if not accepted:
		message = _simulation.last_error
	return accepted


func manual_control() -> bool:
	if _simulation == null:
		message = "This weekend is no longer available."
		return false
	# No automatic takeover on opening, selecting or refreshing a view. Starting or
	# resuming explicitly gives these four visible channels to the player. Existing
	# physical pit commitments stay valid; unrelated racecraft ownership stays intact.
	if _simulation.phase == "practice":
		return true
	for car in _simulation.cars:
		if not car.player or car.dnf or car.finished:
			continue
		for channel in ["qualifying", "pit", "pace", "engine"]:
			var policy = _simulation.policy(car.id)
			if (
				policy.owners[channel] != "player"
				or policy.overrides.has(channel)
				or (
					channel == "pit"
					and TacticalDuels.owns(TacticalDuels.current(_simulation, car.id))
				)
			):
				if not send_command(
					"delegation", {"id": car.id, "channel": channel, "owner": "player"}
				):
					return false
	return true


func play() -> bool:
	if _simulation == null:
		message = "This weekend is no longer available."
		return false
	if _simulation.phase not in RaceSim.ACTIVE:
		return false
	if not manual_control():
		return false
	if _simulation.paused:
		return send_command("pause")
	return true


func pause() -> bool:
	if _simulation == null:
		message = "This weekend is no longer available."
		return false
	if _simulation.phase not in RaceSim.ACTIVE:
		return false
	return send_command("pause") if not _simulation.paused else true


func set_speed(value: int) -> bool:
	return send_command("speed", {"value": value})


func stage() -> String:
	if _simulation == null:
		return "Weekend unavailable"
	match _simulation.phase:
		"briefing":
			return (
				"Start practice"
				if _simulation.practice_state.status == "available"
				else "Start qualifying"
			)
		"practice":
			return (
				"End practice" if not _simulation.practice_state.closed else "Returning to garage"
			)
		"qualifying":
			return "End qualifying" if not _simulation.qual_closed else "Finishing laps"
	return (
		{
			"practice_results": "Start qualifying",
			"qualifying_results": "Start formation",
			"race_preparation": "Start formation",
			"formation": "Formation lap",
			"grid_ready": "Start race",
			"lights": "Starting race",
			"results": "Review weekend"
		}
		. get(_simulation.phase, "")
	)


func advance_stage() -> bool:
	if _simulation == null:
		message = "This weekend is no longer available."
		return false
	message = ""
	var accepted = false
	match _simulation.phase:
		"briefing":
			accepted = (
				manual_control()
				and send_command(
					(
						"practice_start"
						if _simulation.practice_state.status == "available"
						else "qualify"
					)
				)
			)
		"practice":
			accepted = send_command("practice_end") and play()
		"practice_results":
			accepted = (
				send_command("practice_finish") and manual_control() and send_command("qualify")
			)
		"qualifying":
			accepted = send_command("close_qualifying") and play()
		"qualifying_results", "race_preparation":
			accepted = _start_formation()
		"grid_ready":
			accepted = send_command("lights")
	return accepted


func _start_formation() -> bool:
	if not manual_control():
		return false
	if _simulation.phase == "qualifying_results" and not send_command("prepare_race"):
		return false
	# Hidden preparation uses real available sets and observed water, without creating stock.
	for car in _simulation.cars:
		if not car.player:
			continue
		var item = replacement(car.id, false)
		if item.is_empty():
			message = car.short + ": no usable starting tyres."
			return false
		if not send_command("select_set", {"id": car.id, "set_id": item.id}):
			return false
	return send_command("formation")


func selected_driver() -> int:
	return (
		_simulation.selected_id
		if _simulation != null and owned(_simulation.selected_id)
		else (
			_simulation.player_ids()[0]
			if _simulation != null and not _simulation.player_ids().is_empty()
			else -1
		)
	)


func select_driver(id: int) -> bool:
	# Selection is presentation intent, not a sporting command. No RNG, time or
	# resource changes; the compatibility checkpoint still stores selected_id.
	if not owned(id):
		return false
	_simulation.selected_id = id
	return true


func current_phase() -> String:
	return _simulation.phase if _simulation != null else ""


func is_paused() -> bool:
	return _simulation.paused if _simulation != null else true


func replacement(_id: int, _exclude_mounted: bool) -> Dictionary:
	return {}
