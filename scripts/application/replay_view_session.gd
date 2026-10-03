class_name ReplayViewSession
extends RefCounted
## Replay application boundary. Its display handle never exposes an authoritative model.
var playing: bool:
	get:
		var playback = _playback.get_ref()
		return playback.playing if playback != null else false
	set(value):
		var playback = _playback.get_ref()
		if playback != null:
			playback.playing = value
var budget: int:
	get:
		var playback = _playback.get_ref()
		return playback.budget if playback != null else 16
	set(value):
		var playback = _playback.get_ref()
		if playback != null:
			playback.budget = clampi(value, 1, 64)
var record: Dictionary:
	get:
		return _player.record.duplicate(true) if _player != null else {}
var sim: RaceViewQuery:
	get:
		if _player == null or _player.sim == null:
			return null
		if _query_source == null or _query_source.get_ref() != _player.sim:
			_query = RaceViewQuery.new(_player.sim)
			_query_source = weakref(_player.sim)
		return _query
var step_index: int:
	get:
		return _player.step_index if _player != null else 0
var start_step: int:
	get:
		return _player.start_step if _player != null else 0
var error: String:
	get:
		return _player.error if _player != null else "Replay unavailable"
var verified: bool:
	get:
		return _player.verified if _player != null else false
var at_snapshot: bool:
	get:
		return _player.at_snapshot if _player != null else false
var _source: WeakRef
var _player: RaceReplay:
	get:
		return _source.get_ref() if _source != null else null
var _query: RaceViewQuery
var _query_source: WeakRef
var _playback: WeakRef


func _init(replay: RaceReplay, playback: ReplayPlayback) -> void:
	_source = weakref(replay)
	_playback = weakref(playback)


func seek(index: int) -> bool:
	return _player.seek(index) if _player != null else false


func authoring() -> ScenarioDraft:
	if _player == null:
		return null
	var candidate = _player.branch()
	return ScenarioDraft.new(candidate, _player.lineage()) if candidate else null
