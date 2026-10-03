class_name RaceSessionRunner
extends RefCounted
## Application-owned live session. Rendering, visibility and UI refresh never drive time.
## Tests/headless tools may disable automatic scheduling and supply elapsed time explicitly.
signal phase_changed(phase: String)
var automatic = true
var persistence_error = ""
var _simulation: RaceSim
var _last_phase = ""


func _init(simulation: RaceSim) -> void:
	_simulation = simulation
	# A newly owned session must publish its initial phase once so its own
	# continuation is saved even when it starts paused (notably a sandbox).


func advance(elapsed_seconds: float) -> int:
	var count = RaceStepClock.advance(_simulation, elapsed_seconds)
	observe_phase()
	return count


func observe_phase() -> void:
	if _last_phase == _simulation.phase:
		return
	_last_phase = _simulation.phase
	phase_changed.emit(_last_phase)
