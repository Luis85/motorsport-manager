class_name DeveloperWeekendSession
extends RefCounted
## Tool-owned lifetime binding. Commands and queries share one authoritative weekend.
const EVENT_LIMIT = 1024
var closed = false
var _simulation: PracticeRaceSim
var _runner: RaceSessionRunner
var _commands: RaceCommands
var _view: RaceViewQuery
var _record: RaceRecord
var _events: Array = []
var _sequence = 0
var _dropped = 0
var _completed = 0


func _init(simulation: PracticeRaceSim, record: RaceRecord = null) -> void:
	_simulation = simulation
	_runner = RaceSessionRunner.new(simulation)
	_runner.automatic = false
	# Establish the phase baseline without replaying historical phase observations.
	_runner.observe_phase()
	_commands = RaceCommands.new(simulation)
	_view = RaceViewQuery.new(simulation)
	_record = record if record != null else RaceRecord.new()
	if record == null:
		_record.attach(simulation)
	simulation.event_posted.connect(_domain_event)
	simulation.input_accepted.connect(_accepted_input)
	simulation.fixed_step_completed.connect(_fixed_step)
	_runner.phase_changed.connect(_phase_changed)


## Detached current scheduling state; reads never advance time.
func state() -> Dictionary:
	return {
		"phase": _simulation.phase,
		"paused": _simulation.paused,
		"speed": _simulation.speed,
		"clock": _simulation.clock,
		"total_time": _simulation.total_time,
		"accumulator": _simulation.accumulator,
		"step_seconds": RaceSim.STEP,
		"player_ids": _simulation.player_ids()
	}


## Apply the production application command boundary and observe resulting phase changes.
func command(action: String, payload: Dictionary) -> Dictionary:
	if not _commands.execute(action, payload):
		return DeveloperToolResult.failure("DOMAIN_REJECTED", _commands.last_error)
	_runner.observe_phase()
	return DeveloperToolResult.success({"accepted": true, "state": state()})


## Explicit query allowlist returning detached JSON values from existing read models.
func query(view: String, parameters: Dictionary) -> Dictionary:
	return DeveloperWeekendQueries.capture(_simulation, _view, view, parameters)


## Exact fixed ticks, independent of playback speed and the elapsed-time accumulator.
func step_ticks(count: int) -> Dictionary:
	var before = _simulation.phase
	var time_before = _simulation.total_time
	var completed_before = _completed
	for _index in range(count):
		if _simulation.paused or _simulation.phase not in RaceSim.ACTIVE:
			break
		var previous = _completed
		_simulation.step()
		if _completed == previous:
			break
	_runner.observe_phase()
	var completed = _completed - completed_before
	return DeveloperToolResult.success(
		{
			"requested": count,
			"completed": completed,
			"phase_before": before,
			"phase_after": _simulation.phase,
			"simulated_seconds": _simulation.total_time - time_before,
			"stop_reason": _stop_reason(completed == count),
			"state": state()
		}
	)


## Caller-supplied elapsed seconds retain production speed, clamping and accumulator semantics.
func advance_elapsed(seconds: float) -> Dictionary:
	var before = _simulation.phase
	var time_before = _simulation.total_time
	var count = _runner.advance(seconds)
	return DeveloperToolResult.success(
		{
			"requested_seconds": seconds,
			"completed": count,
			"phase_before": before,
			"phase_after": _simulation.phase,
			"simulated_seconds": _simulation.total_time - time_before,
			"stop_reason": _stop_reason(count > 0),
			"state": state()
		}
	)


## Production checkpoint and integrity fingerprint; observer buffers are excluded.
func snapshot() -> Dictionary:
	var value = _simulation.snapshot()
	return DeveloperToolResult.success(
		{"snapshot": value, "fingerprint": RaceStateValue.fingerprint(value)}
	)


## Production recording envelope owned by this session, with accepted commands only.
func recording() -> Dictionary:
	return DeveloperToolResult.success(_record.seal())


## Drain transport observations once; never erase sporting event or evidence history.
func events() -> Dictionary:
	var result = {"events": _events, "next_sequence": _sequence + 1, "dropped": _dropped}
	var detached = DeveloperToolResult.success(result)
	_events = []
	_dropped = 0
	return detached


## Native application-only bridge used by campaign settlement, never a transport result.
func owned_record() -> RaceRecord:
	return _record if not closed else null


## Terminal, idempotent cleanup. Release observers before releasing the authoritative source.
func close() -> void:
	if closed:
		return
	closed = true
	_record.detach()
	_simulation.event_posted.disconnect(_domain_event)
	_simulation.input_accepted.disconnect(_accepted_input)
	_simulation.fixed_step_completed.disconnect(_fixed_step)
	_runner.phase_changed.disconnect(_phase_changed)
	_events.clear()
	_record = null
	_view = null
	_commands = null
	_runner = null
	_simulation = null


func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE and _record != null:
		# Engine connections to this dying target are removed automatically.
		# Avoid calling a method on self after Godot has begun finalization.
		_record.detach()


func _stop_reason(completed: bool) -> String:
	if completed:
		return "completed"
	if _simulation.paused:
		return "paused"
	if _simulation.phase not in RaceSim.ACTIVE:
		return "inactive"
	return "no_tick"


func _domain_event(entry: Dictionary) -> void:
	_observe("event", entry)


func _accepted_input(action: String, payload: Dictionary, context: Dictionary) -> void:
	_observe("input", {"action": action, "payload": payload, "context": context})


func _phase_changed(phase: String) -> void:
	_observe("phase", {"phase": phase, "time": _simulation.total_time})


func _fixed_step() -> void:
	_completed += 1


func _observe(kind: String, value: Dictionary) -> void:
	_sequence += 1
	_events.append({"sequence": _sequence, "kind": kind, "value": value.duplicate(true)})
	if _events.size() > EVENT_LIMIT:
		_events.pop_front()
		_dropped += 1
