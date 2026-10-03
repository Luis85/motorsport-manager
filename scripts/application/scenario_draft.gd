class_name ScenarioDraft
extends RefCounted
## Authoring owns a frozen checkpoint, not the live aggregate or replay cursor.
var _snapshot: Dictionary
var _lineage: Dictionary


func _init(simulation: RaceSim, lineage: Dictionary) -> void:
	_snapshot = simulation.snapshot()
	_lineage = lineage.duplicate(true)


func build(brief: Dictionary) -> Dictionary:
	if not ScenarioBrief.validate(brief).is_empty():
		return {}
	var simulation = PracticeRaceSim.restore_practice(_snapshot)
	return ReplayScenario.build(simulation, _lineage, brief) if simulation else {}
