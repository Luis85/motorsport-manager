class_name MinimalRaceControls
extends RefCounted
## Small command adapter. Reads are pure; only explicit player actions issue orders.
## Every mutation goes through the existing recorded simulation command boundary.
var _source: WeakRef
var _simulation: RaceSim:
	get: return _source.get_ref() if _source != null else null
var message = ""

func configure(value: RaceSim) -> void:
	_source = weakref(value)

func owned(id: int) -> bool:
	return _simulation != null and id >= 0 and id < _simulation.cars.size() and _simulation.cars[id].player

func send_command(action: String, payload: Dictionary = {}) -> bool:
	if _simulation == null:
		message = "This weekend is no longer available."
		return false
	var accepted = _simulation.command(action, payload)
	if not accepted: message = _simulation.last_error
	return accepted

func manual_control() -> bool:
	if _simulation == null:
		message = "This weekend is no longer available."
		return false
	# No automatic takeover on opening, selecting or refreshing a view. Starting or
	# resuming explicitly gives these four visible channels to the player. Existing
	# physical pit commitments stay valid; unrelated racecraft ownership stays intact.
	if _simulation.phase == "practice": return true
	for car in _simulation.cars:
		if not car.player or car.dnf or car.finished: continue
		for channel in ["qualifying", "pit", "pace", "engine"]:
			var policy = _simulation.policy(car.id)
			if policy.owners[channel] != "player" or policy.overrides.has(channel) or (channel == "pit" and TacticalDuels.owns(TacticalDuels.current(_simulation, car.id))):
				if not send_command("delegation", {"id": car.id, "channel": channel, "owner": "player"}): return false
	return true

func play() -> bool:
	if _simulation == null:
		message = "This weekend is no longer available."
		return false
	if _simulation.phase not in RaceSim.ACTIVE: return false
	if not manual_control(): return false
	if _simulation.paused: return send_command("pause")
	return true

func pause() -> bool:
	if _simulation == null:
		message = "This weekend is no longer available."
		return false
	if _simulation.phase not in RaceSim.ACTIVE: return false
	return send_command("pause") if not _simulation.paused else true

func set_speed(value: int) -> bool:
	return send_command("speed", {"value": value})

func stage() -> String:
	if _simulation == null: return "Weekend unavailable"
	match _simulation.phase:
		"briefing": return "Start practice" if _simulation.practice_state.status == "available" else "Start qualifying"
		"practice": return "End practice" if not _simulation.practice_state.closed else "Returning to garage"
		"practice_results": return "Start qualifying"
		"qualifying": return "End qualifying" if not _simulation.qual_closed else "Finishing laps"
		"qualifying_results", "race_preparation": return "Start formation"
		"formation": return "Formation lap"
		"grid_ready": return "Start race"
		"lights": return "Starting race"
		"results": return "Review weekend"
	return ""

func advance_stage() -> bool:
	if _simulation == null:
		message = "This weekend is no longer available."
		return false
	message = ""
	match _simulation.phase:
		"briefing":
			if not manual_control(): return false
			return send_command("practice_start" if _simulation.practice_state.status == "available" else "qualify")
		"practice":
			if not send_command("practice_end"): return false
			return play()
		"practice_results":
			if not send_command("practice_finish"): return false
			if not manual_control(): return false
			return send_command("qualify")
		"qualifying":
			if not send_command("close_qualifying"): return false
			return play()
		"qualifying_results", "race_preparation":
			if not manual_control(): return false
			if _simulation.phase == "qualifying_results" and not send_command("prepare_race"): return false
			# Hidden preparation uses real, available sets and observed surface water.
			# It does not create stock, repair wear, or grant a pace/fuel bonus.
			for car in _simulation.cars:
				if not car.player: continue
				var item = replacement(car.id, false)
				if item.is_empty(): message = car.short + ": no usable starting tyres."; return false
				if not send_command("select_set", {"id": car.id, "set_id": item.id}): return false
			return send_command("formation")
		"grid_ready": return send_command("lights")
	return false

func replacement(id: int, exclude_mounted: bool) -> Dictionary:
	if not owned(id): return {}
	var car = _simulation.cars[id]
	var remaining = _simulation.laps - maxf(0, car.distance / _simulation.track.length)
	var compounds = car.tyre_rules.preferences(_simulation.phase, _simulation.average(_simulation.water), remaining)
	for compound in compounds:
		var fitted = TyreInventory.find(car, car.set_id)
		if _simulation.phase == "practice" and not exclude_mounted and fitted.compound == compound and fitted.life >= 40 and WheelTyres.usable(fitted): return fitted.duplicate(true)
		var item = TyreInventory.choose(car, compound, exclude_mounted)
		if not item.is_empty(): return item.duplicate(true)
	return {}

