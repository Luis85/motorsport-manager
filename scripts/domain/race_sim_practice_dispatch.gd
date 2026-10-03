extends "res://scripts/domain/race_sim_recovery_dispatch.gd"
## Stable incident and physical practice-lifecycle dispatch.


func incident(c: RaceCar) -> void:
	mechanics.invoke("incident", [c])


func retire(c: RaceCar, reason: String) -> void:
	mechanics.invoke("retire", [c, reason])


func recovery_debrief() -> String:
	return mechanics.invoke("recovery_debrief", [])


func is_run_session() -> bool:
	return mechanics.invoke("is_run_session", [])


func practice_driver(id: int) -> Dictionary:
	return mechanics.invoke("practice_driver", [id])


func run_preview(id: int, plan: Dictionary) -> Dictionary:
	return mechanics.invoke("run_preview", [id, plan])


func _practice_command(action: String, payload: Dictionary) -> bool:
	return mechanics.invoke("_practice_command", [action, payload])


func record_practice(action: String, id: int, evidence: Dictionary) -> void:
	mechanics.invoke("record_practice", [action, id, evidence])


func launch_run(id: int, plan: Dictionary) -> void:
	mechanics.invoke("launch_run", [id, plan])


func close_practice(reason: String) -> void:
	mechanics.invoke("close_practice", [reason])


func reset_run_counters() -> void:
	mechanics.invoke("reset_run_counters", [])


func qualifying_crossings(c: RaceCar, before: float, after: float) -> void:
	mechanics.invoke("qualifying_crossings", [c, before, after])


func _practice_step() -> void:
	mechanics.invoke("_practice_step", [])


func car_advisories(c: RaceCar) -> Array[String]:
	return mechanics.invoke("car_advisories", [c])


func plan_pit_gate(c: RaceCar) -> void:
	mechanics.invoke("plan_pit_gate", [c])
