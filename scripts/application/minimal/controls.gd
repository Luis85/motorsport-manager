class_name MinimalRaceControls
extends MinimalRaceLifecycle
## Driver orders and finite-resource choices use the recorded command boundary.


func replacement(id: int, exclude_mounted: bool) -> Dictionary:
	if not owned(id):
		return {}
	var car = _simulation.cars[id]
	var remaining = _simulation.laps - maxf(0, car.distance / _simulation.track.length)
	var compounds = car.tyre_rules.preferences(
		_simulation.phase, _simulation.average(_simulation.water), remaining
	)
	for compound in compounds:
		var fitted = TyreInventory.find(car, car.set_id)
		if (
			_simulation.phase == "practice"
			and not exclude_mounted
			and fitted.compound == compound
			and fitted.life >= 40
			and WheelTyres.usable(fitted)
		):
			return fitted.duplicate(true)
		var item = TyreInventory.choose(car, compound, exclude_mounted)
		if not item.is_empty():
			return item.duplicate(true)
	return {}


func practice_plan(id: int) -> Dictionary:
	var item = replacement(id, false)
	return {
		"objective": "tyre_life",
		"baseline": "current",
		"laps": 2,
		"set_id": item.get("id", ""),
		"manual_modes": true
	}


func send_reason(id: int) -> String:
	if not owned(id):
		return "Select one of your drivers."
	var car = _simulation.cars[id]
	if car.dnf or car.finished:
		return "This car is no longer running."
	if _simulation.phase not in ["practice", "qualifying"]:
		return "Send out is available in practice and qualifying."
	if car.route != "garage":
		return "Wait for the car to return to the garage."
	if _simulation.phase == "practice":
		return _simulation.run_preview(id, practice_plan(id)).reason
	return _qualifying_send_reason(id, car)


func send_out(id: int) -> bool:
	message = send_reason(id)
	if not message.is_empty():
		return false
	if _simulation.phase == "practice":
		var plan = practice_plan(id)
		var preview = _simulation.run_preview(id, plan)
		if not send_command(
			"practice_run",
			{
				"id": id,
				"plan": plan,
				"revision": preview.revision,
				"key": preview.key,
				"time": preview.time
			}
		):
			return false
	else:
		var item = replacement(id, false)
		if not send_command("select_set", {"id": id, "set_id": item.id}):
			return false
		if not send_command("send", {"id": id}):
			return false
	message = (
		_simulation.cars[id].short
		+ " · sent out"
		+ ("; press Play to move." if _simulation.paused else ".")
	)
	return true


func box_reason(id: int) -> String:
	var driver_reason = _running_driver_reason(id)
	if not driver_reason.is_empty():
		return driver_reason
	var car = _simulation.cars[id]
	if _simulation.phase not in ["practice", "qualifying", "race"]:
		return "Wait for a running session."
	if car.route != "track":
		return "The car must be on track."
	if _simulation.phase in ["practice", "qualifying"]:
		if car.qual_state == "inlap":
			return "Already returning to the garage."
		return ""
	return _race_box_reason(id, car)


func box(id: int) -> bool:
	message = box_reason(id)
	if not message.is_empty():
		return false
	var action = "practice_recall" if _simulation.phase == "practice" else "recall"
	var payload = {"id": id}
	if _simulation.phase == "race":
		action = "pit"
		payload.set_id = replacement(id, true).id
		payload.expected_gate = (
			RaceForecaster.reachable_gate(_simulation, _simulation.cars[id]).distance
		)
		payload.forecast_key = RaceForecaster.material_key(
			_simulation, id, _simulation.policy(id).revision
		)
		payload.forecast_time = _simulation.total_time
	if not send_command(action, payload):
		return false
	message = (
		_simulation.cars[id].short
		+ (
			" · box this lap."
			if _simulation.phase == "race"
			else " · returning; unfinished timed lap abandoned."
		)
	)
	return true


func mode_reason(id: int) -> String:
	if not owned(id):
		return "Select one of your drivers."
	if _simulation.cars[id].dnf or _simulation.cars[id].finished:
		return "This car is no longer running."
	if (
		_simulation.phase
		in [
			"formation", "grid_ready", "lights", "results", "practice_results", "qualifying_results"
		]
	):
		return "Available in the garage or a running session."
	return ""


func mode(id: int, channel: String, value: int) -> bool:
	message = mode_reason(id)
	if not message.is_empty():
		return false
	if channel not in ["pace", "engine"]:
		message = "Unknown driving control."
		return false
	if not send_command(channel, {"id": id, "value": value}):
		return false
	message = (
		_simulation.cars[id].short
		+ " · "
		+ (
			["Calm", "Normal pace", "Push"][value]
			if channel == "pace"
			else ["Engine: Save", "Engine: Standard", "Engine: Power"][value]
		)
	)
	return true


func toggle_pace(id: int, requested: int) -> bool:
	if not owned(id) or requested not in [0, 2]:
		return false
	return mode(id, "pace", 1 if _simulation.cars[id].pace == requested else requested)


func _qualifying_send_reason(id: int, car: RaceCar) -> String:
	if _simulation.qual_closed:
		return "Qualifying has ended."
	if replacement(id, false).is_empty():
		return "No suitable usable tyre set remains."
	if not RaceForecaster.qualifying_release(_simulation, car).can_start_hotlap:
		return "Not enough time to start a flying lap."
	return ""


func _race_box_reason(id: int, car: RaceCar) -> String:
	if car.pit_order:
		return "Pit stop already requested."
	var gate = RaceForecaster.reachable_gate(_simulation, car)
	if gate.distance >= _simulation.laps * _simulation.track.length:
		return "No safe pit entry remains before the finish."
	var current_lap = int(floor(maxf(0, car.distance) / _simulation.track.length)) + 1
	if gate.lap > current_lap:
		return "Too late for this lap's pit entry. Available next lap."
	if replacement(id, true).is_empty():
		return "No suitable usable replacement tyres remain."
	return ""


func _running_driver_reason(id: int) -> String:
	if not owned(id):
		return "Select one of your drivers."
	var car = _simulation.cars[id]
	if car.dnf or car.finished:
		return "This car is no longer running."
	return ""