func practice_plan(id: int) -> Dictionary:
	var item = replacement(id, false)
	return {"objective": "tyre_life", "baseline": "current", "laps": 2, "set_id": item.get("id", ""), "manual_modes": true}

func send_reason(id: int) -> String:
	if not owned(id): return "Select one of your drivers."
	var car = _simulation.cars[id]
	if car.dnf or car.finished: return "This car is no longer running."
	if _simulation.phase not in ["practice", "qualifying"]: return "Send out is available in practice and qualifying."
	if car.route != "garage": return "Wait for the car to return to the garage."
	if _simulation.phase == "practice": return _simulation.run_preview(id, practice_plan(id)).reason
	if _simulation.qual_closed: return "Qualifying has ended."
	if replacement(id, false).is_empty(): return "No suitable usable tyre set remains."
	if not RaceForecaster.qualifying_release(_simulation, car).can_start_hotlap: return "Not enough time to start a flying lap."
	return ""

func send_out(id: int) -> bool:
	message = send_reason(id)
	if not message.is_empty(): return false
	if _simulation.phase == "practice":
		var plan = practice_plan(id); var preview = _simulation.run_preview(id, plan)
		if not send_command("practice_run", {"id": id, "plan": plan, "revision": preview.revision, "key": preview.key, "time": preview.time}): return false
	else:
		var item = replacement(id, false)
		if not send_command("select_set", {"id": id, "set_id": item.id}): return false
		if not send_command("send", {"id": id}): return false
	message = _simulation.cars[id].short + " · sent out" + ("; press Play to move." if _simulation.paused else ".")
	return true

func box_reason(id: int) -> String:
	if not owned(id): return "Select one of your drivers."
	var car = _simulation.cars[id]
	if car.dnf or car.finished: return "This car is no longer running."
	if _simulation.phase not in ["practice", "qualifying", "race"]: return "Wait for a running session."
	if car.route != "track": return "The car must be on track."
	if _simulation.phase in ["practice", "qualifying"]:
		if car.qual_state == "inlap": return "Already returning to the garage."
		return ""
	if car.pit_order: return "Pit stop already requested."
	var gate = RaceForecaster.reachable_gate(_simulation, car)
	if gate.distance >= _simulation.laps * _simulation.track.length: return "No safe pit entry remains before the finish."
	var current_lap = int(floor(maxf(0, car.distance) / _simulation.track.length)) + 1
	if gate.lap > current_lap: return "Too late for this lap's pit entry. Available next lap."
	if replacement(id, true).is_empty(): return "No suitable usable replacement tyres remain."
	return ""

func box(id: int) -> bool:
	message = box_reason(id)
	if not message.is_empty(): return false
	var action = "practice_recall" if _simulation.phase == "practice" else "recall"
	var payload = {"id": id}
	if _simulation.phase == "race":
		action = "pit"; payload.set_id = replacement(id, true).id
		payload.expected_gate = RaceForecaster.reachable_gate(_simulation, _simulation.cars[id]).distance
		payload.forecast_key = RaceForecaster.material_key(_simulation, id, _simulation.policy(id).revision)
		payload.forecast_time = _simulation.total_time
	if not send_command(action, payload): return false
	message = _simulation.cars[id].short + (" · box this lap." if _simulation.phase == "race" else " · returning; unfinished timed lap abandoned.")
	return true

func mode_reason(id: int) -> String:
	if not owned(id): return "Select one of your drivers."
	if _simulation.cars[id].dnf or _simulation.cars[id].finished: return "This car is no longer running."
	if _simulation.phase in ["formation", "grid_ready", "lights", "results", "practice_results", "qualifying_results"]: return "Available in the garage or a running session."
	return ""

func mode(id: int, channel: String, value: int) -> bool:
	message = mode_reason(id)
	if not message.is_empty(): return false
	if channel not in ["pace", "engine"]: message = "Unknown driving control."; return false
	if not send_command(channel, {"id": id, "value": value}): return false
	message = _simulation.cars[id].short + " · " + (["Calm", "Normal pace", "Push"][value] if channel == "pace" else ["Engine: Save", "Engine: Standard", "Engine: Power"][value])
	return true

func selected_driver() -> int:
	return _simulation.selected_id if _simulation != null and owned(_simulation.selected_id) else (_simulation.player_ids()[0] if _simulation != null and not _simulation.player_ids().is_empty() else -1)

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

func toggle_pace(id: int, requested: int) -> bool:
	if not owned(id) or requested not in [0, 2]:
		return false
	return mode(id, "pace", 1 if _simulation.cars[id].pace == requested else requested)
