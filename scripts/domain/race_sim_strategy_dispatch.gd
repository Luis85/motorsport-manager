extends "res://scripts/domain/race_sim_operations.gd"
## Fixed-step, seeded simulation. No UI, wall-clock or scene-tree dependencies.
var mechanics: RaceMechanics
## Stable strategy dispatch over the single aggregate and dispatcher.


func policy(id: int) -> Dictionary:
	return mechanics.invoke("policy", [id])


func active_plan(id: int) -> Dictionary:
	return mechanics.invoke("active_plan", [id])


func forecast(id: int, draft: Dictionary = {}) -> Dictionary:
	return mechanics.invoke("forecast", [id, draft])


func sync_ownership(c: RaceCar) -> void:
	mechanics.invoke("sync_ownership", [c])


func policy_command(action: String, payload: Dictionary) -> bool:
	return mechanics.invoke("policy_command", [action, payload])


func manage_resources(c: RaceCar, only_channel: String = "") -> void:
	mechanics.invoke("manage_resources", [c, only_channel])


func engineer(c: RaceCar) -> void:
	mechanics.invoke("engineer", [c])


func contextual_rival(_car: RaceCar) -> bool:
	return mechanics.invoke("contextual_rival", [_car])


func review_rival_style(_car: RaceCar, _snapshot: Dictionary, _comparison: Dictionary) -> bool:
	return mechanics.invoke("review_rival_style", [_car, _snapshot, _comparison])


func order_stop(c: RaceCar, item: Dictionary, reason: String) -> void:
	mechanics.invoke("order_stop", [c, item, reason])


func block_plan(c: RaceCar, reason: String) -> void:
	mechanics.invoke("block_plan", [c, reason])


func leave_garage(c: RaceCar) -> void:
	mechanics.invoke("leave_garage", [c])


func record_stint(c: RaceCar) -> void:
	mechanics.invoke("record_stint", [c])


func step() -> void:
	mechanics.invoke("step", [])


func snapshot() -> Dictionary:
	return mechanics.invoke("snapshot", [])


func traffic_instruction(
	c: RaceCar,
	old: Array,
	nearest: int,
	gap: float,
	desired: float,
	lane: float,
	sample: Dictionary,
	local: Dictionary
) -> Dictionary:
	return mechanics.invoke(
		"traffic_instruction", [c, old, nearest, gap, desired, lane, sample, local]
	)


func record_track_pass(c: RaceCar, other: RaceCar) -> void:
	mechanics.invoke("record_track_pass", [c, other])


func move_car(c: RaceCar, old: Array) -> void:
	mechanics.invoke("move_car", [c, old])


func observe_warnings(c: RaceCar) -> void:
	mechanics.invoke("observe_warnings", [c])
