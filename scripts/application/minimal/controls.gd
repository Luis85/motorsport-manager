class_name MinimalRaceControls
extends RefCounted
## Small command adapter. Reads are pure; only explicit player actions issue orders.
## Every mutation goes through the existing recorded simulation command boundary.
var sim: PracticeRaceSim
var message = ""

func configure(value: PracticeRaceSim) -> void:
	sim = value

func owned(id: int) -> bool:
	return id >= 0 and id < sim.cars.size() and sim.cars[id].player

func send_command(action: String, payload: Dictionary = {}) -> bool:
	var accepted = sim.command(action, payload)
	if not accepted: message = sim.last_error
	return accepted

func manual_control() -> bool:
	# No automatic takeover on opening, selecting or refreshing a view. Starting or
	# resuming explicitly gives these four visible channels to the player. Existing
	# physical pit commitments stay valid; unrelated racecraft ownership stays intact.
	if sim.phase == "practice": return true
	for car in sim.cars:
		if not car.player or car.dnf or car.finished: continue
		for channel in ["qualifying", "pit", "pace", "engine"]:
			var policy = sim.policy(car.id)
			if policy.owners[channel] != "player" or policy.overrides.has(channel) or (channel == "pit" and TacticalDuels.owns(TacticalDuels.current(sim, car.id))):
				if not send_command("delegation", {"id": car.id, "channel": channel, "owner": "player"}): return false
	return true

func play() -> bool:
	if sim.phase not in RaceSim.ACTIVE: return false
	if not manual_control(): return false
	if sim.paused: return send_command("pause")
	return true

func pause() -> bool:
	if sim.phase not in RaceSim.ACTIVE: return false
	return send_command("pause") if not sim.paused else true

func set_speed(value: int) -> bool:
	return send_command("speed", {"value": value})

func stage() -> String:
	match sim.phase:
		"briefing": return "Start practice" if sim.practice_state.status == "available" else "Start qualifying"
		"practice": return "End practice" if not sim.practice_state.closed else "Returning to garage"
		"practice_results": return "Start qualifying"
		"qualifying": return "End qualifying" if not sim.qual_closed else "Finishing laps"
		"qualifying_results", "race_preparation": return "Start formation"
		"formation": return "Formation lap"
		"grid_ready": return "Start race"
		"lights": return "Starting race"
		"results": return "New weekend"
	return ""

func advance_stage() -> bool:
	message = ""
	match sim.phase:
		"briefing":
			if not manual_control(): return false
			return send_command("practice_start" if sim.practice_state.status == "available" else "qualify")
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
			if sim.phase == "qualifying_results" and not send_command("prepare_race"): return false
			# Hidden preparation uses real, available sets and observed surface water.
			# It does not create stock, repair wear, or grant a pace/fuel bonus.
			for car in sim.cars:
				if not car.player: continue
				var item = replacement(car.id, false)
				if item.is_empty(): message = car.short + ": no usable starting tyres."; return false
				if not send_command("select_set", {"id": car.id, "set_id": item.id}): return false
			return send_command("formation")
		"grid_ready": return send_command("lights")
	return false

func replacement(id: int, exclude_mounted: bool) -> Dictionary:
	var car = sim.cars[id]
	var recommended = sim.recommended_compound()
	var compounds: Array = [recommended]
	if recommended == "M":
		if sim.phase == "qualifying": compounds = ["S", "M", "H"]
		elif sim.phase == "practice": compounds = ["M", "H", "S"]
		else: compounds = ["H", "M", "S"] if sim.laps - maxf(0, car.distance / sim.track.length) > 15 else ["M", "H", "S"]
	else: compounds.append("I" if recommended == "W" else "W")
	for compound in compounds:
		var fitted = TyreInventory.find(car, car.set_id)
		if sim.phase == "practice" and not exclude_mounted and fitted.compound == compound and fitted.life >= 40 and WheelTyres.usable(fitted): return fitted
		var item = TyreInventory.choose(car, compound, exclude_mounted)
		if not item.is_empty(): return item
	return {}

func practice_plan(id: int) -> Dictionary:
	var item = replacement(id, false)
	return {"objective": "tyre_life", "baseline": "current", "laps": 2, "set_id": item.get("id", ""), "manual_modes": true}

