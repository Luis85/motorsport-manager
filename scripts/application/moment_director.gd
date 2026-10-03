class_name RaceMomentDirector
extends RefCounted
## Opt-in, bounded time control over real fixed steps. Never fabricates a race event.
## Runtime presentation state only; actual pause/speed commands use the recorded boundary.
signal moment_reached(moment: Dictionary)
signal state_changed
const WATCH_SPEED = 8
const HISTORY_LIMIT = 24
const QUIET_LAPS = 3
var history_dropped = 0
var model: RaceSim:
	get:
		return _source.get_ref() if _source != null else null
	set(value):
		_source = weakref(value) if value != null else null
var armed = false
var prior_speed = 1
var internal_command = false
var initial: Dictionary = {}
var started_at = 0.0
var target_distance = 0.0
var horizon = 0.0
var watched_id = 3
var history: Array[Dictionary] = []
var last_moment: Dictionary = {}
var observed_steps = 0

var _source: WeakRef


func configure(value: RaceSim) -> void:
	detach()
	model = value
	watched_id = model.player_ids()[0]
	model.fixed_step_completed.connect(_after_step)
	model.input_accepted.connect(_input_accepted)


func detach() -> void:
	if is_instance_valid(model):
		if model.fixed_step_completed.is_connected(_after_step):
			model.fixed_step_completed.disconnect(_after_step)
		if model.input_accepted.is_connected(_input_accepted):
			model.input_accepted.disconnect(_input_accepted)
	armed = false
	model = null


func start(id: int) -> bool:
	if model == null or id not in model.player_ids() or model.phase not in RaceSim.ACTIVE:
		return false
	if armed:
		return false
	watched_id = id
	if model.cars[id].dnf or model.cars[id].finished:
		watched_id = model.player_ids()[1] if id == model.player_ids()[0] else model.player_ids()[0]
	prior_speed = model.speed
	initial = facts()
	started_at = model.total_time
	target_distance = maxf(0, model.cars[watched_id].distance) + model.track.length * QUIET_LAPS
	horizon = clampf(model.track.estimate * 3.5, 90.0, 180.0)
	internal_command = true
	model.command("speed", {"value": WATCH_SPEED})
	if model.paused:
		model.command("pause")
	internal_command = false
	armed = true
	state_changed.emit()
	return true


func stop(
	title: String = "Paused by you",
	detail: String = "Time is yours again. No car orders were changed.",
	id: int = -1
) -> void:
	if model == null:
		return
	var restore = armed
	armed = false
	internal_command = true
	if model.phase in RaceSim.ACTIVE and not model.paused:
		model.command("pause")
	if restore and model.speed != prior_speed:
		model.command("speed", {"value": prior_speed})
	internal_command = false
	last_moment = {
		"title": title,
		"detail": detail,
		"driver_id": id,
		"time": model.total_time,
		"phase": model.phase,
		"lap": int(model.cars[watched_id].completed) + 1
	}
	history.append(last_moment.duplicate(true))
	if history.size() > HISTORY_LIMIT:
		history.pop_front()
		history_dropped += 1
	state_changed.emit()
	moment_reached.emit(last_moment)


func _input_accepted(action: String, _payload: Dictionary, _context: Dictionary) -> void:
	if not armed or internal_command:
		return
	if action == "pause":
		# Manual pause wins; return from the temporary 8x watch speed once.
		armed = false
		internal_command = true
		if model.speed != prior_speed:
			model.command("speed", {"value": prior_speed})
		internal_command = false
		state_changed.emit()
	elif action == "speed":
		# Never overwrite a speed explicitly chosen by the player.
		armed = false
		state_changed.emit()


func facts() -> Dictionary:
	var result = {
		"phase": model.phase,
		"flag": model.flag,
		"water": water_band(model.average(model.water)),
		"drivers": {}
	}
	for id in model.player_ids():
		var c = model.cars[id]
		var policy = model.policy(id)
		var window = ""
		for stop_window in model.active_plan(id).get("stops", []):
			if (
				int(c.completed) + 1 >= int(stop_window.from_lap)
				and int(c.completed) + 1 <= int(stop_window.to_lap)
			):
				window = "%s:%d:%d" % [stop_window.set_id, stop_window.from_lap, stop_window.to_lap]
				break
		var overrides: Dictionary = {}
		for channel in policy.overrides:
			overrides[channel] = str(policy.overrides[channel].get("id", ""))
		var tactic = (
			TacticalDuels.current(model, id) if model.duel_state.get("enabled", false) else {}
		)
		result.drivers[id] = {
			"dnf": c.dnf,
			"finished": c.finished,
			"route": c.route,
			"pit_stage": c.pit_stage if c.route == "pit" else "",
			"stops": c.pit_stops,
			"tyre": tyre_band(c.tyre),
			"usable": WheelTyres.usable(TyreInventory.find(c, c.set_id)),
			"fuel": RaceForecaster.fuel_margin(model, c) < 0.0,
			"window": window,
			"overrides": overrides,
			"tactic": tactic.get("status", ""),
			"qual_runs": c.qual_history.size()
		}
	return result


