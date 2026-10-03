extends Node
## Supplies elapsed time and owns race/replay lifecycle integration.
var editor_session: TrackEditorSession
var checkpoint_path = "user://weekend.json"
var sandbox_path = "user://sandbox.json"
var session_runner: RaceSessionRunner
var replay_runner: ReplayPlayback
var _session_record: RaceRecord


func _process(delta: float) -> void:
	if editor_session:
		editor_session.advance_preview(delta)
	if session_runner != null:
		if session_runner.automatic:
			session_runner.advance(delta)
		else:
			session_runner.observe_phase()
	if replay_runner != null:
		replay_runner.advance()


func activate_session(runner: RaceSessionRunner, record: RaceRecord = null) -> void:
	stop_session()
	session_runner = runner
	_session_record = record
	runner.phase_changed.connect(_autosave_session)


func suspend_session() -> Dictionary:
	var suspended = {"runner": session_runner, "record": _session_record}
	stop_session()
	return suspended


func restore_session(suspended: Dictionary) -> void:
	if suspended.get("runner") != null:
		activate_session(suspended.runner, suspended.get("record"))


func stop_session() -> void:
	if session_runner != null and session_runner.phase_changed.is_connected(_autosave_session):
		session_runner.phase_changed.disconnect(_autosave_session)
	session_runner = null
	_session_record = null


func _autosave_session(_phase: String) -> void:
	if session_runner == null or _session_record == null:
		return
	var path = sandbox_path if _session_record.origin == "sandbox" else checkpoint_path
	session_runner.persistence_error = ReplayStorage.save_session(path, _session_record)