func send_reason(id: int) -> String:
	if not owned(id): return "Select one of your drivers."
	var car = sim.cars[id]
	if car.dnf or car.finished: return "This car is no longer running."
	if sim.phase not in ["practice", "qualifying"]: return "Send out is available in practice and qualifying."
	if car.route != "garage": return "Wait for the car to return to the garage."
	if sim.phase == "practice": return sim.run_preview(id, practice_plan(id)).reason
	if sim.qual_closed: return "Qualifying has ended."
	if replacement(id, false).is_empty(): return "No suitable usable tyre set remains."
	if not RaceForecaster.qualifying_release(sim, car).can_start_hotlap: return "Not enough time to start a flying lap."
	return ""

func send_out(id: int) -> bool:
	message = send_reason(id)
	if not message.is_empty(): return false
	if sim.phase == "practice":
		var plan = practice_plan(id); var preview = sim.run_preview(id, plan)
		if not send_command("practice_run", {"id": id, "plan": plan, "revision": preview.revision, "key": preview.key, "time": preview.time}): return false
	else:
		var item = replacement(id, false)
		if not send_command("select_set", {"id": id, "set_id": item.id}): return false
		if not send_command("send", {"id": id}): return false
	message = sim.cars[id].short + " · sent out" + ("; press Play to move." if sim.paused else ".")
	return true

func box_reason(id: int) -> String:
	if not owned(id): return "Select one of your drivers."
	var car = sim.cars[id]
	if car.dnf or car.finished: return "This car is no longer running."
	if sim.phase not in ["practice", "qualifying", "race"]: return "Wait for a running session."
	if car.route != "track": return "The car must be on track."
	if sim.phase in ["practice", "qualifying"]:
		if car.qual_state == "inlap": return "Already returning to the garage."
		return ""
	if car.pit_order: return "Pit stop already requested."
	var gate = RaceForecaster.reachable_gate(sim, car)
	if gate.distance >= sim.laps * sim.track.length: return "No safe pit entry remains before the finish."
	var current_lap = int(floor(maxf(0, car.distance) / sim.track.length)) + 1
	if gate.lap > current_lap: return "Too late for this lap's pit entry. Available next lap."
	if replacement(id, true).is_empty(): return "No suitable usable replacement tyres remain."
	return ""

func box(id: int) -> bool:
	message = box_reason(id)
	if not message.is_empty(): return false
	var action = "practice_recall" if sim.phase == "practice" else "recall"
	var payload = {"id": id}
	if sim.phase == "race":
		action = "pit"; payload.set_id = replacement(id, true).id
		payload.expected_gate = RaceForecaster.reachable_gate(sim, sim.cars[id]).distance
		payload.forecast_key = RaceForecaster.material_key(sim, id, sim.policy(id).revision)
		payload.forecast_time = sim.total_time
	if not send_command(action, payload): return false
	message = sim.cars[id].short + (" · box this lap." if sim.phase == "race" else " · returning; unfinished timed lap abandoned.")
	return true

func mode_reason(id: int) -> String:
	if not owned(id): return "Select one of your drivers."
	if sim.cars[id].dnf or sim.cars[id].finished: return "This car is no longer running."
	if sim.phase in ["formation", "grid_ready", "lights", "results", "practice_results", "qualifying_results"]: return "Available in the garage or a running session."
	return ""

func mode(id: int, channel: String, value: int) -> bool:
	message = mode_reason(id)
	if not message.is_empty(): return false
	if channel not in ["pace", "engine"]: message = "Unknown driving control."; return false
	if not send_command(channel, {"id": id, "value": value}): return false
	message = sim.cars[id].short + " · " + (["Calm", "Normal pace", "Push"][value] if channel == "pace" else ["Engine: Save", "Engine: Standard", "Engine: Power"][value])
	return true

func selected_driver() -> int:
	return sim.selected_id if owned(sim.selected_id) else 3

func select_driver(id: int) -> bool:
	# Selection is presentation intent, not a sporting command. No RNG, time or
	# resource changes; the compatibility checkpoint still stores selected_id.
	if not owned(id):
		return false
	sim.selected_id = id
	return true

func current_phase() -> String:
	return sim.phase

func is_paused() -> bool:
	return sim.paused

func toggle_pace(id: int, requested: int) -> bool:
	if not owned(id) or requested not in [0, 2]:
		return false
	return mode(id, "pace", 1 if sim.cars[id].pace == requested else requested)
