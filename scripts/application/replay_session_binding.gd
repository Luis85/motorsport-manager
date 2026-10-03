class_name ReplaySessionBinding
extends RefCounted
## Application owns reconstruction and sandbox creation; presentation receives view.
var playback: ReplayPlayback
var view: ReplayViewSession
var _player: RaceReplay


func _init(player: RaceReplay) -> void:
	_player = player
	playback = ReplayPlayback.new()
	playback.player = player
	view = ReplayViewSession.new(player, playback)


func branch_session() -> Dictionary:
	var candidate = _player.branch()
	if candidate == null:
		return {}
	var parent = _player.lineage()
	if _player.record.parent.has("scenario"):
		parent.scenario = _player.record.parent.scenario.duplicate(true)
	var recording = RaceRecord.new()
	recording.attach(candidate, "sandbox", parent)
	return {"session": RaceViewSession.new(candidate), "record": recording}