func water_band(value: float) -> int:
	var thresholds: Dictionary = model.tuning.balance.presentation
	return (
		2
		if value >= thresholds.moment_water_high
		else (1 if value >= thresholds.moment_water_raised else 0)
	)


func tyre_band(value: float) -> int:
	var thresholds: Dictionary = model.tuning.balance.presentation
	return (
		2
		if value <= thresholds.moment_tread_critical_percent
		else (1 if value <= thresholds.moment_tread_low_percent else 0)
	)


func _after_step() -> void:
	if not armed:
		return
	observed_steps += 1
	var current = facts()
	if current.phase != initial.phase:
		stop(
			"Session changed",
			model.phase.replace("_", " ").capitalize() + ". Approve the next stage when ready."
		)
		return
	if _safety_changed(current):
		return
	if current.flag != initial.flag:
		stop(
			"Race control: " + str(current.flag).to_upper(),
			"The observed flag changed. Reconsider your timing; no pit order was " + "issued."
		)
		return
	if current.water != initial.water:
		stop(
			"Track conditions changed",
			(
				(
					"Observed average water crossed a %.0f%% or %.0f%% band. These are "
					+ "check-in thresholds, not a tyre recommendation or forecast."
				)
				% [
					model.tuning.balance.presentation.moment_water_raised * 100,
					model.tuning.balance.presentation.moment_water_high * 100
				]
			)
		)
		return
	if _progress_changed(current):
		return
	if (
		model.cars[watched_id].distance >= target_distance
		or model.total_time - started_at >= horizon
	):
		stop(
			"Your next check-in",
			(
				"No new watched threshold took priority. Keep your orders, compare a "
				+ "plan, or watch another segment."
			),
			watched_id
		)


func _safety_changed(current: Dictionary) -> bool:
	for id in model.player_ids():
		var was: Dictionary = initial.drivers[id]
		var now: Dictionary = current.drivers[id]
		var name: String = model.cars[id].short
		if now.dnf and not was.dnf:
			stop(
				name + " has retired",
				model.cars[id].retire_reason + ". Review the other car before continuing.",
				id
			)
			return true
		if now.finished and not was.finished:
			stop(
				name + " crossed the finish",
				"Recorded finish. Final classification remains authoritative.",
				id
			)
			return true
		if not now.usable and was.usable:
			stop(
				name + " tyre set is damaged",
				(
					"A fitted wheel is no longer usable. Inspect the tyre set and recovery "
					+ "options before continuing."
				),
				id
			)
			return true
		if now.fuel and not was.fuel and model.phase == "race":
			stop(
				name + " fuel margin turned negative",
				(
					"The current-mode projection no longer reaches the finish. A saving "
					+ "call trades power for fuel."
				),
				id
			)
			return true
		if int(now.tyre) > int(was.tyre):
			stop(
				name + " tyres need a decision",
				(
					"Fitted tread crossed "
					+ (
						"%.0f%%"
						% (
							model.tuning.balance.presentation.moment_tread_critical_percent
							if now.tyre == 2
							else model.tuning.balance.presentation.moment_tread_low_percent
						)
					)
					+ ". Inspect the limiting wheel and compare stopping with staying out."
				),
				id
			)
			return true
	return false


func _progress_changed(current: Dictionary) -> bool:
	for id in model.player_ids():
		var was: Dictionary = initial.drivers[id]
		var now: Dictionary = current.drivers[id]
		var name: String = model.cars[id].short
		if _pit_progress(id, was, now, name) or _order_progress(id, was, now, name):
			return true
	return false


func _pit_progress(id: int, was: Dictionary, now: Dictionary, name: String) -> bool:
	if was.route == "pit" and now.route == "track":
		stop(
			name + " rejoined the race",
			(
				"The physical pit visit has ended. Compare the actual rejoin with the "
				+ "earlier estimate."
			),
			id
		)
		return true
	if now.route == "pit" and (was.route != "pit" or now.pit_stage != was.pit_stage):
		stop(
			name + " · " + str(now.pit_stage).capitalize(),
			(
				"Actual pit-lane progress. An entered stop cannot be undone; watch "
				+ "queue, service and exit."
			),
			id
		)
		return true
	if not now.window.is_empty() and now.window != was.window and not model.cars[id].pit_order:
		stop(
			name + " pit window opened",
			"An approved window is now due. Check the pit owner before making a " + "manual call.",
			id
		)
		return true
	return false


func _order_progress(id: int, was: Dictionary, now: Dictionary, name: String) -> bool:
	if now.overrides != was.overrides and not was.overrides.is_empty():
		stop(
			name + " radio instruction changed",
			(
				"A bounded instruction ended or was replaced. Inspect the recorded "
				+ "handback; no benefit is assumed."
			),
			id
		)
		return true
	if now.tactic != was.tactic and not was.tactic.is_empty():
		stop(
			name + " tactic changed",
			(
				"Tactical status: "
				+ str(now.tactic).replace("_", " ")
				+ ". Read the evidence before judging the result."
			),
			id
		)
		return true
	if now.qual_runs > was.qual_runs:
		stop(
			name + " flying lap recorded",
			"Check validity, time and remaining tyre stock before sending another run.",
			id
		)
		return true
	return false
