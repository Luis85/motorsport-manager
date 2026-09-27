class_name ReplayViewSession
extends RefCounted
## Replay application boundary. Its display handle never exposes an authoritative model.
var _player: RaceReplay
var _query: RaceViewQuery
var _query_source: WeakRef
var playback: ReplayPlayback = ReplayPlayback.new()
var record: Dictionary:
	get: return _player.record.duplicate(true)
var sim: RaceViewQuery:
	get:
		if _player.sim == null:
			return null
		if _query_source == null or _query_source.get_ref() != _player.sim:
			_query = RaceViewQuery.new(_player.sim)
			_query_source = weakref(_player.sim)
		return _query
var step_index: int:
	get: return _player.step_index
var start_step: int:
	get: return _player.start_step
var error: String:
	get: return _player.error
var verified: bool:
	get: return _player.verified
var at_snapshot: bool:
	get: return _player.at_snapshot
func _init(replay: RaceReplay) -> void:
	_player = replay
	playback.player = replay
func seek(index: int) -> bool:
	return _player.seek(index)
func branch_session() -> Dictionary:
	var candidate = _player.branch()
	if candidate == null: return {}
	var parent = _player.lineage()
	if _player.record.parent.has("scenario"):
		parent.scenario = _player.record.parent.scenario.duplicate(true)
	var recording = RaceRecord.new()
	recording.attach(candidate, "sandbox", parent)
	return {"session": RaceViewSession.new(candidate), "record": recording}
func authoring() -> ScenarioDraft:
	var candidate = _player.branch()
	return ScenarioDraft.new(candidate, _player.lineage()) if candidate else null
