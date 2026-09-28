class_name RaceCommands
extends RefCounted
## Explicit application command boundary; never returned from a read-only query.
var _source: WeakRef
var last_error: String = ""

func _init(simulation: RaceSim) -> void:
	_source = weakref(simulation)

func execute(action: String, payload: Dictionary = {}) -> bool:
	var source: RaceSim = _source.get_ref()
	if source == null:
		last_error = "This weekend is no longer available."
		return false
	var accepted = source.command(action, payload)
	last_error = source.last_error
	return accepted

func select_driver(id: int) -> bool:
	var source: RaceSim = _source.get_ref()
	if source == null or id < 0 or id >= source.cars.size():
		return false
	# Compatibility selection is recorded in old snapshots but has no sporting effect.
	# Car commands still carry their own explicit target and revalidate at execution.
	source.selected_id = id
	return true
