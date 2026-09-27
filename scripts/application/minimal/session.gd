class_name MinimalRaceSession
extends RefCounted
## Composition boundary for the minimal UI: commands, observations and scheduling
## are separate collaborators. The view has no mutable aggregate reference.
var controls = MinimalRaceControls.new()
var query: MinimalWeekendQuery
var visual_source: RaceVisualPort
var runner: RaceSessionRunner

func _init(simulation: RaceSim) -> void:
	controls.configure(simulation)
	query = MinimalWeekendQuery.new(simulation)
	visual_source = RaceVisualSource.new(simulation)
	runner = RaceSessionRunner.new(simulation)

func selected_driver() -> int:
	return controls.selected_driver()
