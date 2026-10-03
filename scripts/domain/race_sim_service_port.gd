extends "res://scripts/domain/race_sim_state_port.gd"
## Pit-service and mechanic fixed-step contract over the same aggregate state.


func service_random_value() -> float:
	return 0.0


func begin_service(_c: RaceCar) -> void:
	pass


func complete_service(_c: RaceCar) -> void:
	pass


func pit_exit_message(_c: RaceCar) -> String:
	return ""


func record_stint(_c: RaceCar) -> void:
	pass


func update_surface() -> void:
	pass


func update_flags() -> void:
	pass


func engineer(_c: RaceCar) -> void:
	pass
