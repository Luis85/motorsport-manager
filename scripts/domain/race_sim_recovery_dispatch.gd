extends "res://scripts/domain/race_sim_strategy_dispatch.gd"
## Stable reliability, recovery and pit-service dispatch.


func enhanced() -> bool:
	return mechanics.invoke("enhanced", [])


func reliability(id: int) -> Dictionary:
	return mechanics.invoke("reliability", [id])


func recovery_advice(id: int) -> Dictionary:
	return mechanics.invoke("recovery_advice", [id])


func recovery_stale(advice: Dictionary) -> bool:
	return mechanics.invoke("recovery_stale", [advice])


func forecast_parameters(_driver_id: int) -> Dictionary:
	return mechanics.invoke("forecast_parameters", [_driver_id])


func log_recovery_command(action: String, payload: Dictionary, reason: String) -> void:
	mechanics.invoke("log_recovery_command", [action, payload, reason])


func issue_repair(c: RaceCar, manual: bool, reason: String) -> void:
	mechanics.invoke("issue_repair", [c, manual, reason])


func wear_car(
	c: RaceCar, distance: float, cell: int, effects: Dictionary = {}, local: Dictionary = {}
) -> void:
	mechanics.invoke("wear_car", [c, distance, cell, effects, local])


func observe_reliability(c: RaceCar) -> void:
	mechanics.invoke("observe_reliability", [c])


func service_random_value() -> float:
	return mechanics.invoke("service_random_value", [])


func begin_service(c: RaceCar) -> void:
	mechanics.invoke("begin_service", [c])


func complete_service(c: RaceCar) -> void:
	mechanics.invoke("complete_service", [c])


func update_pit(c: RaceCar, old: Array = []) -> void:
	mechanics.invoke("update_pit", [c, old])


func pit_exit_message(c: RaceCar) -> String:
	return mechanics.invoke("pit_exit_message", [c])


func pit_status(c: RaceCar) -> String:
	return mechanics.invoke("pit_status", [c])


func update_flags() -> void:
	mechanics.invoke("update_flags", [])


func neutral(c: RaceCar) -> bool:
	return mechanics.invoke("neutral", [c])


func neutral_speed_limit(_c: RaceCar, _sample: Dictionary) -> float:
	return mechanics.invoke("neutral_speed_limit", [_c, _sample])


func constrain_progress(_c: RaceCar, next: float, _old: Array, _nearest: int) -> float:
	return mechanics.invoke("constrain_progress", [_c, next, _old, _nearest])


func update_yield(c: RaceCar, old: Array) -> float:
	return mechanics.invoke("update_yield", [c, old])
