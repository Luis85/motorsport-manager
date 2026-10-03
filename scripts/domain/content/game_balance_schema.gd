class_name GameBalanceSchema
extends RefCounted
## Versioned balance inputs shared by simulation, estimates and presentation.
const MODEL = "game-balance-v1"
static var _legacy_values: Dictionary = RaceStateValue.read_only(defaults())


static func legacy_values() -> Dictionary:
	return _legacy_values


static func defaults() -> Dictionary:
	var result = {"model": MODEL}
	result.merge(RacePhysicsBalance.defaults())
	result.merge(RacePlanningBalance.defaults())
	result.merge(RacePresentationBalance.defaults())
	return result


static func fields() -> Dictionary:
	var result = {"model": {"enum": [MODEL]}}
	result.merge(RacePhysicsBalance.fields())
	result.merge(RacePlanningBalance.fields())
	result.merge(RacePresentationBalance.fields())
	return result


static func semantic_errors(record: Dictionary) -> Array:
	var errors = RacePhysicsBalance.semantic_errors(record)
	errors.append_array(RacePlanningBalance.semantic_errors(record))
	errors.append_array(RacePresentationBalance.semantic_errors(record))
	return errors
