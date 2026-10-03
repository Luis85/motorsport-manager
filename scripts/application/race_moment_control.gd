class_name RaceMomentControl
extends RefCounted
## Optional watch commands and detached check-ins. The live aggregate is never exposed.
signal moment_reached(moment: Dictionary)
var armed: bool:
	get:
		return _director.armed
var last_moment: Dictionary:
	get:
		return _director.last_moment.duplicate(true)
var history: Array:
	get:
		return _director.history.duplicate(true)
var history_dropped: int:
	get:
		return _director.history_dropped
var _director: RaceMomentDirector


func _init(simulation: RaceSim) -> void:
	_director = RaceMomentDirector.new()
	_director.configure(simulation)
	_director.moment_reached.connect(_on_moment)


func _on_moment(value: Dictionary) -> void:
	moment_reached.emit(RaceStateValue.read_only(value))


func start(id: int) -> bool:
	return _director.start(id)


func stop(
	title: String = "Paused by you",
	detail: String = "Time is yours again. No car orders were changed.",
	id: int = -1
) -> void:
	_director.stop(title, detail, id)


func detach() -> void:
	_director.detach()


func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE and _director != null:
		_director.detach()
