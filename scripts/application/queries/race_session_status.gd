class_name RaceSessionStatus
extends RefCounted
## Read-only persistence status. A view cannot advance or retain the live runner.
var persistence_error: String:
	get:
		var runner = _runner.get_ref()
		return runner.persistence_error if runner != null else ""
var _runner: WeakRef


func _init(runner: RaceSessionRunner) -> void:
	_runner = weakref(runner)


func available() -> bool:
	return _runner.get_ref() != null
