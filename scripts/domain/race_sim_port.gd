class_name RaceSimPort
extends "res://scripts/domain/race_sim_service_port.gd"


func leave_garage(_c: RaceCar) -> void:
	pass


func update_pit(_c: RaceCar, _old: Array = []) -> void:
	pass


func move_car(_c: RaceCar, _old: Array) -> void:
	pass


func neutral(_c: RaceCar) -> bool:
	return false


func neutral_speed_limit(_c: RaceCar, _sample: Dictionary) -> float:
	return 0.0


func update_yield(_c: RaceCar, _old: Array) -> float:
	return 0.0


func traffic_instruction(
	_c: RaceCar,
	_old: Array,
	_nearest: int,
	_gap: float,
	desired: float,
	lane: float,
	_sample: Dictionary,
	_local: Dictionary
) -> Dictionary:
	return {"desired": desired, "lane": lane, "attempt": false, "block_pass": false}


func constrain_progress(_c: RaceCar, next: float, _old: Array, _nearest: int) -> float:
	return next


func plan_pit_gate(_c: RaceCar) -> void:
	pass


func wear_car(
	_c: RaceCar, _distance: float, _cell: int, _effects: Dictionary = {}, _local: Dictionary = {}
) -> void:
	pass


func qualifying_crossings(_c: RaceCar, _before: float, _after: float) -> void:
	pass


func record_track_pass(_c: RaceCar, _other: RaceCar) -> void:
	pass


func incident(_c: RaceCar) -> void:
	pass


func is_run_session() -> bool:
	return false


func pit_status(_c: RaceCar) -> String:
	return ""


func retire(_c: RaceCar, _reason: String) -> void:
	pass
